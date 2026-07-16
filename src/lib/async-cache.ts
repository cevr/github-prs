import { createSignal } from "solid-js"
import type { Accessor } from "solid-js"

export type AsyncCacheState<T> =
  | { status: "loading" }
  | { status: "failed"; error: Error }
  | { status: "ready"; value: T; refreshing: boolean; error?: Error }

export interface AsyncCache<T> {
  state: Accessor<AsyncCacheState<T>>
  refresh(): Promise<void>
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Unable to load saved data.")
}

export function createAsyncCache<T>(load: () => Promise<T>): AsyncCache<T> {
  const [state, setState] = createSignal<AsyncCacheState<T>>(
    { status: "loading" },
    { ownedWrite: true },
  )
  let inFlight: Promise<void> | undefined

  const refresh = (): Promise<void> => {
    if (inFlight) return inFlight

    setState((current) =>
      current.status === "ready" ? { ...current, refreshing: true, error: undefined } : current,
    )
    const operation = load()
      .then((value) => {
        setState({ status: "ready", value, refreshing: false })
      })
      .catch((error: unknown) => {
        setState((current) =>
          current.status === "ready"
            ? { ...current, refreshing: false, error: toError(error) }
            : { status: "failed", error: toError(error) },
        )
      })
      .finally(() => {
        inFlight = undefined
      })
    inFlight = operation
    return operation
  }

  void refresh()
  return { state, refresh }
}
