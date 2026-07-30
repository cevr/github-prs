import { Show } from "solid-js"
import type { SyncState } from "@/types"
import { getTimeAgo } from "@/lib/format"
import { RefreshIcon, SettingsIcon } from "./icons"

interface HeaderProps {
  onRefresh?: () => void
  syncState?: SyncState
}

export function Header(props: HeaderProps) {
  const refreshIconClass = () => {
    if (props.syncState?.status === "syncing") return "animate-spin"
    return ""
  }
  const syncLabel = () => {
    if (props.syncState?.status === "syncing") return "Syncing…"
    if (props.syncState?.lastSyncedAt) {
      return `Updated ${getTimeAgo(props.syncState.lastSyncedAt)}`
    }
    return ""
  }

  return (
    <header class="flex min-h-12 items-center justify-between gap-3 border-b border-[#30363d] px-3.5 py-2">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-[#f0f6fc]">Pull requests</div>
        <Show when={props.syncState?.lastSyncedAt || props.syncState?.status === "syncing"}>
          <div class="mt-0.5 truncate text-[11px] text-[#8b949e]" aria-live="polite">
            {syncLabel()}
          </div>
        </Show>
      </div>
      <div class="flex shrink-0 gap-1">
        <Show when={props.onRefresh}>
          <button
            onClick={props.onRefresh}
            class="grid size-8 place-items-center rounded-md border-0 bg-transparent text-[#8b949e] transition-colors hover:bg-[#21262d] hover:text-[#f0f6fc] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#58a6ff]"
            title="Refresh"
            aria-label="Refresh pull requests"
            disabled={props.syncState?.status === "syncing"}
          >
            <RefreshIcon class={refreshIconClass()} />
          </button>
        </Show>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          class="grid size-8 place-items-center rounded-md border-0 bg-transparent text-[#8b949e] transition-colors hover:bg-[#21262d] hover:text-[#f0f6fc] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#58a6ff]"
          title="Settings"
          aria-label="Open settings"
        >
          <SettingsIcon />
        </button>
      </div>
    </header>
  )
}
