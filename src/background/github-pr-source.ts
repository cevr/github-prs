import { Context, Effect, Layer, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import type { TrackerSettings } from "@/settings/tracker-settings"
import { PRData } from "@/types"
import type { PR } from "@/types"

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

const TimelineEvent = Schema.Struct({
  event: Schema.String,
  state: Schema.optionalKey(Schema.String),
  actor: Schema.optionalKey(Schema.Struct({ login: Schema.String })),
})

const GitHubSearchItem = Schema.Struct({
  id: Schema.Number,
  number: Schema.Number,
  title: Schema.String,
  html_url: Schema.String,
  repository_url: Schema.String,
  updated_at: Schema.String,
  user: Schema.Struct({ login: Schema.String }),
})

const GitHubSearchResponse = Schema.Struct({ items: Schema.Array(GitHubSearchItem) })

const SEARCH_PAGE_SIZE = 100

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

function requestWithToken(token: string, url: string) {
  return HttpClientRequest.get(url).pipe(
    HttpClientRequest.setHeader("authorization", `Bearer ${token}`),
    HttpClientRequest.setHeader("accept", "application/vnd.github+json"),
    HttpClientRequest.setHeader("x-github-api-version", "2022-11-28"),
  )
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

    const execute = Effect.fn("GitHubPRSource.execute")(function* (
      token: string,
      operation: string,
      url: string,
    ) {
      const response = yield* client
        .execute(requestWithToken(token, url))
        .pipe(Effect.mapError((cause) => requestError(operation, cause)))
      if (response.status === 401) {
        return yield* new GitHubAuthenticationError({
          message: "GitHub rejected the saved account credentials.",
        })
      }
      if (response.status < 200 || response.status >= 300) {
        return yield* requestError(operation, undefined, response.status)
      }
      return response
    })

    const fetchTimeline = Effect.fn("GitHubPRSource.fetchTimeline")(function* (
      token: string,
      pr: PR,
    ) {
      const repository = pr.repository_url.replace("https://api.github.com/repos/", "")
      const timeline = yield* execute(
        token,
        "load a pull request timeline",
        `https://api.github.com/repos/${repository}/pulls/${pr.number}/timeline`,
      ).pipe(
        Effect.flatMap((response) =>
          HttpClientResponse.schemaBodyJson(Schema.Array(TimelineEvent))(response).pipe(
            Effect.mapError((cause) => requestError("decode a pull request timeline", cause)),
          ),
        ),
        Effect.catchTag("GitHubApiError", (error) =>
          Effect.logWarning(error.message).pipe(Effect.as([])),
        ),
      )
      let isApproved = false
      let lastUpdatedBy: string | undefined

      for (let index = timeline.length - 1; index >= 0; index--) {
        const event = timeline[index]
        if (!event) continue
        if (
          !lastUpdatedBy &&
          event.actor &&
          ["reviewed", "committed", "commented", "synchronized"].includes(event.event)
        ) {
          lastUpdatedBy = event.actor.login
        }
        if (event.event === "reviewed") {
          isApproved = event.state === "approved"
          break
        }
      }

      return { isApproved, lastUpdatedBy }
    })

    const search = Effect.fn("GitHubPRSource.search")(function* (
      token: string,
      query: string,
      includeApproval: boolean,
    ) {
      const items: Array<Schema.Schema.Type<typeof GitHubSearchItem>> = []
      let page = 1

      while (true) {
        const response = yield* execute(
          token,
          "search pull requests",
          `https://api.github.com/search/issues?q=${query}&per_page=${SEARCH_PAGE_SIZE}&page=${page}`,
        ).pipe(
          Effect.flatMap((httpResponse) =>
            HttpClientResponse.schemaBodyJson(GitHubSearchResponse)(httpResponse).pipe(
              Effect.mapError((cause) => requestError("decode pull request search results", cause)),
            ),
          ),
        )
        items.push(...response.items)
        if (response.items.length < SEARCH_PAGE_SIZE) break
        page++
      }

      return yield* Effect.forEach(
        items,
        (item) =>
          Effect.map(
            fetchTimeline(token, {
              id: item.id,
              number: item.number,
              title: item.title,
              html_url: item.html_url,
              repository_url: item.repository_url,
              updated_at: item.updated_at,
              user: { login: item.user.login },
            }),
            (timeline): PR => {
              let isApproved: boolean | undefined
              if (includeApproval) isApproved = timeline.isApproved
              return {
                id: item.id,
                number: item.number,
                title: item.title,
                html_url: item.html_url,
                repository_url: item.repository_url,
                updated_at: item.updated_at,
                user: { login: item.user.login },
                isApproved,
                lastUpdatedBy: timeline.lastUpdatedBy,
              }
            },
          ),
        { concurrency: "unbounded" },
      )
    })

    const fetch = Effect.fn("GitHubPRSource.fetch")(function* (settings: TrackerSettings) {
      const username = encodeURIComponent(settings.username)
      const [created, assigned, reviewRequested] = yield* Effect.all(
        [
          search(settings.token, `is:pr+author:${username}+is:open`, true),
          search(settings.token, `is:pr+is:open+assignee:${username}`, false),
          search(settings.token, `is:pr+is:open+review-requested:${username}`, false),
        ],
        { concurrency: "unbounded" },
      )
      return PRData.make({ created, assigned: deduplicate([assigned, reviewRequested]) })
    })

    return GitHubPRSource.of({ fetch })
  }),
)

export const fetchGitHubPullRequests = (settings: TrackerSettings) =>
  Effect.flatMap(GitHubPRSource, (source) => source.fetch(settings))
