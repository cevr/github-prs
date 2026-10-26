import { Context, Effect, Layer, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import type { TrackerSettings } from "@/settings/tracker-settings"
import { PRData, sameLogin } from "@/types"
import type { Activity, Person, PR, Review, ReviewVerdict } from "@/types"

export class GitHubAuthenticationError extends Schema.TaggedErrorClass<GitHubAuthenticationError>()(
  "GitHubAuthenticationError",
  { message: Schema.String },
) {}

export class GitHubApiError extends Schema.TaggedErrorClass<GitHubApiError>()("GitHubApiError", {
  operation: Schema.String,
  message: Schema.String,
  status: Schema.optional(Schema.Number),
  cause: Schema.optional(Schema.Defect()),
}) {}

const GRAPHQL_URL = "https://api.github.com/graphql"
const SEARCH_PAGE_SIZE = 100

// One search returns every open pull request with what its review status needs, instead of a search
// followed by a timeline request per pull request. Nested lists keep their latest entries; the
// viewer's own verdict is read on its own, so it never depends on how many others reviewed.
const SEARCH_QUERY = `
query PullRequests($query: String!, $after: String, $viewer: String!) {
  search(query: $query, type: ISSUE, first: ${SEARCH_PAGE_SIZE}, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        fullDatabaseId number title url updatedAt isDraft reviewDecision mergeable
        author { __typename login avatarUrl(size: 48) }
        repository { nameWithOwner }
        latestOpinionatedReviews(first: 100) { nodes { ...Verdict } }
        latestReviews(first: 100) { nodes { ...Verdict } }
        viewerOpinion: reviews(last: 1, author: $viewer, states: [APPROVED, CHANGES_REQUESTED, DISMISSED]) {
          nodes { ...Verdict }
        }
        viewerComment: reviews(last: 1, author: $viewer, states: [COMMENTED]) { nodes { ...Verdict } }
        reviewRequests(first: 20) {
          nodes { requestedReviewer { __typename ... on User { login avatarUrl(size: 48) } } }
        }
        comments(last: 5) { nodes { author { __typename login } createdAt } }
        timelineItems(last: 5, itemTypes: [PULL_REQUEST_REVIEW, PULL_REQUEST_COMMIT, ISSUE_COMMENT, HEAD_REF_FORCE_PUSHED_EVENT]) {
          nodes {
            __typename
            ... on PullRequestReview { author { __typename login } submittedAt }
            ... on IssueComment { author { __typename login } createdAt }
            ... on PullRequestCommit { commit { committedDate author { user { login } } } }
            ... on HeadRefForcePushedEvent { actor { __typename login } createdAt }
          }
        }
      }
    }
  }
}
fragment Verdict on PullRequestReview { state submittedAt author { __typename login avatarUrl(size: 48) } }`

const Actor = Schema.NullOr(
  Schema.Struct({
    __typename: Schema.String,
    login: Schema.String,
    avatarUrl: Schema.optionalKey(Schema.String),
  }),
)
type Actor = typeof Actor.Type

/** A GraphQL connection: GitHub may null the list, or an entry the token cannot read. */
const connection = <S extends Schema.Top>(node: S) =>
  Schema.NullOr(Schema.Struct({ nodes: Schema.NullOr(Schema.Array(Schema.NullOr(node))) }))

function nodesOf<A>(list: { readonly nodes: ReadonlyArray<A | null> | null } | null): A[] {
  return (list?.nodes ?? []).filter((node): node is A => node !== null)
}

const ReviewNode = Schema.Struct({
  state: Schema.String,
  submittedAt: Schema.NullOr(Schema.String),
  author: Actor,
})

const TimelineNode = Schema.Struct({
  __typename: Schema.String,
  author: Schema.optionalKey(Actor),
  actor: Schema.optionalKey(Actor),
  submittedAt: Schema.optionalKey(Schema.NullOr(Schema.String)),
  createdAt: Schema.optionalKey(Schema.String),
  commit: Schema.optionalKey(
    Schema.Struct({
      committedDate: Schema.String,
      author: Schema.NullOr(
        Schema.Struct({ user: Schema.NullOr(Schema.Struct({ login: Schema.String })) }),
      ),
    }),
  ),
})

const PullRequestNode = Schema.Struct({
  // A 64-bit ID as a string; the older `databaseId` is deprecated because it can overflow to null.
  fullDatabaseId: Schema.NullOr(Schema.String),
  number: Schema.Number,
  title: Schema.String,
  url: Schema.String,
  updatedAt: Schema.String,
  isDraft: Schema.Boolean,
  reviewDecision: Schema.NullOr(
    Schema.Literals(["APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"]),
  ),
  mergeable: Schema.String,
  author: Actor,
  repository: Schema.Struct({ nameWithOwner: Schema.String }),
  latestOpinionatedReviews: connection(ReviewNode),
  latestReviews: connection(ReviewNode),
  viewerOpinion: connection(ReviewNode),
  viewerComment: connection(ReviewNode),
  reviewRequests: connection(
    Schema.Struct({
      requestedReviewer: Schema.NullOr(
        Schema.Struct({
          __typename: Schema.String,
          login: Schema.optionalKey(Schema.String),
          avatarUrl: Schema.optionalKey(Schema.String),
        }),
      ),
    }),
  ),
  comments: connection(Schema.Struct({ author: Actor, createdAt: Schema.String })),
  timelineItems: connection(TimelineNode),
})
type PullRequestNode = typeof PullRequestNode.Type

const SearchResponse = Schema.Struct({
  data: Schema.optionalKey(
    Schema.NullOr(
      Schema.Struct({
        search: Schema.Struct({
          pageInfo: Schema.Struct({
            hasNextPage: Schema.Boolean,
            endCursor: Schema.NullOr(Schema.String),
          }),
          nodes: Schema.Array(Schema.NullOr(PullRequestNode)),
        }),
      }),
    ),
  ),
  errors: Schema.optionalKey(Schema.Array(Schema.Struct({ message: Schema.String }))),
})

type SearchPage = NonNullable<(typeof SearchResponse.Type)["data"]>["search"]

const VERDICTS: Readonly<Record<string, ReviewVerdict>> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes_requested",
  COMMENTED: "commented",
}

