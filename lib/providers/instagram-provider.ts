import type { ProviderKind } from "@prisma/client";
import { APP_TIMEZONE } from "@/lib/datetime";
import { GraphClient, type GraphClientOptions } from "./meta/graph-client";
import {
  FOLLOWERS_COUNT_FIELD,
  MEDIA_EDGE,
  MEDIA_FIELDS,
  MEDIA_METRICS,
  MEDIA_MAX_LIMIT,
  PAGE_INSTAGRAM_ACCOUNT_FIELD,
} from "./instagram/api-spec";
import { normalizeAccountMetrics, normalizeContentMetric, normalizeMedia, snapshotDateOf } from "./instagram/normalize";
import type {
  InsightProvider,
  ProviderAccountRef,
  ProviderContent,
  ProviderContentMetric,
  ProviderFetchResult,
  ProviderRawPayload,
} from "./types";

/**
 * Second real provider (PROMPT.md Stage 6, after Facebook). Reuses the same
 * GraphClient as FacebookProvider — confirmed the same Graph API platform,
 * see lib/providers/instagram/api-spec.ts's header citation. Only reachable
 * through INSIGHT_PROVIDER=instagram; default stays "mock" (CLAUDE.md rule 2).
 *
 * Every media item's insights are LIFETIME totals as of the call, exactly
 * like Facebook's post insights — one sync per day builds the cumulative
 * history. Account-level followers is a plain "right now" field with no
 * confirmed history, so only today's account_metrics_daily row is ever
 * produced (see normalizeAccountMetrics for why).
 */

export type InstagramProviderConfig = {
  /** The Facebook Page id whose connected Instagram Business Account this provider reads. */
  pageId: string;
  accessToken: string;
  lookbackDays: number;
  graphVersion?: string;
  fetchImpl?: GraphClientOptions["fetchImpl"];
  baseUrl?: string;
  now?: () => Date;
};

const MS_PER_DAY = 86_400_000;
const MEDIA_INSIGHT_CONCURRENCY = 5;
const MEDIA_METRIC_LIST = [MEDIA_METRICS.views, MEDIA_METRICS.reach, MEDIA_METRICS.saved, MEDIA_METRICS.shares].join(
  ",",
);
const REEL_ONLY_METRIC_LIST = [...MEDIA_METRIC_LIST.split(","), MEDIA_METRICS.reelAvgWatchTime].join(",");
const ACCOUNT_METRIC_LIST = "reach,views";

export class InstagramProvider implements InsightProvider {
  readonly kind: ProviderKind = "instagram";

  private readonly config: InstagramProviderConfig;
  private readonly client: GraphClient;
  private readonly now: () => Date;

  constructor(config: InstagramProviderConfig) {
    this.config = config;
    this.now = config.now ?? (() => new Date());
    this.client = new GraphClient({
      accessToken: config.accessToken,
      version: config.graphVersion,
      baseUrl: config.baseUrl,
      fetchImpl: config.fetchImpl,
    });
  }

  async listAccounts(): Promise<ProviderAccountRef[]> {
    const payload = await this.client.get(this.config.pageId, {
      fields: `${PAGE_INSTAGRAM_ACCOUNT_FIELD}{id,username}`,
    });
    const page = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
    const igAccount =
      typeof page[PAGE_INSTAGRAM_ACCOUNT_FIELD] === "object" && page[PAGE_INSTAGRAM_ACCOUNT_FIELD] !== null
        ? (page[PAGE_INSTAGRAM_ACCOUNT_FIELD] as Record<string, unknown>)
        : null;

    if (!igAccount || typeof igAccount.id !== "string") {
      throw new Error(
        `Facebook Page ${this.config.pageId} has no connected Instagram Business Account ` +
          `(${PAGE_INSTAGRAM_ACCOUNT_FIELD} was empty) — connect one in Page settings first.`,
      );
    }

    const externalId = igAccount.id;
    const name = typeof igAccount.username === "string" ? igAccount.username : externalId;

    return [{ platform: "instagram", externalId, name, timezone: APP_TIMEZONE }];
  }

  async fetchAccountData(account: ProviderAccountRef): Promise<ProviderFetchResult> {
    const rawPayloads: ProviderRawPayload[] = [];
    const now = this.now();
    const snapshotDate = snapshotDateOf(now);
    const since = new Date(now.getTime() - this.config.lookbackDays * MS_PER_DAY);

    // ---- media ----
    const mediaPages = await this.client.getAllPages(`${account.externalId}/${MEDIA_EDGE}`, {
      fields: MEDIA_FIELDS.join(","),
      limit: MEDIA_MAX_LIMIT,
    });

    const rawMedia: unknown[] = [];
    for (const [index, page] of mediaPages.entries()) {
      rawPayloads.push({ endpoint: `${MEDIA_EDGE}#${index}`, payload: page.raw });
      rawMedia.push(...page.data);
    }

    const contents: ProviderContent[] = [];
    const mediaInWindow: unknown[] = [];
    for (const raw of rawMedia) {
      const content = normalizeMedia(raw);
      if (!content) continue;
      if (content.publishedAt < since) continue;
      contents.push(content);
      mediaInWindow.push(raw);
    }

    // ---- per-media insights ----
    const contentMetrics: ProviderContentMetric[] = [];
    await forEachChunk(mediaInWindow, MEDIA_INSIGHT_CONCURRENCY, async (raw) => {
      const media = raw as Record<string, unknown>;
      const mediaId = typeof media.id === "string" ? media.id : null;
      if (!mediaId) return;

      // ig_reels_avg_watch_time only applies to REELS — requesting it on a
      // non-reel returns an "invalid metric" error rather than being ignored.
      const metricList = media.media_product_type === "REELS" ? REEL_ONLY_METRIC_LIST : MEDIA_METRIC_LIST;
      const insights = await this.client.get(`${mediaId}/insights`, { metric: metricList });
      rawPayloads.push({ endpoint: `media.insights:${mediaId}`, payload: insights });

      const metric = normalizeContentMetric({ media: raw, insights, snapshotDate });
      if (metric) contentMetrics.push(metric);
    });

    // ---- account-level ----
    const [dailyInsights, followersPayload] = await Promise.all([
      this.client.get(`${account.externalId}/insights`, {
        metric: ACCOUNT_METRIC_LIST,
        period: "day",
        since: toUnixSeconds(since),
        until: toUnixSeconds(now),
      }),
      this.client.get(account.externalId, { fields: FOLLOWERS_COUNT_FIELD }),
    ]);
    rawPayloads.push({ endpoint: "account.insights", payload: dailyInsights });
    rawPayloads.push({ endpoint: "account.followers", payload: followersPayload });

    const followersRecord =
      typeof followersPayload === "object" && followersPayload !== null
        ? (followersPayload as Record<string, unknown>)
        : {};
    const followersCount =
      typeof followersRecord[FOLLOWERS_COUNT_FIELD] === "number" ? followersRecord[FOLLOWERS_COUNT_FIELD] : null;

    const accountMetrics = normalizeAccountMetrics({ dailyInsights, followersCount, snapshotDate });

    return { contents, contentMetrics, accountMetrics, rawPayloads };
  }
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

async function forEachChunk<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}
