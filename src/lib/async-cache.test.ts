import { afterEach, describe, expect, test } from "bun:test"
import { createRoot, flush } from "solid-js"
import { createAsyncCache } from "./async-cache"

let dispose: (() => void) | undefined

afterEach(() => {
  dispose?.()
  dispose = undefined
})

describe("async cache", () => {
  test("deduplicates loads and preserves the ready value when refresh fails", async () => {
    let calls = 0
    let release: ((value: string) => void) | undefined
    const firstLoad = new Promise<string>((resolve) => {
      release = resolve
    })
    const cache = createRoot((rootDispose) => {
      dispose = rootDispose
      return createAsyncCache(async () => {
        calls++
        if (calls === 1) return firstLoad
        throw new Error("storage unavailable")
      })
    })

    const duplicate = cache.refresh()
    expect(calls).toBe(1)
    release?.("saved settings")
    await duplicate
    flush()

    expect(cache.state()).toEqual({
      status: "ready",
      value: "saved settings",
      refreshing: false,
    })

    await cache.refresh()
    flush()

    expect(cache.state()).toMatchObject({
      status: "ready",
      value: "saved settings",
      refreshing: false,
      error: new Error("storage unavailable"),
    })
  })
})
