import { sameLogin } from "@/types"
import type { PR, SeenPRs } from "@/types"
import { authoredStage, reviewingStage, STAGES } from "./pr-status"
import type { Perspective, Stage } from "./pr-status"
import { isUnseen } from "./seen"
import { parseEpochMillis } from "./time"

export interface PRCollectionItem {
  readonly pr: PR
  readonly stage: Stage
  readonly unseen: boolean
  readonly newComment: boolean
}

/** The pull requests at one stage, newest activity first. */
export interface PRCollectionSection {
  readonly stage: Stage
  readonly items: readonly PRCollectionItem[]
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

export function createPRCollection(
  prs: readonly PR[],
  seen: Readonly<SeenPRs>,
  lens: PRCollectionLens,
): PRCollection {
  const byStage = new Map<Stage, PRCollectionItem[]>()
  let unseenCount = 0

  for (const pr of prs) {
    let stage: Stage = authoredStage(pr)
    if (lens.perspective === "reviewing") stage = reviewingStage(pr, lens.viewer)
    const unseen = isUnseen(pr, seen)
    if (unseen) unseenCount++
    const item = { pr, stage, unseen, newComment: hasNewComment(pr, seen, lens.viewer) }
    const items = byStage.get(stage)
    if (items) items.push(item)
    else byStage.set(stage, [item])
  }

  const sections: PRCollectionSection[] = []
  for (const stage of STAGES[lens.perspective]) {
    const items = byStage.get(stage)
    if (!items) continue
    sections.push({
      stage,
      items: items.toSorted(
        (a, b) => parseEpochMillis(b.pr.updatedAt) - parseEpochMillis(a.pr.updatedAt),
      ),
    })
  }

  return { sections, totalCount: prs.length, unseenCount }
}
