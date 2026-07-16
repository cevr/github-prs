import type { PR, PRData } from "@/types"
import type { TrackerSettings } from "@/lib/tracker-settings"

export interface PRSource {
  fetch(settings: TrackerSettings): Promise<PRData>
}

export class GitHubAuthenticationError extends Error {
  constructor() {
    super("GitHub rejected the saved account credentials.")
    this.name = "GitHubAuthenticationError"
  }
}

interface TimelineEvent {
  event: string
  state?: string
  actor?: { login: string }
}

interface GitHubSearchItem {
  id: number
  number: number
  title: string
  html_url: string
  repository_url: string
  updated_at: string
  user: { login: string }
}

function deduplicate(...collections: readonly PR[][]): PR[] {
  const unique = new Map<number, PR>()
  for (const collection of collections) {
    for (const pr of collection) unique.set(pr.id, pr)
  }
  return [...unique.values()]
}

export function createGitHubPRSource(request: typeof fetch = fetch): PRSource {
  async function fetchTimeline(
    token: string,
    pr: PR,
  ): Promise<{ isApproved: boolean; lastUpdatedBy?: string }> {
    const repository = pr.repository_url.replace("https://api.github.com/repos/", "")
    try {
      const response = await request(
        `https://api.github.com/repos/${repository}/pulls/${pr.number}/timeline`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      )
      if (response.status === 401) throw new GitHubAuthenticationError()
      if (!response.ok) return { isApproved: false }

      const timeline = (await response.json()) as TimelineEvent[]
      let isApproved = false
      let lastUpdatedBy: string | undefined

      for (let index = timeline.length - 1; index >= 0; index--) {
        const event = timeline[index]
        if (
          !lastUpdatedBy &&
          event.actor &&
          ["reviewed", "committed", "commented", "synchronized"].includes(event.event)
        ) {
          lastUpdatedBy = event.actor.login
        }
        if (event.event === "reviewed") {
          isApproved = event.state === "approved"
          break
        }
      }

      return { isApproved, lastUpdatedBy }
    } catch (error) {
      if (error instanceof GitHubAuthenticationError) throw error
      console.error("Error fetching timeline:", error)
      return { isApproved: false }
    }
  }

  async function search(token: string, query: string, includeApproval: boolean): Promise<PR[]> {
    const response = await request(`https://api.github.com/search/issues?q=${query}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })
    if (response.status === 401) throw new GitHubAuthenticationError()
    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)

    const { items } = (await response.json()) as { items: GitHubSearchItem[] }
    return Promise.all(
      items.map(async (item) => {
        const pr: PR = {
          id: item.id,
          number: item.number,
          title: item.title,
          html_url: item.html_url,
          repository_url: item.repository_url,
          updated_at: item.updated_at,
          user: { login: item.user.login },
        }
        const timeline = await fetchTimeline(token, pr)
        return {
          ...pr,
          ...(includeApproval ? { isApproved: timeline.isApproved } : {}),
          lastUpdatedBy: timeline.lastUpdatedBy,
        }
      }),
    )
  }

  return {
    async fetch(settings) {
      const username = encodeURIComponent(settings.username)
      const [created, assigned, reviewRequested] = await Promise.all([
        search(settings.token, `is:pr+author:${username}+is:open`, true),
        search(settings.token, `is:pr+is:open+assignee:${username}`, false),
        search(settings.token, `is:pr+is:open+review-requested:${username}`, false),
      ])
      return { created, assigned: deduplicate(assigned, reviewRequested) }
    },
  }
}
