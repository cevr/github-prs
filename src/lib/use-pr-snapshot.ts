import { createSignal, onCleanup } from "solid-js"
import type { Accessor } from "solid-js"
import type { PRData, SeenPRs, SyncState } from "@/types"
import { isAccountConfigured, readTrackerSettings } from "./tracker-settings"

export interface CachedPRSnapshot {
  prs: PRData
  seen: SeenPRs
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
  state: Accessor<PRSnapshotState>
  refresh: () => void
  markSeen: (prId: number) => void
}

function syncFailure(message: string): SyncState {
  return { status: "error", message }
}

export function usePRSnapshot(): PRSnapshotModel {
  const [state, setState] = createSignal<PRSnapshotState>({ kind: "loading" })
  let readGeneration = 0
  let initialRefreshRequested = false

  const readSnapshot = async () => {
    const generation = ++readGeneration

    try {
      const [settings, local] = await Promise.all([
        readTrackerSettings(),
        chrome.storage.local.get(["previousPRs", "seenPRs", "syncState"]),
      ])
      if (generation !== readGeneration) return

      if (!isAccountConfigured(settings)) {
        setState({ kind: "setup-needed" })
        return
      }

      const prs = local.previousPRs as PRData | undefined
      const sync = (local.syncState as SyncState | undefined) ?? { status: "idle" }

      if (!prs) {
        if (sync.status === "error") {
          setState({
            kind: "unavailable",
            reason: "initial-sync-failed",
            message: sync.message ?? "Unable to load pull requests.",
          })
          return
        }

        setState({ kind: "loading" })
        if (!initialRefreshRequested) {
          initialRefreshRequested = true
          chrome.runtime.sendMessage({ action: "checkNow" })
        }
        return
      }

      initialRefreshRequested = false
      setState({
        kind: "available",
        snapshot: {
          prs,
          seen: (local.seenPRs as SeenPRs | undefined) ?? {},
        },
        sync,
      })
    } catch (error) {
      if (generation !== readGeneration) return
      const message = error instanceof Error ? error.message : "Unable to read saved pull requests."
      setState((current) =>
        current.kind === "available"
          ? { ...current, sync: syncFailure(message) }
          : { kind: "unavailable", reason: "storage-failed", message },
      )
    }
  }

  const listener = (request: { action: string }) => {
    if (request.action === "prsUpdated" || request.action === "syncStateChanged") {
      void readSnapshot()
    } else if (request.action === "setupNeeded") {
      readGeneration++
      setState({ kind: "setup-needed" })
    }
  }

  chrome.runtime.onMessage.addListener(listener)
  onCleanup(() => chrome.runtime.onMessage.removeListener(listener))
  void readSnapshot()

  const refresh = () => {
    const current = state()
    if (current.kind === "available") {
      if (current.sync.status === "syncing") return
      setState({
        ...current,
        sync: {
          status: "syncing",
          lastSyncedAt: current.sync.lastSyncedAt,
        },
      })
    }
    chrome.runtime.sendMessage({ action: "checkNow" })
  }

  const markSeen = (prId: number) => {
    setState((current) => {
      if (current.kind !== "available") return current
      return {
        ...current,
        snapshot: {
          ...current.snapshot,
          seen: {
            ...current.snapshot.seen,
            [prId]: new Date().toISOString(),
          },
        },
      }
    })
    chrome.runtime.sendMessage({ action: "markPRViewed", prId })
  }

  return { state, refresh, markSeen }
}
