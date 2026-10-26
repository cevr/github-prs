import { Schema } from "effect"

/** A reviewer's standing verdict: their latest approval or change request, else a comment-only review. */
export const ReviewVerdict = Schema.Literals(["approved", "changes_requested", "commented"])
export type ReviewVerdict = typeof ReviewVerdict.Type

export const Person = Schema.Struct({ login: Schema.String, avatarUrl: Schema.String })
export type Person = typeof Person.Type

export const Review = Schema.Struct({
  reviewer: Person,
  verdict: ReviewVerdict,
  submittedAt: Schema.String,
})
export type Review = typeof Review.Type

/** Who last did something on a pull request, and when. */
export const Activity = Schema.Struct({ by: Schema.String, at: Schema.String })
export type Activity = typeof Activity.Type

export const PR = Schema.Struct({
  id: Schema.Number,
  number: Schema.Number,
  title: Schema.String,
  url: Schema.String,
  /** `owner/name` */
  repository: Schema.String,
  author: Person,
  updatedAt: Schema.String,
  draft: Schema.Boolean,
  /** GitHub's review decision under the base branch's rules; null when the branch requires no review. */
  decision: Schema.NullOr(Schema.Literals(["approved", "changes_requested", "review_required"])),
  conflicting: Schema.Boolean,
  /**
   * The branch the pull request merges into, and its own branch when that lives in the same
   * repository. A pull request whose base is another's head is stacked on it. Snapshots saved before
   * 1.3 lack both.
   */
  baseRef: Schema.optional(Schema.String),
  headRef: Schema.optional(Schema.String),
  /** One per human reviewer other than the author. */
  reviews: Schema.Array(Review),
  /** People asked to review who have not answered since they were asked. */
  requestedReviewers: Schema.Array(Person),
  /** The latest review, commit, push or comment by a person. */
  lastActivity: Schema.optional(Activity),
  /** The latest conversation comment by a person. */
  lastComment: Schema.optional(Activity),
})
export type PR = typeof PR.Type

export const PRData = Schema.Struct({
  /** Open pull requests the user opened. */
  authored: Schema.Array(PR),
  /** Open pull requests by others that ask for the user's review or are assigned to the user. */
  reviewing: Schema.Array(PR),
})
export type PRData = typeof PRData.Type

export const SeenPRs = Schema.Record(Schema.String, Schema.String)
export type SeenPRs = typeof SeenPRs.Type

export const SyncState = Schema.Struct({
  status: Schema.Literals(["idle", "syncing", "error"]),
  startedAt: Schema.optional(Schema.String),
  lastSyncedAt: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
})
export type SyncState = typeof SyncState.Type

export const sameLogin = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
