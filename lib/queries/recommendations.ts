import type { ContentKind, Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  addDays,
  daysBetween,
  endOfSnapshotDay,
  snapshotDateFor,
  snapshotDateFromColumn,
  snapshotDateToColumn,
  type SnapshotDate,
} from "@/lib/datetime";
import { getEnv } from "@/lib/env";
import {
  computeEngagementRate,
  computePerformanceScore,
  computeVelocity,
  diagnoseUnderperformance,
  isRising,
  median,
  type EngagementRateResult,
  type MetricWeights,
  type UnderperformanceDiagnosis,
  type UnderperformanceThresholds,
} from "@/lib/metrics";
import { ALL_PLATFORMS } from "@/lib/platform";
import { getLatestDataDate } from "./latest-data-date";
import { getMetricWeights } from "./weights";
import { resolveDateRange, type DateRangeKey, type ResolvedRange } from "./date-range";

/**
 * Baselines are deliberately NOT tied to the page date filter: an account's
 * "normal" must not move every time someone switches 7d / 30d / 90d, or the
 * same content would be called excellent in one view and average in another.
 * The date filter decides which content is *shown*; these windows decide what
 * it is compared against.
 */
const ER_BASELINE_DAYS = 30;
const VELOCITY_BASELINE_CONTENTS = 20;
/**
 * Equal-maturity comparison window. Every content is measured at the snapshot
 * MATURITY_DAYS after its own publish day (or its latest snapshot if it is
 * still younger), so a 5-day-old post is never compared against a 40-day-old
 * post's accumulated total.
 */
const MATURITY_DAYS = 7;
/**
 * Below this age a content simply has not had its chance yet — excluded from
 * "ต่ำกว่าปกติ" rather than reported as failing.
 */
const MIN_AGE_DAYS_FOR_UNDERPERFORMANCE = 3;

const RISING_LIMIT = 5;
const TOP_LIMIT = 10;
const UNDERPERFORMING_LIMIT = 5;

const MS_PER_HOUR = 3_600_000;

export type RecommendationFilters = {
  range: DateRangeKey;
  platforms: Platform[];
};

export type RecommendationItem = {
  id: string;
  platform: Platform;
  kind: ContentKind;
  caption: string | null;
  publishedAt: Date;
  permalink: string | null;
  thumbnailUrl: string | null;
  /** Cumulative views as of the anchor day. */
  views: number;
  /** Never null in a section — content without a computable ER is filtered out. */
  engagementRate: EngagementRateResult;
  /** Never null in a section — "no baseline yet" must not be shown as "worst". */
  performanceScore: number;
};

export type RisingItem = RecommendationItem & {
  velocity: number;
  ageHours: number;
  first24hViews: number;
};

export type UnderperformingItem = RecommendationItem & {
  diagnosis: UnderperformanceDiagnosis;
  /** Null on platforms that report no reach — the UI shows "—", never 0. */
  reachAtMaturity: number | null;
  viewsAtMaturity: number;
  /** How many days of growth the maturity numbers above actually cover. */
  maturityDays: number;
};

export type RecommendationsData = {
  anchor: SnapshotDate;
  range: ResolvedRange;
  rising: RisingItem[];
  top: RecommendationItem[];
  underperforming: UnderperformingItem[];
  thresholds: UnderperformanceThresholds;
  /** True when the ranking mixes reach-basis and views-basis ER (CLAUDE.md rule 4 — the UI must say so). */
  topMixesErBasis: boolean;
  maturityDays: number;
};

type MetricRow = {
  snapshotDate: SnapshotDate;
  views: number;
  reach: number | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number | null;
};

type ContentRow = {
  id: string;
  accountId: string;
  platform: Platform;
  kind: ContentKind;
  caption: string | null;
  publishedAt: Date;
  permalink: string | null;
  thumbnailUrl: string | null;
};

/** Everything Stage 5 knows about one content once its snapshots are folded in. */
type ScoredContent = {
  content: ContentRow;
  publishedDate: SnapshotDate;
  ageDays: number;
  anchorRow: MetricRow | undefined;
  engagementRate: EngagementRateResult | null;
  performanceScore: number | null;
  velocity: number | null;
  first24hViews: number | null;
  reachAtMaturity: number | null;
  viewsAtMaturity: number | null;
  maturityDays: number;
  medianReachAtMaturity: number | null;
  medianViewsAtMaturity: number | null;
};