const DECISIONS = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes_requested",
  REVIEW_REQUIRED: "review_required",
} as const

function decisionOf(node: PullRequestNode): PR["decision"] {
  if (node.reviewDecision === null) return null
  return DECISIONS[node.reviewDecision]
}

/** A person rather than an app: bots review, comment and push constantly and decide nothing. */
function person(actor: Actor | undefined): actor is NonNullable<Actor> {
  return actor !== null && actor !== undefined && actor.__typename !== "Bot"
}

function avatarOf(login: string, avatarUrl: string | undefined): string {
  return avatarUrl ?? `https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=48`
}

function reviewsOf(node: PullRequestNode, author: string, viewer: string): Review[] {
  const byReviewer = new Map<string, Review>()
  // A reviewer's latest review may be a comment after an approval; the approval still stands, so
  // opinionated reviews are read last and win. The viewer's own pair comes last: a dismissed
  // verdict no longer stands, and a comment-only review then counts.
  const viewerOpinion = nodesOf(node.viewerOpinion).filter((review) => review.state !== "DISMISSED")
  const others = [...nodesOf(node.latestReviews), ...nodesOf(node.latestOpinionatedReviews)].filter(
    (review) => !review.author || !sameLogin(review.author.login, viewer),
  )
  const reviews = [...others, ...nodesOf(node.viewerComment), ...viewerOpinion]
  for (const review of reviews) {
    const verdict = VERDICTS[review.state]
    if (!verdict || !review.submittedAt || !person(review.author)) continue
    // The author's replies to review threads are reviews too.
    if (sameLogin(review.author.login, author)) continue
    byReviewer.set(review.author.login.toLowerCase(), {
      reviewer: {
        login: review.author.login,
        avatarUrl: avatarOf(review.author.login, review.author.avatarUrl),
      },
      verdict,
      submittedAt: review.submittedAt,
    })
  }
  return Array.from(byReviewer.values()).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
}

function requestedReviewersOf(node: PullRequestNode): Person[] {
  const requested: Person[] = []
  for (const { requestedReviewer } of nodesOf(node.reviewRequests)) {
    if (requestedReviewer?.__typename !== "User" || !requestedReviewer.login) continue
    requested.push({
      login: requestedReviewer.login,
      avatarUrl: avatarOf(requestedReviewer.login, requestedReviewer.avatarUrl),
    })
  }
  return requested
}

function lastActivityOf(node: PullRequestNode): Activity | undefined {
  for (const item of nodesOf(node.timelineItems).reverse()) {
    if (item.commit) {
      const login = item.commit.author?.user?.login
      if (login) return { by: login, at: item.commit.committedDate }
      continue
    }
    const actor = item.author ?? item.actor
    const at = item.submittedAt ?? item.createdAt
    if (person(actor) && at) return { by: actor.login, at }
  }
  return undefined
}

function lastCommentOf(node: PullRequestNode): Activity | undefined {
  const comment = nodesOf(node.comments)
    .reverse()
    .find((entry) => person(entry.author))
  if (!comment?.author) return undefined
  return { by: comment.author.login, at: comment.createdAt }
}

