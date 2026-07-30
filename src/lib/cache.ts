import { Cause, Duration, Effect, MutableHashMap, Option, Schema } from "effect"
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
  queuedRefreshPromise?: Promise<void>
}

class CacheDataError extends Schema.TaggedErrorClass<CacheDataError>()("CacheDataError", {
  message: Schema.String,
}) {}

function toError(cause: Cause.Cause<unknown>): Error {
  const failure = Cause.squash(cause)
  if (failure instanceof Error) return failure
  return new CacheDataError({ message: "Unable to load cached data." })
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
            Effect.catchCause((cause) =>
              Option.match(lastValue, {
                onNone: () => Effect.failCause(cause),
                onSome: (value) => Effect.succeed(value),
              }),
            ),
          )
          return options.runner.runPromise(operation)
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
    const startRefresh = () => {
      const currentStatus = entry.status().status
      if (currentStatus === "ready" || currentStatus === "refreshing") {
        entry.setStatus({ status: "refreshing" })
      } else {
        entry.setStatus({ status: "loading" })
      }
      Effect.runSync(entry.invalidate)
      refreshSolid(entry.data)
      const promise = resolve(entry.data)
        .then(() => undefined)
        .finally(() => {
          if (entry.refreshPromise === promise) entry.refreshPromise = undefined
        })
      entry.refreshPromise = promise
      return promise
    }

    if (!entry.refreshPromise) return startRefresh()
    if (entry.queuedRefreshPromise) return entry.queuedRefreshPromise

    const runQueuedRefresh = () => {
      entry.queuedRefreshPromise = undefined
      return startRefresh()
    }
    const queued = entry.refreshPromise.then(runQueuedRefresh, runQueuedRefresh)
    entry.queuedRefreshPromise = queued
    return queued
  }

  return { get, status, refresh }
}
