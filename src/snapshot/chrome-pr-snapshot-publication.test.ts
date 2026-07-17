import { Effect } from "effect"
import { describe, expect, it } from "effect-bun-test"
import type { PRData } from "@/types"
import { ChromePRSnapshotPublicationLive } from "./chrome-pr-snapshot-publication"
import { PRSnapshotPublication } from "./pr-snapshot-publication"

const emptyPRs: PRData = { created: [], assigned: [] }

function resolved<A>(value: A): Promise<A> {
  return Effect.runPromise(Effect.succeed(value))
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

describe("Chrome PR Snapshot publication", () => {
  it.scopedLive("reads and decodes one coherent snapshot", () =>
    Effect.gen(function* () {
      yield* installChrome({
        storage: {
          local: {
            get: () =>
              resolved({
                previousPRs: emptyPRs,
                seenPRs: { "1": "2026-07-16T12:00:00.000Z" },
                syncState: { status: "idle", lastSyncedAt: "2026-07-16T13:00:00.000Z" },
              }),
          },
        },
      })

      const snapshot = yield* Effect.flatMap(PRSnapshotPublication, (publication) =>
        publication.read(),
      ).pipe(Effect.provide(ChromePRSnapshotPublicationLive))

      expect(snapshot).toEqual({
        prs: emptyPRs,
        seen: { "1": "2026-07-16T12:00:00.000Z" },
        sync: { status: "idle", lastSyncedAt: "2026-07-16T13:00:00.000Z" },
      })
    }),
  )

  it.scopedLive("publishes storage before signaling surfaces and projecting attention", () =>
    Effect.gen(function* () {
      const events: string[] = []
      let stored: Record<string, unknown> | undefined
      yield* installChrome({
        storage: {
          local: {
            set: (value: Record<string, unknown>) => {
              stored = value
              events.push("stored")
              return resolved(undefined)
            },
          },
        },
        runtime: {
          sendMessage: () => {
            events.push("signaled")
            return resolved(undefined)
          },
        },
        action: {
          setBadgeText: () => {
            events.push("badge-text")
            return resolved(undefined)
          },
          setBadgeTextColor: () => resolved(undefined),
          setBadgeBackgroundColor: () => resolved(undefined),
        },
      })

      yield* Effect.flatMap(PRSnapshotPublication, (publication) =>
        publication.publish({
          kind: "snapshot",
          prs: emptyPRs,
          seen: {},
          sync: { status: "idle" },
          attention: { total: 1, hasUnseen: true },
        }),
      ).pipe(Effect.provide(ChromePRSnapshotPublicationLive))

      expect(stored).toEqual({ previousPRs: emptyPRs, seenPRs: {}, syncState: { status: "idle" } })
      expect(events.slice(0, 2)).toEqual(["stored", "signaled"])
      expect(events).toContain("badge-text")
    }),
  )

  it.scopedLive("clears snapshot storage, surfaces, and badge through one operation", () =>
    Effect.gen(function* () {
      const removals: string[][] = []
      const messages: string[] = []
      const badges: string[] = []
      yield* installChrome({
        storage: {
          local: {
            remove: (keys: string[]) => {
              removals.push(keys)
              return resolved(undefined)
            },
          },
        },
        runtime: {
          sendMessage: ({ action }: { action: string }) => {
            messages.push(action)
            return resolved(undefined)
          },
        },
        action: {
          setBadgeText: ({ text }: { text: string }) => {
            badges.push(text)
            return resolved(undefined)
          },
        },
      })

      yield* Effect.flatMap(PRSnapshotPublication, (publication) => publication.clear()).pipe(
        Effect.provide(ChromePRSnapshotPublicationLive),
      )

      expect(removals).toEqual([["previousPRs", "seenPRs", "syncState"]])
      expect(messages).toEqual(["setupNeeded"])
      expect(badges).toEqual([""])
    }),
  )
})