function toPR(node: PullRequestNode, id: number, viewer: string): PR {
  const author = node.author?.login ?? "ghost"
  return {
    id,
    number: node.number,
    title: node.title,
    url: node.url,
    repository: node.repository.nameWithOwner,
    author: { login: author, avatarUrl: avatarOf(author, node.author?.avatarUrl) },
    updatedAt: node.updatedAt,
    draft: node.isDraft,
    decision: decisionOf(node),
    conflicting: node.mergeable === "CONFLICTING",
    reviews: reviewsOf(node, author, viewer),
    requestedReviewers: requestedReviewersOf(node),
    lastActivity: lastActivityOf(node),
    lastComment: lastCommentOf(node),
  }
}

function deduplicate(collections: readonly (readonly PR[])[]): readonly PR[] {
  const unique = new Map<number, PR>()
  for (const collection of collections) {
    for (const pr of collection) unique.set(pr.id, pr)
  }
  return Array.from(unique.values())
}

function requestError(operation: string, cause: unknown, status?: number) {
  return new GitHubApiError({
    operation,
    message: `GitHub could not ${operation}.`,
    status,
    cause,
  })
}

export class GitHubPRSource extends Context.Service<
  GitHubPRSource,
  {
    readonly fetch: (
      settings: TrackerSettings,
    ) => Effect.Effect<PRData, GitHubAuthenticationError | GitHubApiError>
  }
>()("@github-prs/GitHubPRSource") {}

export const GitHubPRSourceLive = Layer.effect(
  GitHubPRSource,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient

    const searchPage = Effect.fn("GitHubPRSource.searchPage")(function* (
      token: string,
      viewer: string,
      query: string,
      after: string | null,
    ) {
      const request = HttpClientRequest.post(GRAPHQL_URL).pipe(
        HttpClientRequest.setHeader("authorization", `Bearer ${token}`),
        HttpClientRequest.setHeader("accept", "application/vnd.github+json"),
        HttpClientRequest.bodyJsonUnsafe({
          query: SEARCH_QUERY,
          variables: { query, after, viewer },
        }),
      )
      const response = yield* client
        .execute(request)
        .pipe(Effect.mapError((cause) => requestError("search pull requests", cause)))
      if (response.status === 401) {
        return yield* new GitHubAuthenticationError({
          message: "GitHub rejected the saved account credentials.",
        })
      }
      if (response.status < 200 || response.status >= 300) {
        return yield* requestError("search pull requests", undefined, response.status)
      }
      const body = yield* HttpClientResponse.schemaBodyJson(SearchResponse)(response).pipe(
        Effect.mapError((cause) => requestError("decode pull request search results", cause)),
      )
      // A partial answer would publish as complete and drop pull requests with their seen state, so
      // any error fails the refresh and the saved snapshot stays.
      const message = body.errors?.map((error) => error.message).join(" ")
      if (!body.data || message) {
        return yield* new GitHubApiError({
          operation: "search pull requests",
          message: message ?? "GitHub returned no pull requests.",
        })
      }
      return body.data.search
    })

    const search = Effect.fn("GitHubPRSource.search")(function* (
      settings: TrackerSettings,
      query: string,
    ) {
      const prs: PR[] = []
      let after: string | null = null
      while (true) {
        const page: SearchPage = yield* searchPage(settings.token, settings.username, query, after)
        for (const node of page.nodes) {
          const id = Number(node?.fullDatabaseId ?? Number.NaN)
          if (!node || !Number.isSafeInteger(id) || id <= 0) {
            return yield* new GitHubApiError({
              operation: "search pull requests",
              message: "GitHub left a pull request out of the search. Try again.",
            })
          }
          prs.push(toPR(node, id, settings.username))
        }
        if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) return prs
        after = page.pageInfo.endCursor
      }
    })

    const fetch = Effect.fn("GitHubPRSource.fetch")(function* (settings: TrackerSettings) {
      const user = settings.username
      const open = "is:pr is:open"
      // A review list never holds the user's own pull requests, even ones assigned to the user.
      const [authored, requested, assigned] = yield* Effect.all(
        [
          search(settings, `${open} author:${user}`),
          search(settings, `${open} -author:${user} review-requested:${user}`),
          search(settings, `${open} -author:${user} assignee:${user}`),
        ],
        { concurrency: "unbounded" },
      )
      return PRData.make({ authored, reviewing: deduplicate([requested, assigned]) })
    })

    return GitHubPRSource.of({ fetch })
  }),
)

export const fetchGitHubPullRequests = (settings: TrackerSettings) =>
  Effect.flatMap(GitHubPRSource, (source) => source.fetch(settings))
