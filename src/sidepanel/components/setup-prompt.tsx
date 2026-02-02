import { GitPullRequestIcon } from "./icons"

export function SetupPrompt() {
  return (
    <div class="flex flex-col items-center justify-center py-12 px-6 text-[#8b949e]">
      <GitPullRequestIcon class="mb-4 opacity-40 w-8 h-8" />
      <p class="text-sm m-0 mb-2 text-[#e6edf3]">Set up your GitHub token</p>
      <p class="text-xs m-0 mb-4 text-center">
        Connect your account to start tracking pull requests.
      </p>
      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        class="bg-[#238636] text-white text-sm border-none px-4 py-1.5 rounded-md cursor-pointer hover:bg-[#2ea043] transition-colors"
      >
        Open Settings
      </button>
    </div>
  )
}
