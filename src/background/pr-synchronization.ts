import { Context, DateTime, Effect, Layer, Result, Semaphore } from "effect"
import { GitHubApiError, GitHubPRSource } from "./github-pr-source"
import type { PR, PRData, SeenPRs, SyncState } from "@/types"
import { isAccountConfigured, TrackerSettingsService } from "@/settings/tracker-settings"
import type { TrackerSettingsStorageError } from "@/settings/tracker-settings"
import { PRSnapshotPublication } from "@/snapshot/pr-snapshot-publication"
import type { PRSnapshotPublicationError } from "@/snapshot/pr-snapshot-publication"

export class PRSynchronization extends Context.Service<
  PRSynchronization,
  {
    readonly refresh: () => Effect.Effect<
      void,
      PRSnapshotPublicationError | TrackerSettingsStorageError
    >
    readonly markSeen: (
      prId: number,
    ) => Effect.Effect<void, PRSnapshotPublicationError | TrackerSettingsStorageError>
  }
>()("@github-prs/PRSynchronization") {}

function uniquePRs(prs: PRData): readonly PR[] {
  const unique = new Map<number, PR>()
  for (const pr of prs.created) unique.set(pr.id, pr)
  for (const pr of prs.assigned) unique.set(pr.id, pr)
  return Array.from(unique.values())
}

function filterInactive(prs: PRData, now: Date): PRData {
  const activeSince = new Date(now)
  activeSince.setMonth(activeSince.getMonth() - 1)
  const active = (pr: PR) => new Date(pr.updated_at) >= activeSince
  return {
    created: prs.created.filter(active),
    assigned: prs.assigned.filter(active),
  }
}

function reconcileSeen(prs: readonly PR[], seen: SeenPRs, username: string): SeenPRs {
  const trackedIds = new Set(prs.map((pr) => pr.id.toString()))
  const reconciled: Record<string, string> = {}
  for (const [prId, seenAt] of Object.entries(seen)) {
    if (trackedIds.has(prId)) reconciled[prId] = seenAt
  }

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

export const PRSynchronizationLive = Layer.effect(
  PRSynchronization,
  Effect.gen(function* () {
    const source = yield* GitHubPRSource
    const publication = yield* PRSnapshotPublication
    const settingsService = yield* TrackerSettingsService
    const semaphore = yield* Semaphore.make(1)

    const synchronize = Effect.fn("PRSynchronization.synchronize")(function* () {
      const previous = yield* publication.read()
      const settings = yield* settingsService.read()
      if (!isAccountConfigured(settings)) return
      const startedAt = yield* DateTime.nowAsDate

      yield* publication.publish({
        kind: "sync-state",
        sync: {
          status: "syncing",
          startedAt: startedAt.toISOString(),
          lastSyncedAt: previous.sync?.lastSyncedAt,
        },
      })

      const fetched = yield* Effect.result(
        source.fetch(settings).pipe(
          Effect.timeoutOrElse({
            duration: "45 seconds",
            orElse: () =>
              Effect.fail(
                new GitHubApiError({
                  operation: "refresh pull requests",
                  message: "GitHub refresh timed out. Try again.",
                }),
              ),
          }),
        ),
      )
      if (Result.isFailure(fetched)) {
        if (fetched.failure._tag === "GitHubAuthenticationError") {
          yield* settingsService.clearAccount()
          return
        }

        yield* Effect.logError(fetched.failure.message)
        yield* publication.publish({
          kind: "sync-state",
          sync: {
            status: "error",
            lastSyncedAt: previous.sync?.lastSyncedAt,
            message: fetched.failure.message,
          },
        })
        return
      }

      const now = yield* DateTime.nowAsDate
      const tracked = uniquePRs(fetched.success)
      let visible = fetched.success
      if (settings.hideInactivePRs) visible = filterInactive(fetched.success, now)
      const visiblePRs = uniquePRs(visible)
      const seen = reconcileSeen(tracked, previous.seen, settings.username)
      const sync: SyncState = { status: "idle", lastSyncedAt: now.toISOString() }

      yield* publication.publish({
        kind: "snapshot",
        prs: visible,
        seen,
        sync,
        attention: {
          total: visible.created.length + visible.assigned.length,
          hasUnseen: hasUnseen(visiblePRs, seen),
        },
      })
    })

    const refresh = Effect.fn("PRSynchronization.refresh")(() =>
      semaphore.withPermit(synchronize()),
    )
    const markSeen = Effect.fn("PRSynchronization.markSeen")((prId: number) =>
      semaphore.withPermit(
        Effect.gen(function* () {
          const seenAt = (yield* DateTime.nowAsDate).toISOString()
          yield* publication.recordSeen(prId, seenAt)
        }),
      ),
    )

    return PRSynchronization.of({ refresh, markSeen })
  }),
)

export const refreshPullRequests = Effect.flatMap(PRSynchronization, (service) => service.refresh())
export const markPullRequestSeen = (prId: number) =>
  Effect.flatMap(PRSynchronization, (service) => service.markSeen(prId))
