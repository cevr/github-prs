import { createSignal, createMemo, Switch, Match, For, Show, onSettled } from "solid-js"
import { Errored, Loading } from "@solidjs/web"
import { usePRSnapshot } from "@/lib/use-pr-snapshot"
import { createPRCollection } from "@/lib/pr-collection"
import { getErrorMessage } from "@/lib/format"
import { setupKeyboardNav } from "./lib/keyboard"
import { Header } from "./components/header"
import { TabBar } from "./components/tab-bar"
import type { Tab } from "./components/tab-bar"
import { RepoGroup } from "./components/repo-group"
import { EmptyState } from "./components/empty-state"
import { SetupPrompt } from "./components/setup-prompt"

function SidePanelContent() {
  const { state, refresh, markSeen } = usePRSnapshot()
  const [activeTab, setActiveTab] = createSignal<Tab>("mine")

  onSettled(() => setupKeyboardNav("#pr-list"))

  const available = createMemo(() => {
    const current = state()
    return current.kind === "available" ? current : undefined
  })
  const unavailable = createMemo(() => {
    const current = state()
    return current.kind === "unavailable" ? current : undefined
  })
  const mineCollection = createMemo(() =>
    createPRCollection(available()?.snapshot.prs.created ?? [], available()?.snapshot.seen ?? {}),
  )
  const reviewCollection = createMemo(() =>
    createPRCollection(available()?.snapshot.prs.assigned ?? [], available()?.snapshot.seen ?? {}),
  )

  return (
    <Switch>
      <Match when={state().kind === "setup-needed"}>
        <Header />
        <SetupPrompt />
      </Match>
      <Match when={state().kind === "loading"}>
        <Header onRefresh={refresh} />
        <div class="space-y-2 p-3" aria-label="Loading pull requests">
          <div class="h-9 animate-pulse rounded-md bg-[#161b22]" />
          <div class="h-13 animate-pulse rounded-md bg-[#161b22]" />
          <div class="h-13 animate-pulse rounded-md bg-[#161b22]" />
        </div>
      </Match>
      <Match when={unavailable()}>
        <Header />
        <div class="text-center py-12 text-sm text-[#f85149]">{unavailable()?.message}</div>
      </Match>
      <Match when={available()}>
        {(data) => {
          const activeGroups = createMemo(() =>
            activeTab() === "mine" ? mineCollection().groups : reviewCollection().groups,
          )
          const showApproved = createMemo(() => activeTab() === "mine")

          return (
            <>
              <Header onRefresh={refresh} syncState={data().sync} />
              <Show when={data().sync.status === "error"}>
                <button
                  type="button"
                  onClick={refresh}
                  class="flex w-full items-center justify-between border-0 border-b border-[#6e3a36] bg-[#2d1618] px-3 py-2 text-left text-xs text-[#ffb4ad] hover:bg-[#3b1d20]"
                >
                  <span class="truncate">Couldn’t refresh. Showing saved pull requests.</span>
                  <span class="ml-2 shrink-0 font-semibold">Retry</span>
                </button>
              </Show>
              <TabBar
                active={activeTab()}
                onTabChange={setActiveTab}
                minePRCount={mineCollection().totalCount}
                reviewPRCount={reviewCollection().totalCount}
                mineUnseenCount={mineCollection().unseenCount}
                reviewUnseenCount={reviewCollection().unseenCount}
              />
              <div id="pr-list" class="min-h-0 flex-1 overflow-y-auto">
                <Switch>
                  <Match when={activeGroups().length === 0}>
                    <EmptyState tab={activeTab()} />
                  </Match>
                  <Match when={activeGroups().length > 0}>
                    <For each={activeGroups()}>
                      {(group) => (
                        <RepoGroup
                          group={group}
                          onMarkSeen={markSeen}
                          showApproved={showApproved()}
                        />
                      )}
                    </For>
                  </Match>
                </Switch>
              </div>
            </>
          )
        }}
      </Match>
    </Switch>
  )
}

export function SidePanel() {
  return (
    <div class="flex flex-col h-screen bg-[#0d1117] text-[#e6edf3]">
      <Errored
        fallback={(error) => (
          <>
            <Header />
            <div class="text-center py-12 text-sm text-[#f85149]">
              {getErrorMessage(error(), "Unable to render pull requests.")}
            </div>
          </>
        )}
      >
        <Loading fallback={<div class="text-center py-12 text-sm text-[#8b949e]">Loading...</div>}>
          <SidePanelContent />
        </Loading>
      </Errored>
    </div>
  )
}
