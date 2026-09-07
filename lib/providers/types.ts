import type { ContentKind, Platform, ProviderKind } from "@prisma/client";
import type { SnapshotDate } from "@/lib/datetime";

/**
 * Central DTOs every InsightProvider implementation must return, regardless
 * of the source platform's own API shape (Graph API, TikTok's, ...). The sync
 * engine only ever knows about these types — never a provider's raw response.
 */

export type ProviderAccountRef = {
  platform: Platform;
  /** The id the platform itself uses (page id, ig user id, ...). */
  externalId: string;
  name: string;
  timezone: string;
};

export type ProviderContent = {
  externalId: string;
  kind: ContentKind;
  caption: string | null;
  /** Real instant the platform reports, not a snapshot day. */
  publishedAt: Date;
  permalink: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  tags: string[];
};

/**
 * One CUMULATIVE snapshot of a content item as of `snapshotDate` (Asia/Bangkok
 * calendar day) — see the comment on `content_metrics_daily` in schema.prisma.
 * `reach`, `saves`, `avgWatchSeconds`, `completionRate` are null, never 0,
 * when the platform doesn't report them.
 */
export type ProviderContentMetric = {
  contentExternalId: string;
  snapshotDate: SnapshotDate;
  views: number;
  reach: number | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number | null;
  avgWatchSeconds: number | null;
  completionRate: number | null;
};

/**
 * One day of ACCOUNT-level numbers. Not cumulative — see the comment on
 * `account_metrics_daily` in schema.prisma. `followers` is a point-in-time
 * value; `views`/`reach` are what happened on that day.
 */
export type ProviderAccountMetric = {
  snapshotDate: SnapshotDate;
  followers: number;
  followerDelta: number | null;
  views: number | null;
  reach: number | null;
};

/** A verbatim provider response, persisted to `raw_payloads` before normalization. */
export type ProviderRawPayload = {
  endpoint: string;
  payload: unknown;
};

export type ProviderFetchResult = {
  contents: ProviderContent[];
  contentMetrics: ProviderContentMetric[];
  accountMetrics: ProviderAccountMetric[];
  rawPayloads: ProviderRawPayload[];
};

export interface InsightProvider {
  readonly kind: ProviderKind;

  /**
   * Accounts this provider knows about. MockProvider returns a fixed roster;
   * a real provider would call the platform's own account-list endpoint
   * (Stage 6).
   */
  listAccounts(): Promise<ProviderAccountRef[]>;

  /** Everything needed for one sync pass over one account. */
  fetchAccountData(account: ProviderAccountRef): Promise<ProviderFetchResult>;
}
