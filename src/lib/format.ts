import { nowEpochMillis, parseEpochMillis } from "./time"

export function getTimeAgo(isoDate: string): string {
  const seconds = Math.floor((nowEpochMillis() - parseEpochMillis(isoDate)) / 1000)

  let interval = Math.floor(seconds / 31536000)
  if (interval > 1) return `${interval}y ago`
  if (interval === 1) return `1y ago`

  interval = Math.floor(seconds / 2592000)
  if (interval > 1) return `${interval}mo ago`
  if (interval === 1) return `1mo ago`

  interval = Math.floor(seconds / 86400)
  if (interval > 1) return `${interval}d ago`
  if (interval === 1) return `1d ago`

  interval = Math.floor(seconds / 3600)
  if (interval > 1) return `${interval}h ago`
  if (interval === 1) return `1h ago`

  interval = Math.floor(seconds / 60)
  if (interval > 1) return `${interval}m ago`
  if (interval === 1) return `1m ago`

  return "just now"
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  return fallback
}

const FULL_TIME = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })

/** The exact local date and time, for a tooltip beside a relative time. */
export function formatFullTime(isoDate: string): string {
  const millis = parseEpochMillis(isoDate)
  if (Number.isNaN(millis)) return isoDate
  return FULL_TIME.format(millis)
}
