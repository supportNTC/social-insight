import type { ProviderKind } from "@prisma/client";
import { APP_TIMEZONE } from "@/lib/datetime";
import {
  PAGE_METRICS,
  POST_FIELDS,
  POST_FIELDS_UNVERIFIED,
  POST_METRICS,
  PUBLISHED_POSTS_EDGE,
  PUBLISHED_POSTS_MAX_LIMIT,
} from "./facebook/api-spec";
import { GraphClient, type GraphClientOptions } from "./facebook/graph-client";
import {
  normalizeAccountMetrics,
  normalizeContentMetric,
  normalizePost,
  snapshotDateOf,
} from "./facebook/normalize";
import type {
  InsightProvider,
  ProviderAccountMetric,
  ProviderAccountRef,
  ProviderContent,
  ProviderContentMetric,
  ProviderFetchResult,
  ProviderRawPayload,
} from "./types";

/**
 * The first real provider (PROMPT.md Stage 6). Two things about it are
 * deliberate:
 *
 *   * It is only reachable through INSIGHT_PROVIDER=facebook. The default stays
 *     "mock", and nothing in stages 1-5 may require a credential to run
 *     (CLAUDE.md rule 2).
 *   * Every Graph string it sends comes from lib/providers/facebook/api-spec.ts,
 *     which records the doc page and date each one was verified. Details the
 *     docs did not confirm raise UnverifiedApiDetailError instead of being
 *     guessed — see UNVERIFIED there for the open questions.
 *
 * Post insights are LIFETIME totals as of the moment of the call, which is
 * exactly the cumulative daily snapshot our schema wants: one sync per day
 * builds the history, and no backfill of past days is possible for content.
 * Page-level metrics are per-day and CAN be backfilled with since/until.
 */

export type FacebookProviderConfig = {
  pageId: string;
  accessToken: string;
  /** How far back to walk the post list on each sync. */
  lookbackDays: number;
  graphVersion?: string;
  /** Test seam — a fake transport stands in for the network. */
  fetchImpl?: GraphClientOptions["fetchImpl"];
  baseUrl?: string;
  /** Injected in tests so "now" is not the wall clock. */
  now?: () => Date;
};

const POST_METRIC_LIST = [
  POST_METRICS.views,
  POST_METRICS.reach,
  POST_METRICS.reactionsByType,
  POST_METRICS.videoViews,
  POST_METRICS.videoViewTime,
].join(",");

const PAGE_METRIC_LIST = [PAGE_METRICS.followers, PAGE_METRICS.views, PAGE_METRICS.reach].join(",");

const POST_INSIGHT_CONCURRENCY = 5;
const MS_PER_DAY = 86_400_000;

export class FacebookProvider implements InsightProvider {
  readonly kind: ProviderKind = "facebook";

  private readonly config: FacebookProviderConfig;
  private readonly client: GraphClient;
  private readonly now: () => Date;

  constructor(config: FacebookProviderConfig) {
    this.config = config;
    this.now = config.now ?? (() => new Date());
    this.client = new GraphClient({
      accessToken: config.accessToken,
      version: config.graphVersion,
      baseUrl: config.baseUrl,
      fetchImpl: config.fetchImpl,
    });
  }

  /**
   * One page per configured token. Listing every page a user administers would
   * need a different edge and permission set than the one this token is scoped
   * to, so Stage 6 stays with the single page named in the environment.
   */
  async listAccounts(): Promise<ProviderAccountRef[]> {
    const payload = await this.client.get(this.config.pageId, { fields: "id,name" });
    const page = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};

    const externalId = typeof page.id === "string" ? page.id : this.config.pageId;
    const name = typeof page.name === "string" ? page.name : externalId;

    return [
      {
        platform: "facebook",
        externalId,
        // The Page node's own timezone field is not confirmed, and every
        // snapshot_date in this app is an Asia/Bangkok day regardless.
        name,
        timezone: APP_TIMEZONE,
      },
    ];
  }

  async fetchAccountData(account: ProviderAccountRef): Promise<ProviderFetchResult> {
    const rawPayloads: ProviderRawPayload[] = [];
    const now = this.now();
    const snapshotDate = snapshotDateOf(now);
    const since = new Date(now.getTime() - this.config.lookbackDays * MS_PER_DAY);

    // ---- posts ----
    const postPages = await this.client.getAllPages(`${account.externalId}/${PUBLISHED_POSTS_EDGE}`, {
      fields: [...POST_FIELDS, ...POST_FIELDS_UNVERIFIED].join(","),
      limit: PUBLISHED_POSTS_MAX_LIMIT,
    });

    const rawPosts: unknown[] = [];
    for (const [index, page] of postPages.entries()) {
      rawPayloads.push({ endpoint: `${PUBLISHED_POSTS_EDGE}#${index}`, payload: page.raw });
      rawPosts.push(...page.data);
    }

    const contents: ProviderContent[] = [];
    const postsInWindow: unknown[] = [];
    for (const raw of rawPosts) {
      const content = normalizePost(raw);
      if (!content) continue;
      if (content.publishedAt < since) continue;
      contents.push(content);
      postsInWindow.push(raw);
    }

    // ---- per-post insights ----
    const contentMetrics: ProviderContentMetric[] = [];
    await forEachChunk(postsInWindow, POST_INSIGHT_CONCURRENCY, async (raw) => {
      const post = raw as Record<string, unknown>;
      const postId = typeof post.id === "string" ? post.id : null;
      if (!postId) return;

      const insights = await this.client.get(`${postId}/insights`, { metric: POST_METRIC_LIST });
      rawPayloads.push({ endpoint: `post.insights:${postId}`, payload: insights });

      const metric = normalizeContentMetric({ post: raw, insights, snapshotDate });
      if (metric) contentMetrics.push(metric);
    });

    // ---- page-level daily metrics ----
    const pageInsights = await this.client.get(`${account.externalId}/insights`, {
      metric: PAGE_METRIC_LIST,
      period: "day",
      since: toUnixSeconds(since),
      until: toUnixSeconds(now),
    });
    rawPayloads.push({ endpoint: "page.insights", payload: pageInsights });

    const accountMetrics: ProviderAccountMetric[] = normalizeAccountMetrics(pageInsights);

    return { contents, contentMetrics, accountMetrics, rawPayloads };
  }
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** Bounded concurrency — the Graph API is rate limited per app, not per call. */
async function forEachChunk<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}
