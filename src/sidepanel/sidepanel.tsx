import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onSettled,
  Show,
  Switch,
} from "solid-js"
import { Errored, Loading } from "@solidjs/web"
import { getErrorMessage } from "@/lib/format"
import { createPRCollection } from "@/lib/pr-collection"
import type { PRCollection, PRCollectionItem } from "@/lib/pr-collection"
import type { Perspective } from "@/lib/pr-status"
import { usePRSnapshot } from "@/lib/use-pr-snapshot"
import type { CachedPRSnapshot } from "@/lib/use-pr-snapshot"
import type { SyncState } from "@/types"
import { EmptyState } from "./components/empty-state"
import { Header, RefreshButton, SettingsButton } from "./components/header"
import { PRSection } from "./components/pr-section"
import { PRStack } from "./components/pr-stack"
import { AuthoredRow, ReviewRow } from "./components/pr-row"
import { SetupPrompt } from "./components/setup-prompt"
import { PERSPECTIVE } from "./components/stage"
import { Tabs } from "./components/tabs"
import { createFolds } from "./lib/folds"
import type { Folds } from "./lib/folds"
import { setupKeyboardNav } from "./lib/keyboard"
import { TrackerProvider, useTracker } from "./tracker"

const PERSPECTIVES: readonly Perspective[] = ["authored", "reviewing"]

function SyncErrorBanner() {
  const { actions } = useTracker()
  return (
    <button
      type="button"
      onClick={() => actions.refresh()}
      class="flex w-full shrink-0 items-center justify-between gap-3 border-0 border-y border-danger/30 bg-danger/10 px-3.5 py-2 text-left text-xs text-danger transition-[background-color] duration-100 ease-out hover:bg-danger/15 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <span class="truncate">Couldn’t refresh. Showing saved pull requests.</span>
      <span class="shrink-0 font-semibold">Retry</span>
    </button>
  )
}

function Skeleton() {
  return (
    <div class="space-y-3 p-3" aria-label="Loading pull requests">
      <div class="h-3 w-28 animate-pulse rounded bg-surface" />
      <For each={[0, 1, 2, 3]}>
        {() => (
          <div class="flex animate-pulse items-center gap-3">
            <div class="h-9 flex-1 rounded-md bg-surface" />
            <div class="size-5 rounded-full bg-surface" />
          </div>
        )}
      </For>
    </div>
  )
}

function PRList(props: {
  readonly perspective: Perspective
  readonly collection: PRCollection
  readonly viewer: string
  readonly folds: Folds
}) {
  const row = (item: PRCollectionItem) => (
    <Switch>
      <Match when={props.perspective === "authored"}>
        <AuthoredRow item={item} />
      </Match>
      <Match when={props.perspective === "reviewing"}>
        <ReviewRow item={item} viewer={props.viewer} />
      </Match>
    </Switch>
  )

  return (
    <Show
      when={props.collection.stacks.length > 0 || props.collection.sections.length > 0}
      fallback={<EmptyState perspective={props.perspective} />}
    >
      <For each={props.collection.stacks} keyed={(stack) => stack.key}>
        {(stack) => (
          <PRStack
            stack={stack()}
            collapsed={props.folds.isStackFolded(props.perspective, stack().key)}
            onToggle={() => props.folds.toggleStack(props.perspective, stack().key)}
            row={row}
          />
        )}
      </For>
      <For each={props.collection.sections} keyed={(section) => section.stage}>
        {(section) => (
          <PRSection
            stage={section().stage}
            count={section().items.length}
            unseen={section().unseen}
            collapsed={props.folds.isSectionFolded(props.perspective, section().stage)}
            onToggle={() => props.folds.toggleSection(props.perspective, section().stage)}
          >
            <For each={section().items} keyed={(item) => item.pr.id}>
              {(item) => <li>{row(item())}</li>}
            </For>
          </PRSection>
        )}
      </For>
    </Show>
  )
}

