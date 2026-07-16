import { createMemo, For, Match, Show, Switch } from "solid-js"
import { Errored, Loading } from "@solidjs/web"
import { getErrorMessage, getTimeAgo } from "@/lib/format"
import { createPRCollection } from "@/lib/pr-collection"
import { usePRSnapshot } from "@/lib/use-pr-snapshot"
import type { PR, SeenPRs } from "@/types"

function DashboardList(props: {
  title: string
  description: string
  prs: PR[]
  seenPRs: SeenPRs
  emptyMessage: string
  showApproved?: boolean
  onMarkSeen: (prId: number) => void
}) {
  const collection = createMemo(() => createPRCollection(props.prs, props.seenPRs))

  return (
    <section class="overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117]">
      <header class="flex min-h-20 items-center justify-between gap-4 border-b border-[#30363d] px-5 py-4">
        <div>
          <h2 class="m-0 text-base font-semibold text-[#f0f6fc]">{props.title}</h2>
          <p class="mt-1 mb-0 text-xs text-[#8b949e]">{props.description}</p>
        </div>
        <div class="flex items-center gap-2 text-xs tabular-nums text-[#8b949e]">
          <Show when={collection().unseenCount > 0}>
            <span class="rounded-full bg-[#1f6feb] px-2 py-1 font-semibold text-white">
              {collection().unseenCount} new
            </span>
          </Show>
          <span>{collection().totalCount} total</span>
        </div>
      </header>

      <Show
        when={collection().groups.length > 0}
        fallback={
          <div class="grid min-h-44 place-items-center px-6 text-center text-sm text-[#8b949e]">
            {props.emptyMessage}
          </div>
        }
      >
        <div>
          <For each={collection().groups}>
            {(group) => (
              <section class="border-t border-[#21262d] first:border-t-0">
                <div class="flex items-center justify-between bg-[#161b22] px-5 py-2.5 text-xs font-medium text-[#b1bac4]">
                  <span>{group.repo}</span>
                  <span class="tabular-nums text-[#8b949e]">{group.items.length}</span>
                </div>
                <For each={group.items}>
                  {(item) => (
                    <a
                      href={item.pr.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => props.onMarkSeen(item.pr.id)}
                      class="grid grid-cols-[12px_minmax(0,1fr)_auto] items-start gap-3 border-t border-[#21262d] px-5 py-3.5 text-[#f0f6fc] no-underline outline-none first:border-t-0 hover:bg-[#161b22] focus-visible:bg-[#161b22] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#58a6ff]"
                    >
                      <span class="flex h-5 items-center justify-center" aria-hidden="true">
                        <span
                          class={`size-2 rounded-full ${
                            props.showApproved && item.pr.isApproved
                              ? "bg-[#3fb950]"
                              : item.unseen
                                ? "bg-[#58a6ff]"
                                : "bg-[#484f58]"
                          }`}
                        />
                      </span>
                      <span class="min-w-0">
                        <span
                          class={`block truncate text-sm leading-5 ${item.unseen ? "font-semibold" : "font-medium"}`}
                        >
                          {item.pr.title}
                        </span>
                        <span class="mt-0.5 block text-xs text-[#8b949e]">
                          #{item.pr.number} · {item.pr.user.login}
                          <Show when={props.showApproved && item.pr.isApproved}> · Approved</Show>
                        </span>
                      </span>
                      <time
                        class="pt-0.5 text-xs tabular-nums text-[#8b949e]"
                        datetime={item.pr.updated_at}
                        title={item.pr.updated_at}
                      >
                        {getTimeAgo(new Date(item.pr.updated_at))}
                      </time>
                    </a>
                  )}
                </For>
              </section>
            )}
          </For>
        </div>
      </Show>
    </section>
  )
}

