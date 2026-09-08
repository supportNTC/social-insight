import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  addDays,
  eachDay,
  snapshotDateFromColumn,
  snapshotDateToColumn,
  type SnapshotDate,
} from "@/lib/datetime";
import {
  computeDeltas,
  computeWeightedEngagement,
  type ErBasis,
  type MetricWeights,
} from "@/lib/metrics";
import { ALL_PLATFORMS } from "@/lib/platform";
import { getLatestDataDate } from "./latest-data-date";
import { getMetricWeights } from "./weights";
import { resolveDateRange, type DateRangeKey, type ResolvedRange } from "./date-range";

export type OverviewFilters = {
  range: DateRangeKey;
  platforms: Platform[];
};

type KpiValue = {
  /** Null means "not computable in this scope" (e.g. reach when only TikTok is selected) — never 0. */
  total: number | null;
  /** Null means "no comparable previous-period baseline" — never 0%. */
  deltaPct: number | null;
};

export type OverviewKpis = {
  views: KpiValue;
  reach: KpiValue;
  weightedEngagement: KpiValue;
  /** Universal views-basis ER — combining platforms that do/don't report reach must never silently mix bases. */
  engagementRate: { value: number | null; deltaPct: number | null };
  followers: { total: number; delta: number };
};

export type TrendPoint = { date: SnapshotDate } & Partial<Record<Platform, number>>;

export type PlatformBreakdown = {
  platform: Platform;
  weightedEngagementShare: number;
  /** Null when neither reach nor views produced a usable (non-zero) denominator in scope. */
  engagementRate: { value: number; basis: ErBasis } | null;
  followers: number;
  followerDelta: number;
};

export type OverviewData = {
  anchor: SnapshotDate;
  range: ResolvedRange;
  kpis: OverviewKpis;
  trend: TrendPoint[];
  platformBreakdown: PlatformBreakdown[];
};

/** Returns null when nothing has ever been synced — callers render an empty state. */
export async function getOverviewData(filters: OverviewFilters): Promise<OverviewData | null> {
  const anchor = await getLatestDataDate();
  if (!anchor) return null;

  const range = resolveDateRange(filters.range, anchor);
  const platforms = filters.platforms.length > 0 ? filters.platforms : [...ALL_PLATFORMS];
  const weights = await getMetricWeights();

  const accounts = await prisma.account.findMany({ where: { platform: { in: platforms } } });
  if (accounts.length === 0) {
    return {
      anchor,
      range,
      kpis: emptyKpis(),
      trend: eachDay(range.from, range.to).map((date) => ({ date })),
      platformBreakdown: [],
    };
  }

  const accountIds = accounts.map((a) => a.id);
  const [contentDeltas, accountSeries] = await Promise.all([
    loadContentDeltas(accountIds, range, weights),
    loadAccountSeries(accountIds, range),
  ]);

  return {
    anchor,
    range,
    kpis: buildKpis(contentDeltas, accountSeries, range),
    trend: buildTrend(contentDeltas, range),
    platformBreakdown: buildPlatformBreakdown(contentDeltas, accountSeries, accounts, range),
  };
}

// ---- data loading ----------------------------------------------------------

export type ContentDeltaRow = {
  platform: Platform;
  snapshotDate: SnapshotDate;
  viewsDelta: number;
  reachDelta: number | null;
  weightedEngagementDelta: number;
};

