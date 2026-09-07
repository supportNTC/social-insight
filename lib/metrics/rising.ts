/** CLAUDE.md glossary: "rising" = velocity >= 1.5 and published within 72h. */
export const RISING_VELOCITY_THRESHOLD = 1.5;
export const RISING_MAX_AGE_HOURS = 72;

const MS_PER_HOUR = 3_600_000;

/**
 * A null velocity (no baseline yet) is never rising — not "rising by
 * default". A `publishedAt` after `now` (clock skew, bad data) is likewise
 * never rising rather than producing a negative age that happens to pass.
 */
export function isRising(args: {
  velocity: number | null;
  publishedAt: Date;
  now: Date;
}): boolean {
  const { velocity, publishedAt, now } = args;
  if (velocity === null) return false;

  const ageHours = (now.getTime() - publishedAt.getTime()) / MS_PER_HOUR;
  if (ageHours < 0) return false;

  return velocity >= RISING_VELOCITY_THRESHOLD && ageHours <= RISING_MAX_AGE_HOURS;
}
