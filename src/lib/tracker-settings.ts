export interface TrackerSettings {
  token: string
  username: string
  checkInterval: number
  hideInactivePRs: boolean
}

export class InvalidTrackerSettingsError extends Error {
  constructor(
    public readonly field: "token" | "username",
    message: string,
  ) {
    super(message)
    this.name = "InvalidTrackerSettingsError"
  }
}

const DEFAULT_CHECK_INTERVAL = 15
const MIN_CHECK_INTERVAL = 5
const MAX_CHECK_INTERVAL = 60
const SETTING_KEYS = ["token", "username", "checkInterval", "hideInactivePRs"] as const

function normalizeInterval(value: unknown): number {
  const interval = Number(value)
  if (!Number.isFinite(interval)) return DEFAULT_CHECK_INTERVAL
  return Math.min(MAX_CHECK_INTERVAL, Math.max(MIN_CHECK_INTERVAL, Math.round(interval)))
}

export function normalizeTrackerSettings(
  stored: Partial<Record<(typeof SETTING_KEYS)[number], unknown>>,
): TrackerSettings {
  return {
    token: typeof stored.token === "string" ? stored.token.trim() : "",
    username: typeof stored.username === "string" ? stored.username.trim() : "",
    checkInterval: normalizeInterval(stored.checkInterval),
    hideInactivePRs: stored.hideInactivePRs !== false,
  }
}

export function isAccountConfigured(settings: TrackerSettings): boolean {
  return settings.token.length > 0 && settings.username.length > 0
}

export async function readTrackerSettings(): Promise<TrackerSettings> {
  const stored = await chrome.storage.sync.get([...SETTING_KEYS])
  return normalizeTrackerSettings(stored)
}

export async function initializeTrackerSettings(): Promise<TrackerSettings> {
  const stored = await chrome.storage.sync.get([...SETTING_KEYS])
  const settings = normalizeTrackerSettings(stored)
  if (stored.checkInterval == null) {
    await chrome.storage.sync.set({ checkInterval: settings.checkInterval })
  }
  return settings
}

export async function saveTrackerSettings(input: TrackerSettings): Promise<TrackerSettings> {
  const settings = normalizeTrackerSettings(input)
  if (!settings.token) {
    throw new InvalidTrackerSettingsError(
      "token",
      "Add a GitHub personal access token to continue.",
    )
  }
  if (!settings.username) {
    throw new InvalidTrackerSettingsError("username", "Add your GitHub username to continue.")
  }

  await chrome.storage.sync.set(settings)
  void chrome.runtime.sendMessage({ action: "updateSettings" })
  void chrome.runtime.sendMessage({ action: "checkNow" })
  return settings
}

export async function clearTrackerAccount(): Promise<void> {
  await Promise.all([
    chrome.storage.sync.remove(["token", "username"]),
    chrome.storage.local.remove(["previousPRs", "seenPRs"]),
  ])
  await chrome.runtime.sendMessage({ action: "setupNeeded" })
}
