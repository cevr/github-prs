import { sameLogin } from "@/types"
import type { PR, Review } from "@/types"

/** Which side of a pull request the user is on: its author, or a reviewer. */
export type Perspective = "authored" | "reviewing"

/**
 * Where a pull request stands, seen from the user's side of it. Each perspective lists its stages in
 * the order they are shown: the ones that wait on the user come first.
 */
export const STAGES = {
  authored: ["changes-requested", "approved", "reviewed", "awaiting-review", "draft"],
  reviewing: ["review-requested", "reviewed-by-you", "draft"],
} as const satisfies Record<Perspective, readonly string[]>

export type AuthoredStage = (typeof STAGES.authored)[number]
export type ReviewingStage = (typeof STAGES.reviewing)[number]
export type Stage = AuthoredStage | ReviewingStage

const hasVerdict = (pr: PR, verdict: Review["verdict"]) =>
  pr.reviews.some((review) => review.verdict === verdict)

/**
 * GitHub's own decision wins when the base branch has review rules. Without rules, any change
 * request outweighs approvals, as on GitHub's pull request page.
 */
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

/** A review the author asks for again puts the user back in the requested list. */
export function reviewingStage(pr: PR, viewer: string): ReviewingStage {
  if (pr.draft) return "draft"
  if (pr.requestedReviewers.some((person) => sameLogin(person.login, viewer))) {
    return "review-requested"
  }
  if (viewerReview(pr, viewer)) return "reviewed-by-you"
  return "review-requested"
}
