const listeners = new Set()
const local = {
  githubToken: "github_pat_demo",
  previousPRs: {
    created: [
      {
        id: 101,
        number: 482,
        title: "Add resilient background synchronization",
        html_url: "https://github.com/cevr/github-prs/pull/482",
        repository_url: "https://api.github.com/repos/cevr/github-prs",
        updated_at: "2026-07-16T19:42:00.000Z",
        user: { login: "cevr" },
        isApproved: true,
        lastUpdatedBy: "octocat",
      },
      {
        id: 102,
        number: 197,
        title: "Polish keyboard navigation and focus states",
        html_url: "https://github.com/cevr/design-system/pull/197",
        repository_url: "https://api.github.com/repos/cevr/design-system",
        updated_at: "2026-07-15T16:10:00.000Z",
        user: { login: "cevr" },
        isApproved: false,
        lastUpdatedBy: "hubot",
      },
    ],
    assigned: [
      {
        id: 201,
        number: 1284,
        title: "Refine deployment health checks",
        html_url: "https://github.com/acme/platform/pull/1284",
        repository_url: "https://api.github.com/repos/acme/platform",
        updated_at: "2026-07-16T20:18:00.000Z",
        user: { login: "monalisa" },
        lastUpdatedBy: "monalisa",
      },
      {
        id: 202,
        number: 763,
        title: "Move release metadata into the shared pipeline",
        html_url: "https://github.com/acme/tooling/pull/763",
        repository_url: "https://api.github.com/repos/acme/tooling",
        updated_at: "2026-07-14T13:30:00.000Z",
        user: { login: "octocat" },
        lastUpdatedBy: "octocat",
      },
    ],
  },
  seenPRs: {
    102: "2026-07-15T17:00:00.000Z",
    202: "2026-07-15T10:00:00.000Z",
  },
  syncState: { status: "idle", lastSyncedAt: "2026-07-16T20:20:00.000Z" },
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
    sendMessage: async () => undefined,
    openOptionsPage: async () => undefined,
    getURL: (path) => path,
  },
  tabs: { create: async () => undefined },
})
