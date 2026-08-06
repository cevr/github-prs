import { Schema } from "effect"

export const PR = Schema.Struct({
  id: Schema.Number,
  number: Schema.Number,
  title: Schema.String,
  html_url: Schema.String,
  repository_url: Schema.String,
  updated_at: Schema.String,
  user: Schema.Struct({ login: Schema.String }),
  isApproved: Schema.optional(Schema.Boolean),
  reviewStatus: Schema.optional(Schema.Literals(["approved", "changes_requested", "reviewed"])),
  lastUpdatedBy: Schema.optional(Schema.String),
  lastCommenter: Schema.optional(Schema.String),
  lastCommentedAt: Schema.optional(Schema.String),
})
export type PR = typeof PR.Type

export const PRData = Schema.Struct({
  created: Schema.Array(PR),
  assigned: Schema.Array(PR),
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
