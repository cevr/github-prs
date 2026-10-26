import { useTracker } from "../tracker"
import { GitPullRequestIcon } from "./icons"

export function SetupPrompt() {
  const { actions } = useTracker()
  return (
    <div class="flex flex-col items-center px-6 py-14 text-center">
      <span class="mb-3 grid size-10 place-items-center rounded-full bg-surface text-fg-subtle">
        <GitPullRequestIcon />
      </span>
      <p class="m-0 text-sm font-medium text-fg-strong">Connect GitHub</p>
      <p class="mt-1 mb-4 max-w-60 text-xs leading-5 text-fg-muted">
        Add your username and a read-only token to track your pull requests.
      </p>
      <button
        type="button"
        onClick={() => actions.openSettings()}
        class="rounded-md border-0 bg-success-emphasis px-3.5 py-1.5 text-sm font-medium text-on-emphasis transition-[filter,scale] duration-150 ease-out hover:brightness-110 enabled:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Open settings
      </button>
    </div>
  )
}
