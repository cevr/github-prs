import { Effect, Schema } from "effect"
import { describe, expect, it } from "effect-bun-test"
import {
  ChromeTrackerSettingsPersistenceLive,
  TrackerSettingsPersistence,
} from "./tracker-settings-persistence"
import type { TrackerSettingsPersistenceChange } from "./tracker-settings-persistence"

class ChromeStorageUnavailableError extends Schema.TaggedErrorClass<ChromeStorageUnavailableError>()(
  "ChromeStorageUnavailableError",
  { message: Schema.String },
) {}

function resolved<A>(value: A): Promise<A> {
  return Effect.runPromise(Effect.succeed(value))
}

function rejected(error: Error): Promise<never> {
  return Effect.runPromise(Effect.fail(error))
}

function installChrome(value: unknown) {
  return Effect.acquireRelease(
    Effect.sync(() => {
      Object.defineProperty(globalThis, "chrome", { configurable: true, value })
    }),
    () =>
      Effect.sync(() => {
        Reflect.deleteProperty(globalThis, "chrome")
      }),
  )
}

const apply = (change: TrackerSettingsPersistenceChange) =>
  Effect.flatMap(TrackerSettingsPersistence, (persistence) => persistence.apply(change)).pipe(
    Effect.provide(ChromeTrackerSettingsPersistenceLive),
  )

describe("Chrome Tracker Settings persistence", () => {
  it.scopedLive("keeps the token local and emits one settings change", () =>
    Effect.gen(function* () {
      let savedLocal: Record<string, unknown> | undefined
      let savedSync: Record<string, unknown> | undefined
      const events: string[] = []
      yield* installChrome({
        storage: {
          sync: {
            set: (value: Record<string, unknown>) => {
              savedSync = value
              events.push("sync-saved")
              return resolved(undefined)
            },
            remove: () => {
              events.push("legacy-token-removed")
              return resolved(undefined)
            },
          },
          local: {
            set: (value: Record<string, unknown>) => {
              savedLocal = value
              events.push("local-saved")
              return resolved(undefined)
            },
          },
        },
        runtime: {
          sendMessage: ({ action }: { action: string }) => {
            events.push(action)
            return resolved(undefined)
          },
        },
      })

      yield* apply({
        kind: "save",
        settings: {
          token: "token",
          username: "cevr",
          checkInterval: 15,
          hideInactivePRs: true,
        },
      })

      expect(savedSync).toEqual({
        username: "cevr",
        checkInterval: 15,
        hideInactivePRs: true,
      })
      expect(savedLocal).toEqual({ githubToken: "token" })
      expect(events.at(-2)).toBe("legacy-token-removed")
      expect(events.at(-1)).toBe("trackerSettingsChanged")
    }),
  )

  it.scopedLive("retains the synchronized token when local migration fails", () =>
    Effect.gen(function* () {
      let removedLegacyToken = false
      yield* installChrome({
        storage: {
          local: {
            set: () =>
              rejected(new ChromeStorageUnavailableError({ message: "local storage unavailable" })),
          },
          sync: {
            remove: () => {
              removedLegacyToken = true
              return resolved(undefined)
            },
          },
        },
      })

      yield* apply({ kind: "migrate-token", token: "legacy", storeLocally: true }).pipe(Effect.flip)

      expect(removedLegacyToken).toBe(false)
    }),
  )

  it.scopedLive("restricts both storage areas to trusted extension contexts", () =>
    Effect.gen(function* () {
      const calls: string[] = []
      yield* installChrome({
        storage: {
          local: {
            setAccessLevel: ({ accessLevel }: { accessLevel: string }) => {
              calls.push(`local:${accessLevel}`)
              return resolved(undefined)
            },
          },
          sync: {
            setAccessLevel: ({ accessLevel }: { accessLevel: string }) => {
              calls.push(`sync:${accessLevel}`)
              return resolved(undefined)
            },
          },
        },
      })

      yield* apply({ kind: "restrict-access" })

      expect(calls.sort()).toEqual(["local:TRUSTED_CONTEXTS", "sync:TRUSTED_CONTEXTS"])
    }),
  )

  it.scopedLive("clears only account storage", () =>
    Effect.gen(function* () {
      const removals: Array<[string, string[]]> = []
      yield* installChrome({
        storage: {
          sync: {
            remove: (keys: string[]) => {
              removals.push(["sync", keys])
              return resolved(undefined)
            },
          },
          local: {
            remove: (keys: string[]) => {
              removals.push(["local", keys])
              return resolved(undefined)
            },
          },
        },
        runtime: {
          sendMessage: () => resolved(undefined),
        },
      })

      yield* apply({ kind: "clear-account" })

      expect(removals).toEqual([
        ["sync", ["token", "username"]],
        ["local", ["githubToken"]],
      ])
    }),
  )
})
