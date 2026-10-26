import { Show } from "solid-js"
import type { ParentProps } from "solid-js"
import { getTimeAgo } from "@/lib/format"
import type { SyncState } from "@/types"
import { useTracker } from "../tracker"
import { GearIcon, SyncIcon } from "./icons"

const ICON_BUTTON =
  "grid size-8 place-items-center rounded-md border-0 bg-transparent text-fg-muted transition-[background-color,color,scale] duration-150 ease-out hover:bg-raised hover:text-fg-strong enabled:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"

function syncLabel(sync: SyncState | undefined): string {
  if (sync?.status === "syncing") return "Refreshing…"
  if (sync?.lastSyncedAt) return `Updated ${getTimeAgo(sync.lastSyncedAt)}`
  return ""
}

/** The panel's title and the sync state under it; the actions it offers go in as children. */
export function Header(props: ParentProps<{ readonly sync?: SyncState }>) {
  return (
    <header class="flex min-h-12 shrink-0 items-center justify-between gap-3 px-3.5 py-2">
      <div class="min-w-0">
        <h1 class="m-0 text-sm leading-5 font-semibold text-fg-strong">Pull requests</h1>
        <Show when={syncLabel(props.sync)}>
          {(label) => (
            <p class="m-0 truncate text-[11px] leading-4 text-fg-muted" aria-live="polite">
              {label()}
            </p>
          )}
        </Show>
      </div>
      <div class="flex shrink-0 gap-0.5">{props.children}</div>
    </header>
  )
}

export function RefreshButton(props: { readonly syncing: boolean }) {
  const { actions } = useTracker()
  return (
    <button
      type="button"
      onClick={() => actions.refresh()}
      class={ICON_BUTTON}
      title="Refresh"
      aria-label="Refresh pull requests"
      disabled={props.syncing}
    >
      <SyncIcon class={{ "animate-spin": props.syncing }} />
    </button>
  )
}

export function SettingsButton() {
  const { actions } = useTracker()
  return (
    <button
      type="button"
      onClick={() => actions.openSettings()}
      class={ICON_BUTTON}
      title="Settings"
      aria-label="Open settings"
    >
      <GearIcon />
    </button>
  )
}
