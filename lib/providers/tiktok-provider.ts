import type { ProviderKind } from "@prisma/client";
import { APP_TIMEZONE, snapshotDateFor } from "@/lib/datetime";
import { asFiniteNumber, asRecord, asString } from "./meta/json-safe";
import { TikTokClient, type TikTokClientOptions } from "./tiktok/client";
import { USER_INFO_FIELDS, USER_INFO_PATH, VIDEO_LIST_MAX_COUNT, VIDEO_LIST_PATH, VIDEO_QUERY_FIELDS, VIDEO_QUERY_PATH } from "./tiktok/api-spec";
import { extractVideoId, normalizeAccountMetrics, normalizeContentMetric, normalizeVideo } from "./tiktok/normalize";
import type {
  InsightProvider,
  ProviderAccountRef,
  ProviderContent,
  ProviderContentMetric,
  ProviderFetchResult,
  ProviderRawPayload,
} from "./types";

/**
 * Third real provider (PROMPT.md Stage 6). See lib/providers/tiktok/api-spec.ts
 * for the product-choice reasoning (TikTok for Developers Display/Content API,
 * not the Business/Marketing API) and the confidence caveat on this research.
 *
 * TikTok's OAuth model authenticates one account per token — there is no
 * separate "page id" to configure, unlike Facebook/Instagram.
 *
 * video/query's numbers are current totals (not a delta) at the moment of the
 * call, same treatment as every other provider's lifetime insights.
 */

export type TikTokProviderConfig = {
  accessToken: string;
  lookbackDays: number;
  baseUrl?: string;
  fetchImpl?: TikTokClientOptions["fetchImpl"];
  now?: () => Date;
};

const QUERY_BATCH_SIZE = VIDEO_LIST_MAX_COUNT; // no confirmed limit on video/query's id count — matches list's own confirmed cap, the safer assumption
const MAX_LIST_PAGES = 25;
const MS_PER_DAY = 86_400_000;

export class TikTokProvider implements InsightProvider {
  readonly kind: ProviderKind = "tiktok";

  private readonly config: TikTokProviderConfig;
  private readonly client: TikTokClient;
  private readonly now: () => Date;

  constructor(config: TikTokProviderConfig) {
    this.config = config;
    this.now = config.now ?? (() => new Date());
    this.client = new TikTokClient({
      accessToken: config.accessToken,
      baseUrl: config.baseUrl,
      fetchImpl: config.fetchImpl,
    });
  }

  async listAccounts(): Promise<ProviderAccountRef[]> {
    const payload = await this.client.get(USER_INFO_PATH, {
      fields: USER_INFO_FIELDS.basic.join(","),
    });
    const data = asRecord(asRecord(payload)?.data);
    const externalId = data ? asString(data.open_id) : null;
    if (!externalId) {
      throw new Error("TikTok API: user/info/ returned no open_id — check the access token is still valid.");
    }
    const name = asString(data?.display_name) ?? externalId;

    return [{ platform: "tiktok", externalId, name, timezone: APP_TIMEZONE }];
  }

  // `_account` is unused on purpose — the access token itself is scoped to
  // exactly one TikTok account, unlike Facebook/Instagram where a Page/IG id
  // says which of the token's Pages to read.
  async fetchAccountData(_account: ProviderAccountRef): Promise<ProviderFetchResult> {
    const rawPayloads: ProviderRawPayload[] = [];
    const now = this.now();
    const snapshotDate = snapshotDateFor(now);
    const since = new Date(now.getTime() - this.config.lookbackDays * MS_PER_DAY);

    // ---- list ids (basic metadata only — see UNVERIFIED.videoListFieldsScope) ----
    const idsInWindow: string[] = [];
    let cursor: number | undefined;
    for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
      const listPayload = await this.client.post(
        VIDEO_LIST_PATH,
        {},
        { max_count: VIDEO_LIST_MAX_COUNT, ...(cursor !== undefined ? { cursor } : {}) },
      );
      rawPayloads.push({ endpoint: `video.list#${page}`, payload: listPayload });

      const data = asRecord(asRecord(listPayload)?.data);
      const videos = Array.isArray(data?.videos) ? data.videos : [];
      for (const video of videos) {
        const id = extractVideoId(video);
        const createdAt = createdTimeOf(video);
        if (!id || !createdAt) continue;
        if (createdAt < since) continue;
        idsInWindow.push(id);
      }

      const hasMore = data?.has_more === true;
      const nextCursor = asFiniteNumber(data?.cursor);
      if (!hasMore || nextCursor === null) break;
      cursor = nextCursor;
    }

    // ---- query full details in batches ----
    const contents: ProviderContent[] = [];
    const contentMetrics: ProviderContentMetric[] = [];
    for (let i = 0; i < idsInWindow.length; i += QUERY_BATCH_SIZE) {
      const batch = idsInWindow.slice(i, i + QUERY_BATCH_SIZE);
      const queryPayload = await this.client.post(
        VIDEO_QUERY_PATH,
        { fields: VIDEO_QUERY_FIELDS.join(",") },
        { filters: { video_ids: batch } },
      );
      rawPayloads.push({ endpoint: `video.query#${i / QUERY_BATCH_SIZE}`, payload: queryPayload });

      const data = asRecord(asRecord(queryPayload)?.data);
      const videos = Array.isArray(data?.videos) ? data.videos : [];
      for (const video of videos) {
        const content = normalizeVideo(video, now);
        if (content) contents.push(content);
        const metric = normalizeContentMetric(video, snapshotDate);
        if (metric) contentMetrics.push(metric);
      }
    }

    // ---- account (follower count only — see normalizeAccountMetrics) ----
    const userInfoPayload = await this.client.get(USER_INFO_PATH, {
      fields: [...USER_INFO_FIELDS.basic, ...USER_INFO_FIELDS.stats].join(","),
    });
    rawPayloads.push({ endpoint: "user.info", payload: userInfoPayload });

    const userData = asRecord(asRecord(userInfoPayload)?.data);
    const followerCount = userData ? asFiniteNumber(userData.follower_count) : null;
    const accountMetrics = normalizeAccountMetrics({ followerCount, snapshotDate });

    return { contents, contentMetrics, accountMetrics, rawPayloads };
  }
}

function createdTimeOf(video: unknown): Date | null {
  const record = asRecord(video);
  const seconds = record ? asFiniteNumber(record.create_time) : null;
  return seconds === null ? null : new Date(seconds * 1000);
}
