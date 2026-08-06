import { Effect, Layer } from "effect"
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

function searchItem(id: number) {
  return {
    id,
    number: id,
    title: `Pull request ${id}`,
    html_url: `https://github.com/acme/tracker/pull/${id}`,
    repository_url: "https://api.github.com/repos/acme/tracker",
    updated_at: "2026-08-05T12:00:00.000Z",
    user: { login: "cevr" },
  }
}

describe("GitHub PR source", () => {
  it.effect("loads every pull request search page", () =>
    Effect.gen(function* () {
      const requestedSearchPages: number[] = []
      const client = HttpClient.make((request, url) => {
        if (url.pathname.endsWith("/timeline")) {
          return Effect.succeed(jsonResponse(request, []))
        }

        const query = url.searchParams.get("q") ?? ""
        const page = Number(url.searchParams.get("page"))
        expect(url.searchParams.get("per_page")).toBe("100")
        requestedSearchPages.push(page)

        if (!query.includes("author:cevr")) {
          return Effect.succeed(jsonResponse(request, { items: [] }))
        }
        if (page === 1) {
          return Effect.succeed(
            jsonResponse(request, {
              items: Array.from({ length: 100 }, (_, index) => searchItem(index + 1)),
            }),
          )
        }
        return Effect.succeed(jsonResponse(request, { items: [searchItem(101)] }))
      })
      const layer = GitHubPRSourceLive.pipe(
        Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
      )

      const result = yield* fetchGitHubPullRequests(settings).pipe(Effect.provide(layer))

      expect(result.created).toHaveLength(101)
      expect(result.created.at(-1)?.id).toBe(101)
      expect(requestedSearchPages).toEqual(expect.arrayContaining([1, 2]))
    }),
  )

  it.effect("summarizes review state and latest comment activity", () =>
    Effect.gen(function* () {
      const client = HttpClient.make((request, url) => {
        if (url.pathname.endsWith("/timeline")) {
          expect(url.searchParams.get("per_page")).toBe("100")
          return Effect.succeed(
            jsonResponse(request, [
              {
                event: "reviewed",
                state: "changes_requested",
                actor: { login: "reviewer" },
                submitted_at: "2026-08-05T10:00:00.000Z",
              },
              {
                event: "commented",
                actor: { login: "maintainer" },
                created_at: "2026-08-05T11:00:00.000Z",
              },
              {
                event: "reviewed",
                state: "approved",
                actor: { login: "reviewer" },
                submitted_at: "2026-08-05T12:00:00.000Z",
              },
            ]),
          )
        }

        const query = url.searchParams.get("q") ?? ""
        const items = []
        if (query.includes("author:cevr")) items.push(searchItem(1))
        return Effect.succeed(jsonResponse(request, { items }))
      })
      const layer = GitHubPRSourceLive.pipe(
        Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
      )

      const result = yield* fetchGitHubPullRequests(settings).pipe(Effect.provide(layer))

      expect(result.created[0]).toMatchObject({
        isApproved: true,
        reviewStatus: "approved",
        lastUpdatedBy: "reviewer",
        lastCommenter: "maintainer",
        lastCommentedAt: "2026-08-05T11:00:00.000Z",
      })
    }),
  )
})

function jsonResponse(request: HttpClientRequest.HttpClientRequest, body: unknown) {
  return HttpClientResponse.fromWeb(request, Response.json(body))
}
