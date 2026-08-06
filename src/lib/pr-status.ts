import type { PR } from "@/types"

export interface PRStatusPresentation {
  label: string
  class: string
}

export function getPRStatus(pr: PR): PRStatusPresentation {
  let status = pr.reviewStatus
  if (!status && pr.isApproved) status = "approved"
  if (status === "approved") {
    return { label: "Approved", class: "text-[#3fb950]" }
  }
  if (status === "changes_requested") {
    return { label: "Needs changes", class: "text-[#f0883e]" }
  }
  if (status === "reviewed") {
    return { label: "Reviewed", class: "text-[#a371f7]" }
  }
  return { label: "Awaiting review", class: "text-[#8b949e]" }
}

export function getCommentActivityLabel(newComment: boolean): string {
  if (newComment) return "New comment"
  return "Last comment"
}