export async function loadContentDeltas(
  accountIds: string[],
  range: ResolvedRange,
  weights: MetricWeights,
): Promise<ContentDeltaRow[]> {
  const contents = await prisma.content.findMany({
    where: { accountId: { in: accountIds } },
    select: { id: true, platform: true },
  });
  if (contents.length === 0) return [];

  const contentIds = contents.map((c) => c.id);
  const platformByContentId = new Map(contents.map((c) => [c.id, c.platform]));

  // One extra day before `previousFrom` so the first in-range day of BOTH
  // periods gets a correct delta against the day immediately preceding it.
  const windowStart = addDays(range.previousFrom, -1);
  const metricRows = await prisma.contentMetricDaily.findMany({
    where: {
      contentId: { in: contentIds },
      snapshotDate: { gte: snapshotDateToColumn(windowStart), lte: snapshotDateToColumn(range.to) },
    },
    orderBy: { snapshotDate: "asc" },
  });

  const byContent = new Map<string, typeof metricRows>();
  for (const row of metricRows) {
    const list = byContent.get(row.contentId) ?? [];
    list.push(row);
    byContent.set(row.contentId, list);
  }

  const out: ContentDeltaRow[] = [];
  for (const [contentId, rows] of byContent) {
    const platform = platformByContentId.get(contentId);
    if (!platform) continue;

    const asSeries = (pick: (r: (typeof rows)[number]) => number | null) =>
      computeDeltas(rows.map((r) => ({ snapshotDate: snapshotDateFromColumn(r.snapshotDate), value: pick(r) })));

    const viewsDeltas = asSeries((r) => r.views);
    const reachDeltas = asSeries((r) => r.reach);
    const likesDeltas = asSeries((r) => r.likes);
    const commentsDeltas = asSeries((r) => r.comments);
    const sharesDeltas = asSeries((r) => r.shares);
    const savesDeltas = asSeries((r) => r.saves);

    for (const [i, row] of rows.entries()) {
      const snapshotDate = snapshotDateFromColumn(row.snapshotDate);
      // The lookback day exists only to seed the first in-range day's delta —
      // it is not itself part of either period.
      if (snapshotDate < range.previousFrom) continue;

      const weightedEngagementDelta = computeWeightedEngagement(
        {
          likes: likesDeltas[i]?.delta ?? 0,
          comments: commentsDeltas[i]?.delta ?? 0,
          shares: sharesDeltas[i]?.delta ?? 0,
          saves: savesDeltas[i]?.delta ?? null,
        },
        weights,
      );

      out.push({
        platform,
        snapshotDate,
        viewsDelta: viewsDeltas[i]?.delta ?? 0,
        reachDelta: reachDeltas[i]?.delta ?? null,
        weightedEngagementDelta,
      });
    }
  }

  return out;
}

export type AccountSeriesPoint = {
  snapshotDate: SnapshotDate;
  followers: number;
};

export async function loadAccountSeries(
  accountIds: string[],
  range: ResolvedRange,
): Promise<Map<string, AccountSeriesPoint[]>> {
  const rows = await prisma.accountMetricDaily.findMany({
    where: {
      accountId: { in: accountIds },
      snapshotDate: {
        gte: snapshotDateToColumn(addDays(range.from, -1)),
        lte: snapshotDateToColumn(range.to),
      },
    },
    orderBy: { snapshotDate: "asc" },
  });

  const byAccount = new Map<string, AccountSeriesPoint[]>();
  for (const row of rows) {
    const list = byAccount.get(row.accountId) ?? [];
    list.push({ snapshotDate: snapshotDateFromColumn(row.snapshotDate), followers: row.followers });
    byAccount.set(row.accountId, list);
  }
  return byAccount;
}

// ---- aggregation ------------------------------------------------------------

function emptyKpis(): OverviewKpis {
  return {
    views: { total: 0, deltaPct: null },
    reach: { total: null, deltaPct: null },
    weightedEngagement: { total: 0, deltaPct: null },
    engagementRate: { value: null, deltaPct: null },
    followers: { total: 0, delta: 0 },
  };
}

export function sumInPeriod(
  rows: ContentDeltaRow[],
  from: SnapshotDate,
  to: SnapshotDate,
  platform?: Platform,
): { views: number; reach: number | null; weighted: number } {
  let views = 0;
  let reach = 0;
  let reachSamples = 0;
  let weighted = 0;

  for (const row of rows) {
    if (platform && row.platform !== platform) continue;
    if (row.snapshotDate < from || row.snapshotDate > to) continue;
    views += row.viewsDelta;
    weighted += row.weightedEngagementDelta;
    if (row.reachDelta !== null) {
      reach += row.reachDelta;
      reachSamples += 1;
    }
  }

  return { views, reach: reachSamples > 0 ? reach : null, weighted };
}

/** Null (not 0%) when either side is unavailable, or the previous value is 0 — "up from 0" isn't a meaningful percentage. */
function percentDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function findClosestOnOrBefore(
  series: AccountSeriesPoint[],
  date: SnapshotDate,
): AccountSeriesPoint | undefined {
  let best: AccountSeriesPoint | undefined;
  for (const point of series) {
    if (point.snapshotDate <= date && (!best || point.snapshotDate > best.snapshotDate)) {
      best = point;
    }
  }
  return best;
}

