import { createUniqueId, For, Show } from "solid-js"
import { dynamic } from "@solidjs/web"
import type { JSX } from "@solidjs/web"
import type { PRCollectionItem } from "@/lib/pr-collection"
import type { Stage } from "@/lib/pr-status"
import { ChevronDownIcon, StackIcon } from "./icons"
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
    <span title={label()} class="flex items-center gap-0.5 text-fg-muted tabular-nums">
      <StageIcon stage={props.stage} class="size-3" />
      <span aria-hidden="true">{props.count}</span>
      <span class="sr-only">, {label()}</span>
    </span>
  )
}

interface PRStackProps {
  /** Top of the stack first. */
  readonly items: readonly PRCollectionItem[]
  /** The branch the bottom pull request merges into. */
  readonly base: string | undefined
  readonly tally: readonly { readonly stage: Stage; readonly count: number }[]
  readonly collapsed: boolean
  readonly onToggle: () => void
  /** Draws each member as its list does. */
  readonly row: (item: PRCollectionItem) => JSX.Element
}

/**
 * Pull requests stacked on one another. A header names the branch the stack merges into and counts
 * its members at each stage, so a folded stack still shows where it stands; below it the members sit
 * indented, top first, on a line through each one's stage. Folding is instant, as a section's is.
 */
export function PRStack(props: PRStackProps) {
  const id = createUniqueId()
  const expanded = () => {
    if (props.collapsed) return "false"
    return "true"
  }
  const unseen = () => props.items.filter((item) => item.unseen).length
  const label = () => {
    if (!props.base) return `Stack of ${props.items.length}`
    return `Stack of ${props.items.length} on ${props.base}`
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={expanded()}
        aria-controls={id}
        onClick={() => props.onToggle()}
        class="group/stack flex h-8 w-full items-center gap-1.5 border-0 bg-transparent px-3 text-left text-[11px] text-fg-muted transition-[background-color] duration-100 ease-out hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <StackIcon class="size-3.5 shrink-0 text-fg-muted" />
        <span class="sr-only">{label()}</span>
        <span aria-hidden="true" class="min-w-0 truncate font-mono text-fg">
          {props.base ?? "Stack"}
        </span>
        <span aria-hidden="true" class="shrink-0 text-fg-subtle tabular-nums">
          {props.items.length}
        </span>
        <Show when={props.collapsed && unseen() > 0}>
          <span aria-hidden="true" class="size-1.5 shrink-0 rounded-full bg-accent" />
          <span class="sr-only">, {unseen()} unseen</span>
        </Show>
        <span class="ml-auto flex shrink-0 items-center gap-2 pl-2">
          <For each={props.tally} keyed={(mark) => mark.stage}>
            {(mark) => <TallyMark stage={mark().stage} count={mark().count} />}
          </For>
        </span>
        <ChevronDownIcon
          class={[
            "size-3.5 shrink-0 text-fg-subtle opacity-0 group-hover/stack:opacity-100 group-focus-visible/stack:opacity-100",
            { "-rotate-90 opacity-100": props.collapsed },
          ]}
        />
      </button>
      <ol id={id} hidden={props.collapsed} aria-label={label()} class="m-0 list-none p-0 pl-3">
        <For each={props.items} keyed={(item) => item.pr.id}>
          {(item, index) => (
            <li class="flex">
              <span class="relative w-3.5 shrink-0">
                <span
                  class={[
                    "absolute left-1/2 w-px -translate-x-1/2 bg-line",
                    {
                      // The first reaches up to the header's stack icon; the last ends at its node.
                      "-top-2": index() === 0,
                      "top-0": index() > 0,
                      "bottom-0": index() < props.items.length - 1,
                      "h-4": index() === props.items.length - 1,
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
    </>
  )
}
