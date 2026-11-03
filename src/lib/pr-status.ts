import { sameLogin } from "@/types"
import type { PR, Review } from "@/types"

export type Perspective = "authored" | "reviewing"

export const STAGES = {
  authored: ["changes-requested", "approved", "reviewed", "awaiting-review", "draft"],
  reviewing: ["review-requested", "reviewed-by-you", "draft"],
} as const satisfies Record<Perspective, readonly string[]>

export type AuthoredStage = (typeof STAGES.authored)[number]
export type ReviewingStage = (typeof STAGES.reviewing)[number]
export type Stage = AuthoredStage | ReviewingStage

const hasVerdict = (pr: PR, verdict: Review["verdict"]) =>
  pr.reviews.some((review) => review.verdict === verdict)

export function authoredStage(pr: PR): AuthoredStage {
  if (pr.draft) return "draft"
  const decision = pr.decision
  if (decision === "changes_requested") return "changes-requested"
  if (decision === "approved") return "approved"
  if (decision === null) {
    if (hasVerdict(pr, "changes_requested")) return "changes-requested"
    if (hasVerdict(pr, "approved")) return "approved"
  }
  if (pr.reviews.length > 0) return "reviewed"
  return "awaiting-review"
}

export function viewerReview(pr: PR, viewer: string): Review | undefined {
  return pr.reviews.find((review) => sameLogin(review.reviewer.login, viewer))
}

export function reviewingStage(pr: PR, viewer: string): ReviewingStage {
  if (pr.draft) return "draft"
  if (pr.requestedReviewers.some((person) => sameLogin(person.login, viewer))) {
    return "review-requested"
  }
  if (viewerReview(pr, viewer)) return "reviewed-by-you"
  return "review-requested"
}
