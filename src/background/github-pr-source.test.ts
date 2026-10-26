import { Effect, Layer, Schema } from "effect"
import { HttpClient, HttpClientResponse, type HttpClientRequest } from "effect/unstable/http"
import { describe, expect, it } from "effect-bun-test"
import type { TrackerSettings } from "@/settings/tracker-settings"
import { fetchGitHubPullRequests, GitHubPRSourceLive } from "./github-pr-source"

const settings: TrackerSettings = {
  token: "token",
  username: "cevr",
  checkInterval: 15,
  hideInactivePRs: false,
}

const decodeSearchRequest = Schema.decodeUnknownEffect(
  Schema.fromJsonString(
    Schema.Struct({
      variables: Schema.Struct({
        query: Schema.optionalKey(Schema.String),
        id: Schema.optionalKey(Schema.String),
        after: Schema.NullOr(Schema.String),
      }),
    }),
  ),
)

const user = (login: string) => ({ __typename: "User", login, avatarUrl: `https://a/${login}` })
const bot = (login: string) => ({ __typename: "Bot", login, avatarUrl: `https://a/${login}` })
const nodes = <A>(list: readonly A[]) => ({ nodes: list })
const verdicts = <A>(list: readonly A[], endCursor: string | null = null) => ({
  pageInfo: { hasNextPage: endCursor !== null, endCursor },
  nodes: list,
})

function pullRequest(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `PR_${id}`,
    fullDatabaseId: String(id),
    number: id,
    title: `Pull request ${id}`,
    url: `https://github.com/acme/tracker/pull/${id}`,
    updatedAt: "2026-08-05T12:00:00Z",
    isDraft: false,
    reviewDecision: null,
    mergeable: "MERGEABLE",
    baseRefName: "main",
    headRefName: `branch-${id}`,
    isCrossRepository: false,
    author: user("cevr"),
    repository: { nameWithOwner: "acme/tracker" },
    latestOpinionatedReviews: verdicts([]),
    latestReviews: nodes([]),
    viewerOpinion: nodes([]),
    viewerComment: nodes([]),
    reviewRequests: nodes([]),
    comments: nodes([]),
    timelineItems: nodes([]),
    ...overrides,
  }
}

function searchPage(list: readonly unknown[], endCursor: string | null = null) {
  return {
    data: { search: { pageInfo: { hasNextPage: endCursor !== null, endCursor }, nodes: list } },
  }
}

/**
 * A GraphQL endpoint that answers each search from `answer`, and each request for more of a pull
 * request's verdicts (named by its node `id`, with no search query) from `more`. It records what was
 * asked.
 */
function graphql(
  answer: (query: string, after: string | null) => unknown,
  more: (id: string, after: string | null) => unknown = () => ({ data: { node: null } }),
) {
  const asked: Array<{ query?: string; id?: string; after: string | null }> = []
  const client = HttpClient.make((request) =>
    Effect.gen(function* () {
      const body = request.body
      if (body._tag !== "Uint8Array") return yield* Effect.die("Expected a JSON body")
      const { variables } = yield* decodeSearchRequest(new TextDecoder().decode(body.body)).pipe(
        Effect.orDie,
      )
      asked.push(variables)
      if (variables.query === undefined) {
        return jsonResponse(request, more(variables.id ?? "", variables.after))
      }
      return jsonResponse(request, answer(variables.query, variables.after))
    }),
  )
  const layer = GitHubPRSourceLive.pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient, client)))
  return { asked, layer }
}

