import { createSignal, For } from "solid-js"
import type { PRCollectionGroup } from "@/lib/pr-collection"
import { ChevronIcon } from "./icons"
import { PRRow } from "./pr-row"

interface RepoGroupProps {
  group: PRCollectionGroup
  onMarkSeen: (prId: number) => void
  showApproved?: boolean
}

export function RepoGroup(props: RepoGroupProps) {
  const [open, setOpen] = createSignal(true)
  const expanded = () => {
    if (open()) return "true"
    return "false"
  }
  const itemsClass = () => {
    if (open()) return ""
    return "hidden"
  }

  return (
    <section class="border-t border-[#21262d] first:border-t-0">
      <button
        onClick={() => setOpen((v) => !v)}
        class="flex min-h-9 w-full items-center bg-[#0d1117] px-3 text-xs font-medium text-[#b1bac4] transition-colors hover:bg-[#161b22] hover:text-[#f0f6fc] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#58a6ff]"
        aria-expanded={expanded()}
      >
        <ChevronIcon open={open()} />
        <span class="ml-1.5 flex-1 text-left">{props.group.repo}</span>
        <span class="rounded-full bg-[#21262d] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[#8b949e]">
          {props.group.items.length}
        </span>
      </button>
      <div class={itemsClass()}>
        <For each={props.group.items}>
          {(item) => (
            <PRRow item={item} onMarkSeen={props.onMarkSeen} showApproved={props.showApproved} />
          )}
        </For>
      </div>
    </section>
  )
}
