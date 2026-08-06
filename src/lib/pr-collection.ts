import type { PR, SeenPRs } from "@/types"
import { parseEpochMillis } from "./time"

export interface PRCollectionItem {
  pr: PR
  unseen: boolean
  newComment: boolean
}

export interface PRCollectionGroup {
  repo: string
  items: PRCollectionItem[]
}

export interface PRCollection {
  groups: PRCollectionGroup[]
  totalCount: number
  unseenCount: number
}

function getRepoName(repositoryUrl: string): string {
  const parts = repositoryUrl.split("/")
  if (parts.length >= 2) {
    return parts[parts.length - 2] + "/" + parts[parts.length - 1]
  }
  return "unknown/repo"
}

function isUnseen(pr: PR, seen: SeenPRs): boolean {
  const seenAt = seen[pr.id.toString()]
  return !seenAt || parseEpochMillis(pr.updated_at) > parseEpochMillis(seenAt)
}

export function createPRCollection(prs: readonly PR[], seen: Readonly<SeenPRs>): PRCollection {
  const byRepo = new Map<string, PRCollectionItem[]>()
  let unseenCount = 0

  for (const pr of prs) {
    const unseen = isUnseen(pr, seen)
    if (unseen) unseenCount++
    const seenAt = seen[pr.id.toString()]
    const newComment = Boolean(
      pr.lastCommentedAt &&
      (!seenAt || parseEpochMillis(pr.lastCommentedAt) > parseEpochMillis(seenAt)),
    )

    const repo = getRepoName(pr.repository_url)
    const item = { pr, unseen, newComment }
    const items = byRepo.get(repo)
    if (items) items.push(item)
    else byRepo.set(repo, [item])
  }

  const groups = Array.from(byRepo, ([repo, items]) => ({
    repo,
    items: items
      .slice()
      .sort((a, b) => parseEpochMillis(b.pr.updated_at) - parseEpochMillis(a.pr.updated_at)),
  })).sort((a, b) => {
    const newestA = a.items.at(0)?.pr.updated_at ?? ""
    const newestB = b.items.at(0)?.pr.updated_at ?? ""
    return parseEpochMillis(newestB) - parseEpochMillis(newestA)
  })

  return { groups, totalCount: prs.length, unseenCount }
}
