import { createSignal, For } from "solid-js"
import type { SeenPRs } from "@/types"
import type { RepoGroup as RepoGroupData } from "../lib/group-prs"
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
    <div class="border-t border-[#21262d] first:border-t-0">
      <button
        onClick={() => setOpen((v) => !v)}
        class="flex items-center w-full px-3 py-1.5 text-[#8b949e] text-xs font-semibold uppercase tracking-wide bg-transparent border-none cursor-pointer hover:text-[#e6edf3] transition-colors"
      >
        <ChevronIcon open={open()} />
        <span class="ml-1.5 flex-1 text-left">{props.group.repo}</span>
        <span class="text-[#484f58] font-normal normal-case tracking-normal">
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
    </div>
  )
}
