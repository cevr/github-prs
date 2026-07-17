import { Effect } from "effect"
import { describe, expect, it, yieldFibers } from "effect-bun-test"
import { createRoot, flush } from "@solidjs/signals"
import type { PRData, SyncState } from "@/types"
import { usePRSnapshot } from "./use-pr-snapshot"

const emptyPRs: PRData = { created: [], assigned: [] }

interface MockState {
  sync: Record<string, unknown>
  local: Record<string, unknown>
}

function createChromeMock(state: MockState) {
  const listeners = new Set<(message: { action: string }) => void>()
  const messages: Array<{ action: string; prId?: number }> = []
  const select = (source: Record<string, unknown>, keys: string[]) =>
    Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]))

  const mock = {
    storage: {
      sync: {
        get: (keys: string[]) => resolved(select(state.sync, keys)),
        remove: (key: string) => resolved(Reflect.deleteProperty(state.sync, key)),
      },
      local: {
        get: (keys: string[]) => resolved(select(state.local, keys)),
        set: (value: Record<string, unknown>) => {
          Object.assign(state.local, value)
          return resolved(undefined)
        },
      },
    },
    runtime: {
      onMessage: {
        addListener: (listener: (message: { action: string }) => void) => listeners.add(listener),
        removeListener: (listener: (message: { action: string }) => void) =>
          listeners.delete(listener),
      },
      sendMessage: (message: { action: string; prId?: number }) => {
        messages.push(message)
      },
    },
  }

  return {
    emit(action: string) {
      for (const listener of listeners) listener({ action })
    },
    messages,
    mock,
  }
}

function resolved<A>(value: A): Promise<A> {
  return Effect.runPromise(Effect.succeed(value))
}

function installChrome(state: MockState) {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const controller = createChromeMock(state)
      Object.defineProperty(globalThis, "chrome", {
        configurable: true,
        value: controller.mock,
      })
      return controller
    }),
    () =>
      Effect.sync(() => {
        Reflect.deleteProperty(globalThis, "chrome")
      }),
  )
}

function createSnapshotModel() {
  return Effect.acquireRelease(
    Effect.sync(() => {
      let dispose: () => void = () => undefined
      const model = createRoot((rootDispose) => {
        dispose = rootDispose
        return usePRSnapshot()
      })
      return { dispose, model }
    }),
    ({ dispose }) => Effect.sync(dispose),
  )
}

const settle = yieldFibers.pipe(Effect.andThen(Effect.sync(flush)))

describe("PR snapshot", () => {
  it.scopedLive("keeps the cached snapshot available while refresh runs and fails", () =>
    Effect.gen(function* () {
      const storage: MockState = {
        sync: { username: "cevr" },
        local: {
          githubToken: "token",
          previousPRs: emptyPRs,
          seenPRs: {},
          syncState: { status: "idle", lastSyncedAt: "2026-07-16T12:00:00.000Z" },
        },
      }
      const mock = yield* installChrome(storage)
      const { model } = yield* createSnapshotModel()
      yield* settle

      expect(model.state().kind).toBe("available")
      model.refresh()
      flush()
      expect(model.state()).toMatchObject({
        kind: "available",
        snapshot: { prs: emptyPRs },
        sync: { status: "syncing" },
      })

      const failedSync: SyncState = {
        status: "error",
        lastSyncedAt: "2026-07-16T12:00:00.000Z",
        message: "offline",
      }
      storage.local["syncState"] = failedSync
      mock.emit("prSnapshotChanged")
      yield* settle

      expect(model.state()).toMatchObject({
        kind: "available",
        snapshot: { prs: emptyPRs },
        sync: { status: "error", message: "offline" },
      })
    }),
  )

  it.scopedLive("requests the first sync only when no local snapshot exists", () =>
    Effect.gen(function* () {
      const mock = yield* installChrome({
        sync: { username: "cevr" },
        local: { githubToken: "token", seenPRs: {}, syncState: { status: "idle" } },
      })
      const { model } = yield* createSnapshotModel()
      yield* settle

      expect(model.state()).toEqual({ kind: "loading" })
      expect(mock.messages).toEqual([{ action: "checkNow" }])
      mock.emit("prSnapshotChanged")
      yield* settle
      expect(mock.messages).toEqual([{ action: "checkNow" }])
    }),
  )

  it.scopedLive("makes an interrupted persisted sync retryable", () =>
    Effect.gen(function* () {
      const mock = yield* installChrome({
        sync: { username: "cevr" },
        local: {
          githubToken: "token",
          previousPRs: emptyPRs,
          seenPRs: {},
          syncState: { status: "syncing", lastSyncedAt: "2026-07-16T12:00:00.000Z" },
        },
      })
      const { model } = yield* createSnapshotModel()
      yield* settle

      expect(model.state()).toMatchObject({
        kind: "available",
        sync: { status: "error", message: "The previous refresh was interrupted. Try again." },
      })

      model.refresh()
      expect(mock.messages).toEqual([{ action: "checkNow" }])
    }),
  )

  it.scopedLive("represents missing credentials without a magic error", () =>
    Effect.gen(function* () {
      yield* installChrome({ sync: {}, local: {} })
      const { model } = yield* createSnapshotModel()
      yield* settle

      expect(model.state()).toEqual({ kind: "setup-needed" })
    }),
  )
})