/** Returns null when nothing has ever been synced — callers render an empty state. */
export async function getRecommendations(
  filters: RecommendationFilters,
): Promise<RecommendationsData | null> {
  const anchor = await getLatestDataDate();
  if (!anchor) return null;

  const range = resolveDateRange(filters.range, anchor);
  const platforms = filters.platforms.length > 0 ? filters.platforms : [...ALL_PLATFORMS];
  const [weights, accounts] = await Promise.all([
    getMetricWeights(),
    prisma.account.findMany({ where: { platform: { in: platforms } }, select: { id: true } }),
  ]);

  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return emptyResult(anchor, range);

  const erBaselineStart = addDays(anchor, -(ER_BASELINE_DAYS - 1));
  const relevant = await loadRelevantContents(accountIds, range, erBaselineStart);
  if (relevant.length === 0) return emptyResult(anchor, range);

  const rowsByContent = await loadMetricRows(relevant.map((c) => c.id));
  const scored = relevant.map((content) =>
    scoreContent(content, rowsByContent.get(content.id) ?? [], anchor, weights),
  );
  applyBaselines(scored, anchor, erBaselineStart);

  const thresholds = thresholdsFromEnv();
  // Only content published inside the selected range is *shown* — the wider
  // set above exists purely to make the baselines stable.
  const visible = scored.filter((s) => s.publishedDate >= range.from && s.publishedDate <= range.to);
  const now = endOfSnapshotDay(anchor);

  const rising = buildRising(visible, now);
  const top = buildTop(visible);
  const underperforming = buildUnderperforming(visible, thresholds);

  return {
    anchor,
    range,
    rising,
    top,
    underperforming,
    thresholds,
    topMixesErBasis: new Set(top.map((item) => item.engagementRate.basis)).size > 1,
    maturityDays: MATURITY_DAYS,
  };
}

// ---- data loading ----------------------------------------------------------

const CONTENT_SELECT = {
  id: true,
  accountId: true,
  platform: true,
  kind: true,
  caption: true,
  publishedAt: true,
  permalink: true,
  thumbnailUrl: true,
} as const;

async function loadRelevantContents(
  accountIds: string[],
  range: ResolvedRange,
  erBaselineStart: SnapshotDate,
): Promise<ContentRow[]> {
  // publishedAt is an instant, the window bounds are Bangkok day labels — pad
  // by a day so a post published near local midnight is not dropped here; the
  // exact day-label filtering happens later, on `publishedDate`.
  const windowStart = snapshotDateToColumn(addDays(minDate(range.from, erBaselineStart), -1));

  const [inWindow, recentPerAccount] = await Promise.all([
    prisma.content.findMany({
      where: { accountId: { in: accountIds }, publishedAt: { gte: windowStart } },
      select: CONTENT_SELECT,
    }),
    // The velocity baseline is "the 20 most recent contents in the account",
    // which can reach further back than any window above.
    Promise.all(
      accountIds.map((accountId) =>
        prisma.content.findMany({
          where: { accountId },
          select: CONTENT_SELECT,
          // Tie-broken by id: mock (and real) publish times collide at whole
          // hours, and an arbitrary tie order would let the 20-content
          // velocity baseline change between page loads.
          orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
          // +1 so a content still finds 20 peers after excluding itself.
          take: VELOCITY_BASELINE_CONTENTS + 1,
        }),
      ),
    ),
  ]);

  const byId = new Map<string, ContentRow>();
  for (const content of [...inWindow, ...recentPerAccount.flat()]) {
    byId.set(content.id, content);
  }
  return Array.from(byId.values());
}

async function loadMetricRows(contentIds: string[]): Promise<Map<string, MetricRow[]>> {
  const rows = await prisma.contentMetricDaily.findMany({
    where: { contentId: { in: contentIds } },
    select: {
      contentId: true,
      snapshotDate: true,
      views: true,
      reach: true,
      likes: true,
      comments: true,
      shares: true,
      saves: true,
    },
    orderBy: { snapshotDate: "asc" },
  });

  const byContent = new Map<string, MetricRow[]>();
  for (const row of rows) {
    const list = byContent.get(row.contentId) ?? [];
    list.push({ ...row, snapshotDate: snapshotDateFromColumn(row.snapshotDate) });
    byContent.set(row.contentId, list);
  }
  return byContent;
}

