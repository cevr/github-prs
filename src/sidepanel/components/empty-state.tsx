import type { Perspective } from "@/lib/pr-status"
import { InboxIcon } from "./icons"
import { PERSPECTIVE } from "./stage"

/** Plays its entrance once: switching back to an empty tab shows it at rest. */
const settle = (event: AnimationEvent & { currentTarget: HTMLElement }) =>
  event.currentTarget.classList.remove("enter-once")

export function EmptyState(props: { readonly perspective: Perspective }) {
  const copy = () => PERSPECTIVE[props.perspective]
  return (
    <div class="flex flex-col items-center px-6 py-14 text-center">
      <span
        class="enter-once mb-3 grid size-10 place-items-center rounded-full bg-surface text-fg-subtle"
        onAnimationEnd={settle}
      >
        <InboxIcon />
      </span>
      <p class="enter-once m-0 text-sm text-fg" style={{ "--chunk": 1 }} onAnimationEnd={settle}>
        {copy().empty}
      </p>
      <a
        href={copy().href}
        target="_blank"
        rel="noopener noreferrer"
        class="enter-once mt-1.5 text-xs text-accent no-underline hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{ "--chunk": 2 }}
        onAnimationEnd={settle}
      >
        {copy().link}
      </a>
    </div>
  )
}
