import { Context, DateTime, Effect, Layer, Result, Semaphore } from "effect"
import { isUnseen } from "@/lib/seen"
import { parseEpochMillis } from "@/lib/time"
import { GitHubApiError, GitHubPRSource } from "./github-pr-source"
import { sameLogin } from "@/types"
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
  for (const pr of prs.authored) unique.set(pr.id, pr)
  for (const pr of prs.reviewing) unique.set(pr.id, pr)
  return Array.from(unique.values())
}

function filterInactive(prs: PRData, now: DateTime.Utc): PRData {
  const activeSinceMillis = DateTime.toEpochMillis(DateTime.subtract(now, { months: 1 }))
  const active = (pr: PR) => parseEpochMillis(pr.updatedAt) >= activeSinceMillis
  return {
    authored: prs.authored.filter(active),
    reviewing: prs.reviewing.filter(active),
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
    const lastBy = pr.lastActivity?.by
    if (
      lastBy !== undefined &&
      sameLogin(lastBy, username) &&
      (!seenAt || parseEpochMillis(pr.updatedAt) > parseEpochMillis(seenAt))
    ) {
      reconciled[prId] = pr.updatedAt
    }
  }
  return reconciled
}

function hasUnseen(prs: readonly PR[], seen: SeenPRs): boolean {
  return prs.some((pr) => isUnseen(pr, seen))
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
      const startedAt = yield* DateTime.now

      yield* publication.publish({
        kind: "sync-state",
        sync: {
          status: "syncing",
          startedAt: DateTime.formatIso(startedAt),
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

      const now = yield* DateTime.now
      const tracked = uniquePRs(fetched.success)
      let visible = fetched.success
      if (settings.hideInactivePRs) visible = filterInactive(fetched.success, now)
      const visiblePRs = uniquePRs(visible)
      const seen = reconcileSeen(tracked, previous.seen, settings.username)
      const sync: SyncState = { status: "idle", lastSyncedAt: DateTime.formatIso(now) }

      yield* publication.publish({
        kind: "snapshot",
        prs: visible,
        seen,
        sync,
        attention: {
          total: visible.authored.length + visible.reviewing.length,
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
          const seenAt = DateTime.formatIso(yield* DateTime.now)
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
