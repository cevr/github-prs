import { Schema } from "effect"

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

export const Activity = Schema.Struct({ by: Schema.String, at: Schema.String })
export type Activity = typeof Activity.Type

export const PR = Schema.Struct({
  id: Schema.Number,
  number: Schema.Number,
  title: Schema.String,
  url: Schema.String,
  repository: Schema.String,
  author: Person,
  updatedAt: Schema.String,
  draft: Schema.Boolean,
  decision: Schema.NullOr(Schema.Literals(["approved", "changes_requested", "review_required"])),
  conflicting: Schema.Boolean,
  baseRef: Schema.optional(Schema.String),
  headRef: Schema.optional(Schema.String),
  reviews: Schema.Array(Review),
  requestedReviewers: Schema.Array(Person),
  lastActivity: Schema.optional(Activity),
  lastComment: Schema.optional(Activity),
})
export type PR = typeof PR.Type

export const PRData = Schema.Struct({
  authored: Schema.Array(PR),
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