export function followerTotals(
  accountIds: string[],
  accountSeries: Map<string, AccountSeriesPoint[]>,
  range: ResolvedRange,
): { total: number; atStart: number } {
  let total = 0;
  let atStart = 0;
  for (const accountId of accountIds) {
    const series = accountSeries.get(accountId) ?? [];
    const atTo = findClosestOnOrBefore(series, range.to);
    const atFrom = findClosestOnOrBefore(series, addDays(range.from, -1));
    total += atTo?.followers ?? 0;
    atStart += atFrom?.followers ?? atTo?.followers ?? 0;
  }
  return { total, atStart };
}

function buildKpis(
  rows: ContentDeltaRow[],
  accountSeries: Map<string, AccountSeriesPoint[]>,
  range: ResolvedRange,
): OverviewKpis {
  const current = sumInPeriod(rows, range.from, range.to);
  const previous = sumInPeriod(rows, range.previousFrom, range.previousTo);

  const erCurrent = current.views > 0 ? (current.weighted / current.views) * 100 : null;
  const erPrevious = previous.views > 0 ? (previous.weighted / previous.views) * 100 : null;

  const { total: followersTotal, atStart: followersAtStart } = followerTotals(
    Array.from(accountSeries.keys()),
    accountSeries,
    range,
  );

  return {
    views: { total: current.views, deltaPct: percentDelta(current.views, previous.views) },
    reach: { total: current.reach, deltaPct: percentDelta(current.reach, previous.reach) },
    weightedEngagement: { total: current.weighted, deltaPct: percentDelta(current.weighted, previous.weighted) },
    engagementRate: { value: erCurrent, deltaPct: percentDelta(erCurrent, erPrevious) },
    followers: { total: followersTotal, delta: followersTotal - followersAtStart },
  };
}

function buildTrend(rows: ContentDeltaRow[], range: ResolvedRange): TrendPoint[] {
  const days = eachDay(range.from, range.to);
  const byDate = new Map<SnapshotDate, TrendPoint>(days.map((date) => [date, { date }]));

  for (const row of rows) {
    if (row.snapshotDate < range.from || row.snapshotDate > range.to) continue;
    const point = byDate.get(row.snapshotDate);
    if (!point) continue;
    point[row.platform] = (point[row.platform] ?? 0) + row.weightedEngagementDelta;
  }

  const out: TrendPoint[] = [];
  for (const date of days) {
    const point = byDate.get(date);
    if (point) out.push(point);
  }
  return out;
}

function buildPlatformBreakdown(
  rows: ContentDeltaRow[],
  accountSeries: Map<string, AccountSeriesPoint[]>,
  accounts: { id: string; platform: Platform }[],
  range: ResolvedRange,
): PlatformBreakdown[] {
  const platformsPresent = Array.from(new Set(accounts.map((a) => a.platform)));

  const perPlatform = platformsPresent.map((platform) => {
    const totals = sumInPeriod(rows, range.from, range.to, platform);
    const engagementRate: PlatformBreakdown["engagementRate"] =
      totals.reach !== null
        ? totals.reach > 0
          ? { value: (totals.weighted / totals.reach) * 100, basis: "reach" }
          : null
        : totals.views > 0
          ? { value: (totals.weighted / totals.views) * 100, basis: "views" }
          : null;

    const platformAccountIds = accounts.filter((a) => a.platform === platform).map((a) => a.id);
    const { total: followersTotal, atStart: followersAtStart } = followerTotals(
      platformAccountIds,
      accountSeries,
      range,
    );

    return {
      platform,
      weighted: totals.weighted,
      engagementRate,
      followers: followersTotal,
      followerDelta: followersTotal - followersAtStart,
    };
  });

  const grandTotal = perPlatform.reduce((sum, p) => sum + p.weighted, 0);

  return perPlatform.map((p) => ({
    platform: p.platform,
    weightedEngagementShare: grandTotal > 0 ? p.weighted / grandTotal : 0,
    engagementRate: p.engagementRate,
    followers: p.followers,
    followerDelta: p.followerDelta,
  }));
}
