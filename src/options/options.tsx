import { createResource, createSignal, ErrorBoundary, Suspense, Show } from "solid-js"
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

const inputClass = "w-full px-2.5 py-2 border border-[#e1e4e8] rounded-md text-sm box-border"

function OptionsPage() {
  const [options] = createResource(fetchOptions)
  const [status, setStatus] = createSignal<{
    message: string
    type: "success" | "error" | ""
    visible: boolean
  }>({ message: "", type: "", visible: false })

  const showStatus = (message: string, type: "success" | "error") => {
    setStatus({ message, type, visible: true })
  }

  const clearStatus = () => {
    setStatus({ message: "", type: "", visible: false })
  }

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault()
    clearStatus()

    const form = e.currentTarget as HTMLFormElement
    const formData = new FormData(form)

    const token = (formData.get("token") as string)?.trim()
    const username = (formData.get("username") as string)?.trim()
    const checkInterval = Math.min(60, Math.max(5, Number(formData.get("checkInterval")) || 15))
    const hideInactivePRs = formData.get("hideInactivePRs") === "on"

    if (!token) {
      showStatus("Please enter your GitHub Personal Access Token.", "error")
      return
    }
    if (!username) {
      showStatus("Please enter your GitHub username.", "error")
      return
    }

    chrome.storage.sync.set({ token, username, checkInterval, hideInactivePRs }, () => {
      showStatus("Settings saved successfully!", "success")
      chrome.runtime.sendMessage({
        action: "updateSettings",
        checkInterval,
      })
      chrome.runtime.sendMessage({ action: "checkNow" })
    })
  }

  return (
    <Show when={options()} fallback={<div>Loading...</div>}>
      {(opts) => (
        <form onSubmit={handleSubmit}>
          <h1 class="text-2xl mb-5">GitHub PR Tracker Settings</h1>

          <div class="bg-[#f6f8fa] p-[15px] rounded-md my-5">
            <h2 class="text-base mt-0">How to create a GitHub Personal Access Token:</h2>
            <ol class="pl-5">
              <li class="mb-2">
                Go to{" "}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub Personal Access Tokens
                </a>
              </li>
              <li class="mb-2">
                Click on "Generate new token" and select "Generate new token (classic)"
              </li>
              <li class="mb-2">
                Give your token a descriptive name (e.g., "PR Tracker Extension")
              </li>
              <li class="mb-2">
                Select the following scopes: <strong>repo</strong> (to access repositories)
              </li>
              <li class="mb-2">Click "Generate token" at the bottom of the page</li>
              <li class="mb-2">Copy the generated token and paste it below</li>
            </ol>
          </div>

          <div class="mb-5">
            <label for="token" class="block mb-[5px] font-medium">
              GitHub Personal Access Token:
            </label>
            <input
              type="password"
              id="token"
              placeholder="ghp_xxxxxxxxxxxxxxxx"
              name="token"
              value={opts().token}
              class={inputClass}
            />
            <div class="mt-[5px] text-xs text-[#586069]">
              Your token is stored locally and only used to access GitHub API.
            </div>
          </div>

          <div class="mb-5">
            <label for="username" class="block mb-[5px] font-medium">
              GitHub Username:
            </label>
            <input
              type="text"
              id="username"
              placeholder="yourusername"
              name="username"
              value={opts().username}
              class={inputClass}
            />
          </div>

          <div class="mb-5">
            <label for="interval" class="block mb-[5px] font-medium">
              Check Interval (minutes):
            </label>
            <input
              type="number"
              id="interval"
              min="5"
              max="60"
              placeholder="15"
              name="checkInterval"
              value={opts().checkInterval}
              class={inputClass}
            />
            <div class="mt-[5px] text-xs text-[#586069]">
              How often to check for PR updates (minimum 5 minutes).
            </div>
          </div>

          <div class="mb-5">
            <label class="block mb-[5px] font-medium">
              <input type="checkbox" name="hideInactivePRs" checked={opts().hideInactivePRs} /> Hide
              PRs with no activity for over a month
            </label>
            <div class="mt-[5px] text-xs text-[#586069]">
              PRs that haven't been updated in 30+ days will be hidden from the list.
            </div>
          </div>

          <Show when={status().visible}>
            <div
              class={`mt-5 p-2.5 rounded-md ${
                status().type === "success"
                  ? "bg-[#f0fff4] border border-[#2ea44f] text-[#2ea44f]"
                  : "bg-[#fff5f5] border border-[#e53e3e] text-[#e53e3e]"
              }`}
            >
              {status().message}
            </div>
          </Show>

          <div class="flex justify-end mt-[30px]">
            <button
              type="submit"
              class="bg-[#2ea44f] text-white border-none px-4 py-2 rounded-md font-medium cursor-pointer hover:bg-[#2c974b]"
            >
              Save Settings
            </button>
          </div>
        </form>
      )}
    </Show>
  )
}

export function Options() {
  return (
    <ErrorBoundary fallback={(err: Error) => <div>Error: {err.message}</div>}>
      <Suspense fallback={<div>Loading...</div>}>
        <OptionsPage />
      </Suspense>
    </ErrorBoundary>
  )
}
