import { Context, Effect, Layer, Schema } from "effect"
import { sendRuntimeCommand } from "@/runtime/runtime-messaging"
import type { TrackerSettings } from "./tracker-settings"

export interface StoredTrackerSettings {
  readonly localToken?: unknown
  readonly legacyToken?: unknown
  readonly username?: unknown
  readonly checkInterval?: unknown
  readonly hideInactivePRs?: unknown
}

export type TrackerSettingsPersistenceChange =
  | {
      readonly kind: "migrate-token"
      readonly token: string
      readonly storeLocally: boolean
    }
  | {
      readonly kind: "initialize-interval"
      readonly checkInterval: number
    }
  | {
      readonly kind: "save"
      readonly settings: TrackerSettings
    }
  | { readonly kind: "clear-account" }
  | { readonly kind: "restrict-access" }

export class TrackerSettingsStorageError extends Schema.TaggedErrorClass<TrackerSettingsStorageError>()(
  "TrackerSettingsStorageError",
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export class TrackerSettingsPersistence extends Context.Service<
  TrackerSettingsPersistence,
  {
    readonly read: () => Effect.Effect<StoredTrackerSettings, TrackerSettingsStorageError>
    readonly apply: (
      change: TrackerSettingsPersistenceChange,
    ) => Effect.Effect<void, TrackerSettingsStorageError>
  }
>()("@github-prs/TrackerSettingsPersistence") {}

const SYNC_SETTING_KEYS = ["username", "checkInterval", "hideInactivePRs"] as const
const LOCAL_TOKEN_KEY = "githubToken"

function storageOperation<A>(operation: string, evaluate: () => Promise<A>) {
  return Effect.tryPromise({
    try: evaluate,
    catch: (cause) =>
      new TrackerSettingsStorageError({
        operation,
        message: `Chrome storage could not ${operation}.`,
        cause,
      }),
  })
}

const read = Effect.fn("TrackerSettingsPersistence.read")(function* () {
  const [synced, local] = yield* Effect.all(
    [
      storageOperation("read synchronized settings", () =>
        chrome.storage.sync.get([
          SYNC_SETTING_KEYS[0],
          SYNC_SETTING_KEYS[1],
          SYNC_SETTING_KEYS[2],
          "token",
        ]),
      ),
      storageOperation("read the local token", () => chrome.storage.local.get([LOCAL_TOKEN_KEY])),
    ],
    { concurrency: "unbounded" },
  )
  return {
    localToken: local[LOCAL_TOKEN_KEY],
    legacyToken: synced["token"],
    username: synced["username"],
    checkInterval: synced["checkInterval"],
    hideInactivePRs: synced["hideInactivePRs"],
  }
})

const apply = Effect.fn("TrackerSettingsPersistence.apply")(function* (
  change: TrackerSettingsPersistenceChange,
) {
  switch (change.kind) {
    case "migrate-token": {
      if (change.storeLocally) {
        yield* storageOperation("migrate the token to local storage", () =>
          chrome.storage.local.set({ [LOCAL_TOKEN_KEY]: change.token }),
        )
      }
      yield* storageOperation("remove the legacy synchronized token", () =>
        chrome.storage.sync.remove("token"),
      )
      return
    }
    case "initialize-interval": {
      yield* storageOperation("save the default refresh interval", () =>
        chrome.storage.sync.set({ checkInterval: change.checkInterval }),
      )
      return
    }
    case "save": {
      yield* Effect.all(
        [
          storageOperation("save synchronized preferences", () =>
            chrome.storage.sync.set({
              username: change.settings.username,
              checkInterval: change.settings.checkInterval,
              hideInactivePRs: change.settings.hideInactivePRs,
            }),
          ),
          storageOperation("save the local token", () =>
            chrome.storage.local.set({ [LOCAL_TOKEN_KEY]: change.settings.token }),
          ),
        ],
        { concurrency: "unbounded", discard: true },
      )
      yield* storageOperation("remove the legacy synchronized token", () =>
        chrome.storage.sync.remove("token"),
      )
      yield* sendRuntimeCommand({ action: "trackerSettingsChanged" })
      return
    }
    case "clear-account": {
      yield* Effect.all(
        [
          storageOperation("remove synchronized account data", () =>
            chrome.storage.sync.remove(["token", "username"]),
          ),
          storageOperation("remove local account and pull-request data", () =>
            chrome.storage.local.remove([LOCAL_TOKEN_KEY]),
          ),
        ],
        { concurrency: "unbounded", discard: true },
      )
      return
    }
    case "restrict-access": {
      yield* Effect.all(
        [
          storageOperation("restrict local storage access", () =>
            chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
          ),
          storageOperation("restrict synchronized storage access", () =>
            chrome.storage.sync.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
          ),
        ],
        { concurrency: "unbounded", discard: true },
      )
    }
  }
})

export const ChromeTrackerSettingsPersistenceLive = Layer.succeed(
  TrackerSettingsPersistence,
  TrackerSettingsPersistence.of({ read, apply }),
)
