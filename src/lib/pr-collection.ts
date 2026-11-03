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

export interface PRCollection {
  readonly stacks: readonly PRCollectionStack[]
  readonly sections: readonly PRCollectionSection[]
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
      unseen: singles.filter((item) => item.unseen).length,
    })
  }

  return {
    stacks: stacks.toSorted((a, b) => urgency(a) - urgency(b) || newest(b.items) - newest(a.items)),
    sections,
    totalCount: prs.length,
    unseenCount: items.filter((item) => item.unseen).length,
  }
}
