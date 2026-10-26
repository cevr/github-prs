import { For, Show } from "solid-js"
import type { Person, Review } from "@/types"
import { VERDICT } from "./stage"
import type { Tone } from "./stage"

const OUTLINE: Readonly<Record<Tone | "requested", string>> = {
  severe: "outline-severe",
  success: "outline-success",
  done: "outline-done",
  accent: "outline-accent",
  muted: "outline-fg-muted",
  subtle: "outline-fg-subtle",
  requested: "outline-dashed outline-fg-subtle",
}

/**
 * A GitHub profile picture. Its outline carries the person's part in the pull request: a verdict's
 * tone, dashed while a review is still owed, none for the author. The initial shows until the picture
 * loads, and stays if it never does.
 */
export function Avatar(props: { readonly person: Person; readonly mark?: Tone | "requested" }) {
  return (
    <span
      class={[
        "relative inline-grid size-5 shrink-0 place-items-center overflow-hidden rounded-full bg-raised text-[10px] leading-none font-semibold text-fg-muted uppercase",
        props.mark && ["outline-[1.5px] outline-offset-1", OUTLINE[props.mark]],
      ]}
    >
      {props.person.login.slice(0, 1)}
      <img
        src={props.person.avatarUrl}
        alt=""
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        class={[
          "absolute inset-0 size-full",
          { "opacity-60 grayscale": props.mark === "requested" },
        ]}
        onError={(event) => event.currentTarget.remove()}
      />
    </span>
  )
}

const MAX_SHOWN = 3

/** Who has reviewed and who still owes a review, as GitHub's reviewer list shows them. */
export function ReviewerStack(props: {
  readonly reviews: readonly Review[]
  readonly requested: readonly Person[]
}) {
  const people = () => [
    ...props.reviews.map((review) => ({
      person: review.reviewer,
      mark: VERDICT[review.verdict].tone,
      says: `${review.reviewer.login} ${VERDICT[review.verdict].label}`,
    })),
    ...props.requested.map((person) => ({
      person,
      mark: "requested" as const,
      says: `waiting on ${person.login}`,
    })),
  ]
  const hidden = () => Math.max(0, people().length - MAX_SHOWN)

  return (
    <Show when={people().length > 0}>
      <span
        role="img"
        aria-label={people()
          .map((entry) => entry.says)
          .join(", ")}
        class="flex items-center gap-1.5"
      >
        <For each={people().slice(0, MAX_SHOWN)}>
          {(entry) => (
            <span title={entry.says} class="inline-flex">
              <Avatar person={entry.person} mark={entry.mark} />
            </span>
          )}
        </For>
        <Show when={hidden() > 0}>
          <span class="text-[11px] text-fg-subtle tabular-nums">+{hidden()}</span>
        </Show>
      </span>
    </Show>
  )
}
