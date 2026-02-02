import {
  createResource,
  createMemo,
  onCleanup,
  ErrorBoundary,
  Suspense,
  Show,
  For,
  Switch,
  Match,
} from "solid-js"

interface PR {
  id: number
  number: number
  title: string
  html_url: string
  repository_url: string
  updated_at: string
  user: {
    login: string
    avatar_url: string
  }
  isApproved?: boolean
  lastUpdatedBy?: string
}

interface PRData {
  created: PR[]
  assigned: PR[]
}

interface SeenPRs {
  [key: string]: string
}

interface SetupData {
  token: string
  username: string
}

async function fetchSetup(): Promise<SetupData> {
  const result = await chrome.storage.sync.get(["token", "username"])
  if (!result.token || !result.username) {
    throw new Error("setup_needed")
  }
  return { token: result.token as string, username: result.username as string }
}

async function fetchPRs(): Promise<PRData> {
  const { previousPRs } = await chrome.storage.local.get(["previousPRs"])
  if (!previousPRs) {
    chrome.runtime.sendMessage({ action: "checkNow" })
    throw new Error("loading")
  }
  return previousPRs as PRData
}

async function fetchSeenPRs(): Promise<SeenPRs> {
  const { seenPRs } = await chrome.storage.local.get(["seenPRs"])
  return (seenPRs as SeenPRs) || {}
}

// SVG icon components to reduce duplication
function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"
      />
      <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M7.429 1.525a6.593 6.593 0 0 1 1.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.183.501.29.417.278.97.423 1.53.27l1.102-.303c.11-.03.175.016.195.046.219.31.41.641.573.989.014.031.022.11-.059.19l-.815.806c-.411.406-.562.957-.53 1.456a4.588 4.588 0 0 1 0 .582c-.032.499.119 1.05.53 1.456l.815.806c.08.08.073.159.059.19a6.494 6.494 0 0 1-.573.99c-.02.029-.086.074-.195.045l-1.103-.303c-.559-.153-1.112-.008-1.529.27-.16.107-.327.204-.5.29-.449.222-.851.628-.998 1.189l-.289 1.105c-.029.11-.101.143-.137.146a6.613 6.613 0 0 1-1.142 0c-.036-.003-.108-.037-.137-.146l-.289-1.105c-.147-.56-.55-.967-.997-1.189a4.502 4.502 0 0 1-.501-.29c-.417-.278-.97-.423-1.53-.27l-1.102.303c-.11.03-.175-.016-.195-.046a6.492 6.492 0 0 1-.573-.989c-.014-.031-.022-.11.059-.19l.815-.806c.411-.406.562-.957.53-1.456a4.587 4.587 0 0 1 0-.582c.032-.499-.119-1.05-.53-1.456l-.815-.806c-.08-.08-.073-.159-.059-.19a6.44 6.44 0 0 1 .573-.99c.02-.029.086-.075.195-.045l1.103.303c.559.153 1.112.008 1.529-.27.16-.107.327-.204.5-.29.449-.222.851-.628.998-1.189l.289-1.105c.029-.11.101-.143.137-.146zM8 0c-.236 0-.47.01-.701.03-.743.065-1.29.615-1.458 1.261l-.29 1.106c-.017.066-.078.158-.211.224a5.994 5.994 0 0 0-.668.386c-.123.082-.233.09-.3.071L3.27 2.776c-.644-.177-1.392.02-1.82.63a7.977 7.977 0 0 0-.704 1.217c-.315.675-.111 1.422.363 1.891l.815.806c.05.048.098.147.088.294a6.084 6.084 0 0 0 0 .772c.01.147-.038.246-.088.294l-.815.806c-.474.469-.678 1.216-.363 1.891.2.428.436.835.704 1.218.428.609 1.176.806 1.82.63l1.103-.303c.066-.019.176-.011.299.071.213.143.436.272.668.386.133.066.194.158.212.224l.289 1.106c.169.646.715 1.196 1.458 1.26a8.094 8.094 0 0 0 1.402 0c.743-.064 1.29-.614 1.458-1.26l.29-1.106c.017-.066.078-.158.211-.224a5.98 5.98 0 0 0 .668-.386c.123-.082.233-.09.3-.071l1.102.302c.644.177 1.392-.02 1.82-.63.268-.382.505-.789.704-1.217.315-.675.111-1.422-.364-1.891l-.814-.806c-.05-.048-.098-.147-.088-.294a6.1 6.1 0 0 0 0-.772c-.01-.147.039-.246.088-.294l.814-.806c.475-.469.679-1.216.364-1.891a7.992 7.992 0 0 0-.704-1.218c-.428-.609-1.176-.806-1.82-.63l-1.103.303c-.066.019-.176.011-.299-.071a5.991 5.991 0 0 0-.668-.386c-.133-.066-.194-.158-.212-.224L10.16 1.29C9.99.645 9.444.095 8.701.031A8.094 8.094 0 0 0 8 0z"
      />
    </svg>
  )
}

function Header(props: { onRefresh?: () => void }) {
  return (
    <div class="header">
      <h1>GitHub PR Tracker</h1>
      <div class="header-actions">
        <Show when={props.onRefresh}>
          <button onClick={props.onRefresh} class="header-button" title="Refresh">
            <RefreshIcon />
          </button>
        </Show>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          class="header-button"
          title="Settings"
        >
          <SettingsIcon />
        </button>
      </div>
    </div>
  )
}

