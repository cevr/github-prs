# GitHub PR Tracker — Chrome Extension (MV3)

Solid.js · TypeScript strict · Tailwind v4 · Vite 8 · Bun

## Commands

| Command             | What                                      |
| ------------------- | ----------------------------------------- |
| `bun run gate`      | typecheck + lint + fmt + build (parallel) |
| `bun run dev`       | Vite dev server                           |
| `bun run build`     | Production build → `dist/`                |
| `bun run typecheck` | `tsc --noEmit`                            |
| `bun run lint`      | oxlint                                    |
| `bun run fmt`       | oxfmt                                     |

## File Map

```
src/
├── types.ts            # Shared types: PR, PRData, SeenPRs, OptionsData
├── app.css             # Tailwind entry (@import "tailwindcss" + base body)
├── background.ts       # Service worker: alarm, GitHub API polling, badge, message handler
├── popup/
│   ├── popup.html      # Extension popup entry (body width: 350px)
│   ├── index.tsx       # Solid render mount
│   └── popup.tsx       # Popup UI: Header, PRList, PopupContent, state management
└── options/
    ├── options.html    # Options page entry (max-width: 600px)
    ├── index.tsx       # Solid render mount
    └── options.tsx     # Settings form: token, username, interval, hideInactive

manifest.json           # MV3 manifest, service_worker type:module
vite.config.ts          # 3 entries: popup html, options html, background ts
```

## Architecture

- **background.ts** — Runs as MV3 service worker. Polls GitHub search API on alarm interval. Fetches PR timelines for approval status + last updater. Deduplicates assigned/review-requested PRs via `dedupPRs()`. Manages badge count/color. Stores `previousPRs` and `seenPRs` in `chrome.storage.local`.
- **popup.tsx** — Reads cached PR data from storage. Listens for `prsUpdated`/`setupNeeded` messages. Optimistic mark-as-seen on hover/click.
- **options.tsx** — Form saves to `chrome.storage.sync`. Sends `updateSettings` to background to hot-swap alarm interval.
- **Message actions**: `checkNow`, `markPRViewed`, `updateSettings`, `prsUpdated`, `setupNeeded`

## Conventions

- Styles are Tailwind utility classes inline in TSX — no CSS files per component
- Types shared via `src/types.ts` — never duplicate PR/PRData/SeenPRs
- Solid.js (not React): `createResource`, `createSignal`, `Show`/`For`/`Switch`/`Match`
- camelCase vars/functions, PascalCase components
