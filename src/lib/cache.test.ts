import { Deferred, Effect, Schema } from "effect"
import { createRoot, flush, NotReadyError, resolve } from "@solidjs/signals"
import { describe, expect, it } from "effect-bun-test"
import { createCache } from "./cache"

class CacheLoadError extends Schema.TaggedErrorClass<CacheLoadError>()("CacheLoadError", {
  message: Schema.String,
}) {}

describe("cache", () => {
  it.live("suspends on first read, deduplicates keys, and exposes revalidation", () =>
    Effect.gen(function* () {
      const first = yield* Deferred.make<string>()
      const second = yield* Deferred.make<string>()
      let calls = 0
      let dispose: (() => void) | undefined

      const cache = createRoot((rootDispose) => {
        dispose = rootDispose
        return createCache({
          lookup: (name: string) =>
            Effect.gen(function* () {
              calls++
              if (calls === 3) {
                return yield* new CacheLoadError({ message: "revalidation unavailable" })
              }
              return yield* Deferred.await(calls === 1 ? first : second).pipe(
                Effect.map((value) => `${name}: ${value}`),
              )
            }),
          runner: { runPromise: Effect.runPromise },
        })
      })
      yield* Effect.addFinalizer(() => Effect.sync(() => dispose?.()))

      const data = cache.get("settings")
      const duplicate = cache.get("settings")
      const status = cache.status("settings")

      expect(duplicate).toBe(data)
      expect(status()).toEqual({ status: "loading" })
      expect(() => data()).toThrow(NotReadyError)
      expect(calls).toBe(1)

      yield* Deferred.succeed(first, "one")
      yield* Effect.promise(() => resolve(data))
      flush()

      expect(data()).toBe("settings: one")
      expect(status()).toEqual({ status: "ready" })

      const revalidation = cache.refresh("settings")
      flush()

      expect(data()).toBe("settings: one")
      expect(status()).toEqual({ status: "refreshing" })
      expect(calls).toBe(2)

      yield* Deferred.succeed(second, "two")
      yield* Effect.promise(() => revalidation)
      flush()

      expect(data()).toBe("settings: two")
      expect(status()).toEqual({ status: "ready" })

      yield* Effect.promise(() => cache.refresh("settings"))
      flush()

      expect(data()).toBe("settings: two")
      expect(status()).toEqual({
        status: "failed",
        error: new CacheLoadError({ message: "revalidation unavailable" }),
      })
    }).pipe(Effect.scoped),
  )

  it.live("surfaces typed failures through status and retries after invalidation", () =>
    Effect.gen(function* () {
      const recovery = yield* Deferred.make<string>()
      let calls = 0
      let dispose: (() => void) | undefined

      const cache = createRoot((rootDispose) => {
        dispose = rootDispose
        return createCache({
          lookup: () =>
            Effect.suspend(() => {
              calls++
              return calls === 1
                ? Effect.fail(new CacheLoadError({ message: "storage unavailable" }))
                : Deferred.await(recovery)
            }),
          runner: { runPromise: Effect.runPromise },
        })
      })
      yield* Effect.addFinalizer(() => Effect.sync(() => dispose?.()))

      const data = cache.get()
      const status = cache.status()

      expect(() => data()).toThrow(NotReadyError)
      yield* Effect.promise(() => resolve(data).catch(() => undefined))
      flush()

      expect(status()).toEqual({
        status: "failed",
        error: new CacheLoadError({ message: "storage unavailable" }),
      })

      const retry = cache.refresh()
      flush()
      expect(status()).toEqual({ status: "loading" })

      yield* Deferred.succeed(recovery, "recovered")
      yield* Effect.promise(() => retry)
      flush()

      expect(data()).toBe("recovered")
      expect(status()).toEqual({ status: "ready" })
    }).pipe(Effect.scoped),
  )
})
