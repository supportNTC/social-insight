import { describe, expect, it } from "vitest";
import { FacebookProvider } from "./facebook-provider";
import type { GraphFetch, GraphHttpResponse } from "./facebook/graph-client";
import { DEPRECATED_METRICS } from "./facebook/api-spec";

/**
 * The whole provider, driven by recorded Graph payloads. No credential, no
 * network — CLAUDE.md rule 2 applies to tests too: everything must run on a
 * clean checkout with INSIGHT_PROVIDER=mock.
 */

const PAGE_ID = "111";
const NOW = new Date("2026-09-07T10:00:00Z");

function json(body: unknown): GraphHttpResponse {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

function post(id: string, createdTime: string) {
  return {
    id,
    message: `post ${id}`,
    created_time: createdTime,
    permalink_url: `https://www.facebook.com/${id}`,
    full_picture: "https://scontent.example/p.jpg",
    attachments: { data: [{ type: "photo", media_type: "photo" }] },
    comments: { summary: { total_count: 3 } },
    shares: { count: 1 },
  };
}

function postInsights(views: number, reach: number, likes: number) {
  return {
    data: [
      { name: "post_media_view", period: "lifetime", values: [{ value: views }] },
      { name: "post_total_media_view_unique", period: "lifetime", values: [{ value: reach }] },
      { name: "post_reactions_by_type_total", period: "lifetime", values: [{ value: { like: likes } }] },
    ],
  };
}

const PAGE_INSIGHTS = {
  data: [
    {
      name: "page_follows",
      period: "day",
      values: [
        { value: 46_000, end_time: "2026-09-06T07:00:00+0000" },
        { value: 46_030, end_time: "2026-09-07T07:00:00+0000" },
      ],
    },
    {
      name: "page_media_view",
      period: "day",
      values: [{ value: 1500, end_time: "2026-09-07T07:00:00+0000" }],
    },
  ],
};

/** Routes by URL so the provider's call order does not have to be hard-coded. */
function fakeGraph(): { calls: string[]; fetchImpl: GraphFetch } {
  const calls: string[] = [];

  const fetchImpl: GraphFetch = async (url) => {
    calls.push(url);

    if (url.includes("/published_posts")) {
      return json({
        data: [
          post("111_1", "2026-09-05T10:00:00+0000"),
          // Older than the 90-day lookback below — must be dropped.
          post("111_old", "2025-01-01T10:00:00+0000"),
        ],
      });
    }
    if (url.includes("111_1/insights")) return json(postInsights(1500, 900, 40));
    if (url.includes("111_old/insights")) return json(postInsights(10, 5, 1));
    if (url.includes(`${PAGE_ID}/insights`)) return json(PAGE_INSIGHTS);
    return json({ id: PAGE_ID, name: "ครัวชายทะเล" });
  };

  return { calls, fetchImpl };
}

function makeProvider(fetchImpl: GraphFetch) {
  return new FacebookProvider({
    pageId: PAGE_ID,
    accessToken: "test-token",
    lookbackDays: 90,
    baseUrl: "https://graph.example",
    fetchImpl,
    now: () => NOW,
  });
}

describe("FacebookProvider", () => {
  it("lists the configured page as one account", async () => {
    const { fetchImpl } = fakeGraph();
    const accounts = await makeProvider(fetchImpl).listAccounts();

    expect(accounts).toEqual([
      { platform: "facebook", externalId: PAGE_ID, name: "ครัวชายทะเล", timezone: "Asia/Bangkok" },
    ]);
  });

  it("normalizes posts, per-post insights and page metrics in one pass", async () => {
    const { fetchImpl } = fakeGraph();
    const result = await makeProvider(fetchImpl).fetchAccountData({
      platform: "facebook",
      externalId: PAGE_ID,
      name: "ครัวชายทะเล",
      timezone: "Asia/Bangkok",
    });

    expect(result.contents.map((c) => c.externalId)).toEqual(["111_1"]);
    expect(result.contentMetrics).toEqual([
      {
        contentExternalId: "111_1",
        // Post insights are lifetime totals "as of now", so the snapshot is
        // today's Bangkok day — that is what makes the daily series cumulative.
        snapshotDate: "2026-09-07",
        views: 1500,
        reach: 900,
        likes: 40,
        comments: 3,
        shares: 1,
        saves: null,
        avgWatchSeconds: null,
        completionRate: null,
      },
    ]);
    expect(result.accountMetrics).toHaveLength(2);
    expect(result.accountMetrics[1]).toMatchObject({ snapshotDate: "2026-09-07", followers: 46_030, followerDelta: 30 });
  });

  it("does not fetch insights for posts outside the lookback window", async () => {
    const { calls, fetchImpl } = fakeGraph();
    await makeProvider(fetchImpl).fetchAccountData({
      platform: "facebook",
      externalId: PAGE_ID,
      name: "ครัวชายทะเล",
      timezone: "Asia/Bangkok",
    });

    expect(calls.some((url) => url.includes("111_old/insights"))).toBe(false);
  });

  it("keeps every response verbatim for raw_payloads", async () => {
    const { fetchImpl } = fakeGraph();
    const result = await makeProvider(fetchImpl).fetchAccountData({
      platform: "facebook",
      externalId: PAGE_ID,
      name: "ครัวชายทะเล",
      timezone: "Asia/Bangkok",
    });

    const endpoints = result.rawPayloads.map((p) => p.endpoint);
    expect(endpoints).toContain("published_posts#0");
    expect(endpoints).toContain("post.insights:111_1");
    expect(endpoints).toContain("page.insights");
    // PROMPT.md rule 3: normalization must be replayable from these alone.
    expect(result.rawPayloads.find((p) => p.endpoint === "page.insights")?.payload).toEqual(PAGE_INSIGHTS);
  });

  it("requests only metric names that are not deprecated", async () => {
    const { calls, fetchImpl } = fakeGraph();
    await makeProvider(fetchImpl).fetchAccountData({
      platform: "facebook",
      externalId: PAGE_ID,
      name: "ครัวชายทะเล",
      timezone: "Asia/Bangkok",
    });

    const requested = calls
      .flatMap((url) => new URL(url).searchParams.get("metric")?.split(",") ?? [])
      .map((m) => m.trim());

    expect(requested.length).toBeGreaterThan(0);
    for (const metric of requested) {
      // A removed metric returns an "invalid metric" error, not data — and the
      // replacements moved twice in 2025 alone.
      expect(DEPRECATED_METRICS[metric]).toBeUndefined();
    }
  });
});
