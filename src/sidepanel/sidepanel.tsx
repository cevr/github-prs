import {
  createSignal,
  createMemo,
  ErrorBoundary,
  Suspense,
  Switch,
  Match,
  For,
  onMount,
  onCleanup,
} from "solid-js"
import type { PRData, SeenPRs } from "@/types"
import { usePRData } from "./lib/use-pr-data"
import { groupByRepo } from "./lib/group-prs"
import { setupKeyboardNav } from "./lib/keyboard"
import { Header } from "./components/header"
import { TabBar } from "./components/tab-bar"
import type { Tab } from "./components/tab-bar"
import { RepoGroup } from "./components/repo-group"
import { EmptyState } from "./components/empty-state"
import { SetupPrompt } from "./components/setup-prompt"

function countUnseen(prs: { id: number; updated_at: string }[], seenPRs: SeenPRs): number {
  let count = 0
  for (const pr of prs) {
    const seen = seenPRs[pr.id.toString()]
    if (!seen || new Date(pr.updated_at) > new Date(seen)) {
      count++
    }
  }
  return count
}

function SidePanelContent() {
  const { setup, prsData, seenPRs, refresh, markSeen } = usePRData()
  const [activeTab, setActiveTab] = createSignal<Tab>("mine")

  onMount(() => {
    const cleanup = setupKeyboardNav("#pr-list")
    onCleanup(cleanup)
  })

  const minePRs = createMemo(() => prsData()?.created ?? [])
  const reviewPRs = createMemo(() => prsData()?.assigned ?? [])

  const mineGroups = createMemo(() => groupByRepo(minePRs()))
  const reviewGroups = createMemo(() => groupByRepo(reviewPRs()))

  const mineUnseenCount = createMemo(() => countUnseen(minePRs(), seenPRs() ?? {}))
  const reviewUnseenCount = createMemo(() => countUnseen(reviewPRs(), seenPRs() ?? {}))

  return (
    <Switch>
      <Match when={setup.error?.message === "setup_needed"}>
        <Header />
        <SetupPrompt />
      </Match>
      <Match when={setup.loading || prsData.loading || seenPRs.loading}>
        <Header onRefresh={refresh} />
        <div class="text-center py-12 text-sm text-[#8b949e]">Loading...</div>
      </Match>
      <Match when={prsData.error?.message === "loading"}>
        <Header onRefresh={refresh} />
        <div class="text-center py-12 text-sm text-[#8b949e]">Loading...</div>
      </Match>
      <Match when={setup.error || prsData.error || seenPRs.error}>
        <Header />
        <div class="text-center py-12 text-sm text-[#f85149]">
          {(setup.error as Error)?.message ??
            (prsData.error as Error)?.message ??
            (seenPRs.error as Error)?.message}
        </div>
      </Match>
      <Match
        when={prsData() && seenPRs() && { prs: prsData() as PRData, seen: seenPRs() as SeenPRs }}
      >
        {(data) => {
          const activeGroups = createMemo(() =>
            activeTab() === "mine" ? mineGroups() : reviewGroups(),
          )
          const showApproved = createMemo(() => activeTab() === "mine")

          return (
            <>
              <Header onRefresh={refresh} />
              <TabBar
                active={activeTab()}
                onTabChange={setActiveTab}
                minePRCount={minePRs().length}
                reviewPRCount={reviewPRs().length}
                mineUnseenCount={mineUnseenCount()}
                reviewUnseenCount={reviewUnseenCount()}
              />
              <div id="pr-list" class="overflow-y-auto flex-1">
                <Switch>
                  <Match when={activeGroups().length === 0}>
                    <EmptyState tab={activeTab()} />
                  </Match>
                  <Match when={activeGroups().length > 0}>
                    <For each={activeGroups()}>
                      {(group) => (
                        <RepoGroup
                          group={group}
                          seenPRs={data().seen}
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
      <ErrorBoundary
        fallback={(err: Error) => (
          <>
            <Header />
            <div class="text-center py-12 text-sm text-[#f85149]">{err.message}</div>
          </>
        )}
      >
        <Suspense fallback={<div class="text-center py-12 text-sm text-[#8b949e]">Loading...</div>}>
          <SidePanelContent />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