function DashboardContent() {
  const { state, refresh, markSeen } = usePRSnapshot()
  const available = createMemo(() => {
    const current = state()
    return current.kind === "available" ? current : undefined
  })
  const unavailable = createMemo(() => {
    const current = state()
    return current.kind === "unavailable" ? current : undefined
  })
  const lastSyncLabel = createMemo(() => {
    const lastSyncedAt = available()?.sync.lastSyncedAt
    return lastSyncedAt ? `Updated ${getTimeAgo(new Date(lastSyncedAt))}` : "Saved extension data"
  })
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date())

  return (
    <Switch>
      <Match when={state().kind === "setup-needed"}>
        <main class="grid min-h-screen place-items-center bg-[#010409] px-6">
          <div class="max-w-md text-center">
            <h1 class="m-0 text-2xl font-semibold text-[#f0f6fc]">Connect GitHub to begin</h1>
            <p class="mt-3 text-sm leading-6 text-[#8b949e]">
              Add your account and token to turn this page into your pull request dashboard.
            </p>
            <button
              type="button"
              onClick={() => chrome.runtime.openOptionsPage()}
              class="mt-4 rounded-md border border-[#2ea043] bg-[#238636] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2ea043] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#58a6ff]"
            >
              Open settings
            </button>
          </div>
        </main>
      </Match>

      <Match when={state().kind === "loading"}>
        <main class="min-h-screen bg-[#010409] px-6 py-10">
          <div class="mx-auto max-w-6xl animate-pulse space-y-5" aria-label="Loading dashboard">
            <div class="h-20 rounded-xl bg-[#0d1117]" />
            <div class="grid gap-5 lg:grid-cols-2">
              <div class="h-80 rounded-xl bg-[#0d1117]" />
              <div class="h-80 rounded-xl bg-[#0d1117]" />
            </div>
          </div>
        </main>
      </Match>

      <Match when={unavailable()}>
        <main class="grid min-h-screen place-items-center bg-[#010409] px-6 text-sm text-[#ffb4ad]">
          {unavailable()?.message}
        </main>
      </Match>

      <Match when={available()}>
        {(data) => (
          <main class="min-h-screen bg-[#010409] px-5 py-8 sm:px-8 sm:py-10">
            <div class="mx-auto max-w-6xl">
              <header class="mb-7 flex flex-wrap items-end justify-between gap-5">
                <div>
                  <p class="m-0 text-sm text-[#8b949e]">{dateLabel}</p>
                  <h1 class="mt-1 mb-0 text-2xl font-semibold tracking-[-0.02em] text-[#f0f6fc] sm:text-3xl">
                    Pull request dashboard
                  </h1>
                  <p class="mt-2 mb-0 text-sm text-[#8b949e]">
                    <Show when={data().sync.status === "syncing"} fallback={lastSyncLabel()}>
                      Syncing in the background…
                    </Show>
                  </p>
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    onClick={refresh}
                    disabled={data().sync.status === "syncing"}
                    class="rounded-md border border-[#30363d] bg-[#21262d] px-3.5 py-2 text-sm font-medium text-[#f0f6fc] hover:bg-[#30363d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#58a6ff]"
                  >
                    {data().sync.status === "syncing" ? "Refreshing…" : "Refresh"}
                  </button>
                  <button
                    type="button"
                    onClick={() => chrome.runtime.openOptionsPage()}
                    class="rounded-md border border-[#30363d] bg-transparent px-3.5 py-2 text-sm font-medium text-[#b1bac4] hover:bg-[#161b22] hover:text-[#f0f6fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#58a6ff]"
                  >
                    Settings
                  </button>
                </div>
              </header>

              <Show when={data().sync.status === "error"}>
                <div class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#6e3a36] bg-[#2d1618] px-4 py-3 text-sm text-[#ffb4ad]">
                  <span>Refresh failed. Your saved pull requests are still shown below.</span>
                  <button
                    type="button"
                    onClick={refresh}
                    class="font-semibold underline underline-offset-2"
                  >
                    Retry
                  </button>
                </div>
              </Show>

              <div class="grid items-start gap-5 lg:grid-cols-2">
                <DashboardList
                  title="Created by you"
                  description="Open work you are driving"
                  prs={data().snapshot.prs.created}
                  seenPRs={data().snapshot.seen}
                  emptyMessage="No open pull requests created by you."
                  showApproved
                  onMarkSeen={markSeen}
                />
                <DashboardList
                  title="Needs your review"
                  description="Assigned and review-requested work"
                  prs={data().snapshot.prs.assigned}
                  seenPRs={data().snapshot.seen}
                  emptyMessage="No pull requests are waiting for your review."
                  onMarkSeen={markSeen}
                />
              </div>
            </div>
          </main>
        )}
      </Match>
    </Switch>
  )
}

export function Dashboard() {
  return (
    <Errored
      fallback={(error) => (
        <main class="grid min-h-screen place-items-center bg-[#010409] px-6 text-sm text-[#ffb4ad]">
          {getErrorMessage(error(), "Unable to render the dashboard.")}
        </main>
      )}
    >
      <Loading
        fallback={
          <main class="grid min-h-screen place-items-center bg-[#010409] text-sm text-[#8b949e]">
            Loading dashboard…
          </main>
        }
      >
        <DashboardContent />
      </Loading>
    </Errored>
  )
}
