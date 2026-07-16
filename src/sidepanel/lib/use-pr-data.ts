import { createResource, onCleanup } from "solid-js"
import type { PRData, SeenPRs, SyncState } from "@/types"

async function fetchSetup(): Promise<void> {
  const result = await chrome.storage.sync.get(["token", "username"])
  if (!result.token || !result.username) {
    throw new Error("setup_needed")
  }
}

async function fetchPRs(): Promise<PRData> {
  const { previousPRs } = await chrome.storage.local.get(["previousPRs"])
  if (!previousPRs) {
    chrome.runtime.sendMessage({ action: "checkNow" })
    throw new Error("loading")
  }
  return previousPRs as PRData
}

async function fetchSeenPRs(): Promise<SeenPRs> {
  const { seenPRs } = await chrome.storage.local.get(["seenPRs"])
  return (seenPRs as SeenPRs) || {}
}

async function fetchSyncState(): Promise<SyncState> {
  const { syncState } = await chrome.storage.local.get(["syncState"])
  return (syncState as SyncState | undefined) ?? { status: "idle" }
}

export function usePRData() {
  const [setup] = createResource(fetchSetup)
  const [prsData, { refetch: refetchPRs }] = createResource(fetchPRs)
  const [seenPRs, { mutate: mutateSeenPRs, refetch: refetchSeenPRs }] = createResource(fetchSeenPRs)
  const [syncState, { refetch: refetchSyncState }] = createResource(fetchSyncState)

  const listener = (request: { action: string }) => {
    if (request.action === "prsUpdated") {
      refetchPRs()
      refetchSeenPRs()
      refetchSyncState()
    }
    if (request.action === "syncStateChanged") {
      refetchSyncState()
    }
    if (request.action === "setupNeeded") {
      window.location.reload()
    }
  }
  chrome.runtime.onMessage.addListener(listener)
  onCleanup(() => chrome.runtime.onMessage.removeListener(listener))

  const refresh = () => chrome.runtime.sendMessage({ action: "checkNow" })

  const markSeen = (prId: number) => {
    mutateSeenPRs((prev) => ({
      ...(prev || {}),
      [prId]: new Date().toISOString(),
    }))
    chrome.runtime.sendMessage({ action: "markPRViewed", prId })
  }

  return { setup, prsData, seenPRs, syncState, refresh, markSeen }
}
