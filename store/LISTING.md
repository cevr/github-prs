# Chrome Web Store Listing

## Product name

GitHub PR Tracker

## Summary

Scan the GitHub pull requests you created or need to review from Chrome's side panel.

## Detailed description

GitHub PR Tracker gives developers one fast, client-only view of active pull requests.

- See open pull requests you authored.
- See assigned and review-requested pull requests.
- Order work by review status: changes requested and approved pull requests first, then the ones still in review, then drafts.
- Keep your own pull requests out of the review list, even when they are assigned to you.
- Surface unseen activity and new comments.
- Keep the last saved snapshot visible during background refreshes or network failures.

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
- **Host access to api.github.com** — Searches authorized repositories for pull requests and reads their reviews, review requests and latest comments through GitHub's GraphQL API. No other host is requested.

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
