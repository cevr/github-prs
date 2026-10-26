import { Effect, Schema } from "effect"
import { installRuntimeCommandHandler } from "@/runtime/runtime-messaging"
import { backgroundRuntime } from "./background/runtime"
import type { PRSynchronization } from "./background/pr-synchronization"
import { markPullRequestSeen, refreshPullRequests } from "./background/pr-synchronization"
import type { TrackerSettingsService } from "./settings/tracker-settings"
import {
  initializeTrackerSettings,
  readTrackerSettings,
  restrictTrackerStorageAccess,
} from "./settings/tracker-settings"

class BackgroundChromeError extends Schema.TaggedErrorClass<BackgroundChromeError>()(
  "BackgroundChromeError",
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.Defect(),
  },
) {}

const storageReady = backgroundRuntime.runPromise(restrictTrackerStorageAccess)

function run(program: Effect.Effect<void, unknown, PRSynchronization | TrackerSettingsService>) {
  return backgroundRuntime.runPromise(
    Effect.promise(() => storageReady).pipe(
      Effect.andThen(program),
      Effect.catchCause((cause) =>
        Effect.logError("GitHub PR Tracker background operation failed", cause),
      ),
    ),
  )
}

const setupAlarm = Effect.fn("Background.setupAlarm")((interval: number) =>
  Effect.tryPromise({
    try: () => chrome.alarms.clear("checkPRs"),
    catch: (cause) =>
      new BackgroundChromeError({
        operation: "replace the refresh alarm",
        message: "Chrome could not replace the refresh alarm.",
        cause,
      }),
  }).pipe(
    Effect.tap(() =>
      Effect.sync(() => {
        chrome.alarms.create("checkPRs", { periodInMinutes: interval })
      }),
    ),
    Effect.asVoid,
  ),
)

void run(
  Effect.tryPromise({
    try: () => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }),
    catch: (cause) =>
      new BackgroundChromeError({
        operation: "configure the side panel",
        message: "Chrome could not configure the extension side panel.",
        cause,
      }),
  }),
)

// An install, an update or a reload of the extension refreshes at once: a new version may read
// more from GitHub than the saved snapshot holds, and the next alarm can be an interval away.
chrome.runtime.onInstalled.addListener(() => {
  void run(
    Effect.flatMap(initializeTrackerSettings, (settings) =>
      Effect.andThen(setupAlarm(settings.checkInterval), refreshPullRequests),
    ),
  )
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkPRs") void run(refreshPullRequests)
})

installRuntimeCommandHandler((command) => {
  if (command.action === "checkNow") {
    return run(refreshPullRequests)
  }
  if (command.action === "markPRViewed") return run(markPullRequestSeen(command.prId))
  return run(
    Effect.flatMap(readTrackerSettings, (settings) =>
      Effect.andThen(setupAlarm(settings.checkInterval), refreshPullRequests),
    ),
  )
})
