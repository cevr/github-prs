import type { PR, SeenPRs } from "@/types"
import { parseEpochMillis } from "./time"

export function isUnseen(pr: PR, seen: Readonly<SeenPRs>): boolean {
  const seenAt = seen[pr.id.toString()]
  return !seenAt || parseEpochMillis(pr.updatedAt) > parseEpochMillis(seenAt)
}
