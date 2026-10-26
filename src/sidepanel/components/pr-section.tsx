import { dynamic } from "@solidjs/web"
import type { ParentProps } from "solid-js"
import type { Stage } from "@/lib/pr-status"
import { FoldSection } from "./fold-section"
import { STAGE, TONE_TEXT } from "./stage"

interface PRSectionProps {
  readonly stage: Stage
  readonly count: number
  /** Pull requests in the section that changed since the user last opened them. */
  readonly unseen: number
  readonly collapsed: boolean
  readonly onToggle: () => void
}

/** The pull requests at one stage that are in no stack, under a heading that folds them. */
export function PRSection(props: ParentProps<PRSectionProps>) {
  const look = () => STAGE[props.stage]
  const Icon = dynamic(() => look().Icon)

  return (
    <FoldSection.Root collapsed={props.collapsed} onToggle={props.onToggle}>
      <FoldSection.Heading>
        <Icon class={["size-3.5 shrink-0", TONE_TEXT[look().tone]]} />
        {look().title}
        <span class="font-normal text-fg-subtle tabular-nums">{props.count}</span>
        <FoldSection.Unseen count={props.unseen} />
      </FoldSection.Heading>
      <FoldSection.Body>
        <ul class="m-0 list-none p-0 pb-1">{props.children}</ul>
      </FoldSection.Body>
    </FoldSection.Root>
  )
}
