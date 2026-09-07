/**
 * Timezone rules for this project:
 *
 *   * every instant in the database is UTC (`timestamptz`)
 *   * every instant shown to a user is Asia/Bangkok
 *   * `snapshot_date` is a *business day label* in Asia/Bangkok, stored as a
 *     bare `date` column
 *
 * The last one is the subtle part. Postgres `date` has no timezone, and Prisma
 * hands it back as a Date at UTC midnight. So a snapshot labelled 2026-09-07
 * arrives as 2026-09-07T00:00:00Z even though the Bangkok day it describes ran
 * from 2026-09-06T17:00:00Z to 2026-09-07T17:00:00Z. Convert with the helpers
 * here rather than with `new Date(...)` at call sites.
 */

export const APP_TIMEZONE = "Asia/Bangkok";

/** `YYYY-MM-DD`. A calendar day, not an instant. */
export type SnapshotDate = string;

const SNAPSHOT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// en-CA formats as YYYY-MM-DD, which is exactly the shape we want.
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The Asia/Bangkok calendar day an instant falls on.
 *
 * `snapshotDateFor(new Date("2026-09-06T17:00:00Z"))` -> "2026-09-07",
 * because Bangkok is UTC+7 and has just rolled over to the 7th.
 */
export function snapshotDateFor(instant: Date): SnapshotDate {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError("snapshotDateFor received an invalid Date");
  }
  return dayFormatter.format(instant);
}

/**
 * Turn a `YYYY-MM-DD` label into the value Prisma expects for a `date` column
 * (UTC midnight). Round-trips with `snapshotDateFromColumn`.
 */
export function snapshotDateToColumn(date: SnapshotDate): Date {
  assertSnapshotDate(date);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError(`Not a real calendar date: ${date}`);
  }
  // Date parsing rolls impossible days over silently — "2026-02-29" becomes
  // 2026-03-01 rather than throwing. Reject anything that did not survive the
  // round-trip, or a bad snapshot_date would land in the database as a
  // plausible-looking wrong day.
  if (parsed.toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Not a real calendar date: ${date}`);
  }
  return parsed;
}

/** Read a `date` column back as a `YYYY-MM-DD` label. */
export function snapshotDateFromColumn(value: Date): SnapshotDate {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError("snapshotDateFromColumn received an invalid Date");
  }
  return value.toISOString().slice(0, 10);
}

/** Shift a day label by whole days. Negative goes backwards. */
export function addDays(date: SnapshotDate, days: number): SnapshotDate {
  const base = snapshotDateToColumn(date);
  base.setUTCDate(base.getUTCDate() + days);
  return snapshotDateFromColumn(base);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: SnapshotDate, to: SnapshotDate): number {
  const ms =
    snapshotDateToColumn(to).getTime() - snapshotDateToColumn(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** Inclusive list of day labels. Returns [] when `to` precedes `from`. */
export function eachDay(
  from: SnapshotDate,
  to: SnapshotDate,
): SnapshotDate[] {
  const span = daysBetween(from, to);
  if (span < 0) return [];
  const out: SnapshotDate[] = [];
  for (let i = 0; i <= span; i += 1) out.push(addDays(from, i));
  return out;
}

function assertSnapshotDate(value: string): void {
  if (!SNAPSHOT_DATE_PATTERN.test(value)) {
    throw new RangeError(`Expected a YYYY-MM-DD snapshot date, got "${value}"`);
  }
}

/**
 * The instant a Bangkok business day ends — i.e. the next day's local
 * midnight. Needed wherever a *day label* has to be compared against a
 * timestamp (content age in hours, for instance).
 *
 * Asia/Bangkok is a fixed +07:00 offset with no DST, so the offset is written
 * literally rather than derived; the constant is asserted in the tests.
 */
export function endOfSnapshotDay(date: SnapshotDate): Date {
  assertSnapshotDate(date);
  const next = addDays(date, 1);
  const instant = new Date(`${next}T00:00:00.000+07:00`);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`Not a real calendar date: ${date}`);
  }
  return instant;
}
