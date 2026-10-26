import type { Person, PR, Review } from "@/types"

export function person(login: string): Person {
  return { login, avatarUrl: `https://avatars.githubusercontent.com/${login}?s=48` }
}

export function review(login: string, verdict: Review["verdict"], submittedAt: string): Review {
  return { reviewer: person(login), verdict, submittedAt }
}

/** An open, ready pull request by `cevr` that nobody has reviewed yet. */
export function pr(overrides: Partial<PR> = {}): PR {
  const id = overrides.id ?? 1
  return {
    id,
    number: id,
    title: `Pull request ${id}`,
    url: `https://github.com/acme/tracker/pull/${id}`,
    repository: "acme/tracker",
    author: person("cevr"),
    updatedAt: "2026-07-16T12:00:00.000Z",
    draft: false,
    decision: null,
    conflicting: false,
    reviews: [],
    requestedReviewers: [],
    ...overrides,
  }
}
