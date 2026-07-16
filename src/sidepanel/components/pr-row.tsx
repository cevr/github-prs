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
      onClick={() => props.onMarkSeen(props.pr.id)}
      class="group/row grid min-h-13 grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-x-2 px-3 py-2 text-[#f0f6fc] no-underline outline-none transition-colors hover:bg-[#161b22] focus-visible:bg-[#161b22] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#58a6ff]"
    >
      <span class="flex h-5 items-center justify-center" aria-hidden="true">
        <Show
          when={props.showApproved && props.pr.isApproved}
          fallback={
            <span
              class={`size-1.5 rounded-full ${isUnseen() ? "bg-[#58a6ff]" : "bg-transparent"}`}
            />
          }
        >
          <CheckCircleIcon class="text-[#3fb950]" />
        </Show>
      </span>
      <span class="min-w-0">
        <span
          class={`block truncate text-[13px] leading-5 ${isUnseen() ? "font-semibold" : "font-medium"}`}
        >
          {props.pr.title}
        </span>
        <span class="block truncate text-[11px] leading-4 text-[#8b949e]">
          #{props.pr.number} · {props.pr.user.login}
        </span>
      </span>
      <time
        class="pt-0.5 text-[11px] tabular-nums text-[#8b949e]"
        dateTime={props.pr.updated_at}
        title={props.pr.updated_at}
      >
        {getTimeAgo(new Date(props.pr.updated_at))}
      </time>
    </a>
  )
}
