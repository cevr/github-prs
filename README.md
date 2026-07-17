# GitHub PR Tracker

A client-only Chrome extension that keeps authored and review-requested GitHub pull requests easy to scan in the side panel and a new-tab dashboard.

## Privacy

The GitHub token stays in local Chrome storage and is sent only to **api.github.com**. The extension has no developer backend, analytics, advertising, or data sale. See the complete [privacy policy](./PRIVACY.md).

## Development

```bash
bun install
bun run dev
```

Run the full local gate:

```bash
bun run gate
```

Build the Chrome Web Store upload ZIP:

```bash
bun run package:extension
```

The validated upload appears in **release/github-pr-tracker-VERSION.zip**.
