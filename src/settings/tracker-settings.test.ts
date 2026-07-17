import { Effect, Layer } from "effect"
import { describe, expect, it, test } from "effect-bun-test"
import { PRSnapshotPublication } from "@/snapshot/pr-snapshot-publication"
import {
  InvalidTrackerSettingsError,
  type TrackerSettingsService,
  TrackerSettingsServiceLive,
  clearTrackerAccount,
  normalizeTrackerSettings,
  readTrackerSettings,
  restrictTrackerStorageAccess,
  saveTrackerSettings,
} from "./tracker-settings"
import {
  TrackerSettingsPersistence,
  type StoredTrackerSettings,
  type TrackerSettingsPersistenceChange,
} from "./tracker-settings-persistence"

function createPersistence(initial: StoredTrackerSettings = {}) {
  let stored = initial
  let snapshotClears = 0
  const changes: TrackerSettingsPersistenceChange[] = []
  const layer = Layer.succeed(
    TrackerSettingsPersistence,
    TrackerSettingsPersistence.of({
      read: () => Effect.succeed(stored),
      apply: (change) =>
        Effect.sync(() => {
          changes.push(change)
          switch (change.kind) {
            case "migrate-token":
              stored = {
                localToken: change.storeLocally ? change.token : stored.localToken,
                legacyToken: undefined,
                username: stored.username,
                checkInterval: stored.checkInterval,
                hideInactivePRs: stored.hideInactivePRs,
              }
              return
            case "initialize-interval":
              stored = {
                localToken: stored.localToken,
                legacyToken: stored.legacyToken,
                username: stored.username,
                checkInterval: change.checkInterval,
                hideInactivePRs: stored.hideInactivePRs,
              }
              return
            case "save":
              stored = {
                localToken: change.settings.token,
                legacyToken: undefined,
                username: change.settings.username,
                checkInterval: change.settings.checkInterval,
                hideInactivePRs: change.settings.hideInactivePRs,
              }
              return
            case "clear-account":
              stored = {
                localToken: undefined,
                legacyToken: undefined,
                username: undefined,
                checkInterval: stored.checkInterval,
                hideInactivePRs: stored.hideInactivePRs,
              }
              return
            case "restrict-access":
              return
          }
        }),
    }),
  )
  const snapshotLayer = Layer.succeed(
    PRSnapshotPublication,
    PRSnapshotPublication.of({
      read: () => Effect.succeed({ seen: {} }),
      recordSeen: () => Effect.void,
      publish: () => Effect.void,
      clear: () =>
        Effect.sync(() => {
          snapshotClears++
        }),
    }),
  )
  return {
    changes,
    layer,
    snapshotLayer,
    getSnapshotClears: () => snapshotClears,
  }
}

function provideTrackerSettings<A, E>(
  effect: Effect.Effect<A, E, TrackerSettingsService>,
  persistence: Layer.Layer<TrackerSettingsPersistence>,
  snapshotPublication: Layer.Layer<PRSnapshotPublication>,
): Effect.Effect<A, E> {
  return effect.pipe(
    Effect.provide(TrackerSettingsServiceLive),
    Effect.provide([persistence, snapshotPublication]),
  )
}

describe("Tracker Settings", () => {
  test("normalizes stored values through one set of defaults and limits", () => {
    expect(normalizeTrackerSettings({ checkInterval: 2, hideInactivePRs: "yes" })).toEqual({
      token: "",
      username: "",
      checkInterval: 5,
      hideInactivePRs: true,
    })
    expect(normalizeTrackerSettings({ checkInterval: 72, hideInactivePRs: false })).toMatchObject({
      checkInterval: 60,
      hideInactivePRs: false,
    })
  })

  it.effect("normalizes settings before one persistence change", () => {
    const { changes, layer, snapshotLayer } = createPersistence()
    return Effect.gen(function* () {
      yield* provideTrackerSettings(
        saveTrackerSettings({
          token: " token ",
          username: " cevr ",
          checkInterval: 90,
          hideInactivePRs: true,
        }),
        layer,
        snapshotLayer,
      )

      expect(changes).toEqual([
        {
          kind: "save",
          settings: {
            token: "token",
            username: "cevr",
            checkInterval: 60,
            hideInactivePRs: true,
          },
        },
      ])
    })
  })

  it.effect("migrates an existing synchronized token through one persistence change", () => {
    const { changes, layer, snapshotLayer } = createPersistence({
      legacyToken: " legacy-token ",
      username: "cevr",
      checkInterval: 15,
      hideInactivePRs: true,
    })
    return Effect.gen(function* () {
      const settings = yield* provideTrackerSettings(readTrackerSettings, layer, snapshotLayer)

      expect(settings).toEqual({
        token: "legacy-token",
        username: "cevr",
        checkInterval: 15,
        hideInactivePRs: true,
      })
      expect(changes).toEqual([
        {
          kind: "migrate-token",
          token: "legacy-token",
          storeLocally: true,
        },
      ])
    })
  })

  it.effect("restricts storage through one persistence change", () => {
    const { changes, layer, snapshotLayer } = createPersistence()
    return Effect.gen(function* () {
      yield* provideTrackerSettings(restrictTrackerStorageAccess, layer, snapshotLayer)

      expect(changes).toEqual([{ kind: "restrict-access" }])
    })
  })

  it.effect("disconnects the account through one persistence change", () => {
    const { changes, getSnapshotClears, layer, snapshotLayer } = createPersistence()
    return Effect.gen(function* () {
      yield* provideTrackerSettings(clearTrackerAccount, layer, snapshotLayer)

      expect(changes).toEqual([{ kind: "clear-account" }])
      expect(getSnapshotClears()).toBe(1)
    })
  })

  it.effect("rejects incomplete account settings before persistence", () => {
    const { changes, layer, snapshotLayer } = createPersistence()
    return Effect.gen(function* () {
      const error = yield* provideTrackerSettings(
        saveTrackerSettings({
          token: "",
          username: "cevr",
          checkInterval: 15,
          hideInactivePRs: true,
        }),
        layer,
        snapshotLayer,
      ).pipe(Effect.flip)

      expect(error).toBeInstanceOf(InvalidTrackerSettingsError)
      expect(changes).toEqual([])
    })
  })
})
