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
├── types.ts                 # Schemas: PR, PRData (authored, reviewing), SeenPRs, SyncState
├── app.css                  # Tailwind entry + theme tokens (Primer light/dark), base styles
├── background.ts            # Service worker: alarm, runtime commands
├── background/
│   ├── github-pr-source.ts  # One GraphQL search per list → PRData
│   └── pr-synchronization.ts# Serialized refresh, seen reconciliation, inactive filter
├── snapshot/                # PR Snapshot storage (chrome.storage.local `pullRequests`) and badge
├── settings/                # Tracker Settings storage and validation
├── lib/
│   ├── pr-status.ts         # Stages per perspective and their order
│   ├── pr-collection.ts     # PRs → sections by stage, newest first; stacks kept together
│   ├── pr-stacks.ts         # Stacks: base branch = another's head branch, same repository
│   ├── seen.ts              # The unseen rule shared by UI, badge and sync
│   └── use-pr-snapshot.ts   # Solid model of the PR Snapshot for the side panel
├── sidepanel/
│   ├── sidepanel.tsx        # Composition: TrackerProvider → Header, Tabs, PRList
│   ├── tracker.tsx          # Context: state (snapshot) + actions (refresh, markSeen, openSettings)
│   ├── lib/folds.ts         # Folded sections and stacks, kept in the panel's localStorage
│   └── components/          # Tabs.*, PRRow.* (AuthoredRow, ReviewRow), PRSection, PRStack, Avatar, icons
├── options/                 # Settings page
└── testing/pr-fixture.ts    # PR builders for tests
store/fixtures/chrome-mock.js  # Chrome stand-in for rendering pages outside Chrome
```

## Architecture

- **Background** polls on an alarm and on demand. `GitHubPRSource` runs three searches: authored, review-requested and assigned, both review searches excluding the user's own pull requests.
- **PR Collection** sorts one perspective into stages (`lib/pr-status.ts`); the side panel renders a section per stage. A stack renders as a foldable header (base branch, member count, count per stage) over its indented members.
- **Side panel** refreshes once each time it opens (`use-pr-snapshot.ts`), showing the saved snapshot meanwhile.
- **Side panel** parts read state and actions from `TrackerContext`; compound parts (`Tabs.*`, `PRRow.*`) compose the two row variants instead of boolean props.
- **Message actions**: `checkNow`, `markPRViewed`, `updateSettings`, `prSnapshotChanged`, `setupNeeded`

## Conventions

- Styles are Tailwind utility classes inline in TSX using the theme tokens in `app.css` (`bg-canvas`, `text-fg-muted`); never a literal color
- Types shared via `src/types.ts` — never duplicate PR/PRData/SeenPRs
- Lint forbids ternaries: use a small function with `if`, `Show`, or a lookup table
- Solid.js (not React): `createResource`, `createSignal`, `Show`/`For`/`Switch`/`Match`
- camelCase vars/functions, PascalCase components
