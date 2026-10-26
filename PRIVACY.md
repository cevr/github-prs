# Privacy Policy for GitHub PR Tracker

Last updated: July 16, 2026

GitHub PR Tracker is a client-only Chrome extension. The developer does not operate a backend service for the extension and does not receive, collect, sell, or share your data.

## Data the extension handles

The extension handles the minimum data needed to show pull requests you created or need to review:

- Your GitHub username.
- A GitHub personal access token that you provide.
- Pull-request metadata returned by GitHub, including repository names, titles, authors, URLs, update times, review status, and timeline actors.
- Local interaction state, such as when a pull request was last seen.
- Preferences for refresh frequency and inactive pull requests.

The extension does not read browser history, page content, cookies, email, contacts, payment information, or unrelated GitHub data.

## Where data is stored

- The GitHub token is stored in **chrome.storage.local** on the current Chrome profile. It is never placed in Chrome Sync.
- Cached pull-request metadata, seen state, and synchronization status are stored in **chrome.storage.local**.
- The GitHub username, refresh interval, and inactive-item preference are stored in **chrome.storage.sync**. If Chrome Sync is enabled, Chrome may synchronize those preferences through the user's Google account.
- Both storage areas are restricted to trusted extension contexts with Chrome's **TRUSTED_CONTEXTS** access level.

Local extension data is removed when the extension is uninstalled. Chrome-synchronized preferences may remain associated with the user's Chrome profile according to Chrome Sync behavior.

## Network use

The extension sends the GitHub token in an authorization header and includes the GitHub username in search queries sent only to **https://api.github.com**. It uses those requests to search pull requests and read their reviews, review requests and latest comments through GitHub's GraphQL API.

The side panel shows the profile pictures of pull-request authors and reviewers. Chrome loads them from GitHub's avatar server (**avatars.githubusercontent.com**, reached through **github.com**) as ordinary images, without the token or any other extension data.

GitHub processes these requests under [GitHub's Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). The extension does not send data to the developer, analytics providers, advertisers, data brokers, or any other third party.

## Retention and deletion

Data remains in Chrome storage until it is replaced, the account is disconnected, Chrome clears extension data, or the extension is uninstalled.

The **Disconnect and clear account data** action in Settings deletes:

- The locally stored GitHub token.
- The synchronized GitHub username, including any legacy synchronized token.
- Cached pull-request metadata, seen state, and synchronization status.

The refresh interval and inactive-item preference remain as non-account preferences.

Deleting data from Chrome does not revoke the token at GitHub. Users should also delete or revoke a token in [GitHub's fine-grained token settings](https://github.com/settings/personal-access-tokens) when it is no longer needed.

## Permissions

- **storage**: stores the token, preferences, cached pull requests, seen state, and synchronization status.
- **alarms**: schedules background refreshes at the chosen interval.
- **sidePanel**: displays the pull-request tracker beside the current page.
- Access to **https://api.github.com/**: searches and reads the GitHub pull requests the user authorized.

The extension requests no broad website access.

## Limited Use

GitHub PR Tracker's use and transfer of user data complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Data is used only to provide and maintain the extension's single purpose: showing the user's active GitHub pull requests and their review state across extension surfaces.

## Security

Users should create a fine-grained personal access token with:

- An expiration date.
- Access limited to only the required repository owner and repositories.
- **Pull requests: Read-only** repository permission.

An organization may require approval before a fine-grained token can read its private repositories.

## Changes

If this policy changes, the updated policy and its date will be published here before materially different data handling is introduced.

## Contact

For privacy questions or deletion help, open an issue at [github.com/cevr/github-prs/issues](https://github.com/cevr/github-prs/issues) or contact Cristian at seeve.c@gmail.com.
