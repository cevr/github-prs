import { describe, expect, test } from "effect-bun-test"
import { person, pr, review } from "@/testing/pr-fixture"
import { createPRCollection } from "./pr-collection"

const T = "2026-07-16T10:00:00.000Z"

type Collection = ReturnType<typeof createPRCollection>

/** Each section's stage and the ids of its pull requests. */
const stagesOf = (collection: Collection) =>
  collection.sections.map((section) => [section.stage, section.items.map((item) => item.pr.id)])

/** Each stack's ids, top first. */
const stackIds = (collection: Collection) =>
  collection.stacks.map((stack) => stack.items.map((item) => item.pr.id))

const firstItem = (collection: Collection) => collection.sections[0]?.items[0]

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
    expect(firstItem(before)?.newComment).toBe(true)
    expect(firstItem(after)?.newComment).toBe(false)
  })

  test("never flags the user's own comment as new", () => {
    const own = pr({ id: 1, lastComment: { by: "Cevr", at: "2026-07-16T11:00:00.000Z" } })

    const collection = createPRCollection([own], {}, { perspective: "authored", viewer: "cevr" })

    expect(firstItem(collection)?.newComment).toBe(false)
  })

  test("sets stacks apart from the stages, top first, each led by its first pull request", () => {
    const branch = (id: number, base: string, overrides: Parameters<typeof pr>[0] = {}) =>
      pr({ id, baseRef: base, headRef: `stack-${id}`, ...overrides })
    const input = [
      branch(1, "main", { decision: "approved", updatedAt: "2026-07-16T08:00:00.000Z" }),
      branch(2, "stack-1", { reviews: [review("monalisa", "changes_requested", T)] }),
      branch(3, "stack-2", { draft: true }),
      pr({ id: 4, decision: "approved", updatedAt: "2026-07-16T09:00:00.000Z" }),
    ]

    const collection = createPRCollection(input, {}, { perspective: "authored", viewer: "cevr" })

    expect(stackIds(collection)).toEqual([[3, 2, 1]])
    expect(stagesOf(collection)).toEqual([["approved", [4]]])
    const [stack] = collection.stacks
    expect(stack?.first.pr.id).toBe(1)
    expect(stack?.base).toBe("main")
    expect(stack?.items.map((item) => item.stage)).toEqual([
      "draft",
      "changes-requested",
      "approved",
    ])
    expect(stack?.tally).toEqual([
      { stage: "changes-requested", count: 1 },
      { stage: "approved", count: 1 },
      { stage: "draft", count: 1 },
    ])
  })

  test("puts the stack with the most urgent member first, then the most recent", () => {
    const input = [
      pr({ id: 1, baseRef: "main", headRef: "a", decision: "approved" }),
      pr({ id: 2, baseRef: "a", headRef: "a-2", updatedAt: "2026-07-16T12:00:00.000Z" }),
      pr({ id: 3, baseRef: "main", headRef: "b", updatedAt: "2026-07-16T08:00:00.000Z" }),
      pr({
        id: 4,
        baseRef: "b",
        headRef: "b-2",
        reviews: [review("hubot", "changes_requested", T)],
      }),
      pr({ id: 5, baseRef: "main", headRef: "c", updatedAt: "2026-07-16T09:00:00.000Z" }),
      pr({
        id: 6,
        baseRef: "c",
        headRef: "c-2",
        decision: "approved",
        updatedAt: "2026-07-16T07:00:00.000Z",
      }),
    ]

    const collection = createPRCollection(input, {}, { perspective: "authored", viewer: "cevr" })

    expect(stackIds(collection)).toEqual([
      [4, 3],
      [2, 1],
      [6, 5],
    ])
    expect(collection.sections).toEqual([])
  })

  test("stacks only within one repository", () => {
    const input = [
      pr({ id: 1, repository: "cevr/okra", baseRef: "main", headRef: "feature" }),
      pr({ id: 2, repository: "cevr/rift", baseRef: "feature", headRef: "feature-2" }),
      pr({ id: 3, repository: "cevr/rift", baseRef: "main" }),
    ]

    const collection = createPRCollection(input, {}, { perspective: "authored", viewer: "cevr" })

    expect(stagesOf(collection)).toEqual([["awaiting-review", [1, 2, 3]]])
  })

  test("keeps branches off one base together, deepest first", () => {
    const input = [
      pr({ id: 1, baseRef: "main", headRef: "base" }),
      pr({ id: 2, baseRef: "base", headRef: "left", updatedAt: "2026-07-16T10:00:00.000Z" }),
      pr({ id: 3, baseRef: "base", headRef: "right", updatedAt: "2026-07-16T11:00:00.000Z" }),
      pr({ id: 4, baseRef: "left", headRef: "left-top" }),
    ]

    const collection = createPRCollection(input, {}, { perspective: "authored", viewer: "cevr" })

    expect(stackIds(collection)).toEqual([[4, 3, 2, 1]])
    expect(collection.sections).toEqual([])
  })
})