function Tracker(props: { readonly snapshot: CachedPRSnapshot; readonly sync: SyncState }) {
  const [perspective, setPerspective] = createSignal<Perspective>("authored")
  const folds = createFolds()
  const collections = createMemo(() => {
    const { prs, seen, viewer } = props.snapshot
    return {
      authored: createPRCollection(prs.authored, seen, { perspective: "authored", viewer }),
      reviewing: createPRCollection(prs.reviewing, seen, { perspective: "reviewing", viewer }),
    }
  })
  createEffect(
    () =>
      PERSPECTIVES.flatMap((tab) =>
        collections()[tab].stacks.map((stack) => ({ perspective: tab, stack: stack.key })),
      ),
    (live) => folds.keepStacks(live),
  )
  const choose = (value: string) => {
    const next = PERSPECTIVES.find((candidate) => candidate === value)
    if (next) setPerspective(next)
  }

  return (
    <>
      <Header sync={props.sync}>
        <RefreshButton syncing={props.sync.status === "syncing"} />
        <SettingsButton />
      </Header>
      <Show when={props.sync.status === "error"}>
        <SyncErrorBanner />
      </Show>
      <Tabs.Root value={perspective()} onChange={choose}>
        <Tabs.List label="Pull request lists">
          <For each={PERSPECTIVES}>
            {(value) => (
              <Tabs.Tab value={value}>
                {PERSPECTIVE[value].tab}
                <Tabs.Count
                  total={collections()[value].totalCount}
                  unseen={collections()[value].unseenCount}
                />
              </Tabs.Tab>
            )}
          </For>
        </Tabs.List>
        <For each={PERSPECTIVES}>
          {(value) => (
            <Tabs.Panel value={value} class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <PRList
                perspective={value}
                collection={collections()[value]}
                viewer={props.snapshot.viewer}
                folds={folds}
              />
            </Tabs.Panel>
          )}
        </For>
      </Tabs.Root>
    </>
  )
}

function SidePanelContent() {
  const { state } = useTracker()
  onSettled(() => setupKeyboardNav())

  const available = createMemo(() => {
    const current = state.snapshot()
    if (current.kind === "available") return current
    return undefined
  })
  const unavailable = createMemo(() => {
    const current = state.snapshot()
    if (current.kind === "unavailable") return current
    return undefined
  })

  return (
    <Switch>
      <Match when={state.snapshot().kind === "setup-needed"}>
        <Header>
          <SettingsButton />
        </Header>
        <SetupPrompt />
      </Match>
      <Match when={state.snapshot().kind === "loading"}>
        <Header sync={{ status: "syncing" }}>
          <RefreshButton syncing />
          <SettingsButton />
        </Header>
        <Skeleton />
      </Match>
      <Match when={unavailable()}>
        {(failure) => (
          <>
            <Header>
              <RefreshButton syncing={false} />
              <SettingsButton />
            </Header>
            <p role="alert" class="m-0 px-6 py-14 text-center text-sm text-danger">
              {failure().message}
            </p>
          </>
        )}
      </Match>
      <Match when={available()}>
        {(data) => <Tracker snapshot={data().snapshot} sync={data().sync} />}
      </Match>
    </Switch>
  )
}

export function SidePanel() {
  const { state, refresh, markSeen } = usePRSnapshot()
  return (
    <TrackerProvider
      value={{
        state: { snapshot: state },
        actions: { refresh, markSeen, openSettings: () => void chrome.runtime.openOptionsPage() },
      }}
    >
      <div class="flex h-screen flex-col bg-canvas text-fg">
        <Errored
          fallback={(error) => (
            <p role="alert" class="m-0 px-6 py-14 text-center text-sm text-danger">
              {getErrorMessage(error(), "Unable to render pull requests.")}
            </p>
          )}
        >
          <Loading fallback={<Skeleton />}>
            <SidePanelContent />
          </Loading>
        </Errored>
      </div>
    </TrackerProvider>
  )
}
