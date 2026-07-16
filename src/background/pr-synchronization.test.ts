import { describe, expect, test } from "bun:test"
import type { PR, PRData, SeenPRs, SyncState } from "@/types"
import type { TrackerSettings } from "@/lib/tracker-settings"
import { GitHubAuthenticationError } from "./github-pr-source"
import type { PRSynchronizationEffects, PRSynchronizationStore } from "./pr-synchronization"
import { createPRSynchronization } from "./pr-synchronization"

const settings: TrackerSettings = {
  token: "token",
  username: "cevr",
  checkInterval: 15,
  hideInactivePRs: false,
}

function pr(overrides: Partial<PR> = {}): PR {
  return {
    id: 1,
    number: 1,
    title: "Deepen the synchronization module",
    html_url: "https://github.com/acme/tracker/pull/1",
    repository_url: "https://api.github.com/repos/acme/tracker",
    updated_at: "2026-07-16T12:00:00.000Z",
    user: { login: "cevr" },
    ...overrides,
  }
}

function createHarness(initialSeen: SeenPRs = {}) {
  let seen = initialSeen
  let sync: SyncState | undefined = { status: "idle" }
  let committed: PRData | undefined
  const badges: Array<{ total: number; hasUnseen: boolean }> = []
  const events: string[] = []

  const store: PRSynchronizationStore = {
    async read() {
      return { seen: { ...seen }, sync }
    },
    async setSeen(next) {
      seen = next
      events.push("seen")
    },
    async setSync(next) {
      sync = next
      events.push(next.status)
    },
    async commit(prs, nextSeen, nextSync) {
      committed = prs
      seen = nextSeen
      sync = nextSync
      events.push("commit")
    },
  }
  const effects: PRSynchronizationEffects = {
    async syncStateChanged() {
      events.push("sync-event")
    },
    async prsUpdated() {
      events.push("prs-event")
    },
    async updateBadge(summary) {
      badges.push(summary)
      events.push("badge")
    },
  }

  return {
    store,
    effects,
    events,
    badges,
    get seen() {
      return seen
    },
    get sync() {
      return sync
    },
    get committed() {
      return committed
    },
  }
}

describe("PR Synchronization", () => {
  test("serializes refresh and mark-seen mutations without losing the seen timestamp", async () => {
    const harness = createHarness()
    let releaseFirst: (() => void) | undefined
    let fetchCount = 0
    let signalFetchStarted: (() => void) | undefined
    const fetchStarted = new Promise<void>((resolve) => {
      signalFetchStarted = resolve
    })
    const synchronization = createPRSynchronization({
      source: {
        async fetch() {
          fetchCount++
          signalFetchStarted?.()
          if (fetchCount === 1) {
            await new Promise<void>((resolve) => {
              releaseFirst = resolve
            })
          }
          return { created: [pr()], assigned: [] }
        },
      },
      store: harness.store,
      effects: harness.effects,
      settings: { read: async () => settings, clearAccount: async () => undefined },
      now: () => new Date("2026-07-16T13:00:00.000Z"),
    })

    const refresh = synchronization.refresh()
    await fetchStarted
    const markSeen = synchronization.markSeen(1)

    expect(fetchCount).toBe(1)
    releaseFirst?.()
    await Promise.all([refresh, markSeen])

    expect(fetchCount).toBe(2)
    expect(harness.seen["1"]).toBe("2026-07-16T13:00:00.000Z")
    expect(harness.events.indexOf("seen")).toBeGreaterThan(harness.events.indexOf("commit"))
  })

  test("reconciles self-authored updates through the same attention policy as the UI", async () => {
    const harness = createHarness({ "1": "2026-07-16T10:00:00.000Z" })
    const synchronization = createPRSynchronization({
      source: {
        fetch: async () => ({
          created: [pr({ lastUpdatedBy: "cevr" })],
          assigned: [],
        }),
      },
      store: harness.store,
      effects: harness.effects,
      settings: { read: async () => settings, clearAccount: async () => undefined },
      now: () => new Date("2026-07-16T13:00:00.000Z"),
    })

    await synchronization.refresh()

    expect(harness.seen["1"]).toBe("2026-07-16T12:00:00.000Z")
    expect(harness.badges).toEqual([{ total: 1, hasUnseen: false }])
    expect(harness.sync).toEqual({ status: "idle", lastSyncedAt: "2026-07-16T13:00:00.000Z" })
  })

  test("invalidates rejected credentials without replacing setup state with a sync error", async () => {
    const harness = createHarness()
    let accountCleared = false
    const synchronization = createPRSynchronization({
      source: {
        fetch: async () => {
          throw new GitHubAuthenticationError()
        },
      },
      store: harness.store,
      effects: harness.effects,
      settings: {
        read: async () => settings,
        clearAccount: async () => {
          accountCleared = true
        },
      },
    })

    await synchronization.refresh()

    expect(accountCleared).toBe(true)
    expect(harness.sync?.status).toBe("syncing")
    expect(harness.committed).toBeUndefined()
    expect(harness.events).not.toContain("prs-event")
  })
})
