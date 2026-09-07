import type { ContentKind, Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { snapshotDateFromColumn, type SnapshotDate } from "@/lib/datetime";
import { computeEngagementRate, type EngagementRateResult } from "@/lib/metrics";
import { getMetricWeights } from "./weights";

export type ContentGrowthPoint = {
  snapshotDate: SnapshotDate;
  views: number;
  reach: number | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number | null;
};

export type ContentDetail = {
  id: string;
  platform: Platform;
  kind: ContentKind;
  caption: string | null;
  publishedAt: Date;
  permalink: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  accountName: string;
  growth: ContentGrowthPoint[];
  latestEngagementRate: EngagementRateResult | null;
};

export async function getContentDetail(id: string): Promise<ContentDetail | null> {
  const content = await prisma.content.findUnique({
    where: { id },
    include: {
      account: { select: { name: true } },
      metricsDaily: { orderBy: { snapshotDate: "asc" } },
    },
  });
  if (!content) return null;

  const weights = await getMetricWeights();

  const growth: ContentGrowthPoint[] = content.metricsDaily.map((m) => ({
    snapshotDate: snapshotDateFromColumn(m.snapshotDate),
    views: m.views,
    reach: m.reach,
    likes: m.likes,
    comments: m.comments,
    shares: m.shares,
    saves: m.saves,
  }));

  const latest = content.metricsDaily.at(-1);
  const latestEngagementRate = latest
    ? computeEngagementRate(
        {
          views: latest.views,
          reach: latest.reach,
          likes: latest.likes,
          comments: latest.comments,
          shares: latest.shares,
          saves: latest.saves,
        },
        weights,
      )
    : null;

  return {
    id: content.id,
    platform: content.platform,
    kind: content.kind,
    caption: content.caption,
    publishedAt: content.publishedAt,
    permalink: content.permalink,
    thumbnailUrl: content.thumbnailUrl,
    durationSeconds: content.durationSeconds,
    accountName: content.account.name,
    growth,
    latestEngagementRate,
  };
}
