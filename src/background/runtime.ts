import { Layer, ManagedRuntime } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { TrackerSettingsLive } from "@/settings/tracker-settings"
import { ChromePRSnapshotPublicationLive } from "@/snapshot/chrome-pr-snapshot-publication"
import { GitHubPRSourceLive } from "./github-pr-source"
import { PRSynchronizationLive } from "./pr-synchronization"

const GitHubLive = GitHubPRSourceLive.pipe(Layer.provide(FetchHttpClient.layer))

const SynchronizationLive = PRSynchronizationLive.pipe(
  Layer.provide([TrackerSettingsLive, GitHubLive, ChromePRSnapshotPublicationLive]),
)

export const backgroundRuntime = ManagedRuntime.make(
  Layer.merge(SynchronizationLive, TrackerSettingsLive),
)