function PRList(props: { prsData: PRData; seenPRs: SeenPRs; onMarkSeen: (prId: number) => void }) {
  const allPRs = createMemo(() =>
    [
      ...props.prsData.created.map((pr) => ({
        ...pr,
        type: pr.isApproved ? ("APPROVED" as const) : ("CREATED" as const),
      })),
      ...props.prsData.assigned.map((pr) => ({
        ...pr,
        type: "ASSIGNED" as const,
      })),
    ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
  )

  return (
    <Show
      when={allPRs().length > 0}
      fallback={
        <div class="empty-state">
          <p>No PRs found.</p>
        </div>
      }
    >
      <ul class="pr-list">
        <For each={allPRs()}>
          {(pr) => {
            const prId = pr.id.toString()
            const isSeen = () => props.seenPRs[prId]
            const isUnseen = () => {
              const seen = isSeen()
              return !seen || new Date(pr.updated_at) > new Date(seen)
            }

            return (
              <li
                class={`pr-item ${isSeen() ? "pr-item-viewed" : ""}`}
                onClick={() => {
                  props.onMarkSeen(pr.id)
                  chrome.tabs.create({ url: pr.html_url })
                }}
                onMouseEnter={() => props.onMarkSeen(pr.id)}
              >
                <div class="pr-title">
                  <span class={`status-dot ${isUnseen() ? "unseen" : "seen"}`} />
                  <span class="pr-title-text">{pr.title}</span>
                  <span class={`pr-type-label ${pr.type === "APPROVED" ? "approved" : ""}`}>
                    {pr.type}
                  </span>
                </div>
                <div class="pr-meta">
                  <span class="pr-repo">
                    {getRepoNameFromUrl(pr.repository_url)} #{pr.number}
                  </span>
                  <span class="pr-updated">{getTimeAgo(new Date(pr.updated_at))}</span>
                </div>
              </li>
            )
          }}
        </For>
      </ul>
    </Show>
  )
}

function getRepoNameFromUrl(url: string): string {
  const parts = url.split("/")
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
  }
  return "Unknown Repository"
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  let interval = Math.floor(seconds / 31536000)
  if (interval > 1) return `${interval} years ago`
  if (interval === 1) return `1 year ago`

  interval = Math.floor(seconds / 2592000)
  if (interval > 1) return `${interval} months ago`
  if (interval === 1) return `1 month ago`

  interval = Math.floor(seconds / 86400)
  if (interval > 1) return `${interval} days ago`
  if (interval === 1) return `1 day ago`

  interval = Math.floor(seconds / 3600)
  if (interval > 1) return `${interval} hours ago`
  if (interval === 1) return `1 hour ago`

  interval = Math.floor(seconds / 60)
  if (interval > 1) return `${interval} minutes ago`
  if (interval === 1) return `1 minute ago`

  return "just now"
}

function PopupContent() {
  const [setup] = createResource(fetchSetup)
  const [prsData, { refetch: refetchPRs }] = createResource(fetchPRs)
  const [seenPRs, { mutate: mutateSeenPRs, refetch: refetchSeenPRs }] = createResource(fetchSeenPRs)

  // Listen for background messages to refetch
  const listener = (request: { action: string }) => {
    if (request.action === "prsUpdated") {
      refetchPRs()
      refetchSeenPRs()
    }
    if (request.action === "setupNeeded") {
      // Force a full reload — setup state changed
      window.location.reload()
    }
  }
  chrome.runtime.onMessage.addListener(listener)
  onCleanup(() => chrome.runtime.onMessage.removeListener(listener))

  const markSeen = (prId: number) => {
    // Optimistic update
    mutateSeenPRs((prev) => ({
      ...(prev || {}),
      [prId]: new Date().toISOString(),
    }))
    // Fire-and-forget to background
    chrome.runtime.sendMessage({ action: "markPRViewed", prId })
  }

  return (
    <Switch>
      <Match when={setup.error?.message === "setup_needed"}>
        <Header />
        <div class="setup-needed">
          <p>Please set up your GitHub token to start tracking PRs.</p>
          <button onClick={() => chrome.runtime.openOptionsPage()} class="setup-button">
            Open Settings
          </button>
        </div>
      </Match>
      <Match when={setup.loading || prsData.loading || seenPRs.loading}>
        <Header onRefresh={() => chrome.runtime.sendMessage({ action: "checkNow" })} />
        <div class="loading">Loading...</div>
      </Match>
      <Match when={prsData.error?.message === "loading"}>
        <Header onRefresh={() => chrome.runtime.sendMessage({ action: "checkNow" })} />
        <div class="loading">Loading...</div>
      </Match>
      <Match when={setup.error || prsData.error || seenPRs.error}>
        <Header />
        <div class="empty-state">
          <p>
            Error:{" "}
            {(setup.error as Error)?.message ||
              (prsData.error as Error)?.message ||
              (seenPRs.error as Error)?.message}
          </p>
        </div>
      </Match>
      <Match
        when={prsData() && seenPRs() && { prs: prsData() as PRData, seen: seenPRs() as SeenPRs }}
      >
        {(data) => (
          <>
            <Header onRefresh={() => chrome.runtime.sendMessage({ action: "checkNow" })} />
            <div class="pr-container">
              <PRList prsData={data().prs} seenPRs={data().seen} onMarkSeen={markSeen} />
            </div>
          </>
        )}
      </Match>
    </Switch>
  )
}

export function Popup() {
  return (
    <ErrorBoundary
      fallback={(err: Error) => (
        <>
          <Header />
          <div class="empty-state">
            <p>Error: {err.message}</p>
          </div>
        </>
      )}
    >
      <Suspense fallback={<div class="loading">Loading...</div>}>
        <PopupContent />
      </Suspense>
    </ErrorBoundary>
  )
}
