import { createContext, useContext } from "solid-js"
import type { Accessor, ParentProps } from "solid-js"
import type { PRSnapshotState } from "@/lib/use-pr-snapshot"

/**
 * What the side panel's parts read and do. Only the provider knows the state comes from the PR
 * Snapshot; parts read it here instead of taking it, and its actions, through props.
 */
export interface TrackerApi {
  readonly state: { readonly snapshot: Accessor<PRSnapshotState> }
  readonly actions: {
    readonly refresh: () => void
    readonly markSeen: (prId: number) => void
    readonly openSettings: () => void
  }
}

const TrackerContext = createContext<TrackerApi>()

export function TrackerProvider(props: ParentProps<{ readonly value: TrackerApi }>) {
  return <TrackerContext value={props.value}>{props.children}</TrackerContext>
}

export function useTracker(): TrackerApi {
  return useContext(TrackerContext)
}
