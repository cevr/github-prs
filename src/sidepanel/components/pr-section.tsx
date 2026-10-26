import { createUniqueId } from "solid-js"
import { dynamic } from "@solidjs/web"
import type { ParentProps } from "solid-js"
import type { Stage } from "@/lib/pr-status"
import { STAGE, TONE_TEXT } from "./stage"

/** The pull requests at one stage, under a heading that stays in view while they scroll past. */
export function PRSection(props: ParentProps<{ readonly stage: Stage; readonly count: number }>) {
  const id = createUniqueId()
  const look = () => STAGE[props.stage]
  const Icon = dynamic(() => look().Icon)
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        class="sticky top-0 z-10 m-0 flex h-8 items-center gap-1.5 bg-canvas/90 px-3 text-xs font-semibold text-fg backdrop-blur-sm"
      >
        <Icon class={["size-3.5", TONE_TEXT[look().tone]]} />
        {look().title}
        <span class="font-normal text-fg-subtle tabular-nums">{props.count}</span>
      </h2>
      <ul class="m-0 list-none p-0 pb-1">{props.children}</ul>
    </section>
  )
}
