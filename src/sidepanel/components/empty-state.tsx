import { InboxIcon } from "./icons"

interface EmptyStateProps {
  tab: "mine" | "review"
}

export function EmptyState(props: EmptyStateProps) {
  const message = () =>
    props.tab === "mine" ? "No open PRs authored by you." : "No PRs requesting your review."

  return (
    <div class="flex flex-col items-center justify-center py-12 text-[#484f58]">
      <InboxIcon class="mb-3 opacity-40" />
      <p class="text-sm m-0">{message()}</p>
      <a
        href="https://github.com/pulls"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs text-[#58a6ff] no-underline mt-2 hover:underline"
      >
        View all PRs on GitHub
      </a>
    </div>
  )
}
