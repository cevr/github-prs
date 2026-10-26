# Chrome Web Store Listing

## Product name

GitHub PR Tracker

## Summary

The store takes the summary from the `description` in `manifest.json`; the dashboard cannot edit it. Change it there, in a release:

Track your authored and review-requested GitHub pull requests, ordered by review status, in Chrome's side panel.

## Detailed description

GitHub PR Tracker gives developers one fast, client-only view of active pull requests in Chrome's side panel.

- See the open pull requests you authored, and the ones assigned to you or waiting on your review.
- Keep stacked pull requests together. Each stack gets its own section that shows its first pull request, the branch it merges into, and how many of its pull requests are approved, reviewed, or need changes.
- Order work by review status: changes requested and approved first, then reviewed, then awaiting review, then drafts.
- Fold any section or stack to one line. The panel remembers what you fold.
- Keep your own pull requests out of the review list, even when they are assigned to you.
- Surface unseen activity and new comments.
- Refresh each time the side panel opens and in the background, and keep the last saved list visible while a refresh runs or fails.

Your GitHub token stays in local Chrome storage and is sent only to GitHub's API. Pull-request data is cached locally for fast rendering. There is no developer server, analytics, advertising, tracking, or sale of data.

## Category

Developer Tools

## Language

English

## Single purpose

Show a developer's active authored and review-requested GitHub pull requests, review state, and unseen activity in Chrome's side panel.

## Permission justifications

- **storage** — Stores the local GitHub token, cached pull-request snapshot, seen timestamps, sync status, username, and refresh preferences.
- **alarms** — Refreshes pull-request data in the background at the interval selected by the user.
- **sidePanel** — Shows the tracker beside the current tab.
- **Host access to api.github.com** — Searches authorized repositories for pull requests and reads their reviews, review requests, branch names and latest comments through GitHub's GraphQL API. No other host is requested.

## Privacy practices answers

- Handles authentication information: **Yes** — a user-provided GitHub personal access token.
- Handles personally identifiable information: **Yes** — GitHub username and usernames present in pull-request metadata.
- Handles website content: **Yes** — pull-request titles and metadata returned by GitHub's API.
- Handles browsing history/activity: **No**.
- Uses data only for the single purpose: **Yes**.
- Sells or transfers data: **No**.
- Uses data for advertising, creditworthiness, or unrelated purposes: **No**.
- Human access to user data: **No**.
- Privacy policy URL: **https://github.com/cevr/github-prs/blob/main/PRIVACY.md**

## Support

- Homepage: **https://github.com/cevr/github-prs**
- Support URL: **https://github.com/cevr/github-prs/issues**
