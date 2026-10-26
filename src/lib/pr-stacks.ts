import type { PR } from "@/types"

export interface Stack<T> {
  /** Top of the stack first, the pull request on the base branch last. */
  readonly members: readonly T[]
  /** The branch the bottom pull request merges into; unknown in snapshots saved before 1.3. */
  readonly base: string | undefined
}

const branchKey = (repository: string, ref: string) => `${repository}\u0000${ref}`

/**
 * Groups pull requests into stacks: one is stacked on another when its base branch is the other's
 * head branch in the same repository, as gh-stack, Graphite and spr build them. A pull request on no
 * other stays a stack of one. Members sit deepest first, newest first among siblings.
 */
export function stacksOf<T extends { readonly pr: PR }>(items: readonly T[]): Stack<T>[] {
  const byHead = new Map<string, T>()
  for (const item of items) {
    if (item.pr.headRef) byHead.set(branchKey(item.pr.repository, item.pr.headRef), item)
  }
  const parentOf = (item: T): T | undefined => {
    if (!item.pr.baseRef) return undefined
    const parent = byHead.get(branchKey(item.pr.repository, item.pr.baseRef))
    if (parent === item) return undefined
    return parent
  }

  const groups = new Map<T, Array<{ readonly item: T; readonly depth: number }>>()
  for (const item of items) {
    // Walk down to the bottom of the stack; a cycle of base branches stops where it repeats.
    const path = new Set<T>([item])
    let bottom = item
    for (let parent = parentOf(bottom); parent && !path.has(parent); parent = parentOf(bottom)) {
      path.add(parent)
      bottom = parent
    }
    const group = groups.get(bottom)
    const member = { item, depth: path.size - 1 }
    if (group) group.push(member)
    else groups.set(bottom, [member])
  }

  return Array.from(groups, ([bottom, members]) => ({
    members: members
      .toSorted(
        (a, b) => b.depth - a.depth || b.item.pr.updatedAt.localeCompare(a.item.pr.updatedAt),
      )
      .map((member) => member.item),
    base: bottom.pr.baseRef,
  }))
}
