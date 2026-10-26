import { Effect, Result } from "effect"
import { createEffect, createSignal, onCleanup } from "@solidjs/signals"
import type { Accessor } from "@solidjs/signals"
import { applicationRuntime } from "@/application/runtime"
import { createCache } from "@/lib/cache"
import { nowEpochMillis, nowIso } from "@/lib/time"
import { sendRuntimeCommand, subscribeToRuntimeEvents } from "@/runtime/runtime-messaging"
import { isAccountConfigured, readTrackerSettings } from "@/settings/tracker-settings"
import { readPRSnapshot } from "@/snapshot/pr-snapshot-publication"
import type { PRData, SeenPRs, SyncState } from "@/types"

export interface CachedPRSnapshot {
  readonly prs: PRData
  readonly seen: SeenPRs
  /** The user's GitHub login, whose side of each pull request decides its order. */
  readonly viewer: string
}

export type PRSnapshotState =
  | { kind: "loading" }
  | { kind: "setup-needed" }
  | {
      kind: "unavailable"
      reason: "storage-failed" | "initial-sync-failed"
      message: string
    }
  | {
      kind: "available"
      snapshot: CachedPRSnapshot
      sync: SyncState
    }

export interface PRSnapshotModel {
  readonly state: Accessor<PRSnapshotState>
  readonly refresh: () => void
  readonly markSeen: (prId: number) => void
}

function syncFailure(message: string): SyncState {
  return { status: "error", message }
}

const SYNC_TIMEOUT_MS = 60_000

function recoverInterruptedSync(sync: SyncState): SyncState {
  if (sync.status !== "syncing") return sync
  if (sync.startedAt) {
    const startedAt = Date.parse(sync.startedAt)
    if (Number.isFinite(startedAt) && nowEpochMillis() - startedAt < SYNC_TIMEOUT_MS) return sync
  }
  return {
    status: "error",
    lastSyncedAt: sync.lastSyncedAt,
    message: "The previous refresh was interrupted. Try again.",
  }
}

export function usePRSnapshot(): PRSnapshotModel {
  const snapshotCache = createCache({
    lookup: () =>
      Effect.result(Effect.all({ settings: readTrackerSettings, local: readPRSnapshot })),
    runner: applicationRuntime,
  })
  const stored = snapshotCache.get()
  let initialRefreshRequested = false
  const [state, setState] = createSignal<PRSnapshotState>(
    (previous) => {
      const result = stored()
      if (Result.isFailure(result)) {
        const failure = result.failure
        let message = "Unable to read saved pull requests."
        if (failure instanceof Error) message = failure.message
        if (previous?.kind === "available") {
          return { kind: "available", snapshot: previous.snapshot, sync: syncFailure(message) }
        }
        return { kind: "unavailable", reason: "storage-failed", message }
      }

      const { local, settings } = result.success
      if (!isAccountConfigured(settings)) return { kind: "setup-needed" }

      const prs = local.prs
      const sync = recoverInterruptedSync(local.sync ?? { status: "idle" })
      if (!prs) {
        if (sync.status === "error") {
          return {
            kind: "unavailable",
            reason: "initial-sync-failed",
            message: sync.message ?? "Unable to load pull requests.",
          }
        }
        return { kind: "loading" }
      }

      return {
        kind: "available",
        snapshot: { prs, seen: local.seen, viewer: settings.username },
        sync,
      }
    },
    { lazy: true, name: "PRSnapshot.state", ownedWrite: true },
  )

  createEffect(
    () => state(),
    (current) => {
      if (current.kind === "loading" && !initialRefreshRequested) {
        initialRefreshRequested = true
        void Effect.runPromise(sendRuntimeCommand({ action: "checkNow" }))
      } else if (current.kind === "available") {
        initialRefreshRequested = false
      }
    },
  )

  const unsubscribe = subscribeToRuntimeEvents((event) => {
    if (event.action === "prSnapshotChanged") {
      void snapshotCache.refresh()
    } else {
      setState({ kind: "setup-needed" })
    }
  })
  onCleanup(unsubscribe)

  const refresh = () => {
    const current = state()
    if (current.kind === "available") {
      if (current.sync.status === "syncing") return
      setState({
        kind: "available",
        snapshot: current.snapshot,
        sync: {
          status: "syncing",
          startedAt: nowIso(),
          lastSyncedAt: current.sync.lastSyncedAt,
        },
      })
    }
    void Effect.runPromise(sendRuntimeCommand({ action: "checkNow" }))
  }

  const markSeen = (prId: number) => {
    setState((current) => {
      if (current.kind !== "available") return current
      const seen: Record<string, string> = {}
      for (const [id, seenAt] of Object.entries(current.snapshot.seen)) seen[id] = seenAt
      seen[prId] = nowIso()
      return {
        kind: "available",
        snapshot: { prs: current.snapshot.prs, seen, viewer: current.snapshot.viewer },
        sync: current.sync,
      }
    })
    void Effect.runPromise(sendRuntimeCommand({ action: "markPRViewed", prId }))
  }

  return { state, refresh, markSeen }
}
