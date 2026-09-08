import type { ContentKind, Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, snapshotDateFor, snapshotDateToColumn, type SnapshotDate } from "@/lib/datetime";
import {
  computeEngagementRate,
  computePerformanceScore,
  type EngagementRateResult,
} from "@/lib/metrics";
import { ALL_PLATFORMS } from "@/lib/platform";
import { getLatestDataDate } from "./latest-data-date";
import { getMetricWeights } from "./weights";

export type ContentSortKey =
  | "published_desc"
  | "published_asc"
  | "views_desc"
  | "views_asc"
  | "er_desc"
  | "er_asc"
  | "score_desc"
  | "score_asc";

export const CONTENT_SORT_OPTIONS: { key: ContentSortKey; label: string }[] = [
  { key: "published_desc", label: "วันที่เผยแพร่ (ใหม่สุด)" },
  { key: "published_asc", label: "วันที่เผยแพร่ (เก่าสุด)" },
  { key: "views_desc", label: "ยอดวิว (มากสุด)" },
  { key: "views_asc", label: "ยอดวิว (น้อยสุด)" },
  { key: "er_desc", label: "Engagement Rate (มากสุด)" },
  { key: "er_asc", label: "Engagement Rate (น้อยสุด)" },
  { key: "score_desc", label: "Performance Score (มากสุด)" },
  { key: "score_asc", label: "Performance Score (น้อยสุด)" },
];

export function isContentSortKey(value: string | undefined): value is ContentSortKey {
  return CONTENT_SORT_OPTIONS.some((o) => o.key === value);
}

export type ContentListFilters = {
  platforms: Platform[];
  search: string;
  sort: ContentSortKey;
  page: number;
  pageSize: number;
};

export type ContentListRow = {
  id: string;
  platform: Platform;
  kind: ContentKind;
  caption: string | null;
  publishedAt: Date;
  permalink: string | null;
  thumbnailUrl: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: EngagementRateResult | null;
  performanceScore: number | null;
};

export type ContentListResult = {
  /** Null when nothing has ever been synced. */
  anchor: SnapshotDate | null;
  rows: ContentListRow[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Every content's daily snapshot reaches all the way to the anchor day (the
 * mock generator and every real sync both write through "today"), so a
 * content's CURRENT numbers are just its row at snapshotDate = anchor — no
 * need to fetch full history for the table.
 */
export async function getContentList(filters: ContentListFilters): Promise<ContentListResult> {
  const anchor = await getLatestDataDate();
  if (!anchor) {
    return { anchor: null, rows: [], total: 0, page: filters.page, pageSize: filters.pageSize };
  }

  const platforms = filters.platforms.length > 0 ? filters.platforms : [...ALL_PLATFORMS];
  const weights = await getMetricWeights();

  const accounts = await prisma.account.findMany({
    where: { platform: { in: platforms } },
    select: { id: true },
  });
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) {
    return { anchor, rows: [], total: 0, page: filters.page, pageSize: filters.pageSize };
  }

  const contentsWhere: Prisma.ContentWhereInput = {
    accountId: { in: accountIds },
    ...(filters.search ? { caption: { contains: filters.search, mode: "insensitive" } } : {}),
  };

  const contents = await prisma.content.findMany({
    where: contentsWhere,
    select: {
      id: true,
      accountId: true,
      platform: true,
      kind: true,
      caption: true,
      publishedAt: true,
      permalink: true,
      thumbnailUrl: true,
    },
  });
  if (contents.length === 0) {
    return { anchor, rows: [], total: 0, page: filters.page, pageSize: filters.pageSize };
  }

  // The performance-score baseline needs EVERY content in these accounts
  // published in the last 30 days — not just ones matching `search` — so a
  // caption search doesn't skew the very baseline it's compared against.
  const allAccountContents = await prisma.content.findMany({
    where: { accountId: { in: accountIds } },
    select: { id: true, accountId: true, publishedAt: true },
  });

  const anchorMetrics = await prisma.contentMetricDaily.findMany({
    where: {
      contentId: { in: allAccountContents.map((c) => c.id) },
      snapshotDate: snapshotDateToColumn(anchor),
    },
  });
  const metricByContentId = new Map(anchorMetrics.map((m) => [m.contentId, m]));

  const baselineWindowStart = addDays(anchor, -29);
  const erHistoryByAccount = new Map<string, EngagementRateResult[]>();
  for (const content of allAccountContents) {
    if (snapshotDateFor(content.publishedAt) < baselineWindowStart) continue;
    const metric = metricByContentId.get(content.id);
    if (!metric) continue;

    const er = computeEngagementRate(
      {
        views: metric.views,
        reach: metric.reach,
        likes: metric.likes,
        comments: metric.comments,
        shares: metric.shares,
        saves: metric.saves,
      },
      weights,
    );
    if (!er) continue;

    const list = erHistoryByAccount.get(content.accountId) ?? [];
    list.push(er);
    erHistoryByAccount.set(content.accountId, list);
  }

  const rows: ContentListRow[] = contents.map((content) => {
    const metric = metricByContentId.get(content.id);
    const engagementRate = metric
      ? computeEngagementRate(
          {
            views: metric.views,
            reach: metric.reach,
            likes: metric.likes,
            comments: metric.comments,
            shares: metric.shares,
            saves: metric.saves,
          },
          weights,
        )
      : null;

    const performanceScore = engagementRate
      ? computePerformanceScore(engagementRate, erHistoryByAccount.get(content.accountId) ?? [])
      : null;

    return {
      id: content.id,
      platform: content.platform,
      kind: content.kind,
      caption: content.caption,
      publishedAt: content.publishedAt,
      permalink: content.permalink,
      thumbnailUrl: content.thumbnailUrl,
      views: metric?.views ?? 0,
      likes: metric?.likes ?? 0,
      comments: metric?.comments ?? 0,
      shares: metric?.shares ?? 0,
      engagementRate,
      performanceScore,
    };
  });

  const sorted = sortContentRows(rows, filters.sort);
  const total = sorted.length;
  // Clamp rather than trust the querystring's page number — an out-of-range
  // page (a stale bookmark, or someone editing the URL) must still land on a
  // real page of results, not an empty slice with a nonsensical "19961-120".
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const currentPage = Math.min(Math.max(1, filters.page), totalPages);
  const start = (currentPage - 1) * filters.pageSize;
  const page = sorted.slice(start, start + filters.pageSize);

  return { anchor, rows: page, total, page: currentPage, pageSize: filters.pageSize };
}

/** Same filters as getContentList, minus pagination — for CSV export. */
export async function getAllMatchingContent(
  filters: Omit<ContentListFilters, "page" | "pageSize">,
): Promise<ContentListResult> {
  return getContentList({ ...filters, page: 1, pageSize: Number.MAX_SAFE_INTEGER });
}

function compareNullsLast(a: number | null, b: number | null, ascending: boolean): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return ascending ? a - b : b - a;
}

function sortContentRows(rows: ContentListRow[], sort: ContentSortKey): ContentListRow[] {
  const ascending = sort.endsWith("_asc");

  return [...rows].sort((a, b) => {
    if (sort.startsWith("published")) {
      const diff = a.publishedAt.getTime() - b.publishedAt.getTime();
      return ascending ? diff : -diff;
    }
    if (sort.startsWith("views")) {
      return ascending ? a.views - b.views : b.views - a.views;
    }
    if (sort.startsWith("er")) {
      return compareNullsLast(a.engagementRate?.value ?? null, b.engagementRate?.value ?? null, ascending);
    }
    // score
    return compareNullsLast(a.performanceScore, b.performanceScore, ascending);
  });
}
