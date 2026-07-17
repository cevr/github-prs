import { Context, Effect, Schema } from "effect"
import type { PRData, SeenPRs, SyncState } from "@/types"

export class PRSnapshotPublicationError extends Schema.TaggedErrorClass<PRSnapshotPublicationError>()(
  "PRSnapshotPublicationError",
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export type PRSnapshotChange =
  | {
      readonly kind: "sync-state"
      readonly sync: SyncState
    }
  | {
      readonly kind: "snapshot"
      readonly prs: PRData
      readonly seen: SeenPRs
      readonly sync: SyncState
      readonly attention: {
        readonly total: number
        readonly hasUnseen: boolean
      }
    }

export class PRSnapshotPublication extends Context.Service<
  PRSnapshotPublication,
  {
    readonly read: () => Effect.Effect<
      { readonly prs?: PRData; readonly seen: SeenPRs; readonly sync?: SyncState },
      PRSnapshotPublicationError
    >
    readonly recordSeen: (
      prId: number,
      seenAt: string,
    ) => Effect.Effect<void, PRSnapshotPublicationError>
    readonly publish: (change: PRSnapshotChange) => Effect.Effect<void, PRSnapshotPublicationError>
    readonly clear: () => Effect.Effect<void, PRSnapshotPublicationError>
  }
>()("@github-prs/PRSnapshotPublication") {}

export const readPRSnapshot = Effect.flatMap(PRSnapshotPublication, (publication) =>
  publication.read(),
)
