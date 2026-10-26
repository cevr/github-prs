// A Chrome stand-in for rendering the extension pages outside Chrome, for store screenshots: load it
// before a page's module script. The pull requests cover every stage of both lists.
// Times are written as of the snapshot and shown as if it were taken just now.
const SNAPSHOT_AT = Date.parse("2026-07-16T20:20:00Z")
const at = (iso) => new Date(Date.now() - (SNAPSHOT_AT - Date.parse(iso))).toISOString()
const person = (login) => ({ login, avatarUrl: `https://github.com/${login}.png?size=48` })
const review = (login, verdict, submittedAt) => ({
  reviewer: person(login),
  verdict,
  submittedAt: at(submittedAt),
})
const pr = (number, repository, title, updatedAt, overrides = {}) => ({
  id: number,
  number,
  title,
  url: `https://github.com/${repository}/pull/${number}`,
  repository,
  author: person("cevr"),
  updatedAt: at(updatedAt),
  draft: false,
  conflicting: false,
  reviews: [],
  requestedReviewers: [],
  ...overrides,
  lastComment: overrides.lastComment && {
    ...overrides.lastComment,
    at: at(overrides.lastComment.at),
  },
  decision:
    { APPROVED: "approved", REVIEW_REQUIRED: "review_required" }[overrides.decision] ?? null,
})

const listeners = new Set()
const local = {
  githubToken: "github_pat_demo",
  pullRequests: {
    authored: [
      pr(482, "cevr/github-prs", "Order pull requests by review status", "2026-07-16T19:42:00Z", {
        decision: "APPROVED",
        baseRef: "graphql-search",
        headRef: "status-order",
        reviews: [review("octocat", "approved", "2026-07-16T19:40:00Z")],
        requestedReviewers: [person("hubot")],
      }),
      pr(
        479,
        "cevr/github-prs",
        "Load pull requests through one GraphQL search",
        "2026-07-16T18:05:00Z",
        {
          baseRef: "main",
          headRef: "graphql-search",
          reviews: [
            review("monalisa", "changes_requested", "2026-07-16T18:00:00Z"),
            review("octocat", "commented", "2026-07-16T17:10:00Z"),
          ],
          lastComment: { by: "monalisa", at: "2026-07-16T18:01:00Z" },
        },
      ),
      pr(486, "cevr/github-prs", "Group stacked pull requests", "2026-07-16T20:02:00Z", {
        draft: true,
        baseRef: "status-order",
        headRef: "stacks",
      }),
      pr(197, "cevr/okra", "Retry counsel turns that time out", "2026-07-15T16:10:00Z", {
        decision: "REVIEW_REQUIRED",
        reviews: [review("hubot", "commented", "2026-07-15T16:00:00Z")],
        requestedReviewers: [person("octocat")],
      }),
      pr(203, "cevr/okra", "Keep the schedule queue across restarts", "2026-07-16T11:30:00Z", {
        decision: "REVIEW_REQUIRED",
        conflicting: true,
        requestedReviewers: [person("monalisa"), person("octocat")],
      }),
      pr(61, "cevr/keychain", "Offer submitted logins to Passwords", "2026-07-14T09:00:00Z", {
        draft: true,
      }),
    ],
    reviewing: [
      pr(1284, "cevr/manna", "Cache Strong's lookups between sessions", "2026-07-16T20:18:00Z", {
        author: person("monalisa"),
        requestedReviewers: [person("cevr")],
      }),
      pr(763, "cevr/rift", "Copy untracked prototypes into new rifts", "2026-07-16T13:30:00Z", {
        author: person("octocat"),
        reviews: [review("cevr", "changes_requested", "2026-07-15T10:00:00Z")],
        requestedReviewers: [person("cevr")],
      }),
      pr(88, "cevr/effect-oxlint", "Flag ternaries inside JSX attributes", "2026-07-15T08:12:00Z", {
        author: person("hubot"),
        reviews: [review("cevr", "approved", "2026-07-15T08:00:00Z")],
      }),
    ],
  },
  seenPRs: {
    197: at("2026-07-15T17:00:00.000Z"),
    61: at("2026-07-14T10:00:00.000Z"),
    88: at("2026-07-15T09:00:00.000Z"),
  },
  syncState: { status: "idle", lastSyncedAt: at("2026-07-16T20:20:00.000Z") },
}
const sync = { username: "cevr", checkInterval: 15, hideInactivePRs: true }
globalThis.confirm = () => true

const select = (source, keys) =>
  Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]))

Object.assign((globalThis.chrome ??= {}), {
  storage: {
    local: {
      get: async (keys) => select(local, keys),
      set: async (values) => Object.assign(local, values),
      remove: async (keys) => keys.forEach((key) => delete local[key]),
      setAccessLevel: async () => undefined,
    },
    sync: {
      get: async (keys) => select(sync, keys),
      set: async (values) => Object.assign(sync, values),
      remove: async (keys) => {
        const selected = Array.isArray(keys) ? keys : [keys]
        selected.forEach((key) => delete sync[key])
      },
      setAccessLevel: async () => undefined,
    },
  },
  runtime: {
    onMessage: {
      addListener: (listener) => listeners.add(listener),
      removeListener: (listener) => listeners.delete(listener),
    },
    // A refresh finishes at once with the same pull requests. Chrome delivers the background's answer
    // in a later task, never during the send, so the mock does too.
    sendMessage: async (message) => {
      if (message?.action !== "checkNow") return
      local.syncState = { status: "idle", lastSyncedAt: new Date().toISOString() }
      setTimeout(() => listeners.forEach((listener) => listener({ action: "prSnapshotChanged" })))
    },
    openOptionsPage: async () => undefined,
    getURL: (path) => path,
  },
  tabs: { create: async () => undefined },
})
