import { afterEach, describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
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
      sync: { get: async (keys: string[]) => select(state.sync, keys) },
      local: { get: async (keys: string[]) => select(state.local, keys) },
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

  Object.defineProperty(globalThis, "chrome", { configurable: true, value: mock })

  return {
    emit(action: string) {
      for (const listener of listeners) listener({ action })
    },
    messages,
  }
}

async function settle() {
  await Promise.resolve()
  await Promise.resolve()
}

let dispose: (() => void) | undefined

afterEach(() => {
  dispose?.()
  dispose = undefined
  Reflect.deleteProperty(globalThis, "chrome")
})

describe("PR snapshot", () => {
  test("keeps the cached snapshot available while refresh runs and fails", async () => {
    const storage: MockState = {
      sync: { token: "token", username: "cevr" },
      local: {
        previousPRs: emptyPRs,
        seenPRs: {},
        syncState: { status: "idle", lastSyncedAt: "2026-07-16T12:00:00.000Z" },
      },
    }
    const mock = createChromeMock(storage)
    const model = createRoot((rootDispose) => {
      dispose = rootDispose
      return usePRSnapshot()
    })
    await settle()

    expect(model.state().kind).toBe("available")
    model.refresh()
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
    storage.local.syncState = failedSync
    mock.emit("syncStateChanged")
    await settle()

    expect(model.state()).toMatchObject({
      kind: "available",
      snapshot: { prs: emptyPRs },
      sync: { status: "error", message: "offline" },
    })
  })

  test("requests the first sync only when no local snapshot exists", async () => {
    const mock = createChromeMock({
      sync: { token: "token", username: "cevr" },
      local: { seenPRs: {}, syncState: { status: "idle" } },
    })
    const model = createRoot((rootDispose) => {
      dispose = rootDispose
      return usePRSnapshot()
    })
    await settle()

    expect(model.state()).toEqual({ kind: "loading" })
    expect(mock.messages).toEqual([{ action: "checkNow" }])
    mock.emit("syncStateChanged")
    await settle()
    expect(mock.messages).toEqual([{ action: "checkNow" }])
  })

  test("represents missing credentials without a magic error", async () => {
    createChromeMock({ sync: {}, local: {} })
    const model = createRoot((rootDispose) => {
      dispose = rootDispose
      return usePRSnapshot()
    })
    await settle()

    expect(model.state()).toEqual({ kind: "setup-needed" })
  })
})
