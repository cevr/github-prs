import { describe, expect, test } from "bun:test"
import type { PR } from "@/types"
import { createPRCollection } from "./pr-collection"

function pr(id: number, repo: string, updatedAt: string): PR {
  return {
    id,
    number: id,
    title: "PR " + id,
    html_url: "https://github.com/" + repo + "/pull/" + id,
    repository_url: "https://api.github.com/repos/" + repo,
    updated_at: updatedAt,
    user: { login: "cevr" },
  }
}

describe("PR collection", () => {
  test("prepares repository groups, recency order, and unseen counts without mutating input", () => {
    const older = pr(1, "acme/console", "2026-07-15T10:00:00.000Z")
    const newest = pr(2, "acme/platform", "2026-07-16T12:00:00.000Z")
    const middle = pr(3, "acme/console", "2026-07-16T09:00:00.000Z")
    const input = [older, newest, middle]

    const collection = createPRCollection(input, {
      "1": "2026-07-15T10:00:00.000Z",
      "3": "2026-07-16T08:00:00.000Z",
    })

    expect(input).toEqual([older, newest, middle])
    expect(collection).toMatchObject({ totalCount: 3, unseenCount: 2 })
    expect(collection.groups.map((group) => group.repo)).toEqual(["acme/platform", "acme/console"])
    expect(collection.groups[1].items.map((item) => [item.pr.id, item.unseen])).toEqual([
      [3, true],
      [1, false],
    ])
  })
})
