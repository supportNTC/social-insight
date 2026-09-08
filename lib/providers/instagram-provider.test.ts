import { describe, expect, it } from "vitest";
import { InstagramProvider } from "./instagram-provider";
import type { GraphFetch, GraphHttpResponse } from "./meta/graph-client";

const PAGE_ID = "111";
const IG_ID = "17841400000000000";
const NOW = new Date("2026-09-07T10:00:00Z");

function json(body: unknown): GraphHttpResponse {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

function media(id: string, timestamp: string, productType: "FEED" | "REELS" = "FEED") {
  return {
    id,
    caption: `media ${id}`,
    media_type: "IMAGE",
    media_product_type: productType,
    timestamp,
    permalink: `https://www.instagram.com/p/${id}/`,
    thumbnail_url: null,
    media_url: `https://scontent.example/${id}.jpg`,
    like_count: 40,
    comments_count: 3,
  };
}

function mediaInsights(views: number, reach: number, saved: number, shares: number) {
  return {
    data: [
      { name: "views", period: "lifetime", values: [{ value: views }] },
      { name: "reach", period: "lifetime", values: [{ value: reach }] },
      { name: "saved", period: "lifetime", values: [{ value: saved }] },
      { name: "shares", period: "lifetime", values: [{ value: shares }] },
    ],
  };
}

const ACCOUNT_INSIGHTS = {
  data: [
    { name: "reach", period: "day", values: [{ value: 900, end_time: "2026-09-07T07:00:00+0000" }] },
    { name: "views", period: "day", values: [{ value: 1500, end_time: "2026-09-07T07:00:00+0000" }] },
  ],
};

function fakeGraph(): { calls: string[]; fetchImpl: GraphFetch } {
  const calls: string[] = [];

  const fetchImpl: GraphFetch = async (url) => {
    calls.push(url);

    if (url.includes(`${PAGE_ID}?`) && url.includes("instagram_business_account")) {
      return json({ instagram_business_account: { id: IG_ID, username: "kruachaithale" } });
    }
    if (url.includes(`/${IG_ID}/media`)) {
      return json({
        data: [
          media("ig_1", "2026-09-05T10:00:00+0000"),
          // Older than the 90-day lookback below — must be dropped.
          media("ig_old", "2025-01-01T10:00:00+0000"),
          // A story — out of scope regardless of age (no ContentKind for it).
          media("ig_story", "2026-09-06T10:00:00+0000", "FEED"),
        ],
      });
    }
    if (url.includes("ig_1/insights")) return json(mediaInsights(1500, 900, 5, 2));
    if (url.includes("ig_old/insights")) return json(mediaInsights(10, 5, 0, 0));
    if (url.includes("ig_story/insights")) return json(mediaInsights(100, 50, 1, 0));
    if (url.includes(`${IG_ID}/insights`)) return json(ACCOUNT_INSIGHTS);
    if (url.includes(`${IG_ID}?`) && url.includes("followers_count")) {
      return json({ followers_count: 62_500 });
    }
    return json({});
  };

  return { calls, fetchImpl };
}

function makeProvider(fetchImpl: GraphFetch) {
  return new InstagramProvider({
    pageId: PAGE_ID,
    accessToken: "test-token",
    lookbackDays: 90,
    baseUrl: "https://graph.example",
    fetchImpl,
    now: () => NOW,
  });
}

describe("InstagramProvider", () => {
  it("resolves the Page's connected Instagram Business Account as one account", async () => {
    const { fetchImpl } = fakeGraph();
    const accounts = await makeProvider(fetchImpl).listAccounts();

    expect(accounts).toEqual([
      { platform: "instagram", externalId: IG_ID, name: "kruachaithale", timezone: "Asia/Bangkok" },
    ]);
  });

  it("throws a clear error when the Page has no connected Instagram account", async () => {
    const fetchImpl: GraphFetch = async () => json({});
    await expect(makeProvider(fetchImpl).listAccounts()).rejects.toThrow(/no connected Instagram/);
  });

  it("normalizes FEED media, drops STORY-shaped and out-of-window items", async () => {
    const { fetchImpl } = fakeGraph();
    const result = await makeProvider(fetchImpl).fetchAccountData({
      platform: "instagram",
      externalId: IG_ID,
      name: "kruachaithale",
      timezone: "Asia/Bangkok",
    });

    expect(result.contents.map((c) => c.externalId).sort()).toEqual(["ig_1", "ig_story"]);
    const ig1Metric = result.contentMetrics.find((m) => m.contentExternalId === "ig_1");
    expect(ig1Metric).toEqual({
      contentExternalId: "ig_1",
      snapshotDate: "2026-09-07",
      views: 1500,
      reach: 900,
      likes: 40,
      comments: 3,
      shares: 2,
      saves: 5,
      avgWatchSeconds: null,
      completionRate: null,
    });
  });

  it("does not fetch insights for media outside the lookback window", async () => {
    const { calls, fetchImpl } = fakeGraph();
    await makeProvider(fetchImpl).fetchAccountData({
      platform: "instagram",
      externalId: IG_ID,
      name: "kruachaithale",
      timezone: "Asia/Bangkok",
    });

    expect(calls.some((url) => url.includes("ig_old/insights"))).toBe(false);
  });

  it("produces exactly one account_metrics_daily row (today), with followerDelta null", async () => {
    const { fetchImpl } = fakeGraph();
    const result = await makeProvider(fetchImpl).fetchAccountData({
      platform: "instagram",
      externalId: IG_ID,
      name: "kruachaithale",
      timezone: "Asia/Bangkok",
    });

    expect(result.accountMetrics).toEqual([
      { snapshotDate: "2026-09-07", followers: 62_500, followerDelta: null, views: 1500, reach: 900 },
    ]);
  });

  it("keeps every response verbatim for raw_payloads", async () => {
    const { fetchImpl } = fakeGraph();
    const result = await makeProvider(fetchImpl).fetchAccountData({
      platform: "instagram",
      externalId: IG_ID,
      name: "kruachaithale",
      timezone: "Asia/Bangkok",
    });

    const endpoints = result.rawPayloads.map((p) => p.endpoint);
    expect(endpoints).toContain("media#0");
    expect(endpoints).toContain("media.insights:ig_1");
    expect(endpoints).toContain("account.insights");
    expect(endpoints).toContain("account.followers");
  });
});
