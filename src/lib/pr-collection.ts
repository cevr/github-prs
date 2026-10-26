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

/** One line of a section: a lone pull request, or a stack of them kept together. */
export type PRCollectionEntry =
  | { readonly kind: "single"; readonly key: string; readonly item: PRCollectionItem }
  | {
      readonly kind: "stack"
      readonly key: string
      /** Top of the stack first. Each member keeps its own stage. */
      readonly items: readonly PRCollectionItem[]
      readonly base: string | undefined
    }

/** The entries at one stage, newest activity first. A stack sits at its most urgent member's stage. */
export interface PRCollectionSection {
  readonly stage: Stage
  readonly entries: readonly PRCollectionEntry[]
  /** Pull requests in the section, stack members included. */
  readonly count: number
  readonly unseen: number
}

export interface PRCollection {
  /** Only stages that hold pull requests, in their perspective's order. */
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

function membersOf(entry: PRCollectionEntry): readonly PRCollectionItem[] {
  if (entry.kind === "stack") return entry.items
  return [entry.item]
}

/** The stage that comes first in the perspective's order: the one waiting on the user soonest. */
function mostUrgent(stages: readonly Stage[], order: readonly Stage[]): Stage | undefined {
  let urgent: Stage | undefined
  for (const stage of stages) {
    if (urgent === undefined || order.indexOf(stage) < order.indexOf(urgent)) urgent = stage
  }
  return urgent
}

const newest = (items: readonly PRCollectionItem[]) =>
  Math.max(...items.map((item) => parseEpochMillis(item.pr.updatedAt)))

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

  const byStage = new Map<Stage, PRCollectionEntry[]>()
  for (const stack of stacksOf(items)) {
    const [first] = stack.members
    if (!first) continue
    let entry: PRCollectionEntry = { kind: "single", key: `pr-${first.pr.id}`, item: first }
    let stage = first.stage
    if (stack.members.length > 1) {
      const bottom = stack.members.at(-1) ?? first
      entry = {
        kind: "stack",
        key: `stack-${bottom.pr.id}`,
        items: stack.members,
        base: stack.base,
      }
      stage =
        mostUrgent(
          stack.members.map((member) => member.stage),
          order,
        ) ?? first.stage
    }
    const entries = byStage.get(stage)
    if (entries) entries.push(entry)
    else byStage.set(stage, [entry])
  }

  const sections: PRCollectionSection[] = []
  for (const stage of order) {
    const entries = byStage.get(stage)
    if (!entries) continue
    const members = entries.flatMap(membersOf)
    sections.push({
      stage,
      entries: entries.toSorted((a, b) => newest(membersOf(b)) - newest(membersOf(a))),
      count: members.length,
      unseen: members.filter((item) => item.unseen).length,
    })
  }

  return {
    sections,
    totalCount: prs.length,
    unseenCount: items.filter((item) => item.unseen).length,
  }
}