// ---- per-content scoring ---------------------------------------------------

function scoreContent(
  content: ContentRow,
  rows: MetricRow[],
  anchor: SnapshotDate,
  weights: MetricWeights,
): ScoredContent {
  const publishedDate = snapshotDateFor(content.publishedAt);
  const anchorRow = rows.find((r) => r.snapshotDate === anchor);

  // The first snapshot is the publish day itself, so its cumulative views are
  // this content's first-24h views (the glossary's velocity numerator).
  const first24hViews = rows[0]?.views ?? null;

  // Same maturity for everyone: MATURITY_DAYS after publish, or the newest
  // snapshot we have when the content is still younger than that.
  const maturityDate = minDate(addDays(publishedDate, MATURITY_DAYS - 1), anchor);
  const maturityRow = rows.find((r) => r.snapshotDate === maturityDate) ?? rows.at(-1);

  const engagementRate = anchorRow
    ? computeEngagementRate(
        {
          views: anchorRow.views,
          reach: anchorRow.reach,
          likes: anchorRow.likes,
          comments: anchorRow.comments,
          shares: anchorRow.shares,
          saves: anchorRow.saves,
        },
        weights,
      )
    : null;

  return {
    content,
    publishedDate,
    ageDays: daysBetween(publishedDate, anchor),
    anchorRow,
    engagementRate,
    // Filled in by applyBaselines, once every content of the account is scored.
    performanceScore: null,
    velocity: null,
    medianReachAtMaturity: null,
    medianViewsAtMaturity: null,
    first24hViews,
    reachAtMaturity: maturityRow?.reach ?? null,
    viewsAtMaturity: maturityRow?.views ?? null,
    maturityDays: maturityRow ? daysBetween(publishedDate, maturityRow.snapshotDate) + 1 : 0,
  };
}

/**
 * Second pass: every baseline is per account, so it can only be computed once
 * all of that account's contents carry their own numbers.
 */
function applyBaselines(
  scored: ScoredContent[],
  anchor: SnapshotDate,
  erBaselineStart: SnapshotDate,
): void {
  const byAccount = new Map<string, ScoredContent[]>();
  for (const item of scored) {
    const list = byAccount.get(item.content.accountId) ?? [];
    list.push(item);
    byAccount.set(item.content.accountId, list);
  }

  for (const items of byAccount.values()) {
    const inErWindow = items.filter(
      (i) => i.publishedDate >= erBaselineStart && i.publishedDate <= anchor,
    );

    const erHistory = inErWindow
      .map((i) => i.engagementRate)
      .filter((er): er is EngagementRateResult => er !== null);

    // The maturity medians compare only contents that actually reached full
    // maturity — a half-grown post would drag the account's "normal" down.
    const matureItems = inErWindow.filter((i) => i.maturityDays >= MATURITY_DAYS);
    const medianReachAtMaturity = median(
      matureItems.map((i) => i.reachAtMaturity).filter((v): v is number => v !== null),
    );
    const medianViewsAtMaturity = median(
      matureItems.map((i) => i.viewsAtMaturity).filter((v): v is number => v !== null),
    );

    // Same tie-break as the query above. Without it the 20 most recent
    // contents are ambiguous whenever two share a publish time, and velocity
    // would shift depending on how many contents the page happened to load.
    const byRecency = [...items].sort(
      (a, b) =>
        b.content.publishedAt.getTime() - a.content.publishedAt.getTime() ||
        a.content.id.localeCompare(b.content.id),
    );

    for (const item of items) {
      if (item.engagementRate) {
        item.performanceScore = computePerformanceScore(item.engagementRate, erHistory);
      }

      if (item.first24hViews !== null) {
        const peers = byRecency
          .filter((peer) => peer.content.id !== item.content.id)
          .slice(0, VELOCITY_BASELINE_CONTENTS)
          .map((peer) => peer.first24hViews)
          .filter((v): v is number => v !== null);
        item.velocity = computeVelocity(item.first24hViews, peers);
      }

      item.medianReachAtMaturity = medianReachAtMaturity;
      item.medianViewsAtMaturity = medianViewsAtMaturity;
    }
  }
}

