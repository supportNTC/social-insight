import { addDays, type SnapshotDate } from "@/lib/datetime";

export type DateRangeKey = "7d" | "30d" | "90d";

export const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string; days: number }[] = [
  { key: "7d", label: "7 วัน", days: 7 },
  { key: "30d", label: "30 วัน", days: 30 },
  { key: "90d", label: "90 วัน", days: 90 },
];

export function isDateRangeKey(value: string | undefined): value is DateRangeKey {
  return value === "7d" || value === "30d" || value === "90d";
}

export function parseDateRangeKey(value: string | undefined): DateRangeKey {
  return isDateRangeKey(value) ? value : "30d";
}

function daysForRange(key: DateRangeKey): number {
  const option = DATE_RANGE_OPTIONS.find((o) => o.key === key);
  return option ? option.days : 30;
}

export type ResolvedRange = {
  from: SnapshotDate;
  to: SnapshotDate;
  previousFrom: SnapshotDate;
  previousTo: SnapshotDate;
};

/**
 * `to` must be the last day real data exists for (see getLatestDataDate),
 * never wall-clock `now()` — a sync can lag behind real time, and
 * MockProvider's universe is permanently anchored to MOCK_SEED.
 */
export function resolveDateRange(key: DateRangeKey, to: SnapshotDate): ResolvedRange {
  const days = daysForRange(key);
  const from = addDays(to, -(days - 1));
  const previousTo = addDays(from, -1);
  const previousFrom = addDays(previousTo, -(days - 1));
  return { from, to, previousFrom, previousTo };
}
