import { For, Show } from "solid-js"
import { dynamic } from "@solidjs/web"
import type { JSX } from "@solidjs/web"
import type { PRCollectionItem } from "@/lib/pr-collection"
import { STAGE, TONE_TEXT } from "./stage"

/** A stack member's own stage, as a node on the stack's line. */
function StageNode(props: { readonly item: PRCollectionItem }) {
  const look = () => STAGE[props.item.stage]
  const Icon = dynamic(() => look().Icon)
  return (
    <span
      role="img"
      aria-label={look().title}
      title={look().title}
      class="absolute top-3 left-1/2 grid -translate-x-1/2 place-items-center bg-canvas py-0.5"
    >
      <Icon class={["size-3", TONE_TEXT[look().tone]]} />
    </span>
  )
}

/**
 * Pull requests stacked on one another, drawn as git draws a branch: top first, a line through each
 * member's stage down to the branch the stack merges into. `row` draws each member as its list does.
 */
export function PRStack(props: {
  readonly items: readonly PRCollectionItem[]
  readonly base: string | undefined
  readonly row: (item: PRCollectionItem) => JSX.Element
}) {
  const label = () => {
    if (!props.base) return `Stack of ${props.items.length}`
    return `Stack of ${props.items.length} on ${props.base}`
  }
  return (
    <ol aria-label={label()} class="m-0 list-none p-0 pl-3">
      <For each={props.items} keyed={(item) => item.pr.id}>
        {(item, index) => (
          <li class="flex">
            <span class="relative w-3.5 shrink-0">
              <span
                class={[
                  "absolute bottom-0 left-1/2 w-px -translate-x-1/2 bg-line",
                  { "top-4": index() === 0, "top-0": index() > 0 },
                ]}
              />
              <StageNode item={item()} />
            </span>
            <div class="min-w-0 flex-1">{props.row(item())}</div>
          </li>
        )}
      </For>
      <Show when={props.base}>
        {(base) => (
          <li class="flex h-6 items-center" aria-hidden="true">
            <span class="relative h-full w-3.5 shrink-0">
              <span class="absolute top-0 left-1/2 h-1/2 w-px -translate-x-1/2 bg-line" />
              <span class="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-canvas" />
            </span>
            <span class="truncate pl-7 font-mono text-[11px] text-fg-subtle">{base()}</span>
          </li>
        )}
      </Show>
    </ol>
  )
}
