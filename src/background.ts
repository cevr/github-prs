import type { PR, PRData, SeenPRs } from "./types"

const DEFAULT_CHECK_INTERVAL = 15

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["token", "username", "checkInterval"], (result) => {
    if (!result.checkInterval) {
      chrome.storage.sync.set({ checkInterval: DEFAULT_CHECK_INTERVAL })
    }
    setupAlarm(Number(result.checkInterval) || DEFAULT_CHECK_INTERVAL)
  })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkPRs") {
    checkForUpdates()
  }
})

function setupAlarm(interval: number) {
  chrome.alarms.clear("checkPRs", () => {
    chrome.alarms.create("checkPRs", { periodInMinutes: interval })
  })
}

interface TimelineEvent {
  event: string
  state?: string
  actor?: { login: string }
}

async function fetchPRTimeline(
  token: string,
  repoOwner: string,
  repoName: string,
  prNumber: number,
): Promise<{ isApproved: boolean; lastUpdatedBy: string | null }> {
  const timelineUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/pulls/${prNumber}/timeline`

  try {
    const response = await fetch(timelineUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })

    if (!response.ok) {
      return { isApproved: false, lastUpdatedBy: null }
    }

    const timeline: TimelineEvent[] = await response.json()
    let isApproved = false
    let lastUpdatedBy: string | null = null

    // Walk backwards: find most recent reviewer action, determine approval state
    for (let i = timeline.length - 1; i >= 0; i--) {
      const event = timeline[i]

      if (
        !lastUpdatedBy &&
        event.actor &&
        (event.event === "reviewed" ||
          event.event === "committed" ||
          event.event === "commented" ||
          event.event === "synchronized")
      ) {
        lastUpdatedBy = event.actor.login
      }

      if (event.event === "reviewed" && event.state === "approved") {
        isApproved = true
        break
      }

      if (event.event === "reviewed" && event.state !== "approved") {
        break
      }
    }

    return { isApproved, lastUpdatedBy }
  } catch (error) {
    console.error("Error fetching timeline:", error)
    return { isApproved: false, lastUpdatedBy: null }
  }
}

function dedupPRs(...lists: PR[][]): PR[] {
  const unique = new Map<string, PR>()
  for (const list of lists) {
    for (const pr of list) {
      const key = pr.id.toString()
      if (!unique.has(key)) {
        unique.set(key, pr)
      }
    }
  }
  return Array.from(unique.values())
}

async function checkForUpdates() {
  try {
    const { token, username, hideInactivePRs } = await chrome.storage.sync.get([
      "token",
      "username",
      "hideInactivePRs",
    ])
    if (!token || !username) return

    const { seenPRs = {} }: { seenPRs?: SeenPRs } = await chrome.storage.local.get(["seenPRs"])

    const [createdPRs, assignedPRs] = await Promise.all([
      fetchPRsWithTimeline({
        token: token as string,
        url: `https://api.github.com/search/issues?q=is:pr+author:${username}+is:open`,
        includeApprovalStatus: true,
      }),
      Promise.all([
        fetchPRsWithTimeline({
          token: token as string,
          url: `https://api.github.com/search/issues?q=is:pr+is:open+assignee:${username}`,
          includeApprovalStatus: false,
        }),
        fetchPRsWithTimeline({
          token: token as string,
          url: `https://api.github.com/search/issues?q=is:pr+is:open+review-requested:${username}`,
          includeApprovalStatus: false,
        }),
      ]).then(([assigned, reviewRequested]) => dedupPRs(assigned, reviewRequested)),
    ]).catch(async (error: Error) => {
      if (error.message.includes("401")) {
        await chrome.storage.sync.remove(["token", "username"])
        await chrome.storage.local.remove(["previousPRs", "seenPRs"])
        await chrome.runtime.sendMessage({ action: "setupNeeded" })
      }
      throw error
    })

    const filterInactivePRs = (prs: PR[]): PR[] => {
      if (!hideInactivePRs) return prs
      const oneMonthAgo = new Date()
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
      return prs.filter((pr) => new Date(pr.updated_at) >= oneMonthAgo)
    }

    const newPRs: PRData = {
      created: filterInactivePRs(createdPRs),
      assigned: filterInactivePRs(assignedPRs),
    }

    const allPRs = dedupPRs(createdPRs, assignedPRs)
    const updatedSeenPRs: SeenPRs = { ...seenPRs }

    for (const prId of Object.keys(updatedSeenPRs)) {
      if (!allPRs.find((pr) => pr.id.toString() === prId)) {
        delete updatedSeenPRs[prId]
      }
    }

    let hasUnseenUpdates = false
    for (const pr of allPRs) {
      const prId = pr.id.toString()
      const lastSeen = updatedSeenPRs[prId]
      if (
        !lastSeen ||
        (new Date(pr.updated_at) > new Date(lastSeen) && pr.lastUpdatedBy !== username)
      ) {
        hasUnseenUpdates = true
        break
      }
    }

    const totalPRs = newPRs.created.length + newPRs.assigned.length
    if (totalPRs > 0) {
      chrome.action.setBadgeText({ text: totalPRs.toString() })
      chrome.action.setBadgeTextColor({ color: "#fff" })
      chrome.action.setBadgeBackgroundColor({
        color: hasUnseenUpdates ? "#f85149" : "#666",
      })
    } else {
      chrome.action.setBadgeText({ text: "" })
    }

    await chrome.storage.local.set({
      previousPRs: newPRs,
      seenPRs: updatedSeenPRs,
    })
    await chrome.runtime.sendMessage({ action: "prsUpdated" })
  } catch (error) {
    console.error("Error checking for updates:", error)
  }
}

async function fetchPRsWithTimeline({
  token,
  url,
  includeApprovalStatus = false,
}: {
  token: string
  url: string
  includeApprovalStatus?: boolean
}): Promise<PR[]> {
  const prs = await fetchPRs(token, url)
  return Promise.all(
    prs.map(async (pr) => {
      const repoParts = pr.repository_url.split("/")
      const repoOwner = repoParts[repoParts.length - 2]
      const repoName = repoParts[repoParts.length - 1]

      const { isApproved, lastUpdatedBy } = await fetchPRTimeline(
        token,
        repoOwner,
        repoName,
        pr.number,
      )

      return {
        ...pr,
        ...(includeApprovalStatus && { isApproved }),
        lastUpdatedBy: lastUpdatedBy ?? undefined,
      }
    }),
  )
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

async function fetchPRs(token: string, url: string): Promise<PR[]> {
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const data: { items: GitHubSearchItem[] } = await response.json()
  return data.items.map((item) => ({
    id: item.id,
    number: item.number,
    title: item.title,
    html_url: item.html_url,
    repository_url: item.repository_url,
    updated_at: item.updated_at,
    user: { login: item.user.login },
  }))
}

chrome.runtime.onMessage.addListener(
  (request: { action: string; prId?: number; checkInterval?: number }, _sender, sendResponse) => {
    if (request.action === "checkNow") {
      checkForUpdates()
      sendResponse()
    } else if (request.action === "markPRViewed" && request.prId != null) {
      markPRViewed(request.prId)
      sendResponse()
    } else if (request.action === "updateSettings") {
      setupAlarm(Number(request.checkInterval) || DEFAULT_CHECK_INTERVAL)
      sendResponse()
    }
  },
)

async function markPRViewed(prId: number) {
  const { seenPRs = {} }: { seenPRs?: SeenPRs } = await chrome.storage.local.get(["seenPRs"])
  seenPRs[prId] = new Date().toISOString()
  await chrome.storage.local.set({ seenPRs })
  checkForUpdates()
}