// ---- section builders ------------------------------------------------------

/**
 * Null for a content the recommender cannot judge: no computable ER, or no
 * performance-score baseline. "Not known yet" must never be rendered as
 * "worst" — these sections are alerts, and an alert without evidence is noise.
 */
function toItem(scored: ScoredContent): RecommendationItem | null {
  if (!scored.engagementRate || scored.performanceScore === null) return null;

  return {
    id: scored.content.id,
    platform: scored.content.platform,
    kind: scored.content.kind,
    caption: scored.content.caption,
    publishedAt: scored.content.publishedAt,
    permalink: scored.content.permalink,
    thumbnailUrl: scored.content.thumbnailUrl,
    views: scored.anchorRow?.views ?? 0,
    engagementRate: scored.engagementRate,
    performanceScore: scored.performanceScore,
  };
}

function buildRising(scored: ScoredContent[], now: Date): RisingItem[] {
  const out: RisingItem[] = [];

  for (const item of scored) {
    const { velocity, first24hViews } = item;
    if (velocity === null || first24hViews === null) continue;
    if (!isRising({ velocity, publishedAt: item.content.publishedAt, now })) continue;

    const base = toItem(item);
    if (!base) continue;

    out.push({
      ...base,
      velocity,
      first24hViews,
      ageHours: (now.getTime() - item.content.publishedAt.getTime()) / MS_PER_HOUR,
    });
  }

  return out.sort((a, b) => b.velocity - a.velocity).slice(0, RISING_LIMIT);
}

function buildTop(scored: ScoredContent[]): RecommendationItem[] {
  return scored
    .map(toItem)
    .filter((item): item is RecommendationItem => item !== null)
    .sort((a, b) => b.performanceScore - a.performanceScore)
    .slice(0, TOP_LIMIT);
}

function buildUnderperforming(
  scored: ScoredContent[],
  thresholds: UnderperformanceThresholds,
): UnderperformingItem[] {
  const out: UnderperformingItem[] = [];

  for (const item of scored) {
    if (item.ageDays < MIN_AGE_DAYS_FOR_UNDERPERFORMANCE) continue;

    const { viewsAtMaturity } = item;
    if (viewsAtMaturity === null) continue;

    const base = toItem(item);
    if (!base) continue;

    const diagnosis = diagnoseUnderperformance(
      {
        reachAtMaturity: item.reachAtMaturity,
        medianReachAtMaturity: item.medianReachAtMaturity,
        viewsAtMaturity,
        medianViewsAtMaturity: item.medianViewsAtMaturity,
        performanceScore: item.performanceScore,
      },
      thresholds,
    );
    if (!diagnosis) continue;

    out.push({
      ...base,
      diagnosis,
      reachAtMaturity: item.reachAtMaturity,
      viewsAtMaturity,
      maturityDays: item.maturityDays,
    });
  }

  // Worst first. Each ratio is already normalised against its own account's
  // median, so ordering across accounts and platforms stays meaningful.
  return out.sort((a, b) => a.diagnosis.ratio - b.diagnosis.ratio).slice(0, UNDERPERFORMING_LIMIT);
}

// ---- helpers ---------------------------------------------------------------

function minDate(a: SnapshotDate, b: SnapshotDate): SnapshotDate {
  return a <= b ? a : b;
}

function thresholdsFromEnv(): UnderperformanceThresholds {
  const env = getEnv();
  return {
    reachRatio: env.UNDERPERFORMANCE_REACH_RATIO,
    viewsRatio: env.UNDERPERFORMANCE_VIEWS_RATIO,
    performanceScore: env.UNDERPERFORMANCE_SCORE,
  };
}

function emptyResult(anchor: SnapshotDate, range: ResolvedRange): RecommendationsData {
  return {
    anchor,
    range,
    rising: [],
    top: [],
    underperforming: [],
    thresholds: thresholdsFromEnv(),
    topMixesErBasis: false,
    maturityDays: MATURITY_DAYS,
  };
}
