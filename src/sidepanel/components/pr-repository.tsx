import type { ParentProps } from "solid-js"
import { FoldSection } from "./fold-section"
import { RepoIcon } from "./icons"

interface PRRepositoryProps {
  readonly repository: string
  readonly count: number
  readonly unseen: number
  readonly collapsed: boolean
  readonly onToggle: () => void
}

export function PRRepository(props: ParentProps<PRRepositoryProps>) {
  const owner = () => props.repository.split("/").slice(0, -1).join("/")
  const name = () => props.repository.split("/").at(-1) ?? props.repository

  return (
    <FoldSection.Root collapsed={props.collapsed} onToggle={props.onToggle}>
      <FoldSection.Subheading>
        <RepoIcon class="size-3 shrink-0 text-fg-subtle" />
        <span title={props.repository} class="min-w-0 truncate">
          <span class="font-normal text-fg-subtle">{owner()}/</span>
          {name()}
        </span>
        <span class="font-normal text-fg-subtle tabular-nums">{props.count}</span>
        <FoldSection.Unseen count={props.unseen} />
      </FoldSection.Subheading>
      <FoldSection.Body>
        <ul class="m-0 list-none p-0">{props.children}</ul>
      </FoldSection.Body>
    </FoldSection.Root>
  )
}
