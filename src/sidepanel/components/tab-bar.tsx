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
  return (
    <button
      onClick={props.onClick}
      class={`flex-1 py-1.5 text-xs font-medium border-none cursor-pointer transition-colors ${
        props.active
          ? "bg-transparent text-[#e6edf3] border-b-2 border-b-[#58a6ff]"
          : "bg-transparent text-[#8b949e] border-b-2 border-b-transparent hover:text-[#e6edf3]"
      }`}
    >
      {props.label}
      <span
        class={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
          props.unseenCount > 0 ? "bg-[#58a6ff] text-[#0d1117]" : "bg-[#21262d] text-[#8b949e]"
        }`}
      >
        {props.count}
      </span>
    </button>
  )
}

export function TabBar(props: TabBarProps) {
  return (
    <div class="flex border-b border-[#21262d]">
      <TabButton
        active={props.active === "mine"}
        label="Mine"
        count={props.minePRCount}
        unseenCount={props.mineUnseenCount}
        onClick={() => props.onTabChange("mine")}
      />
      <TabButton
        active={props.active === "review"}
        label="Review"
        count={props.reviewPRCount}
        unseenCount={props.reviewUnseenCount}
        onClick={() => props.onTabChange("review")}
      />
    </div>
  )
}
