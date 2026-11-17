import { Effect, Option, Schema } from "effect"
import { KeyValueStore } from "effect/persistence"
import { createSignal } from "solid-js"
import type { PRCollection } from "@/lib/pr-collection"
import type { Perspective, Stage } from "@/lib/pr-status"

const FOLDS_KEY_FROM_BEFORE_STACK_FOLDS = "collapsedSections"

const foldStore = Effect.map(KeyValueStore.KeyValueStore, (store) =>
  KeyValueStore.toSchemaStore(store, Schema.Array(Schema.String)),
).pipe(Effect.provide(KeyValueStore.layerStorage(() => localStorage)))

const STACK = ":stack:"
const REPOSITORY = ":repository:"

function repositoryKey(perspective: Perspective, repository: string): string {
  return `${perspective}${REPOSITORY}${repository}`
}

function sectionKey(perspective: Perspective, repository: string, stage: Stage): string {
  return `${repositoryKey(perspective, repository)}:${stage}`
}

function stackKey(perspective: Perspective, stack: string): string {
  return `${perspective}${STACK}${stack}`
}

function liveKeys(perspective: Perspective, collection: PRCollection): string[] {
  return collection.repositories.flatMap((group) => [
    repositoryKey(perspective, group.repository),
    ...group.stacks.map((stack) => stackKey(perspective, stack.key)),
    ...group.sections.map((section) => sectionKey(perspective, group.repository, section.stage)),
  ])
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
    isRepositoryFolded: (perspective: Perspective, repository: string) =>
      folded().has(repositoryKey(perspective, repository)),
    toggleRepository: (perspective: Perspective, repository: string) =>
      toggle(repositoryKey(perspective, repository)),
    isSectionFolded: (perspective: Perspective, repository: string, stage: Stage) =>
      folded().has(sectionKey(perspective, repository, stage)),
    toggleSection: (perspective: Perspective, repository: string, stage: Stage) =>
      toggle(sectionKey(perspective, repository, stage)),
    isStackFolded: (perspective: Perspective, stack: string) =>
      folded().has(stackKey(perspective, stack)),
    toggleStack: (perspective: Perspective, stack: string) => toggle(stackKey(perspective, stack)),
    keepLive: (collections: Readonly<Record<Perspective, PRCollection>>) => {
      const keep = new Set([
        ...liveKeys("authored", collections.authored),
        ...liveKeys("reviewing", collections.reviewing),
      ])
      const next = new Set(Array.from(latestAheadOfSignal).filter((key) => keep.has(key)))
      if (next.size !== latestAheadOfSignal.size) commit(next)
    },
  }
}
