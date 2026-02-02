import { Show } from "solid-js"
import { RefreshIcon, SettingsIcon } from "./icons"

interface HeaderProps {
  onRefresh?: () => void
}

export function Header(props: HeaderProps) {
  return (
    <div class="flex items-center justify-between px-3 py-2 border-b border-[#21262d]">
      <span class="text-sm font-semibold text-[#e6edf3]">PRs</span>
      <div class="flex gap-1">
        <Show when={props.onRefresh}>
          <button
            onClick={props.onRefresh}
            class="bg-transparent border-none text-[#8b949e] cursor-pointer p-1 rounded hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
            title="Refresh"
          >
            <RefreshIcon />
          </button>
        </Show>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          class="bg-transparent border-none text-[#8b949e] cursor-pointer p-1 rounded hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          title="Settings"
        >
          <SettingsIcon />
        </button>
      </div>
    </div>
  )
}
