import { Effect, Layer, Schema } from "effect"
import { parseEpochMillis } from "@/lib/time"
import { publishRuntimeEvent } from "@/runtime/runtime-messaging"
import { PRData, SeenPRs, SyncState } from "@/types"
import { PRSnapshotPublication, PRSnapshotPublicationError } from "./pr-snapshot-publication"
import type { PRSnapshotChange } from "./pr-snapshot-publication"

const StoredPublicationState = Schema.Struct({
  previousPRs: Schema.optionalKey(PRData),
  seenPRs: Schema.optionalKey(SeenPRs),
  syncState: Schema.optionalKey(SyncState),
})

function storageOperation<A>(operation: string, evaluate: () => Promise<A>) {
  return Effect.tryPromise({
    try: evaluate,
    catch: (cause) =>
      new PRSnapshotPublicationError({
        operation,
        message: `Chrome storage could not ${operation}.`,
        cause,
      }),
  })
}

const read = Effect.fn("PRSnapshotPublication.read")(function* () {
  const stored = yield* storageOperation("read pull-request state", () =>
    chrome.storage.local.get(["previousPRs", "seenPRs", "syncState"]),
  )
  const decoded = yield* Schema.decodeUnknownEffect(StoredPublicationState)(stored).pipe(
    Effect.mapError(
      (cause) =>
        new PRSnapshotPublicationError({
          operation: "decode pull-request state",
          message: "Saved pull-request state is invalid.",
          cause,
        }),
    ),
  )
  return { prs: decoded.previousPRs, seen: decoded.seenPRs ?? {}, sync: decoded.syncState }
})

function badgeBackgroundColor(hasUnseen: boolean): string {
  if (hasUnseen) return "#f85149"
  return "#666"
}

function updateBadge(summary: { readonly total: number; readonly hasUnseen: boolean }) {
  if (summary.total === 0) {
    return Effect.tryPromise(() => chrome.action.setBadgeText({ text: "" })).pipe(Effect.asVoid)
  }

  return Effect.all(
    [
      Effect.tryPromise(() => chrome.action.setBadgeText({ text: summary.total.toString() })),
      Effect.tryPromise(() => chrome.action.setBadgeTextColor({ color: "#fff" })),
      Effect.tryPromise(() =>
        chrome.action.setBadgeBackgroundColor({
          color: badgeBackgroundColor(summary.hasUnseen),
        }),
      ),
    ],
    { concurrency: "unbounded", discard: true },
  )
}

const recordSeen = Effect.fn("PRSnapshotPublication.recordSeen")(function* (
  prId: number,
  seenAt: string,
) {
  const stored = yield* read()
  const seen: Record<string, string> = Object.assign({}, stored.seen)
  seen[prId] = seenAt
  yield* storageOperation("save seen pull requests", () =>
    chrome.storage.local.set({ seenPRs: seen }),
  )
  yield* publishRuntimeEvent({ action: "prSnapshotChanged" })

  const prs = stored.prs
  if (!prs) return
  const unique = new Map(prs.created.map((pr) => [pr.id, pr]))
  for (const pr of prs.assigned) unique.set(pr.id, pr)
  const hasUnseen = Array.from(unique.values()).some((pr) => {
    const recordedAt = seen[pr.id.toString()]
    return !recordedAt || parseEpochMillis(pr.updated_at) > parseEpochMillis(recordedAt)
  })
  yield* updateBadge({
    total: prs.created.length + prs.assigned.length,
    hasUnseen,
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning(
        "Unable to update the extension badge after marking a pull request seen.",
        cause,
      ),
    ),
  )
})

const publish = Effect.fn("PRSnapshotPublication.publish")(function* (change: PRSnapshotChange) {
  if (change.kind === "sync-state") {
    yield* storageOperation("save synchronization state", () =>
      chrome.storage.local.set({ syncState: change.sync }),
    )
    yield* publishRuntimeEvent({ action: "prSnapshotChanged" })
    return
  }

  yield* storageOperation("publish the pull-request snapshot", () =>
    chrome.storage.local.set({
      previousPRs: change.prs,
      seenPRs: change.seen,
      syncState: change.sync,
    }),
  )
  yield* publishRuntimeEvent({ action: "prSnapshotChanged" })
  yield* updateBadge(change.attention).pipe(
    Effect.catchCause((cause) => Effect.logWarning("Unable to update the extension badge.", cause)),
  )
})

const clear = Effect.fn("PRSnapshotPublication.clear")(function* () {
  yield* storageOperation("clear the pull-request snapshot", () =>
    chrome.storage.local.remove(["previousPRs", "seenPRs", "syncState"]),
  )
  yield* publishRuntimeEvent({ action: "setupNeeded" })
  yield* updateBadge({ total: 0, hasUnseen: false }).pipe(
    Effect.catchCause((cause) => Effect.logWarning("Unable to clear the extension badge.", cause)),
  )
})

export const ChromePRSnapshotPublicationLive = Layer.succeed(
  PRSnapshotPublication,
  PRSnapshotPublication.of({ read, recordSeen, publish, clear }),
)
