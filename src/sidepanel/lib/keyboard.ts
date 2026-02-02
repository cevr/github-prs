export function setupKeyboardNav(containerSelector: string) {
  const getFocusableRows = (): HTMLAnchorElement[] =>
    Array.from(document.querySelectorAll(`${containerSelector} a[data-pr-row]`))

  const focusRow = (rows: HTMLAnchorElement[], index: number) => {
    const clamped = Math.max(0, Math.min(rows.length - 1, index))
    rows[clamped]?.focus()
  }

  const getCurrentIndex = (rows: HTMLAnchorElement[]): number => {
    const active = document.activeElement
    return rows.indexOf(active as HTMLAnchorElement)
  }

  const handler = (e: KeyboardEvent) => {
    const rows = getFocusableRows()
    if (rows.length === 0) return

    const current = getCurrentIndex(rows)

    switch (e.key) {
      case "ArrowDown":
      case "j": {
        e.preventDefault()
        focusRow(rows, current === -1 ? 0 : current + 1)
        break
      }
      case "ArrowUp":
      case "k": {
        e.preventDefault()
        focusRow(rows, current === -1 ? 0 : current - 1)
        break
      }
      case "Enter": {
        if (current >= 0) {
          // Let the <a> handle it naturally
        }
        break
      }
    }
  }

  document.addEventListener("keydown", handler)
  return () => document.removeEventListener("keydown", handler)
}
