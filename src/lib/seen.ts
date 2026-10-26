import type { PR, SeenPRs } from "@/types"
import { parseEpochMillis } from "./time"

/** The pull request changed after the user last opened it, or the user never opened it. */
export function isUnseen(pr: PR, seen: Readonly<SeenPRs>): boolean {
  const seenAt = seen[pr.id.toString()]
  return !seenAt || parseEpochMillis(pr.updatedAt) > parseEpochMillis(seenAt)
}
