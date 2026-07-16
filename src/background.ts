import type { PRData, SeenPRs, SyncState } from "./types"
import {
  clearTrackerAccount,
  initializeTrackerSettings,
  readTrackerSettings,
} from "./lib/tracker-settings"
import { createGitHubPRSource } from "./background/github-pr-source"
import { createPRSynchronization } from "./background/pr-synchronization"

const synchronization = createPRSynchronization({
  source: createGitHubPRSource(),
  settings: {
    read: readTrackerSettings,
    clearAccount: clearTrackerAccount,
  },
  store: {
    async read() {
      const stored: { seenPRs?: SeenPRs; syncState?: SyncState } = await chrome.storage.local.get([
        "seenPRs",
        "syncState",
      ])
      return { seen: stored.seenPRs ?? {}, sync: stored.syncState }
    },
    async setSeen(seenPRs) {
      await chrome.storage.local.set({ seenPRs })
    },
    async setSync(syncState) {
      await chrome.storage.local.set({ syncState })
    },
    async commit(previousPRs: PRData, seenPRs: SeenPRs, syncState: SyncState) {
      await chrome.storage.local.set({ previousPRs, seenPRs, syncState })
    },
  },
  effects: {
    async syncStateChanged() {
      await chrome.runtime.sendMessage({ action: "syncStateChanged" }).catch(() => undefined)
    },
    async prsUpdated() {
      await chrome.runtime.sendMessage({ action: "prsUpdated" }).catch(() => undefined)
    },
    async updateBadge({ total, hasUnseen }) {
      if (total === 0) {
        await chrome.action.setBadgeText({ text: "" })
        return
      }
      await Promise.all([
        chrome.action.setBadgeText({ text: total.toString() }),
        chrome.action.setBadgeTextColor({ color: "#fff" }),
        chrome.action.setBadgeBackgroundColor({ color: hasUnseen ? "#f85149" : "#666" }),
      ])
    },
  },
})

function run(operation: Promise<void>) {
  void operation.catch((error) => console.error("PR synchronization failed:", error))
}

function setupAlarm(interval: number) {
  chrome.alarms.clear("checkPRs", () => {
    chrome.alarms.create("checkPRs", { periodInMinutes: interval })
  })
}

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

chrome.runtime.onInstalled.addListener(() => {
  void initializeTrackerSettings().then((settings) => setupAlarm(settings.checkInterval))
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkPRs") run(synchronization.refresh())
})

chrome.runtime.onMessage.addListener(
  (request: { action: string; prId?: number }, _sender, sendResponse) => {
    if (request.action === "checkNow") {
      run(synchronization.refresh())
      sendResponse()
    } else if (request.action === "markPRViewed" && request.prId != null) {
      run(synchronization.markSeen(request.prId))
      sendResponse()
    } else if (request.action === "updateSettings") {
      void readTrackerSettings().then((settings) => setupAlarm(settings.checkInterval))
      sendResponse()
    }
  },
)
