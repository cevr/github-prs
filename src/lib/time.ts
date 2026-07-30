import { DateTime, Option } from "effect"

// Solid render paths run outside the Effect runtime, so they cannot yield
// DateTime.now; DateTime.nowUnsafe is the sanctioned synchronous clock access.

export function parseEpochMillis(isoDate: string): number {
  return Option.match(DateTime.make(isoDate), {
    onNone: () => Number.NaN,
    onSome: DateTime.toEpochMillis,
  })
}

export function nowEpochMillis(): number {
  return DateTime.toEpochMillis(DateTime.nowUnsafe())
}

export function nowIso(): string {
  return DateTime.formatIso(DateTime.nowUnsafe())
}

export function nowDate(): Date {
  return DateTime.toDate(DateTime.nowUnsafe())
}
