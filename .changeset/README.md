# Changesets

Changesets drive Chrome Web Store versions without publishing this private package to npm.

Add one for every user-facing change:

```bash
bun run changeset
```

Merging the generated `Version Packages` pull request synchronizes `package.json` and
`manifest.json`, then triggers the marketplace release workflow.
