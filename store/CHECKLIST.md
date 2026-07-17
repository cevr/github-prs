# Chrome Web Store Upload Checklist

## Package

- [x] Manifest V3.
- [x] Manifest is at the root of the generated ZIP.
- [x] Version is a valid, uploadable Chrome version.
- [x] Description is accurate and under 132 characters.
- [x] Minimum Chrome version covers the Side Panel API.
- [x] Permissions are limited to storage, alarms, side panel, and api.github.com.
- [x] 16 px, 48 px, and padded 128 px PNG icons are packaged.
- [x] Production build, manifest targets, ZIP integrity, tests, types, lint, and formatting are validated locally.

## Store listing assets

- [x] Dashboard screenshot: **store/assets/dashboard-1280x800.png**.
- [x] Settings screenshot: **store/assets/settings-1280x800.png**.
- [x] Privacy-controls screenshot: **store/assets/privacy-controls-1280x800.png**.
- [x] Side-panel screenshot: **store/assets/sidepanel-640x400.png**.
- [x] Small promotional image: **store/assets/promo-440x280.png**.

## Developer Dashboard

- [x] Prepare the exact registration, listing, privacy, distribution, test, and reviewer handoff in **store/PUBLISHER_HANDOFF.md**.
- [ ] Register the publisher and complete the one-time developer registration payment.
- [ ] Enable two-step verification on the publishing Google Account.
- [ ] Upload **release/github-pr-tracker-1.0.1.zip**.
- [ ] Paste the copy and permission justifications from **store/LISTING.md**.
- [ ] Upload listing assets.
- [ ] Enter the public privacy policy URL from **store/LISTING.md** after the policy commit is pushed.
- [ ] Complete the Privacy practices declarations and Limited Use certification.
- [ ] Select Developer Tools, English, and the desired regions.
- [ ] Start with Private or Unlisted visibility for install testing, then switch to Public after review.

## Manual production test

- [x] Load the production build as an unpacked extension in Chrome and confirm it is enabled without extension errors.
- [x] Confirm installation visibly replaces the new-tab page with the PR dashboard and opens Settings from its setup state.
- [ ] Save a fine-grained, expiring token restricted to selected repositories with Pull requests read-only.
- [ ] Confirm the token exists only in local storage and the username/preferences appear in sync storage.
- [ ] Confirm both storage areas report **TRUSTED_CONTEXTS**.
- [ ] Confirm side panel, dashboard, background alarm, manual refresh, mark-seen, and options all work.
- [ ] Simulate an offline refresh and confirm the saved PR Snapshot stays visible.
- [ ] Disconnect and confirm token, username, cached pull requests, seen state, sync state, and badge are cleared.
