import { Effect } from "effect"
import { describe, expect, it } from "effect-bun-test"
import { synchronizeManifestVersion } from "./sync-manifest-version"

describe("manifest version synchronization", () => {
  it.effect("copies the Changesets package version without changing manifest fields", () =>
    Effect.sync(() => {
      const synchronized = synchronizeManifestVersion(
        JSON.stringify({ name: "github-prs", version: "1.2.3" }),
        JSON.stringify({ manifest_version: 3, name: "GitHub PR Tracker", version: "1.2.2" }),
      )

      expect(JSON.parse(synchronized)).toEqual({
        manifest_version: 3,
        name: "GitHub PR Tracker",
        version: "1.2.3",
      })
      expect(synchronized.endsWith("\n")).toBe(true)
    }),
  )
})
