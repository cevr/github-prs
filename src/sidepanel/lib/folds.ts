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

function sectionKey(perspective: Perspective, stage: Stage): string {
  return `${perspective}:${stage}`
}

function stackKey(perspective: Perspective, stack: string): string {
  return `${perspective}${STACK}${stack}`
}

function repositoryKey(perspective: Perspective, stage: Stage, repository: string): string {
  return `${sectionKey(perspective, stage)}${REPOSITORY}${repository}`
}

function liveKeys(perspective: Perspective, collection: PRCollection): string[] {
  return [
    ...collection.stacks.map((stack) => stackKey(perspective, stack.key)),
    ...collection.sections.flatMap((section) =>
      section.repositories.map((group) =>
        repositoryKey(perspective, section.stage, group.repository),
      ),
    ),
  ]
}

const followsLiveEntries = (key: string) => key.includes(STACK) || key.includes(REPOSITORY)

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
    isRepositoryFolded: (perspective: Perspective, stage: Stage, repository: string) =>
      folded().has(repositoryKey(perspective, stage, repository)),
    toggleRepository: (perspective: Perspective, stage: Stage, repository: string) =>
      toggle(repositoryKey(perspective, stage, repository)),
    keepLive: (collections: Readonly<Record<Perspective, PRCollection>>) => {
      const keep = new Set([
        ...liveKeys("authored", collections.authored),
        ...liveKeys("reviewing", collections.reviewing),
      ])
      const next = new Set(
        Array.from(latestAheadOfSignal).filter((key) => !followsLiveEntries(key) || keep.has(key)),
      )
      if (next.size !== latestAheadOfSignal.size) commit(next)
    },
  }
}
