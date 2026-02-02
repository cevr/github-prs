import { Show } from "solid-js"
import type { PR, SeenPRs } from "@/types"
import { getTimeAgo } from "../lib/format"
import { CheckCircleIcon } from "./icons"

interface PRRowProps {
  pr: PR
  seenPRs: SeenPRs
  onMarkSeen: (prId: number) => void
  showApproved?: boolean
}

export function PRRow(props: PRRowProps) {
  const isUnseen = () => {
    const seen = props.seenPRs[props.pr.id.toString()]
    return !seen || new Date(props.pr.updated_at) > new Date(seen)
  }

  return (
    <a
      href={props.pr.html_url}
      target="_blank"
      rel="noopener noreferrer"
      data-pr-row
      onMouseEnter={() => props.onMarkSeen(props.pr.id)}
      class={`group/row flex items-center gap-2 h-9 px-3 text-[#e6edf3] no-underline transition-colors outline-none focus-visible:bg-[#1c2128] hover:bg-[#1c2128] ${isUnseen() ? "border-l-2 border-l-[#58a6ff]" : "border-l-2 border-l-transparent"}`}
    >
      <Show when={props.showApproved && props.pr.isApproved}>
        <CheckCircleIcon class="shrink-0 text-[#3fb950]" />
      </Show>
      <span class="text-[#8b949e] text-xs shrink-0 w-10 tabular-nums">#{props.pr.number}</span>
      <span class="text-sm truncate flex-1 min-w-0">{props.pr.title}</span>
      <span
        class="text-[#484f58] text-xs shrink-0 opacity-0 group-hover/row:opacity-100"
        title={props.pr.updated_at}
      >
        {getTimeAgo(new Date(props.pr.updated_at))}
      </span>
    </a>
  )
}
