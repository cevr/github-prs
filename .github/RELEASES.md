# Automated releases

The release workflow follows the same Changesets version-PR model as the other personal repos,
then uses the Chrome Web Store API instead of npm publishing.

## One-time configuration

1. In Google Cloud, enable the **Chrome Web Store API** and create a service account plus a JSON
   key.
2. In the Chrome Web Store Developer Dashboard, open **Account** and add that service account's
   email to the publisher.
3. In this GitHub repository, create an environment named **marketplace**.
4. Add these environment secrets:
   - `CWS_PUBLISHER_ID`: the publisher ID shown under Developer Dashboard > Publisher > Settings.
   - `CWS_SERVICE_ACCOUNT_JSON`: the complete JSON service-account key.
5. If the listing visibility was changed manually, publish that visibility once from the
   Developer Dashboard before relying on the API.

The extension ID is public and fixed in the workflow as `jgkofdbcjfhghgbpanbdlpikdhenfdgi`.
When either secret is absent, versioning still succeeds and the marketplace job reports a clean
skip instead of failing.

## Release flow

1. Add a changeset with `bun run changeset` for each user-facing change.
2. Push to `main`; the Release workflow creates or updates **Version Packages**.
3. Merge **Version Packages** after CI passes.
4. The merge synchronizes the package and extension manifest versions, runs the full gate, builds
   and validates the ZIP, stores it as a workflow artifact, uploads it, and submits it for review.

The Developer Dashboard's existing visibility settings control distribution. Submissions use
`DEFAULT_PUBLISH`, so an approved release is published automatically. Validation warnings block
submission and remain visible in the failed workflow rather than being silently ignored.
