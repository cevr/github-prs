import { DateTime, Deferred, Effect, Fiber, Layer } from "effect"
import { TestClock } from "effect/testing"
import { describe, expect, it } from "effect-bun-test"
import type { PR, PRData, SeenPRs, SyncState } from "@/types"
import type { TrackerSettings } from "@/settings/tracker-settings"
import { TrackerSettingsService } from "@/settings/tracker-settings"
import { GitHubAuthenticationError, GitHubPRSource } from "./github-pr-source"
import { PRSnapshotPublication } from "@/snapshot/pr-snapshot-publication"
import {
  PRSynchronizationLive,
  markPullRequestSeen,
  refreshPullRequests,
} from "./pr-synchronization"

const settings: TrackerSettings = {
  token: "token",
  username: "cevr",
  checkInterval: 15,
  hideInactivePRs: false,
}

function pr(overrides: Partial<PR> = {}): PR {
  return {
    id: overrides.id ?? 1,
    number: overrides.number ?? 1,
    title: overrides.title ?? "Deepen the synchronization module",
    html_url: overrides.html_url ?? "https://github.com/acme/tracker/pull/1",
    repository_url: overrides.repository_url ?? "https://api.github.com/repos/acme/tracker",
    updated_at: overrides.updated_at ?? "2026-07-16T12:00:00.000Z",
    user: overrides.user ?? { login: "cevr" },
    isApproved: overrides.isApproved,
    lastUpdatedBy: overrides.lastUpdatedBy,
  }
}