describe("GitHub PR source", () => {
  it.effect("follows the search cursor through every page", () =>
    Effect.gen(function* () {
      const { asked, layer } = graphql((query, after) => {
        if (!query.includes("author:cevr") || query.includes("-author")) return searchPage([])
        if (after === null) return searchPage([pullRequest(1)], "page-2")
        return searchPage([pullRequest(2)])
      })

      const result = yield* fetchGitHubPullRequests(settings).pipe(Effect.provide(layer))

      expect(result.authored.map((pr) => pr.id)).toEqual([1, 2])
      expect(asked.filter(({ after }) => after === "page-2")).toHaveLength(1)
    }),
  )

  it.effect("keeps the user's own pull requests out of the review list", () =>
    Effect.gen(function* () {
      const { asked, layer } = graphql((query) => {
        if (query.includes("review-requested:cevr")) {
          return searchPage([pullRequest(10, { author: user("octocat") })])
        }
        if (query.includes("assignee:cevr")) {
          return searchPage([
            pullRequest(10, { author: user("octocat") }),
            pullRequest(11, { author: user("hubot") }),
          ])
        }
        return searchPage([])
      })

      const result = yield* fetchGitHubPullRequests(settings).pipe(Effect.provide(layer))

      const reviewQueries = asked.filter(({ query }) => !query?.endsWith(" author:cevr"))
      expect(reviewQueries).toHaveLength(2)
      for (const { query } of reviewQueries) expect(query).toContain("-author:cevr")
      expect(result.reviewing.map((pr) => pr.id)).toEqual([10, 11])
    }),
  )

  it.effect("keeps each person's standing verdict and ignores bots and the author", () =>
    Effect.gen(function* () {
      const { layer } = graphql((query) => {
        if (query.includes("-author")) return searchPage([])
        return searchPage([
          pullRequest(1, {
            reviewDecision: "REVIEW_REQUIRED",
            mergeable: "CONFLICTING",
            latestReviews: nodes([
              { state: "COMMENTED", submittedAt: "2026-08-05T11:00:00Z", author: user("monalisa") },
              { state: "COMMENTED", submittedAt: "2026-08-05T10:30:00Z", author: user("cevr") },
              {
                state: "COMMENTED",
                submittedAt: "2026-08-05T10:20:00Z",
                author: bot("coderabbitai"),
              },
              { state: "COMMENTED", submittedAt: "2026-08-05T10:10:00Z", author: user("hubot") },
            ]),
            latestOpinionatedReviews: verdicts([
              { state: "APPROVED", submittedAt: "2026-08-05T10:00:00Z", author: user("monalisa") },
            ]),
            reviewRequests: nodes([
              { requestedReviewer: user("octocat") },
              { requestedReviewer: { __typename: "Team" } },
            ]),
            comments: nodes([
              { author: user("hubot"), createdAt: "2026-08-05T09:00:00Z" },
              { author: bot("github-actions"), createdAt: "2026-08-05T09:30:00Z" },
            ]),
            timelineItems: nodes([
              {
                __typename: "PullRequestReview",
                author: user("monalisa"),
                submittedAt: "2026-08-05T11:00:00Z",
              },
              {
                __typename: "IssueComment",
                author: bot("github-actions"),
                createdAt: "2026-08-05T11:30:00Z",
              },
            ]),
          }),
        ])
      })

      const [pr] = (yield* fetchGitHubPullRequests(settings).pipe(Effect.provide(layer))).authored

      expect(pr).toMatchObject({
        author: { login: "cevr" },
        decision: "review_required",
        conflicting: true,
        requestedReviewers: [{ login: "octocat" }],
        lastActivity: { by: "monalisa", at: "2026-08-05T11:00:00Z" },
        lastComment: { by: "hubot", at: "2026-08-05T09:00:00Z" },
      })
      expect(pr?.reviews.map((review) => [review.reviewer.login, review.verdict])).toEqual([
        ["monalisa", "approved"],
        ["hubot", "commented"],
      ])
    }),
  )

  it.effect("reads the user's own verdict from its own query, not the capped review lists", () =>
    Effect.gen(function* () {
      const { layer } = graphql((query) => {
        if (!query.includes("assignee:cevr")) return searchPage([])
        return searchPage([
          pullRequest(20, {
            author: user("octocat"),
            latestReviews: nodes([
              { state: "APPROVED", submittedAt: "2026-08-05T09:00:00Z", author: user("cevr") },
            ]),
            viewerOpinion: nodes([
              {
                state: "CHANGES_REQUESTED",
                submittedAt: "2026-08-05T10:00:00Z",
                author: user("cevr"),
              },
            ]),
          }),
          pullRequest(21, {
            author: user("octocat"),
            viewerOpinion: nodes([
              { state: "DISMISSED", submittedAt: "2026-08-05T10:00:00Z", author: user("cevr") },
            ]),
            viewerComment: nodes([
              { state: "COMMENTED", submittedAt: "2026-08-05T11:00:00Z", author: user("cevr") },
            ]),
          }),
        ])
      })

      const { reviewing } = yield* fetchGitHubPullRequests(settings).pipe(Effect.provide(layer))

      expect(reviewing.map((pr) => pr.reviews.map((review) => review.verdict))).toEqual([
        ["changes_requested"],
        ["commented"],
      ])
    }),
  )

  it.effect("reads every standing verdict of a pull request with more than one page of them", () =>
    Effect.gen(function* () {
      const { asked, layer } = graphql(
        (query) => {
          if (query.includes("-author")) return searchPage([])
          return searchPage([
            pullRequest(1, {
              latestOpinionatedReviews: verdicts(
                [
                  {
                    state: "APPROVED",
                    submittedAt: "2026-08-05T10:00:00Z",
                    author: user("octocat"),
                  },
                ],
                "verdicts-2",
              ),
            }),
          ])
        },
        (id, after) => {
          if (id !== "PR_1" || after !== "verdicts-2")
            return { errors: [{ message: "wrong page" }] }
          const changes = {
            state: "CHANGES_REQUESTED",
            submittedAt: "2026-08-05T11:00:00Z",
            author: user("monalisa"),
          }
          return { data: { node: { latestOpinionatedReviews: verdicts([changes]) } } }
        },
      )

      const [pr] = (yield* fetchGitHubPullRequests(settings).pipe(Effect.provide(layer))).authored

      expect(pr?.reviews.map((review) => [review.reviewer.login, review.verdict])).toEqual([
        ["octocat", "approved"],
        ["monalisa", "changes_requested"],
      ])
      expect(asked.filter(({ id }) => id === "PR_1")).toHaveLength(1)
    }),
  )

  it.effect("fails a refresh GitHub answered only in part, so the saved snapshot stays", () =>
    Effect.gen(function* () {
      const partial = graphql(() => ({
        ...searchPage([pullRequest(1), null]),
        errors: [{ message: "Something went wrong while executing your query." }],
      }))
      const unnamed = graphql(() => searchPage([pullRequest(1, { fullDatabaseId: null })]))

      const errors = yield* Effect.forEach([partial.layer, unnamed.layer], (layer) =>
        Effect.flip(fetchGitHubPullRequests(settings).pipe(Effect.provide(layer))),
      )

      expect(errors.map((error) => [error._tag, error.message])).toEqual([
        ["GitHubApiError", "Something went wrong while executing your query."],
        ["GitHubApiError", "GitHub left a pull request out of the search. Try again."],
      ])
    }),
  )

  it.effect("rejects saved credentials GitHub refuses", () =>
    Effect.gen(function* () {
      const client = HttpClient.make((request) =>
        Effect.succeed(HttpClientResponse.fromWeb(request, new Response(null, { status: 401 }))),
      )
      const layer = GitHubPRSourceLive.pipe(
        Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
      )

      const error = yield* Effect.flip(
        fetchGitHubPullRequests(settings).pipe(Effect.provide(layer)),
      )

      expect(error._tag).toBe("GitHubAuthenticationError")
    }),
  )
})

function jsonResponse(request: HttpClientRequest.HttpClientRequest, body: unknown) {
  return HttpClientResponse.fromWeb(request, Response.json(body))
}
