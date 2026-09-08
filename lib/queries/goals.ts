import type { GoalMetric, Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, snapshotDateToColumn, type SnapshotDate } from "@/lib/datetime";
import { computeGoalProgress, type GoalProgress, type MetricWeights } from "@/lib/metrics";
import { getLatestDataDate } from "./latest-data-date";
import { getMetricWeights } from "./weights";
import { followerTotals, loadAccountSeries, loadContentDeltas, sumInPeriod } from "./overview";
import type { ResolvedRange } from "./date-range";

/**
 * "Goal" progress reuses the exact same aggregation Overview already computes
 * (lib/queries/overview.ts) for weighted_engagement/followers — nothing here
 * re-derives engagement math. course_conversions has no automated source (see
 * schema comment on CourseConversionEntry — a 2026-09-08 product decision) so
 * it just sums manually-logged entries instead.
 */

export type MonthKey = string; // "YYYY-MM"

export function isMonthKey(value: string | undefined): value is MonthKey {
  return !!value && /^\d{4}-\d{2}$/.test(value);
}

export function currentMonthKey(date: SnapshotDate): MonthKey {
  return date.slice(0, 7);
}

function parseMonthKey(monthKey: MonthKey): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  const yearStr = match?.[1];
  const monthStr = match?.[2];
  if (!yearStr || !monthStr) {
    throw new RangeError(`Invalid month key: "${monthKey}" (expected YYYY-MM)`);
  }
  return { year: Number(yearStr), month: Number(monthStr) };
}

export function monthStart(monthKey: MonthKey): SnapshotDate {
  parseMonthKey(monthKey); // validates
  return `${monthKey}-01`;
}

export function monthEnd(monthKey: MonthKey): SnapshotDate {
  const { year, month } = parseMonthKey(monthKey);
  const nextMonthKey = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  return addDays(monthStart(nextMonthKey), -1);
}

export function addMonths(monthKey: MonthKey, delta: number): MonthKey {
  const { year, month } = parseMonthKey(monthKey);
  const zeroBased = (month - 1) + delta;
  const newYear = year + Math.floor(zeroBased / 12);
  const newMonth = ((zeroBased % 12) + 12) % 12; // handles negative delta correctly
  return `${newYear}-${String(newMonth + 1).padStart(2, "0")}`;
}

export type GoalWithProgress = {
  id: string;
  metric: GoalMetric;
  /** Null = all platforms combined. */
  platform: Platform | null;
  month: MonthKey;
  targetValue: number;
  progress: GoalProgress;
};

export async function getGoalsForMonth(monthKey: MonthKey): Promise<GoalWithProgress[]> {
  const goals = await prisma.goal.findMany({
    where: { month: snapshotDateToColumn(monthStart(monthKey)) },
    orderBy: [{ metric: "asc" }, { platform: "asc" }],
  });
  if (goals.length === 0) return [];

  const from = monthStart(monthKey);
  const to = monthEnd(monthKey);
  // A goal for the current (in-progress) or a future month can't show
  // engagement data past whatever has actually been synced.
  const anchor = await getLatestDataDate();
  const effectiveTo = anchor && anchor < to ? anchor : to;

  const weights = await getMetricWeights();
  // One shared range per (platform) combo would be a micro-optimization;
  // there are at most a handful of goals per month, so simplicity wins.
  const results: GoalWithProgress[] = [];
  for (const goal of goals) {
    const actual = await computeActual(goal.metric, goal.platform, from, effectiveTo, weights);
    results.push({
      id: goal.id,
      metric: goal.metric,
      platform: goal.platform,
      month: monthKey,
      targetValue: goal.targetValue,
      progress: computeGoalProgress(actual, goal.targetValue),
    });
  }
  return results;
}

