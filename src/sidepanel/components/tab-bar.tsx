export type Tab = "mine" | "review"

interface TabBarProps {
  active: Tab
  onTabChange: (tab: Tab) => void
  minePRCount: number
  reviewPRCount: number
  mineUnseenCount: number
  reviewUnseenCount: number
}

function TabButton(props: {
  active: boolean
  label: string
  count: number
  unseenCount: number
  onClick: () => void
}) {
  const buttonClass = () => {
    const base =
      "relative min-h-10 flex-1 border-0 bg-transparent px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#58a6ff]"
    if (props.active) {
      return `${base} text-[#f0f6fc] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#58a6ff]`
    }
    return `${base} text-[#8b949e] hover:bg-[#161b22] hover:text-[#f0f6fc]`
  }
  const countClass = () => {
    const base = "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
    if (props.unseenCount > 0) return `${base} bg-[#1f6feb] text-white`
    return `${base} bg-[#21262d] text-[#b1bac4]`
  }

  return (
    <button onClick={props.onClick} class={buttonClass()}>
      {props.label}
      <span class={countClass()}>{props.count}</span>
    </button>
  )
}

export function TabBar(props: TabBarProps) {
  return (
    <nav class="flex border-b border-[#30363d]" aria-label="Pull request lists">
      <TabButton
        active={props.active === "mine"}
        label="Created"
        count={props.minePRCount}
        unseenCount={props.mineUnseenCount}
        onClick={() => props.onTabChange("mine")}
      />
      <TabButton
        active={props.active === "review"}
        label="Review requests"
        count={props.reviewPRCount}
        unseenCount={props.reviewUnseenCount}
        onClick={() => props.onTabChange("review")}
      />
    </nav>
  )
}
