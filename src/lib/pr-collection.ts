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

/** Pull requests stacked on one another, shown as their own section ahead of the stages. */
export interface PRCollectionStack {
  readonly key: string
  /** Top of the stack first. Each member keeps its own stage. */
  readonly items: readonly PRCollectionItem[]
  /** The stack's first pull request, the one on the base branch: what the stack is about. */
  readonly first: PRCollectionItem
  /** The branch the first pull request merges into. */
  readonly base: string | undefined
  /** How many members sit at each stage, in the perspective's order: the stack at a glance. */
  readonly tally: readonly { readonly stage: Stage; readonly count: number }[]
  readonly unseen: number
}

/** The pull requests at one stage that are in no stack, newest activity first. */
export interface PRCollectionSection {
  readonly stage: Stage
  readonly items: readonly PRCollectionItem[]
  readonly unseen: number
}

export interface PRCollection {
  /** Stacks, the one with the most urgent member first, then by newest activity. */
  readonly stacks: readonly PRCollectionStack[]
  /** Only stages that hold pull requests outside stacks, in their perspective's order. */
  readonly sections: readonly PRCollectionSection[]
  readonly totalCount: number
  readonly unseenCount: number
}

export interface PRCollectionLens {
  readonly perspective: Perspective
  /** The user's GitHub login. */
  readonly viewer: string
}

/** Someone else commented after the user last opened the pull request; the user's own never count. */
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

  // A stack's tally runs in the perspective's order, so its first stage is its most urgent.
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