async function computeActual(
  metric: GoalMetric,
  platform: Platform | null,
  from: SnapshotDate,
  to: SnapshotDate,
  weights: MetricWeights,
): Promise<number> {
  if (to < from) return 0; // nothing synced yet for this month

  if (metric === "course_conversions") {
    const result = await prisma.courseConversionEntry.aggregate({
      _sum: { count: true },
      where: {
        entryDate: { gte: snapshotDateToColumn(from), lte: snapshotDateToColumn(to) },
        ...(platform ? { platform } : {}),
      },
    });
    return result._sum.count ?? 0;
  }

  const accounts = await prisma.account.findMany({
    where: platform ? { platform } : {},
    select: { id: true },
  });
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return 0;

  // previousFrom/previousTo only widen loadContentDeltas'/loadAccountSeries'
  // fetch window by one day — goals don't need a period-over-period
  // comparison the way Overview's KPIs do, so `from` doubles for both.
  const range: ResolvedRange = { from, to, previousFrom: from, previousTo: addDays(from, -1) };

  if (metric === "weighted_engagement") {
    const rows = await loadContentDeltas(accountIds, range, weights);
    return sumInPeriod(rows, from, to).weighted;
  }

  // followers: "actual" is growth during the month — matches how the
  // Overview KPI already frames followers as a flow ("+1.6K this period"),
  // not a raw total, since a raw total isn't something you "hit a target" on.
  const accountSeries = await loadAccountSeries(accountIds, range);
  const { total, atStart } = followerTotals(accountIds, accountSeries, range);
  return total - atStart;
}

export type GoalInput = {
  metric: GoalMetric;
  platform: Platform | null;
  month: MonthKey;
  targetValue: number;
};

/**
 * Upserts on (metric, platform, month) — setting a goal that already exists
 * just updates its target. Done as findFirst + create/update rather than
 * Prisma's own `upsert`: Postgres treats NULL as never equal to NULL in a
 * unique index, so `@@unique([metric, platform, month])` does not actually
 * stop two "all platforms" (platform=NULL) goals for the same metric+month
 * from both existing — and Prisma's compound-unique `where` won't even accept
 * `null` for that reason. This has the same small race window any
 * findFirst-then-write does, which is fine for a low-traffic internal form.
 */
export async function upsertGoal(input: GoalInput, updatedBy: string): Promise<void> {
  const month = snapshotDateToColumn(monthStart(input.month));
  const existing = await prisma.goal.findFirst({
    where: { metric: input.metric, platform: input.platform, month },
  });

  if (existing) {
    await prisma.goal.update({ where: { id: existing.id }, data: { targetValue: input.targetValue, updatedBy } });
  } else {
    await prisma.goal.create({
      data: { metric: input.metric, platform: input.platform, month, targetValue: input.targetValue, updatedBy },
    });
  }
}

export async function deleteGoal(id: string): Promise<void> {
  await prisma.goal.delete({ where: { id } });
}

export type CourseConversionEntryView = {
  id: string;
  entryDate: SnapshotDate;
  platform: Platform | null;
  count: number;
  note: string | null;
};

export async function getCourseConversionEntries(monthKey: MonthKey): Promise<CourseConversionEntryView[]> {
  const rows = await prisma.courseConversionEntry.findMany({
    where: {
      entryDate: {
        gte: snapshotDateToColumn(monthStart(monthKey)),
        lte: snapshotDateToColumn(monthEnd(monthKey)),
      },
    },
    orderBy: { entryDate: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    entryDate: row.entryDate.toISOString().slice(0, 10),
    platform: row.platform,
    count: row.count,
    note: row.note,
  }));
}

export type CourseConversionInput = {
  entryDate: SnapshotDate;
  platform: Platform | null;
  count: number;
  note: string | null;
};

export async function logCourseConversion(input: CourseConversionInput, createdBy: string): Promise<void> {
  await prisma.courseConversionEntry.create({
    data: {
      entryDate: snapshotDateToColumn(input.entryDate),
      platform: input.platform,
      count: input.count,
      note: input.note,
      createdBy,
    },
  });
}

export async function deleteCourseConversionEntry(id: string): Promise<void> {
  await prisma.courseConversionEntry.delete({ where: { id } });
}
