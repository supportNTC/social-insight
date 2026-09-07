import type { SnapshotDate } from "@/lib/datetime";

/**
 * Turns a CUMULATIVE snapshot series into per-day deltas (schema rule 1: a
 * `content_metrics_daily` row is a lifetime total as of that day, not what
 * happened on that day). `series` must already be sorted ascending by date.
 *
 * The first snapshot's delta is the snapshot itself — a content's debut day
 * IS its first day of activity, there is no earlier cumulative value to
 * subtract. A null value produces a null delta rather than being treated as 0
 * (matches the reach/saves "null ≠ 0" rule).
 */
export function computeDeltas(
  series: readonly { snapshotDate: SnapshotDate; value: number | null }[],
): { snapshotDate: SnapshotDate; delta: number | null }[] {
  const out: { snapshotDate: SnapshotDate; delta: number | null }[] = [];
  let previous: number | null = null;

  for (const point of series) {
    if (point.value === null) {
      out.push({ snapshotDate: point.snapshotDate, delta: null });
      // Deliberately do not update `previous` — a missing day shouldn't make
      // the next real value look like a delta against 0.
      continue;
    }
    const delta = previous === null ? point.value : point.value - previous;
    out.push({ snapshotDate: point.snapshotDate, delta });
    previous = point.value;
  }

  return out;
}
