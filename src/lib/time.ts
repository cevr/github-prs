import { DateTime, Option } from "effect"

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
