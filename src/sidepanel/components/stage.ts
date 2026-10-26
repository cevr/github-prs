import type { Component } from "solid-js"
import type { Perspective, Stage } from "@/lib/pr-status"
import type { ReviewVerdict } from "@/types"
import {
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  CommentIcon,
  DraftIcon,
  EyeIcon,
  FileDiffIcon,
} from "./icons"
import type { IconProps } from "./icons"

export type Tone = "severe" | "success" | "done" | "accent" | "muted" | "subtle"

export const TONE_TEXT: Readonly<Record<Tone, string>> = {
  severe: "text-severe",
  success: "text-success",
  done: "text-done",
  accent: "text-accent",
  muted: "text-fg-muted",
  subtle: "text-fg-subtle",
}

export interface StagePresentation {
  readonly title: string
  readonly tone: Tone
  readonly Icon: Component<IconProps>
}

export const STAGE: Readonly<Record<Stage, StagePresentation>> = {
  "changes-requested": { title: "Changes requested", tone: "severe", Icon: FileDiffIcon },
  approved: { title: "Approved", tone: "success", Icon: CheckCircleIcon },
  reviewed: { title: "Reviewed", tone: "done", Icon: CommentIcon },
  "awaiting-review": { title: "Awaiting review", tone: "muted", Icon: ClockIcon },
  draft: { title: "Drafts", tone: "subtle", Icon: DraftIcon },
  "review-requested": { title: "Needs your review", tone: "accent", Icon: EyeIcon },
  "reviewed-by-you": { title: "Reviewed by you", tone: "muted", Icon: CheckIcon },
}

export const VERDICT: Readonly<
  Record<ReviewVerdict, { readonly label: string; readonly tone: Tone }>
> = {
  approved: { label: "approved", tone: "success" },
  changes_requested: { label: "requested changes", tone: "severe" },
  commented: { label: "commented", tone: "done" },
}

export const PERSPECTIVE: Readonly<
  Record<
    Perspective,
    { readonly tab: string; readonly empty: string; readonly link: string; readonly href: string }
  >
> = {
  authored: {
    tab: "Created",
    empty: "No open pull requests.",
    link: "Your pull requests on GitHub",
    href: "https://github.com/pulls",
  },
  reviewing: {
    tab: "Review requests",
    empty: "No reviews waiting on you.",
    link: "Review requests on GitHub",
    href: "https://github.com/pulls/review-requested",
  },
}
