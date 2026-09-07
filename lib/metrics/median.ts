/**
 * Population median. Returns null for an empty input — "no data yet" is a
 * distinct case from every other numeric result and every caller in this
 * module treats it as "no baseline", not as 0.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    const middle = sorted[mid];
    return middle ?? null; // unreachable given the length check above; keeps noUncheckedIndexedAccess happy
  }

  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (lower === undefined || upper === undefined) return null; // same as above
  return (lower + upper) / 2;
}
