import { Cause, Duration, Effect, MutableHashMap, Option } from "effect"
import {
  createMemo,
  createSignal,
  getOwner,
  refresh as refreshSolid,
  resolve,
  runWithOwner,
} from "@solidjs/signals"
import type { Accessor, SourceAccessor } from "@solidjs/signals"

export type CacheStatus =
  | { readonly status: "loading" }
  | { readonly status: "ready" }
  | { readonly status: "refreshing" }
  | { readonly status: "failed"; readonly error: Error }

export interface EffectRunner<R> {
  readonly runPromise: <A, E>(effect: Effect.Effect<A, E, R>) => Promise<A>
}

export interface CacheOptions<Args extends Array<unknown>, A, E, R> {
  readonly lookup: (...args: Args) => Effect.Effect<A, E, R>
  readonly runner: EffectRunner<R>
}

export interface SolidCache<Args extends Array<unknown>, A> {
  readonly get: (...args: Args) => Accessor<A>
  readonly status: (...args: Args) => Accessor<CacheStatus>
  readonly refresh: (...args: Args) => Promise<void>
}

interface Entry<A> {
  readonly data: SourceAccessor<A>
  readonly status: Accessor<CacheStatus>
  readonly setStatus: (status: CacheStatus) => CacheStatus
  readonly invalidate: Effect.Effect<void>
  refreshPromise?: Promise<void>
}

function toError(cause: Cause.Cause<unknown>): Error {
  const failure = Cause.squash(cause)
  return failure instanceof Error ? failure : new Error("Unable to load cached data.")
}

export function createCache<Args extends Array<unknown>, A, E, R>(
  options: CacheOptions<Args, A, E, R>,
): SolidCache<Args, A> {
  const owner = getOwner()
  const entries = MutableHashMap.empty<Args, Entry<A>>()

  const entryFor = (args: Args): Entry<A> => {
    const existing = MutableHashMap.get(entries, args)
    if (Option.isSome(existing)) return existing.value

    const entry = runWithOwner(owner, () => {
      let lastValue = Option.none<A>()
      const [read, invalidate] = Effect.runSync(
        Effect.cachedInvalidateWithTTL(options.lookup.apply(undefined, args), Duration.infinity),
      )
      const [status, setStatus] = createSignal<CacheStatus>(
        { status: "loading" },
        { ownedWrite: true },
      )
      const data = createMemo(
        () => {
          const operation = read.pipe(
            Effect.tap((value) =>
              Effect.sync(() => {
                lastValue = Option.some(value)
                setStatus({ status: "ready" })
              }),
            ),
            Effect.tapCause((cause) =>
              Effect.sync(() => setStatus({ status: "failed", error: toError(cause) })),
            ),
          )
          return options.runner.runPromise(operation).catch((error: unknown) => {
            if (Option.isSome(lastValue)) return lastValue.value
            throw error
          })
        },
        { lazy: true, name: "EffectCache.data" },
      )
      return { data, status, setStatus, invalidate }
    })
    MutableHashMap.set(entries, args, entry)
    return entry
  }

  const get = (...args: Args): Accessor<A> => entryFor(args).data
  const status = (...args: Args): Accessor<CacheStatus> => entryFor(args).status
  const refresh = (...args: Args): Promise<void> => {
    const entry = entryFor(args)
    if (entry.refreshPromise) return entry.refreshPromise

    const currentStatus = entry.status().status
    entry.setStatus({
      status:
        currentStatus === "ready" || currentStatus === "refreshing" ? "refreshing" : "loading",
    })
    Effect.runSync(entry.invalidate)
    refreshSolid(entry.data)
    const promise = resolve(entry.data)
      .then(() => undefined)
      .finally(() => {
        entry.refreshPromise = undefined
      })
    entry.refreshPromise = promise
    return promise
  }

  return { get, status, refresh }
}
