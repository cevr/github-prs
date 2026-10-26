const STEPS: Readonly<Record<string, number>> = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 }

/** j/k and the arrow keys move between the visible pull requests; Enter opens one. */
export function setupKeyboardNav() {
  const handler = (event: KeyboardEvent) => {
    const step = STEPS[event.key]
    if (step === undefined || event.metaKey || event.ctrlKey || event.altKey) return
    const rows = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[data-pr-row]")).filter(
      (row) => row.checkVisibility(),
    )
    if (rows.length === 0) return
    event.preventDefault()
    const current = rows.findIndex((row) => row === document.activeElement)
    let next = 0
    if (current !== -1) next = Math.max(0, Math.min(rows.length - 1, current + step))
    rows[next]?.focus()
    rows[next]?.scrollIntoView({ block: "nearest" })
  }

  document.addEventListener("keydown", handler)
  return () => document.removeEventListener("keydown", handler)
}
