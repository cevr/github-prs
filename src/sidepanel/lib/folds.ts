import { Effect, Option, Schema } from "effect"
import { KeyValueStore } from "effect/persistence"
import { createSignal } from "solid-js"
import type { Perspective, Stage } from "@/lib/pr-status"

const FOLDS_KEY_FROM_BEFORE_STACK_FOLDS = "collapsedSections"

const foldStore = Effect.map(KeyValueStore.KeyValueStore, (store) =>
  KeyValueStore.toSchemaStore(store, Schema.Array(Schema.String)),
).pipe(Effect.provide(KeyValueStore.layerStorage(() => localStorage)))

const STACK = ":stack:"

function sectionKey(perspective: Perspective, stage: Stage): string {
  return `${perspective}:${stage}`
}

function stackKey(perspective: Perspective, stack: string): string {
  return `${perspective}${STACK}${stack}`
}

function read(): ReadonlySet<string> {
  return Effect.runSync(
    foldStore.pipe(
      Effect.flatMap((store) => store.get(FOLDS_KEY_FROM_BEFORE_STACK_FOLDS)),
      Effect.map(
        Option.match({ onNone: () => new Set<string>(), onSome: (saved) => new Set(saved) }),
      ),
      Effect.catchCause(() => Effect.succeed(new Set<string>())),
    ),
  )
}

function write(folded: ReadonlySet<string>) {
  Effect.runSync(
    foldStore.pipe(
      Effect.flatMap((store) => store.set(FOLDS_KEY_FROM_BEFORE_STACK_FOLDS, Array.from(folded))),
      Effect.catchCause(() => Effect.void),
    ),
  )
}

export type Folds = ReturnType<typeof createFolds>

export function createFolds() {
  let latestAheadOfSignal = read()
  const [folded, setFolded] = createSignal(latestAheadOfSignal)
  const commit = (next: ReadonlySet<string>) => {
    latestAheadOfSignal = next
    setFolded(next)
    write(next)
  }
  const toggle = (key: string) => {
    const next = new Set(latestAheadOfSignal)
    if (!next.delete(key)) next.add(key)
    commit(next)
  }

  return {
    isSectionFolded: (perspective: Perspective, stage: Stage) =>
      folded().has(sectionKey(perspective, stage)),
    toggleSection: (perspective: Perspective, stage: Stage) =>
      toggle(sectionKey(perspective, stage)),
    isStackFolded: (perspective: Perspective, stack: string) =>
      folded().has(stackKey(perspective, stack)),
    toggleStack: (perspective: Perspective, stack: string) => toggle(stackKey(perspective, stack)),
    keepStacks: (
      live: readonly { readonly perspective: Perspective; readonly stack: string }[],
    ) => {
      const keep = new Set(live.map((entry) => stackKey(entry.perspective, entry.stack)))
      const next = new Set(
        Array.from(latestAheadOfSignal).filter((key) => !key.includes(STACK) || keep.has(key)),
      )
      if (next.size !== latestAheadOfSignal.size) commit(next)
    },
  }
}
