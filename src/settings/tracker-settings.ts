import { Context, Effect, Layer, Schema } from "effect"
import { ChromePRSnapshotPublicationLive } from "@/snapshot/chrome-pr-snapshot-publication"
import { PRSnapshotPublication } from "@/snapshot/pr-snapshot-publication"
import type { PRSnapshotPublicationError } from "@/snapshot/pr-snapshot-publication"
import {
  ChromeTrackerSettingsPersistenceLive,
  TrackerSettingsPersistence,
} from "./tracker-settings-persistence"
export { TrackerSettingsStorageError } from "./tracker-settings-persistence"
import type { TrackerSettingsStorageError } from "./tracker-settings-persistence"

export const TrackerSettings = Schema.Struct({
  token: Schema.String,
  username: Schema.String,
  checkInterval: Schema.Number,
  hideInactivePRs: Schema.Boolean,
})
export type TrackerSettings = typeof TrackerSettings.Type

export class InvalidTrackerSettingsError extends Schema.TaggedErrorClass<InvalidTrackerSettingsError>()(
  "InvalidTrackerSettingsError",
  {
    field: Schema.Literals(["token", "username"]),
    message: Schema.String,
  },
) {}

export class TrackerSettingsService extends Context.Service<
  TrackerSettingsService,
  {
    readonly read: () => Effect.Effect<TrackerSettings, TrackerSettingsStorageError>
    readonly initialize: () => Effect.Effect<TrackerSettings, TrackerSettingsStorageError>
    readonly save: (
      input: TrackerSettings,
    ) => Effect.Effect<TrackerSettings, InvalidTrackerSettingsError | TrackerSettingsStorageError>
    readonly clearAccount: () => Effect.Effect<
      void,
      TrackerSettingsStorageError | PRSnapshotPublicationError
    >
    readonly restrictStorageAccess: () => Effect.Effect<void, TrackerSettingsStorageError>
  }
>()("@github-prs/TrackerSettings") {}

const DEFAULT_CHECK_INTERVAL = 15
const MIN_CHECK_INTERVAL = 5
const MAX_CHECK_INTERVAL = 60

function normalizeInterval(value: unknown): number {
  const interval = Number(value)
  if (!Number.isFinite(interval)) return DEFAULT_CHECK_INTERVAL
  return Math.min(MAX_CHECK_INTERVAL, Math.max(MIN_CHECK_INTERVAL, Math.round(interval)))
}

export function normalizeTrackerSettings(stored: {
  readonly token?: unknown
  readonly username?: unknown
  readonly checkInterval?: unknown
  readonly hideInactivePRs?: unknown
}): TrackerSettings {
  return {
    token: typeof stored.token === "string" ? stored.token.trim() : "",
    username: typeof stored.username === "string" ? stored.username.trim() : "",
    checkInterval: normalizeInterval(stored.checkInterval),
    hideInactivePRs: stored.hideInactivePRs !== false,
  }
}

export function isAccountConfigured(settings: TrackerSettings): boolean {
  return settings.token.length > 0 && settings.username.length > 0
}

export const TrackerSettingsServiceLive = Layer.effect(
  TrackerSettingsService,
  Effect.gen(function* () {
    const persistence = yield* TrackerSettingsPersistence
    const snapshotPublication = yield* PRSnapshotPublication

    const readStoredTrackerSettings = Effect.fn("TrackerSettings.readStored")(function* () {
      const stored = yield* persistence.read()
      const legacyToken = typeof stored.legacyToken === "string" ? stored.legacyToken.trim() : ""
      const localToken = typeof stored.localToken === "string" ? stored.localToken : ""

      if (legacyToken) {
        yield* persistence.apply({
          kind: "migrate-token",
          token: legacyToken,
          storeLocally: !localToken,
        })
      }

      return {
        settings: normalizeTrackerSettings({
          token: localToken || legacyToken,
          username: stored.username,
          checkInterval: stored.checkInterval,
          hideInactivePRs: stored.hideInactivePRs,
        }),
        hasCheckInterval: stored.checkInterval != null,
      }
    })

    const read = Effect.fn("TrackerSettings.read")(function* () {
      return (yield* readStoredTrackerSettings()).settings
    })

    const initialize = Effect.fn("TrackerSettings.initialize")(function* () {
      const stored = yield* readStoredTrackerSettings()
      if (!stored.hasCheckInterval) {
        yield* persistence.apply({
          kind: "initialize-interval",
          checkInterval: stored.settings.checkInterval,
        })
      }
      return stored.settings
    })

    const save = Effect.fn("TrackerSettings.save")(function* (input: TrackerSettings) {
      const settings = normalizeTrackerSettings(input)
      if (!settings.token) {
        return yield* new InvalidTrackerSettingsError({
          field: "token",
          message: "Add a GitHub personal access token to continue.",
        })
      }
      if (!settings.username) {
        return yield* new InvalidTrackerSettingsError({
          field: "username",
          message: "Add your GitHub username to continue.",
        })
      }

      yield* persistence.apply({ kind: "save", settings })
      return settings
    })

    const clearAccount = Effect.fn("TrackerSettings.clearAccount")(function* () {
      yield* persistence.apply({ kind: "clear-account" })
      yield* snapshotPublication.clear()
    })

    const restrictStorageAccess = Effect.fn("TrackerSettings.restrictStorageAccess")(() =>
      persistence.apply({ kind: "restrict-access" }),
    )

    return TrackerSettingsService.of({
      read,
      initialize,
      save,
      clearAccount,
      restrictStorageAccess,
    })
  }),
)

export const TrackerSettingsLive = TrackerSettingsServiceLive.pipe(
  Layer.provide([ChromeTrackerSettingsPersistenceLive, ChromePRSnapshotPublicationLive]),
)

export const readTrackerSettings = Effect.flatMap(TrackerSettingsService, (service) =>
  service.read(),
)
export const initializeTrackerSettings = Effect.flatMap(TrackerSettingsService, (service) =>
  service.initialize(),
)
export const saveTrackerSettings = (input: TrackerSettings) =>
  Effect.flatMap(TrackerSettingsService, (service) => service.save(input))
export const clearTrackerAccount = Effect.flatMap(TrackerSettingsService, (service) =>
  service.clearAccount(),
)
export const restrictTrackerStorageAccess = Effect.flatMap(TrackerSettingsService, (service) =>
  service.restrictStorageAccess(),
)
