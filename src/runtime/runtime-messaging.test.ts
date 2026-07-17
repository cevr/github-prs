import { Effect } from "effect"
import { describe, expect, it } from "effect-bun-test"
import { installRuntimeCommandHandler, subscribeToRuntimeEvents } from "./runtime-messaging"

type Listener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  respond: () => void,
) => void

function installChrome() {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const listeners = new Set<Listener>()
      Object.defineProperty(globalThis, "chrome", {
        configurable: true,
        value: {
          runtime: {
            onMessage: {
              addListener: (listener: Listener) => listeners.add(listener),
              removeListener: (listener: Listener) => listeners.delete(listener),
            },
          },
        },
      })
      return {
        emit(message: unknown) {
          let responses = 0
          for (const listener of listeners) listener(message, {}, () => responses++)
          return responses
        },
        listenerCount: () => listeners.size,
      }
    }),
    () =>
      Effect.sync(() => {
        Reflect.deleteProperty(globalThis, "chrome")
      }),
  )
}

describe("runtime messaging", () => {
  it.scopedLive("routes only validated commands and removes its listener", () =>
    Effect.gen(function* () {
      const chrome = yield* installChrome()
      const commands: string[] = []
      const remove = installRuntimeCommandHandler((command) => commands.push(command.action))

      expect(chrome.emit({ action: "markPRViewed" })).toBe(0)
      expect(chrome.emit({ action: "markPRViewed", prId: 42 })).toBe(1)
      expect(chrome.emit({ action: "unknown" })).toBe(0)
      expect(commands).toEqual(["markPRViewed"])

      remove()
      expect(chrome.listenerCount()).toBe(0)
    }),
  )

  it.scopedLive("keeps commands out of event subscriptions", () =>
    Effect.gen(function* () {
      const chrome = yield* installChrome()
      const events: string[] = []
      const remove = subscribeToRuntimeEvents((event) => events.push(event.action))

      chrome.emit({ action: "checkNow" })
      chrome.emit({ action: "prSnapshotChanged" })
      chrome.emit({ action: "setupNeeded", unexpected: true })
      expect(events).toEqual(["prSnapshotChanged", "setupNeeded"])

      remove()
      expect(chrome.listenerCount()).toBe(0)
    }),
  )
})
