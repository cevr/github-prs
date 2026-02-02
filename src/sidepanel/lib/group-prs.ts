import type { PR } from "@/types"
import { getRepoName } from "./format"

export interface RepoGroup {
  repo: string
  prs: PR[]
}

export function groupByRepo(prs: PR[]): RepoGroup[] {
  const map = new Map<string, PR[]>()

  for (const pr of prs) {
    const repo = getRepoName(pr.repository_url)
    const list = map.get(repo)
    if (list) {
      list.push(pr)
    } else {
      map.set(repo, [pr])
    }
  }

  // Sort groups by most recent PR update, PRs within each group also by recency
  const groups: RepoGroup[] = []
  for (const [repo, repoPrs] of map) {
    repoPrs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    groups.push({ repo, prs: repoPrs })
  }

  groups.sort(
    (a, b) => new Date(b.prs[0].updated_at).getTime() - new Date(a.prs[0].updated_at).getTime(),
  )

  return groups
}
