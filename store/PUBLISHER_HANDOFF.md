# Chrome Web Store Publisher Handoff

This is the operator runbook for publishing GitHub PR Tracker 1.0.0. Complete the sections in order. The checked-in listing copy and validated assets are the source of truth; do not rewrite claims in the Developer Dashboard.

## 1. Register and secure the publisher

1. Sign in to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Accept the developer agreement and pay Google's one-time registration fee.
3. Enable 2-Step Verification on the publishing Google Account before submission.
4. In **Account**, set:
   - **Publisher name:** `Cristian` or the established public publisher name.
   - **Contact email:** `seeve.c@gmail.com`, then complete email verification.
   - **Email notifications:** enable item-review and policy notifications.
5. Complete the required EU **Trader / Non-Trader** declaration. This is a legal status the account owner must determine; do not infer it from this repository.

Official references: [register an account](https://developer.chrome.com/docs/webstore/register), [set up the account](https://developer.chrome.com/docs/webstore/set-up-account/), and [2-Step Verification policy](https://developer.chrome.com/docs/webstore/program-policies/policies#2-step_verification).

## 2. Create the item and upload the package

1. Run the release contract from a clean checkout:

   ```bash
   bun install --frozen-lockfile
   bun run gate
   bun run package:extension
   bun run validate:marketplace
   ```

2. In the Developer Dashboard, choose **New item**.
3. Upload `release/github-pr-tracker-1.0.0.zip`.
4. Confirm the dashboard reads version `1.0.0` and Manifest V3.

Do not upload `dist/` directly and do not rebuild the ZIP manually. The checked-in packaging script includes only the manifest, production build, and referenced icons.

## 3. Store listing

Copy these exact values from [`LISTING.md`](./LISTING.md):

- **Product name:** `GitHub PR Tracker`
- **Summary:** use the **Summary** section verbatim.
- **Detailed description:** use the **Detailed description** section verbatim.
- **Category:** `Developer Tools`
- **Language:** `English`
- **Homepage URL:** `https://github.com/cevr/github-prs`
- **Support URL:** `https://github.com/cevr/github-prs/issues`

Upload the graphic assets in this order:

1. `assets/dashboard-1280x800.png`
2. `assets/sidepanel-640x400.png`
3. `assets/settings-1280x800.png`
4. `assets/privacy-controls-1280x800.png`
5. **Small promo tile:** `assets/promo-440x280.png`

The extension package supplies `icons/icon128.png` as the 128 px store icon. A promo video and 1400x560 marquee image are optional and intentionally omitted.

Official references: [listing fields and assets](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) and [image requirements](https://developer.chrome.com/docs/webstore/images).

## 4. Privacy practices

### Single purpose

Paste the **Single purpose** value from [`LISTING.md`](./LISTING.md):

> Show a developer's active authored and review-requested GitHub pull requests, review state, and unseen activity in Chrome's side panel and new-tab page.

### Permission justifications

Paste each matching justification from the **Permission justifications** section of [`LISTING.md`](./LISTING.md):

- `storage`
- `alarms`
- `sidePanel`
- Host access to `https://api.github.com/*`

There is no justification for tabs, browsing history, scripting, activeTab, cookies, or broad website access because the manifest does not request them.

### Data-use disclosures

Select **Yes** only for the data categories the extension handles:

- **Authentication information:** the user-provided GitHub personal access token.
- **Personally identifiable information:** the GitHub username and usernames in pull-request metadata.
- **Website content:** pull-request titles and metadata returned by GitHub's API.

Do not select browsing history, location, financial information, health information, personal communications, or user activity. The extension does not handle those categories.

Affirm every applicable data-use certification:

- Data is used only to provide the extension's disclosed single purpose.
- Data is not sold or transferred outside the permitted Limited Use cases.
- Data is not used or transferred for advertising, creditworthiness, lending, or unrelated purposes.
- Humans do not read user data.
- The extension complies with the Chrome Web Store User Data Policy, including Limited Use.

### Privacy policy

- **Privacy policy URL:** `https://github.com/cevr/github-prs/blob/main/PRIVACY.md`

Before submission, open that URL in a signed-out/private window and confirm it is publicly readable. Its claims must remain consistent with the dashboard selections.

Official references: [Privacy practices fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) and [User Data and Limited Use](https://developer.chrome.com/docs/webstore/user_data).

## 5. Distribution

Set:

- **Visibility:** `Public`
- **Regions:** `All regions`
- **In-app purchases:** `No`

On the final submission dialog, turn off immediate publication so the approved item is held for deliberate release. This avoids a second visibility-change submission while preventing an automatic public launch immediately after approval.

Official reference: [distribution and visibility](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution).

## 6. Test instructions and reviewer notes

Paste the following into **Test instructions**:

> GitHub PR Tracker is a client-only extension and requires a GitHub account plus a fine-grained personal access token to display repository data. No developer-operated account or backend is involved.
>
> 1. Install the extension and open its Settings page.
> 2. Enter the GitHub username being tested.
> 3. Create or use a fine-grained GitHub personal access token restricted to selected repositories, with an expiration date and Pull requests: Read-only permission.
> 4. Save Settings. Open a new tab to view the dashboard, or click the extension action to open the side panel.
> 5. Use Refresh to request current authored and review-requested pull requests. Hover or open a pull request to mark it seen.
> 6. Temporarily disable the network and refresh. The last locally saved snapshot remains visible while the failed refresh status is shown.
> 7. In Settings, choose Disconnect and clear account data to remove the token, username, cached pull requests, seen state, synchronization status, and badge.
>
> The token is stored only in chrome.storage.local. Username and non-secret preferences use chrome.storage.sync. Both storage areas are restricted to TRUSTED_CONTEXTS. Requests are sent only to https://api.github.com. The extension has no developer backend, analytics, advertising, or remote code.

Paste the following into **Reviewer notes** if the dashboard presents a separate field:

> The extension replaces the new-tab page as a disclosed part of its single purpose and also provides the same tracker in Chrome's side panel. The GitHub credential is supplied by the user and is never synchronized. The extension executes no remote code; all JavaScript ships in the reviewed package. Network requests go only to GitHub's API. The public privacy policy documents every stored field, network destination, retention rule, and deletion control.

Do not commit or place a reviewer token in listing copy. If review requires supplied credentials, create a temporary GitHub test account and a fine-grained, expiring, read-only token; enter it only in the dashboard's restricted Test instructions field and revoke it after review.

Official references: [publishing and Test instructions](https://developer.chrome.com/docs/webstore/publish/) and [review troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting/).

## 7. Submit and monitor

1. Recheck every tab for unsaved changes: **Package**, **Store listing**, **Privacy practices**, **Distribution**, and **Test instructions**.
2. Submit for review with deferred publishing selected.
3. Record the extension item ID and review submission date in the release notes or issue tracker.
4. Watch the verified publisher email and the item's **Status** tab.
5. After approval, install the held production item, repeat the manual checks in [`CHECKLIST.md`](./CHECKLIST.md), then publish it.
6. If rejected, preserve the exact policy finding, fix the smallest compliant release, increment the manifest/package version, rebuild, validate, and resubmit.

Google currently warns that review time can range from days to weeks. Follow up with Developer Support if a submission remains pending beyond the period in the current review guidance.

Official reference: [review status and lifecycle](https://developer.chrome.com/docs/webstore/check-review).
