import { createContext, Show, useContext } from "solid-js"
import type { Accessor, ParentProps } from "solid-js"
import { formatFullTime, getTimeAgo } from "@/lib/format"
import type { PRCollectionItem } from "@/lib/pr-collection"
import { viewerReview } from "@/lib/pr-status"
import { useTracker } from "../tracker"
import { Avatar, ReviewerStack } from "./avatar"
import { AlertIcon } from "./icons"
import { TONE_TEXT, VERDICT } from "./stage"

const RowContext = createContext<Accessor<PRCollectionItem>>()

/**
 * One pull request: a link to it on GitHub that marks it seen. The list it sits in owns its item. Its parts sit on a two-line grid, title
 * and time above, details and people below; the authored and reviewing rows compose them differently.
 */
function Root(props: ParentProps<{ readonly item: PRCollectionItem }>) {
  const { actions } = useTracker()
  const item = () => props.item

  return (
    <a
      href={item().pr.url}
      target="_blank"
      rel="noopener noreferrer"
      data-pr-row
      data-unseen={item().unseen}
      onClick={() => actions.markSeen(item().pr.id)}
      class="group/row grid grid-cols-[6px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 px-3 py-2 text-fg no-underline outline-none transition-[background-color] duration-100 ease-out hover:bg-surface focus-visible:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <span
        aria-hidden="true"
        class="col-start-1 row-start-1 size-1.5 rounded-full bg-accent opacity-0 scale-50 transition-[opacity,scale] duration-150 ease-out group-data-unseen/row:opacity-100 group-data-unseen/row:scale-100"
      />
      <Show when={item().unseen}>
        <span class="sr-only">Unseen activity. </span>
      </Show>
      <RowContext value={item}>{props.children}</RowContext>
    </a>
  )
}

function useRow() {
  return useContext(RowContext)
}

function Title() {
  const item = useRow()
  return (
    <span class="col-start-2 row-start-1 truncate text-[13px] leading-5 font-medium text-fg-strong group-data-unseen/row:font-semibold">
      {item().pr.title}
    </span>
  )
}

function Time() {
  const item = useRow()
  return (
    <time
      class="col-start-3 row-start-1 justify-self-end text-[11px] leading-5 text-fg-muted tabular-nums"
      datetime={item().pr.updatedAt}
      title={formatFullTime(item().pr.updatedAt)}
    >
      {getTimeAgo(item().pr.updatedAt)}
    </time>
  )
}

/** The second line: short facts separated by middots. */
function Details(props: ParentProps) {
  return (
    <span class="col-start-2 row-start-2 flex min-w-0 items-center text-[11px] leading-4 text-fg-muted [&>*]:shrink-0 [&>*:first-child]:shrink [&>*:first-child]:truncate [&>*+*]:before:mx-1 [&>*+*]:before:text-fg-subtle [&>*+*]:before:content-['·']">
      {props.children}
    </span>
  )
}

function People(props: ParentProps) {
  return <span class="col-start-3 row-start-2 justify-self-end">{props.children}</span>
}

function Reference() {
  const item = useRow()
  const name = () => item().pr.repository.split("/").at(-1) ?? item().pr.repository
  return (
    <span title={item().pr.repository}>
      {name()} <span class="tabular-nums">#{item().pr.number}</span>
    </span>
  )
}

function Conflicts() {
  const item = useRow()
  return (
    <Show when={item().pr.conflicting}>
      <span class="inline-flex items-center gap-1 text-danger">
        <AlertIcon class="size-3" />
        Conflicts
      </span>
    </Show>
  )
}

function NewComment() {
  const item = useRow()
  return (
    <Show when={item().newComment && item().pr.lastComment}>
      {(comment) => <span class="text-accent">New comment by {comment().by}</span>}
    </Show>
  )
}

export const PRRow = { Root, Title, Time, Details, People, Reference, Conflicts, NewComment }

/** A pull request the user opened: who reviewed it, how, and who still owes a review. */
export function AuthoredRow(props: { readonly item: PRCollectionItem }) {
  return (
    <PRRow.Root item={props.item}>
      <PRRow.Title />
      <PRRow.Time />
      <PRRow.Details>
        <PRRow.Reference />
        <PRRow.Conflicts />
        <PRRow.NewComment />
      </PRRow.Details>
      <PRRow.People>
        <ReviewerStack
          reviews={props.item.pr.reviews}
          requested={props.item.pr.requestedReviewers}
        />
      </PRRow.People>
    </PRRow.Root>
  )
}

/** A pull request waiting on the user's review: whose it is, and the user's own verdict once given. */
export function ReviewRow(props: { readonly item: PRCollectionItem; readonly viewer: string }) {
  const verdict = () => {
    const review = viewerReview(props.item.pr, props.viewer)
    return review && VERDICT[review.verdict]
  }
  // A review the user already gave that the author asks for again.
  const askedAgain = () => props.item.stage === "review-requested" && verdict() !== undefined
  return (
    <PRRow.Root item={props.item}>
      <PRRow.Title />
      <PRRow.Time />
      <PRRow.Details>
        <PRRow.Reference />
        <Show when={askedAgain()}>
          <span class="text-accent">Asked again</span>
        </Show>
        <Show when={props.item.stage === "reviewed-by-you" && verdict()}>
          {(own) => <span class={TONE_TEXT[own().tone]}>You {own().label}</span>}
        </Show>
        <PRRow.Conflicts />
        <PRRow.NewComment />
      </PRRow.Details>
      <PRRow.People>
        <span
          role="img"
          aria-label={`Opened by ${props.item.pr.author.login}`}
          title={`Opened by ${props.item.pr.author.login}`}
          class="inline-flex"
        >
          <Avatar person={props.item.pr.author} />
        </span>
      </PRRow.People>
    </PRRow.Root>
  )
}
