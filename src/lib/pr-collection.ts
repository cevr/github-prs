import { sameLogin } from "@/types"
import type { PR, SeenPRs } from "@/types"
import { authoredStage, reviewingStage, STAGES } from "./pr-status"
import type { Perspective, Stage } from "./pr-status"
import { stacksOf } from "./pr-stacks"
import { isUnseen } from "./seen"
import { parseEpochMillis } from "./time"

export interface PRCollectionItem {
  readonly pr: PR
  readonly stage: Stage
  readonly unseen: boolean
  readonly newComment: boolean
}

export interface PRCollectionStack {
  readonly key: string
  readonly items: readonly PRCollectionItem[]
  readonly first: PRCollectionItem
  readonly base: string | undefined
  readonly tally: readonly { readonly stage: Stage; readonly count: number }[]
  readonly unseen: number
}

export interface PRCollectionSection {
  readonly stage: Stage
  readonly items: readonly PRCollectionItem[]
  readonly unseen: number
}

export interface PRCollectionRepository {
  readonly repository: string
  readonly stacks: readonly PRCollectionStack[]
  readonly sections: readonly PRCollectionSection[]
  readonly count: number
  readonly unseen: number
}

export interface PRCollection {
  readonly repositories: readonly PRCollectionRepository[]
  readonly totalCount: number
  readonly unseenCount: number
}

export interface PRCollectionLens {
  readonly perspective: Perspective
  readonly viewer: string
}

function hasNewComment(pr: PR, seen: Readonly<SeenPRs>, viewer: string): boolean {
  if (!pr.lastComment || sameLogin(pr.lastComment.by, viewer)) return false
  const seenAt = seen[pr.id.toString()]
  return !seenAt || parseEpochMillis(pr.lastComment.at) > parseEpochMillis(seenAt)
}

function tallyOf(items: readonly PRCollectionItem[], order: readonly Stage[]) {
  const tally: Array<{ readonly stage: Stage; readonly count: number }> = []
  for (const stage of order) {
    const count = items.filter((item) => item.stage === stage).length
    if (count > 0) tally.push({ stage, count })
  }
  return tally
}

const activity = (item: PRCollectionItem) => parseEpochMillis(item.pr.updatedAt)
const newest = (items: readonly PRCollectionItem[]) => Math.max(...items.map(activity))
const unseenIn = (items: readonly PRCollectionItem[]) => items.filter((item) => item.unseen).length

function repositoryOf(
  repository: string,
  items: readonly PRCollectionItem[],
  order: readonly Stage[],
): PRCollectionRepository {
  const stacks: PRCollectionStack[] = []
  const byStage = new Map<Stage, PRCollectionItem[]>()
  for (const stack of stacksOf(items)) {
    const [top] = stack.members
    const first = stack.members.at(-1)
    if (!top || !first) continue
    if (stack.members.length === 1) {
      const singles = byStage.get(top.stage)
      if (singles) singles.push(top)
      else byStage.set(top.stage, [top])
      continue
    }
    stacks.push({
      key: `stack-${first.pr.id}`,
      items: stack.members,
      first,
      base: stack.base,
      tally: tallyOf(stack.members, order),
      unseen: stack.members.filter((member) => member.unseen).length,
    })
  }

  const urgency = (stack: PRCollectionStack) => {
    const stage = stack.tally[0]?.stage
    if (stage === undefined) return order.length
    return order.indexOf(stage)
  }
  const sections: PRCollectionSection[] = []
  for (const stage of order) {
    const singles = byStage.get(stage)
    if (!singles) continue
    sections.push({
      stage,
      items: singles.toSorted((a, b) => activity(b) - activity(a)),
      unseen: unseenIn(singles),
    })
  }

  return {
    repository,
    stacks: stacks.toSorted((a, b) => urgency(a) - urgency(b) || newest(b.items) - newest(a.items)),
    sections,
    count: items.length,
    unseen: unseenIn(items),
  }
}

export function createPRCollection(
  prs: readonly PR[],
  seen: Readonly<SeenPRs>,
  lens: PRCollectionLens,
): PRCollection {
  const order: readonly Stage[] = STAGES[lens.perspective]
  const items = prs.map((pr): PRCollectionItem => {
    let stage: Stage = authoredStage(pr)
    if (lens.perspective === "reviewing") stage = reviewingStage(pr, lens.viewer)
    return {
      pr,
      stage,
      unseen: isUnseen(pr, seen),
      newComment: hasNewComment(pr, seen, lens.viewer),
    }
  })

  const byRepository = new Map<string, PRCollectionItem[]>()
  for (const item of items) {
    const group = byRepository.get(item.pr.repository)
    if (group) group.push(item)
    else byRepository.set(item.pr.repository, [item])
  }
  const mostRecentFirst = Array.from(byRepository).toSorted(
    ([a, aItems], [b, bItems]) => newest(bItems) - newest(aItems) || a.localeCompare(b),
  )

  return {
    repositories: mostRecentFirst.map(([repository, members]) =>
      repositoryOf(repository, members, order),
    ),
    totalCount: prs.length,
    unseenCount: unseenIn(items),
  }
}
