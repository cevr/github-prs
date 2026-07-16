import { createResource, createSignal, ErrorBoundary, Show, Suspense } from "solid-js"
import type { OptionsData } from "../types"

async function fetchOptions(): Promise<OptionsData> {
  const result = await chrome.storage.sync.get([
    "token",
    "username",
    "checkInterval",
    "hideInactivePRs",
  ])
  return {
    token: (result.token as string) ?? "",
    username: (result.username as string) ?? "",
    checkInterval: Number(result.checkInterval) || 15,
    hideInactivePRs: result.hideInactivePRs !== false,
  }
}

const inputClass =
  "w-full box-border rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-[#f0f6fc] outline-none placeholder:text-[#6e7681] hover:border-[#484f58] focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff]"

const labelClass = "mb-1.5 block text-sm font-medium text-[#f0f6fc]"

function OptionsPage() {
  const [options] = createResource(fetchOptions)
  const [showToken, setShowToken] = createSignal(false)
  const [status, setStatus] = createSignal<{
    message: string
    type: "success" | "error"
  }>()

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    setStatus()

    const form = event.currentTarget as HTMLFormElement
    const formData = new FormData(form)

    const token = String(formData.get("token") ?? "").trim()
    const username = String(formData.get("username") ?? "").trim()
    const checkInterval = Math.min(60, Math.max(5, Number(formData.get("checkInterval")) || 15))
    const hideInactivePRs = formData.get("hideInactivePRs") === "on"

    if (!token) {
      setStatus({ message: "Add a GitHub personal access token to continue.", type: "error" })
      return
    }
    if (!username) {
      setStatus({ message: "Add your GitHub username to continue.", type: "error" })
      return
    }

    chrome.storage.sync.set({ token, username, checkInterval, hideInactivePRs }, () => {
      if (chrome.runtime.lastError) {
        setStatus({
          message: chrome.runtime.lastError.message ?? "Chrome could not save these settings.",
          type: "error",
        })
        return
      }

      setStatus({ message: "Settings saved. Refreshing pull requests now.", type: "success" })
      chrome.runtime.sendMessage({ action: "updateSettings", checkInterval })
      chrome.runtime.sendMessage({ action: "checkNow" })
    })
  }

  return (
    <Show
      when={options()}
      fallback={
        <main class="min-h-screen bg-[#010409] px-5 py-10">
          <div class="mx-auto h-96 max-w-3xl animate-pulse rounded-xl bg-[#0d1117]" />
        </main>
      }
    >
      {(opts) => (
        <main class="min-h-screen bg-[#010409] px-5 py-10 sm:px-8 sm:py-14">
          <div class="mx-auto max-w-3xl">
            <header class="mb-8">
              <p class="m-0 text-sm font-medium text-[#58a6ff]">GitHub PR Tracker</p>
              <h1 class="mt-1.5 mb-0 text-2xl font-semibold tracking-[-0.02em] text-[#f0f6fc] sm:text-3xl">
                Settings
              </h1>
              <p class="mt-2 mb-0 max-w-2xl text-sm leading-6 text-[#8b949e]">
                Connect your account, choose how often to refresh, and preview the new tab
                dashboard.
              </p>
            </header>

            <form onSubmit={handleSubmit} class="space-y-5">
              <section class="overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117]">
                <header class="border-b border-[#30363d] px-5 py-4 sm:px-6">
                  <h2 class="m-0 text-base font-semibold text-[#f0f6fc]">GitHub account</h2>
                  <p class="mt-1 mb-0 text-xs leading-5 text-[#8b949e]">
                    Credentials stay in Chrome sync storage and are only sent to GitHub.
                  </p>
                </header>
                <div class="space-y-5 px-5 py-5 sm:px-6">
                  <div>
                    <label for="username" class={labelClass}>
                      Username
                    </label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      value={opts().username}
                      placeholder="octocat"
                      autocomplete="username"
                      spellcheck={false}
                      class={inputClass}
                    />
                  </div>

                  <div>
                    <label for="token" class={labelClass}>
                      Personal access token
                    </label>
                    <div class="relative">
                      <input
                        type={showToken() ? "text" : "password"}
                        id="token"
                        name="token"
                        value={opts().token}
                        placeholder="ghp_••••••••••••••••"
                        autocomplete="off"
                        spellcheck={false}
                        class={inputClass + " pr-18 font-mono"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken((visible) => !visible)}
                        class="absolute inset-y-1 right-1 rounded px-2.5 text-xs font-medium text-[#b1bac4] hover:bg-[#21262d] hover:text-[#f0f6fc] focus-visible:outline-2 focus-visible:outline-[#58a6ff]"
                        aria-pressed={showToken()}
                      >
                        {showToken() ? "Hide" : "Show"}
                      </button>
                    </div>
                    <p class="mt-1.5 mb-0 text-xs leading-5 text-[#8b949e]">
                      Use a classic token with the <code class="text-[#b1bac4]">repo</code> scope.
                    </p>
                  </div>

                  <details class="rounded-lg bg-[#161b22] px-4 py-3 text-sm text-[#b1bac4]">
                    <summary class="font-medium text-[#f0f6fc] outline-none focus-visible:rounded focus-visible:outline-2 focus-visible:outline-[#58a6ff]">
                      Create a personal access token
                    </summary>
                    <ol class="mt-3 mb-1 space-y-2 pl-5 text-xs leading-5 text-[#8b949e]">
                      <li>
                        Open{" "}
                        <a
                          href="https://github.com/settings/tokens"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-[#58a6ff] underline underline-offset-2 hover:text-[#79c0ff]"
                        >
                          GitHub token settings
                        </a>
                        .
                      </li>
                      <li>Generate a new classic token with a recognizable name.</li>
                      <li>Select the repo scope, generate it, then paste it above.</li>
                    </ol>
                  </details>
                </div>
              </section>

              <section class="overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117]">
                <header class="border-b border-[#30363d] px-5 py-4 sm:px-6">
                  <h2 class="m-0 text-base font-semibold text-[#f0f6fc]">Refresh behavior</h2>
                  <p class="mt-1 mb-0 text-xs leading-5 text-[#8b949e]">
                    Saved pull requests remain visible while a background refresh is running or
                    fails.
                  </p>
                </header>
                <div class="divide-y divide-[#21262d] px-5 sm:px-6">
                  <div class="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
                    <div>
                      <label for="interval" class={labelClass}>
                        Check interval
                      </label>
                      <p class="m-0 text-xs leading-5 text-[#8b949e]">
                        Between 5 and 60 minutes. You can always refresh manually.
                      </p>
                    </div>
                    <div class="relative">
                      <input
                        type="number"
                        id="interval"
                        min="5"
                        max="60"
                        name="checkInterval"
                        value={opts().checkInterval}
                        class={inputClass + " pr-14 tabular-nums"}
                      />
                      <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-[#8b949e]">
                        min
                      </span>
                    </div>
                  </div>

                  <label class="flex gap-3 py-5">
                    <input
                      type="checkbox"
                      name="hideInactivePRs"
                      checked={opts().hideInactivePRs}
                      class="mt-0.5 size-4 shrink-0 accent-[#1f6feb]"
                    />
                    <span>
                      <span class="block text-sm font-medium text-[#f0f6fc]">
                        Hide inactive pull requests
                      </span>
                      <span class="mt-1 block text-xs leading-5 text-[#8b949e]">
                        Remove pull requests with no activity for more than 30 days from the
                        tracker.
                      </span>
                    </span>
                  </label>
                </div>
              </section>

              <section class="overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117]">
                <div class="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
                  <div class="max-w-xl">
                    <div class="flex items-center gap-2">
                      <h2 class="m-0 text-base font-semibold text-[#f0f6fc]">New tab dashboard</h2>
                      <span class="rounded-full bg-[#193b24] px-2 py-0.5 text-[11px] font-semibold text-[#7ee787]">
                        Enabled
                      </span>
                    </div>
                    <p class="mt-1.5 mb-0 text-xs leading-5 text-[#8b949e]">
                      New tabs open an instant, full-width view of your saved pull requests and
                      refresh in the background.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      chrome.tabs.create({
                        url: chrome.runtime.getURL("dist/dashboard/dashboard.html"),
                      })
                    }
                    class="rounded-md border border-[#30363d] bg-[#21262d] px-3.5 py-2 text-sm font-medium text-[#f0f6fc] hover:bg-[#30363d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#58a6ff]"
                  >
                    Preview dashboard
                  </button>
                </div>
              </section>

              <Show when={status()}>
                {(current) => (
                  <div
                    role={current().type === "error" ? "alert" : "status"}
                    class={
                      "rounded-lg border px-4 py-3 text-sm " +
                      (current().type === "success"
                        ? "border-[#2f6f44] bg-[#14261b] text-[#7ee787]"
                        : "border-[#6e3a36] bg-[#2d1618] text-[#ffb4ad]")
                    }
                  >
                    {current().message}
                  </div>
                )}
              </Show>

              <div class="flex items-center justify-end pt-1">
                <button
                  type="submit"
                  class="rounded-md border border-[#2ea043] bg-[#238636] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2ea043] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#58a6ff] active:bg-[#1f7a30]"
                >
                  Save settings
                </button>
              </div>
            </form>
          </div>
        </main>
      )}
    </Show>
  )
}

export function Options() {
  return (
    <ErrorBoundary
      fallback={(error: Error) => (
        <main class="grid min-h-screen place-items-center bg-[#010409] px-6 text-sm text-[#ffb4ad]">
          {error.message}
        </main>
      )}
    >
      <Suspense
        fallback={
          <main class="grid min-h-screen place-items-center bg-[#010409] text-sm text-[#8b949e]">
            Loading settings…
          </main>
        }
      >
        <OptionsPage />
      </Suspense>
    </ErrorBoundary>
  )
}
