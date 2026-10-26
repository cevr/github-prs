import { describe, expect, test } from "effect-bun-test"
import { person, pr, review } from "@/testing/pr-fixture"
import { createPRCollection } from "./pr-collection"

const T = "2026-07-16T10:00:00.000Z"

const stagesOf = (collection: ReturnType<typeof createPRCollection>) =>
  collection.sections.map((section) => [section.stage, section.items.map((item) => item.pr.id)])

describe("PR collection", () => {
  test("orders the user's pull requests by what waits on them, then by recent activity", () => {
    const input = [
      pr({ id: 1, updatedAt: "2026-07-16T09:00:00.000Z" }),
      pr({ id: 2, draft: true, decision: "approved" }),
      pr({ id: 3, decision: "approved" }),
      pr({ id: 4, reviews: [review("monalisa", "changes_requested", T)] }),
      pr({ id: 5, reviews: [review("hubot", "commented", T)] }),
      pr({ id: 6, updatedAt: "2026-07-16T11:00:00.000Z" }),
    ]

    const collection = createPRCollection(input, {}, { perspective: "authored", viewer: "cevr" })

    expect(stagesOf(collection)).toEqual([
      ["changes-requested", [4]],
      ["approved", [3]],
      ["reviewed", [5]],
      ["awaiting-review", [6, 1]],
      ["draft", [2]],
    ])
    expect(input.map((item) => item.id)).toEqual([1, 2, 3, 4, 5, 6])
  })

  test("follows GitHub's decision when the branch has review rules", () => {
    const approvedOnce = pr({
      id: 1,
      decision: "review_required",
      reviews: [review("monalisa", "approved", T)],
    })
    const outvoted = pr({
      id: 2,
      decision: "approved",
      reviews: [review("monalisa", "changes_requested", T)],
    })

    const collection = createPRCollection(
      [approvedOnce, outvoted],
      {},
      {
        perspective: "authored",
        viewer: "cevr",
      },
    )

    expect(stagesOf(collection)).toEqual([
      ["approved", [2]],
      ["reviewed", [1]],
    ])
  })

  test("puts reviews the user still owes first, including ones asked for again", () => {
    const input = [
      pr({ id: 1, author: person("octocat") }),
      pr({ id: 2, author: person("octocat"), reviews: [review("Cevr", "approved", T)] }),
      pr({
        id: 3,
        author: person("octocat"),
        reviews: [review("cevr", "changes_requested", T)],
        requestedReviewers: [person("cevr")],
      }),
      pr({ id: 4, author: person("octocat"), draft: true }),
    ]

    const collection = createPRCollection(input, {}, { perspective: "reviewing", viewer: "cevr" })

    expect(stagesOf(collection)).toEqual([
      ["review-requested", [1, 3]],
      ["reviewed-by-you", [2]],
      ["draft", [4]],
    ])
  })

  test("counts unseen pull requests and flags comments newer than the last visit", () => {
    const commented = pr({ id: 1, lastComment: { by: "octocat", at: "2026-07-16T11:00:00.000Z" } })
    const seenAfterComment = { "1": "2026-07-16T11:30:00.000Z" }
    const seenBeforeComment = { "1": "2026-07-16T10:30:00.000Z" }
    const lens = { perspective: "authored", viewer: "cevr" } as const

    const before = createPRCollection([commented], seenBeforeComment, lens)
    const after = createPRCollection([commented], seenAfterComment, lens)

    expect(before.unseenCount).toBe(1)
    expect(before.sections[0]?.items[0]?.newComment).toBe(true)
    expect(after.sections[0]?.items[0]?.newComment).toBe(false)
  })
})
