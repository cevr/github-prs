import type { PR, PRData, SeenPRs, SyncState } from "@/types"
import type { TrackerSettings } from "@/lib/tracker-settings"
import { isAccountConfigured } from "@/lib/tracker-settings"
import type { PRSource } from "./github-pr-source"
import { GitHubAuthenticationError } from "./github-pr-source"

export interface PRSynchronizationStore {
  read(): Promise<{ seen: SeenPRs; sync?: SyncState }>
  setSeen(seen: SeenPRs): Promise<void>
  setSync(sync: SyncState): Promise<void>
  commit(prs: PRData, seen: SeenPRs, sync: SyncState): Promise<void>
}

export interface PRSynchronizationEffects {
  syncStateChanged(): Promise<void>
  prsUpdated(): Promise<void>
  updateBadge(summary: { total: number; hasUnseen: boolean }): Promise<void>
}

export interface PRSynchronizationSettings {
  read(): Promise<TrackerSettings>
  clearAccount(): Promise<void>
}

export interface PRSynchronization {
  refresh(): Promise<void>
  markSeen(prId: number): Promise<void>
}

interface Dependencies {
  source: PRSource
  store: PRSynchronizationStore
  effects: PRSynchronizationEffects
  settings: PRSynchronizationSettings
  now?: () => Date
}

function uniquePRs(prs: PRData): PR[] {
  const unique = new Map<number, PR>()
  for (const pr of [...prs.created, ...prs.assigned]) unique.set(pr.id, pr)
  return [...unique.values()]
}

function filterInactive(prs: PRData, now: Date): PRData {
  const activeSince = new Date(now)
  activeSince.setMonth(activeSince.getMonth() - 1)
  const active = (pr: PR) => new Date(pr.updated_at) >= activeSince
  return { created: prs.created.filter(active), assigned: prs.assigned.filter(active) }
}

function reconcileSeen(prs: readonly PR[], seen: SeenPRs, username: string): SeenPRs {
  const trackedIds = new Set(prs.map((pr) => pr.id.toString()))
  const reconciled = Object.fromEntries(
    Object.entries(seen).filter(([prId]) => trackedIds.has(prId)),
  )

  for (const pr of prs) {
    const prId = pr.id.toString()
    const seenAt = reconciled[prId]
    if (pr.lastUpdatedBy === username && (!seenAt || new Date(pr.updated_at) > new Date(seenAt))) {
      reconciled[prId] = pr.updated_at
    }
  }
  return reconciled
}

function hasUnseen(prs: readonly PR[], seen: SeenPRs): boolean {
  return prs.some((pr) => {
    const seenAt = seen[pr.id.toString()]
    return !seenAt || new Date(pr.updated_at) > new Date(seenAt)
  })
}

export function createPRSynchronization({
  source,
  store,
  effects,
  settings,
  now = () => new Date(),
}: Dependencies): PRSynchronization {
  let queue: Promise<void> = Promise.resolve()

  const enqueue = (operation: () => Promise<void>): Promise<void> => {
    const result = queue.then(operation, operation)
    queue = result.catch(() => undefined)
    return result
  }

  const synchronize = async () => {
    const previous = await store.read()
    try {
      const trackerSettings = await settings.read()
      if (!isAccountConfigured(trackerSettings)) return

      await store.setSync({
        status: "syncing",
        lastSyncedAt: previous.sync?.lastSyncedAt,
      })
      await effects.syncStateChanged()

      const fetched = await source.fetch(trackerSettings)
      const tracked = uniquePRs(fetched)
      const visible = trackerSettings.hideInactivePRs ? filterInactive(fetched, now()) : fetched
      const visiblePRs = uniquePRs(visible)
      const seen = reconcileSeen(tracked, previous.seen, trackerSettings.username)
      const sync: SyncState = { status: "idle", lastSyncedAt: now().toISOString() }

      await store.commit(visible, seen, sync)
      await effects.updateBadge({
        total: visible.created.length + visible.assigned.length,
        hasUnseen: hasUnseen(visiblePRs, seen),
      })
      await effects.prsUpdated()
    } catch (error) {
      if (error instanceof GitHubAuthenticationError) {
        await settings.clearAccount()
        return
      }

      console.error("Error checking for updates:", error)
      await store.setSync({
        status: "error",
        lastSyncedAt: previous.sync?.lastSyncedAt,
        message: error instanceof Error ? error.message : "Unable to refresh pull requests",
      })
      await effects.syncStateChanged()
    }
  }

  return {
    refresh: () => enqueue(synchronize),
    markSeen: (prId) =>
      enqueue(async () => {
        const { seen } = await store.read()
        await store.setSeen({ ...seen, [prId]: now().toISOString() })
        await synchronize()
      }),
  }
}
