export function getRepoName(repositoryUrl: string): string {
  const parts = repositoryUrl.split("/")
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
  }
  return "unknown/repo"
}

export function getTimeAgo(date: Date): string {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

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
