import { Effect, Option, Schema } from "effect"
import { KeyValueStore } from "effect/unstable/persistence"
import { createSignal } from "solid-js"
import type { Perspective, Stage } from "@/lib/pr-status"

const STORAGE_KEY = "collapsedSections"

const collapsedStore = Effect.map(KeyValueStore.KeyValueStore, (store) =>
  KeyValueStore.toSchemaStore(store, Schema.Array(Schema.String)),
).pipe(Effect.provide(KeyValueStore.layerStorage(() => localStorage)))

function key(perspective: Perspective, stage: Stage): string {
  return `${perspective}:${stage}`
}

// Web Storage is synchronous, so the panel reads its preference before its first render. Unreadable
// or blocked storage opens every section; a failed write is simply not remembered.
function read(): ReadonlySet<string> {
  return Effect.runSync(
    collapsedStore.pipe(
      Effect.flatMap((store) => store.get(STORAGE_KEY)),
      Effect.map(
        Option.match({ onNone: () => new Set<string>(), onSome: (saved) => new Set(saved) }),
      ),
      Effect.catchCause(() => Effect.succeed(new Set<string>())),
    ),
  )
}

function write(collapsed: ReadonlySet<string>) {
  Effect.runSync(
    collapsedStore.pipe(
      Effect.flatMap((store) => store.set(STORAGE_KEY, Array.from(collapsed))),
      Effect.catchCause(() => Effect.void),
    ),
  )
}

/**
 * Which sections the user folded, per tab. A view preference of this side panel, so it stays in the
 * panel's own storage on this device; every section starts open.
 */
export type CollapsedSections = ReturnType<typeof createCollapsedSections>

export function createCollapsedSections() {
  // The latest set, ahead of the signal: a signal read returns its old value until Solid flushes, so
  // two toggles in one tick would otherwise lose the first.
  let latest = read()
  const [collapsed, setCollapsed] = createSignal(latest)
  return {
    isCollapsed: (perspective: Perspective, stage: Stage) =>
      collapsed().has(key(perspective, stage)),
    toggle: (perspective: Perspective, stage: Stage) => {
      const next = new Set(latest)
      const entry = key(perspective, stage)
      if (!next.delete(entry)) next.add(entry)
      latest = next
      setCollapsed(next)
      write(next)
    },
  }
}
