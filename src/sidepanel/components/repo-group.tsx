import { createSignal, For } from "solid-js"
import type { SeenPRs } from "@/types"
import type { RepoGroup as RepoGroupData } from "@/lib/group-prs"
import { ChevronIcon } from "./icons"
import { PRRow } from "./pr-row"

interface RepoGroupProps {
  group: RepoGroupData
  seenPRs: SeenPRs
  onMarkSeen: (prId: number) => void
  showApproved?: boolean
}

export function RepoGroup(props: RepoGroupProps) {
  const [open, setOpen] = createSignal(true)

  return (
    <section class="border-t border-[#21262d] first:border-t-0">
      <button
        onClick={() => setOpen((v) => !v)}
        class="flex min-h-9 w-full items-center bg-[#0d1117] px-3 text-xs font-medium text-[#b1bac4] transition-colors hover:bg-[#161b22] hover:text-[#f0f6fc] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#58a6ff]"
        aria-expanded={open()}
      >
        <ChevronIcon open={open()} />
        <span class="ml-1.5 flex-1 text-left">{props.group.repo}</span>
        <span class="rounded-full bg-[#21262d] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[#8b949e]">
          {props.group.prs.length}
        </span>
      </button>
      <div class={open() ? "" : "hidden"}>
        <For each={props.group.prs}>
          {(pr) => (
            <PRRow
              pr={pr}
              seenPRs={props.seenPRs}
              onMarkSeen={props.onMarkSeen}
              showApproved={props.showApproved}
            />
          )}
        </For>
      </div>
    </section>
  )
}
