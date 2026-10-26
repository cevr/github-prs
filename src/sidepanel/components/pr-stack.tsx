import { For, Show } from "solid-js"
import { dynamic } from "@solidjs/web"
import type { JSX } from "@solidjs/web"
import type { PRCollectionItem, PRCollectionStack } from "@/lib/pr-collection"
import type { Stage } from "@/lib/pr-status"
import { FoldSection } from "./fold-section"
import { StackIcon } from "./icons"
import { STAGE, TONE_TEXT } from "./stage"

function StageIcon(props: { readonly stage: Stage; readonly class?: string }) {
  const look = () => STAGE[props.stage]
  const Icon = dynamic(() => look().Icon)
  return <Icon class={[props.class, TONE_TEXT[look().tone]]} />
}

/** A stack member's own stage, as a node on the stack's line. */
function StageNode(props: { readonly item: PRCollectionItem }) {
  return (
    <span
      role="img"
      aria-label={STAGE[props.item.stage].title}
      title={STAGE[props.item.stage].title}
      class="absolute top-3 left-1/2 grid -translate-x-1/2 place-items-center bg-canvas py-0.5"
    >
      <StageIcon stage={props.item.stage} class="size-3" />
    </span>
  )
}

/** How many members sit at one stage, as an icon and a count. */
function TallyMark(props: { readonly stage: Stage; readonly count: number }) {
  const label = () => `${STAGE[props.stage].title}: ${props.count}`
  return (
    <span title={label()} class="flex items-center gap-0.5 tabular-nums">
      <StageIcon stage={props.stage} class="size-3" />
      <span aria-hidden="true">{props.count}</span>
      <span class="sr-only">, {label()}</span>
    </span>
  )
}

interface PRStackProps {
  readonly stack: PRCollectionStack
  readonly collapsed: boolean
  readonly onToggle: () => void
  /** Draws each member as its list does. */
  readonly row: (item: PRCollectionItem) => JSX.Element
}

/**
 * Pull requests stacked on one another, as a section of their own. The heading leads with the
 * stack's first pull request, the one on the base branch, for what the stack is about; below it the
 * repository, the size, the base branch and a count of members at each stage, so a folded stack still
 * shows where it stands. The members follow, top first, on a line through each one's stage.
 */
export function PRStack(props: PRStackProps) {
  const first = () => props.stack.first.pr
  const repository = () => first().repository.split("/").at(-1) ?? first().repository
  const size = () => `${props.stack.items.length} PRs`
  const label = () => {
    if (!props.stack.base) return `Stack of ${props.stack.items.length}`
    return `Stack of ${props.stack.items.length} on ${props.stack.base}`
  }

  return (
    <FoldSection.Root collapsed={props.collapsed} onToggle={props.onToggle}>
      <FoldSection.Heading>
        <StackIcon class="size-3.5 shrink-0 mt-px self-start text-fg-muted" />
        <span class="grid min-w-0 flex-1 gap-0.5">
          <span class="flex min-w-0 items-center gap-1.5">
            <span class="truncate">{first().title}</span>
            <FoldSection.Unseen count={props.stack.unseen} />
          </span>
          <span class="flex min-w-0 items-center gap-2 text-[11px] font-normal text-fg-muted">
            {/* The repository gives way first: the base branch says more about the stack. */}
            <span class="flex min-w-0 items-center">
              <span title={first().repository} class="min-w-0 truncate">
                {repository()}
              </span>
              <span class="mx-1 shrink-0 text-fg-subtle">·</span>
              <span class="max-w-[70%] shrink-0 truncate">
                <span class="tabular-nums">{size()}</span>
                <Show when={props.stack.base}>
                  {(base) => (
                    <>
                      {" into "}
                      <span class="font-mono text-fg">{base()}</span>
                    </>
                  )}
                </Show>
              </span>
            </span>
            <span class="ml-auto flex shrink-0 items-center gap-2">
              <For each={props.stack.tally} keyed={(mark) => mark.stage}>
                {(mark) => <TallyMark stage={mark().stage} count={mark().count} />}
              </For>
            </span>
          </span>
        </span>
      </FoldSection.Heading>
      <FoldSection.Body>
        <ol aria-label={label()} class="m-0 list-none p-0 pb-1 pl-3">
          <For each={props.stack.items} keyed={(item) => item.pr.id}>
            {(item, index) => (
              <li class="flex">
                <span class="relative w-3.5 shrink-0">
                  <span
                    class={[
                      "absolute top-0 left-1/2 w-px -translate-x-1/2 bg-line",
                      {
                        "bottom-0": index() < props.stack.items.length - 1,
                        "h-4": index() === props.stack.items.length - 1,
                      },
                    ]}
                  />
                  <StageNode item={item()} />
                </span>
                <div class="min-w-0 flex-1">{props.row(item())}</div>
              </li>
            )}
          </For>
        </ol>
      </FoldSection.Body>
    </FoldSection.Root>
  )
}
