import { afterEach, describe, expect, test } from "bun:test"
import {
  InvalidTrackerSettingsError,
  normalizeTrackerSettings,
  saveTrackerSettings,
} from "./tracker-settings"

afterEach(() => {
  Reflect.deleteProperty(globalThis, "chrome")
})

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

  test("saves normalized settings before notifying synchronization", async () => {
    const events: string[] = []
    let saved: Record<string, unknown> | undefined
    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        storage: {
          sync: {
            set: async (value: Record<string, unknown>) => {
              saved = value
              events.push("saved")
            },
          },
        },
        runtime: {
          sendMessage: async ({ action }: { action: string }) => {
            events.push(action)
          },
        },
      },
    })

    await saveTrackerSettings({
      token: " token ",
      username: " cevr ",
      checkInterval: 90,
      hideInactivePRs: true,
    })

    expect(saved).toEqual({
      token: "token",
      username: "cevr",
      checkInterval: 60,
      hideInactivePRs: true,
    })
    expect(events).toEqual(["saved", "updateSettings", "checkNow"])
  })

  test("rejects incomplete account settings before persistence", async () => {
    await expect(
      saveTrackerSettings({
        token: "",
        username: "cevr",
        checkInterval: 15,
        hideInactivePRs: true,
      }),
    ).rejects.toBeInstanceOf(InvalidTrackerSettingsError)
  })
})
