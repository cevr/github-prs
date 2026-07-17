import { Layer, ManagedRuntime } from "effect"
import { TrackerSettingsLive } from "@/settings/tracker-settings"
import { ChromePRSnapshotPublicationLive } from "@/snapshot/chrome-pr-snapshot-publication"

export const applicationRuntime = ManagedRuntime.make(
  Layer.merge(TrackerSettingsLive, ChromePRSnapshotPublicationLive),
)
