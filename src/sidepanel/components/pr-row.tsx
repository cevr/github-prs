import { Show } from "solid-js"
import type { PRCollectionItem } from "@/lib/pr-collection"
import { getTimeAgo } from "@/lib/format"
import { CheckCircleIcon } from "./icons"

interface PRRowProps {
  item: PRCollectionItem
  onMarkSeen: (prId: number) => void
  showApproved?: boolean
}

export function PRRow(props: PRRowProps) {
  const pr = () => props.item.pr
  const indicatorClass = () => {
    if (props.item.unseen) return "bg-[#58a6ff]"
    return "bg-transparent"
  }
  const titleWeight = () => {
    if (props.item.unseen) return "font-semibold"
    return "font-medium"
  }

  return (
    <a
      href={pr().html_url}
      target="_blank"
      rel="noopener noreferrer"
      data-pr-row
      onClick={() => props.onMarkSeen(pr().id)}
      class="group/row grid min-h-13 grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-x-2 px-3 py-2 text-[#f0f6fc] no-underline outline-none transition-colors hover:bg-[#161b22] focus-visible:bg-[#161b22] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#58a6ff]"
    >
      <span class="flex h-5 items-center justify-center" aria-hidden="true">
        <Show
          when={props.showApproved && pr().isApproved}
          fallback={<span class={`size-1.5 rounded-full ${indicatorClass()}`} />}
        >
          <CheckCircleIcon class="text-[#3fb950]" />
        </Show>
      </span>
      <span class="min-w-0">
        <span class={`block truncate text-[13px] leading-5 ${titleWeight()}`}>{pr().title}</span>
        <span class="block truncate text-[11px] leading-4 text-[#8b949e]">
          #{pr().number} · {pr().user.login}
        </span>
      </span>
      <time
        class="pt-0.5 text-[11px] tabular-nums text-[#8b949e]"
        datetime={pr().updated_at}
        title={pr().updated_at}
      >
        {getTimeAgo(pr().updated_at)}
      </time>
    </a>
  )
}
