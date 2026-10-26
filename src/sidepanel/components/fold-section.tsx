import { createContext, createUniqueId, Show, useContext } from "solid-js"
import type { ParentProps } from "solid-js"
import { ChevronDownIcon } from "./icons"

interface FoldValue {
  readonly id: string
  readonly collapsed: () => boolean
  readonly toggle: () => void
}

const FoldContext = createContext<FoldValue>()

function useFold() {
  return useContext(FoldContext)
}

/**
 * A section the user folds from its heading. The owner keeps whether it is folded; folding is instant
 * because the user does it often.
 */
function Root(props: ParentProps<{ readonly collapsed: boolean; readonly onToggle: () => void }>) {
  const fold: FoldValue = {
    id: createUniqueId(),
    collapsed: () => props.collapsed,
    toggle: () => props.onToggle(),
  }
  return (
    <section>
      <FoldContext value={fold}>{props.children}</FoldContext>
    </section>
  )
}

/** The heading, which stays in view while its section scrolls past; the chevron ends it. */
function Heading(props: ParentProps) {
  const fold = useFold()
  const expanded = () => {
    if (fold.collapsed()) return "false"
    return "true"
  }
  return (
    <h2 class="sticky top-0 z-10 m-0 bg-canvas/90 backdrop-blur-sm">
      <button
        type="button"
        aria-expanded={expanded()}
        aria-controls={fold.id}
        onClick={() => fold.toggle()}
        class="group/heading flex min-h-8 w-full items-center gap-1.5 border-0 bg-transparent px-3 py-1.5 text-left text-xs font-semibold text-fg transition-[background-color] duration-100 ease-out hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        {props.children}
        <ChevronDownIcon
          class={[
            "ml-auto size-3.5 shrink-0 text-fg-subtle opacity-0 group-hover/heading:opacity-100 group-focus-visible/heading:opacity-100",
            { "-rotate-90 opacity-100": fold.collapsed() },
          ]}
        />
      </button>
    </h2>
  )
}

/** A blue dot while the section is folded over activity the user has not seen. */
function Unseen(props: { readonly count: number }) {
  const fold = useFold()
  return (
    <Show when={fold.collapsed() && props.count > 0}>
      <span aria-hidden="true" class="size-1.5 shrink-0 rounded-full bg-accent" />
      <span class="sr-only">, {props.count} unseen</span>
    </Show>
  )
}

function Body(props: ParentProps) {
  const fold = useFold()
  return (
    <div id={fold.id} hidden={fold.collapsed()}>
      {props.children}
    </div>
  )
}

export const FoldSection = { Root, Heading, Unseen, Body }
