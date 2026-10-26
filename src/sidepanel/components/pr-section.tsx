import { createUniqueId, Show } from "solid-js"
import { dynamic } from "@solidjs/web"
import type { ParentProps } from "solid-js"
import type { Stage } from "@/lib/pr-status"
import { ChevronDownIcon } from "./icons"
import { STAGE, TONE_TEXT } from "./stage"

interface PRSectionProps {
  readonly stage: Stage
  readonly count: number
  /** Pull requests in the section that changed since the user last opened them. */
  readonly unseen: number
  readonly collapsed: boolean
  readonly onToggle: () => void
}

/**
 * The pull requests at one stage, under a heading that stays in view while they scroll past. The
 * heading folds the section; folding is instant because the user does it often, and a folded section
 * keeps a blue dot while it hides unseen activity.
 */
export function PRSection(props: ParentProps<PRSectionProps>) {
  const id = createUniqueId()
  const look = () => STAGE[props.stage]
  const Icon = dynamic(() => look().Icon)
  const expanded = () => {
    if (props.collapsed) return "false"
    return "true"
  }

  return (
    <section>
      <h2 class="sticky top-0 z-10 m-0 bg-canvas/90 backdrop-blur-sm">
        <button
          type="button"
          aria-expanded={expanded()}
          aria-controls={id}
          onClick={() => props.onToggle()}
          class="group/heading flex h-8 w-full items-center gap-1.5 border-0 bg-transparent px-3 text-left text-xs font-semibold text-fg transition-[background-color] duration-100 ease-out hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <Icon class={["size-3.5 shrink-0", TONE_TEXT[look().tone]]} />
          {look().title}
          <span class="font-normal text-fg-subtle tabular-nums">{props.count}</span>
          <Show when={props.collapsed && props.unseen > 0}>
            <span aria-hidden="true" class="size-1.5 rounded-full bg-accent" />
            <span class="sr-only">, {props.unseen} unseen</span>
          </Show>
          <ChevronDownIcon
            class={[
              "ml-auto size-3.5 shrink-0 text-fg-subtle opacity-0 group-hover/heading:opacity-100 group-focus-visible/heading:opacity-100",
              { "-rotate-90 opacity-100": props.collapsed },
            ]}
          />
        </button>
      </h2>
      <ul id={id} hidden={props.collapsed} class="m-0 list-none p-0 pb-1">
        {props.children}
      </ul>
    </section>
  )
}