function createHarness(initialSeen: SeenPRs = {}) {
  let seen = initialSeen
  let sync: SyncState | undefined = { status: "idle" }
  let committed: PRData | undefined
  const badges: Array<{ total: number; hasUnseen: boolean }> = []
  const events: string[] = []

  const layer = Layer.succeed(
    PRSnapshotPublication,
    PRSnapshotPublication.of({
      read: Effect.fn("PRSnapshotPublicationTest.read")(() =>
        Effect.sync(() => ({ seen: Object.assign({}, seen), sync })),
      ),
      recordSeen: Effect.fn("PRSnapshotPublicationTest.recordSeen")((prId, seenAt) =>
        Effect.sync(() => {
          seen = Object.assign({}, seen, { [prId]: seenAt })
          events.push("seen")
        }),
      ),
      publish: Effect.fn("PRSnapshotPublicationTest.publish")((change) =>
        Effect.sync(() => {
          if (change.kind === "sync-state") {
            sync = change.sync
            events.push(change.sync.status)
            events.push("sync-event")
            return
          }

          committed = change.prs
          seen = change.seen
          sync = change.sync
          events.push("commit")
          badges.push(change.attention)
          events.push("badge")
          events.push("prs-event")
        }),
      ),
      clear: Effect.fn("PRSnapshotPublicationTest.clear")(() => Effect.void),
    }),
  )

  return {
    layer,
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

function createSettingsLayer(onClear: () => void = () => undefined) {
  return Layer.succeed(
    TrackerSettingsService,
    TrackerSettingsService.of({
      read: Effect.fn("TrackerSettingsTest.read")(() => Effect.succeed(settings)),
      initialize: Effect.fn("TrackerSettingsTest.initialize")(() => Effect.succeed(settings)),
      save: Effect.fn("TrackerSettingsTest.save")((value) => Effect.succeed(value)),
      clearAccount: Effect.fn("TrackerSettingsTest.clearAccount")(() => Effect.sync(onClear)),
      restrictStorageAccess: Effect.fn("TrackerSettingsTest.restrictStorageAccess")(
        () => Effect.void,
      ),
    }),
  )
}

function synchronizationLayer(
  source: Layer.Layer<GitHubPRSource>,
  harness: ReturnType<typeof createHarness>,
  settingsLayer = createSettingsLayer(),
) {
  return PRSynchronizationLive.pipe(Layer.provide([source, harness.layer, settingsLayer]))
}

describe("PR Synchronization", () => {
  it.effect("serializes mark-seen locally without issuing another GitHub refresh", () =>
    Effect.gen(function* () {
      const harness = createHarness()
      const releaseFirst = yield* Deferred.make<void>()
      const fetchStarted = yield* Deferred.make<void>()
      let fetchCount = 0
      const source = Layer.succeed(
        GitHubPRSource,
        GitHubPRSource.of({
          fetch: Effect.fn("GitHubPRSourceTest.fetch")(function* () {
            fetchCount++
            yield* Deferred.succeed(fetchStarted, undefined)
            if (fetchCount === 1) yield* Deferred.await(releaseFirst)
            return { created: [pr()], assigned: [] }
          }),
        }),
      )
      const program = Effect.gen(function* () {
        yield* TestClock.setTime(
          DateTime.toEpochMillis(DateTime.makeUnsafe("2026-07-16T13:00:00.000Z")),
        )
        const refreshFiber = yield* Effect.forkChild(refreshPullRequests)
        yield* Deferred.await(fetchStarted)
        const markSeenFiber = yield* Effect.forkChild(markPullRequestSeen(1))

        expect(fetchCount).toBe(1)
        yield* Deferred.succeed(releaseFirst, undefined)
        yield* Fiber.join(refreshFiber)
        yield* Fiber.join(markSeenFiber)

        expect(fetchCount).toBe(1)
        expect(harness.seen["1"]).toBe("2026-07-16T13:00:00.000Z")
        expect(harness.events.indexOf("seen")).toBeGreaterThan(harness.events.indexOf("commit"))
      })

      yield* program.pipe(Effect.provide(synchronizationLayer(source, harness)))
    }),
  )

  it.effect("reconciles self-authored updates through the same attention policy as the UI", () =>
    Effect.gen(function* () {
      const harness = createHarness({ "1": "2026-07-16T10:00:00.000Z" })
      const source = Layer.succeed(
        GitHubPRSource,
        GitHubPRSource.of({
          fetch: Effect.fn("GitHubPRSourceTest.fetch")(() =>
            Effect.succeed({ created: [pr({ lastUpdatedBy: "cevr" })], assigned: [] }),
          ),
        }),
      )
      const program = Effect.gen(function* () {
        yield* TestClock.setTime(
          DateTime.toEpochMillis(DateTime.makeUnsafe("2026-07-16T13:00:00.000Z")),
        )
        yield* refreshPullRequests

        expect(harness.seen["1"]).toBe("2026-07-16T12:00:00.000Z")
        expect(harness.badges).toEqual([{ total: 1, hasUnseen: false }])
        expect(harness.sync).toEqual({
          status: "idle",
          lastSyncedAt: "2026-07-16T13:00:00.000Z",
        })
      })

      yield* program.pipe(Effect.provide(synchronizationLayer(source, harness)))
    }),
  )

  it.effect("turns a stalled GitHub refresh into a retryable synchronization error", () =>
    Effect.gen(function* () {
      const harness = createHarness()
      const fetchStarted = yield* Deferred.make<void>()
      const source = Layer.succeed(
        GitHubPRSource,
        GitHubPRSource.of({
          fetch: Effect.fn("GitHubPRSourceTest.fetch")(() =>
            Effect.andThen(Deferred.succeed(fetchStarted, undefined), Effect.never),
          ),
        }),
      )
      const program = Effect.gen(function* () {
        yield* TestClock.setTime(
          DateTime.toEpochMillis(DateTime.makeUnsafe("2026-07-16T13:00:00.000Z")),
        )
        const refreshFiber = yield* Effect.forkChild(refreshPullRequests)
        yield* Deferred.await(fetchStarted)

        expect(harness.sync).toEqual({
          status: "syncing",
          startedAt: "2026-07-16T13:00:00.000Z",
        })

        yield* TestClock.adjust("1 minute")
        yield* Fiber.join(refreshFiber)
        expect(harness.sync).toEqual({
          status: "error",
          lastSyncedAt: undefined,
          message: "GitHub refresh timed out. Try again.",
        })
      })

      yield* program.pipe(Effect.provide(synchronizationLayer(source, harness)))
    }),
  )

  it.effect(
    "invalidates rejected credentials without replacing setup state with a sync error",
    () =>
      Effect.gen(function* () {
        const harness = createHarness()
        let accountCleared = false
        const source = Layer.succeed(
          GitHubPRSource,
          GitHubPRSource.of({
            fetch: Effect.fn("GitHubPRSourceTest.fetch")(() =>
              Effect.fail(
                new GitHubAuthenticationError({
                  message: "GitHub rejected the saved account credentials.",
                }),
              ),
            ),
          }),
        )
        const settingsLayer = createSettingsLayer(() => {
          accountCleared = true
        })

        yield* refreshPullRequests.pipe(
          Effect.provide(synchronizationLayer(source, harness, settingsLayer)),
        )

        expect(accountCleared).toBe(true)
        expect(harness.sync?.status).toBe("syncing")
        expect(harness.committed).toBeUndefined()
        expect(harness.events).not.toContain("prs-event")
      }),
  )
})
