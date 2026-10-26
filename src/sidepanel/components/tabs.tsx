import { createContext, createUniqueId, Show, useContext } from "solid-js"
import type { Accessor, ParentProps } from "solid-js"

interface TabsApi {
  readonly state: { readonly selected: Accessor<string> }
  readonly actions: { readonly select: (value: string) => void }
  readonly meta: { readonly id: (value: string, part: "tab" | "panel") => string }
}

const TabsContext = createContext<TabsApi>()

/** Tabs that switch at once: the side panel switches them too often for motion to help. */
function Root(
  props: ParentProps<{ readonly value: string; readonly onChange: (value: string) => void }>,
) {
  const base = createUniqueId()
  return (
    <TabsContext
      value={{
        state: { selected: () => props.value },
        actions: { select: (value) => props.onChange(value) },
        meta: { id: (value, part) => `${base}-${part}-${value}` },
      }}
    >
      {props.children}
    </TabsContext>
  )
}

/** The arrow keys move between tabs and select them, as in a native tab list. */
function List(props: ParentProps<{ readonly label: string }>) {
  const { actions } = useContext(TabsContext)
  const move = (event: KeyboardEvent & { currentTarget: HTMLDivElement }) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (step === undefined) return
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"))
    const current = tabs.findIndex((tab) => tab === document.activeElement)
    const next = tabs.at((current + step) % tabs.length)
    if (!next?.dataset["value"]) return
    event.preventDefault()
    next.focus()
    actions.select(next.dataset["value"])
  }
  return (
    <div
      role="tablist"
      aria-label={props.label}
      onKeyDown={move}
      class="flex shrink-0 gap-1 border-b border-line-muted px-2"
    >
      {props.children}
    </div>
  )
}

function Tab(props: ParentProps<{ readonly value: string }>) {
  const { state, actions, meta } = useContext(TabsContext)
  const selected = () => state.selected() === props.value
  // ARIA needs the literal "false", and only the selected tab takes Tab focus.
  const ariaSelected = () => {
    if (selected()) return "true"
    return "false"
  }
  const tabindex = () => {
    if (selected()) return 0
    return -1
  }
  return (
    <button
      type="button"
      role="tab"
      id={meta.id(props.value, "tab")}
      aria-controls={meta.id(props.value, "panel")}
      aria-selected={ariaSelected()}
      tabindex={tabindex()}
      data-value={props.value}
      data-selected={selected()}
      onClick={() => actions.select(props.value)}
      class="relative flex min-h-10 items-center gap-1.5 rounded-t-md border-0 bg-transparent px-2.5 text-xs font-medium text-fg-muted transition-[color] duration-100 ease-out outline-none hover:text-fg-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent data-selected:text-fg-strong data-selected:after:absolute data-selected:after:inset-x-2 data-selected:after:-bottom-px data-selected:after:h-0.5 data-selected:after:rounded-full data-selected:after:bg-accent"
    >
      {props.children}
    </button>
  )
}

/** A panel stays mounted while hidden, so switching back keeps its scroll position. */
function Panel(props: ParentProps<{ readonly value: string; readonly class?: string }>) {
  const { state, meta } = useContext(TabsContext)
  return (
    <div
      role="tabpanel"
      id={meta.id(props.value, "panel")}
      aria-labelledby={meta.id(props.value, "tab")}
      hidden={state.selected() !== props.value}
      class={props.class}
    >
      {props.children}
    </div>
  )
}

/** How many pull requests a tab holds; blue while some changed since the user last opened them. */
function Count(props: { readonly total: number; readonly unseen: number }) {
  return (
    <span
      data-unseen={props.unseen > 0}
      class="min-w-5 rounded-full bg-raised px-1.5 py-0.5 text-center text-[10px] leading-3 font-semibold text-fg-muted tabular-nums data-unseen:bg-accent-emphasis data-unseen:text-on-emphasis"
    >
      {props.total}
      <Show when={props.unseen > 0}>
        <span class="sr-only">, {props.unseen} unseen</span>
      </Show>
    </span>
  )
}

export const Tabs = { Root, List, Tab, Panel, Count }
