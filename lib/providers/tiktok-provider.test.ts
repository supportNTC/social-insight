import { describe, expect, it } from "vitest";
import { TikTokProvider } from "./tiktok-provider";
import type { TikTokFetch, TikTokHttpResponse } from "./tiktok/client";

const NOW = new Date("2026-09-07T10:00:00Z");
const OPEN_ID = "open-id-1";

function ok(body: unknown): TikTokHttpResponse {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

function unixSeconds(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

function videoSummary(id: string, iso: string) {
  return { id, create_time: unixSeconds(iso) };
}

function videoDetail(id: string, iso: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    create_time: unixSeconds(iso),
    cover_image_url: `https://p.tiktokcdn.example/${id}.jpg`,
    share_url: `https://www.tiktok.com/@brand/video/${id}`,
    video_description: `video ${id}`,
    duration: 30,
    like_count: 180,
    comment_count: 54,
    share_count: 36,
    view_count: 2500,
    ...overrides,
  };
}

function fakeTikTok(): { calls: string[]; fetchImpl: TikTokFetch } {
  const calls: string[] = [];

  const fetchImpl: TikTokFetch = async (url) => {
    calls.push(url);

    if (url.includes("/video/list/")) {
      return ok({
        data: {
          videos: [videoSummary("tt_1", "2026-09-05T10:00:00Z"), videoSummary("tt_old", "2025-01-01T10:00:00Z")],
          cursor: 0,
          has_more: false,
        },
        error: { code: "ok" },
      });
    }
    if (url.includes("/video/query/")) {
      return ok({ data: { videos: [videoDetail("tt_1", "2026-09-05T10:00:00Z")] }, error: { code: "ok" } });
    }
    if (url.includes("/user/info/")) {
      return ok({
        data: { open_id: OPEN_ID, display_name: "ครัวชายทะเล", follower_count: 91_300 },
        error: { code: "ok" },
      });
    }
    throw new Error(`unexpected url: ${url}`);
  };

  return { calls, fetchImpl };
}

function makeProvider(fetchImpl: TikTokFetch) {
  return new TikTokProvider({
    accessToken: "test-token",
    lookbackDays: 90,
    baseUrl: "https://tiktok.example",
    fetchImpl,
    now: () => NOW,
  });
}

describe("TikTokProvider", () => {
  it("lists the authenticated account as one account", async () => {
    const { fetchImpl } = fakeTikTok();
    const accounts = await makeProvider(fetchImpl).listAccounts();

    expect(accounts).toEqual([
      { platform: "tiktok", externalId: OPEN_ID, name: "ครัวชายทะเล", timezone: "Asia/Bangkok" },
    ]);
  });

  it("normalizes videos inside the lookback window and drops older ones before ever querying them", async () => {
    const { calls, fetchImpl } = fakeTikTok();
    const result = await makeProvider(fetchImpl).fetchAccountData({
      platform: "tiktok",
      externalId: OPEN_ID,
      name: "ครัวชายทะเล",
      timezone: "Asia/Bangkok",
    });

    expect(result.contents.map((c) => c.externalId)).toEqual(["tt_1"]);
    expect(result.contentMetrics).toEqual([
      {
        contentExternalId: "tt_1",
        snapshotDate: "2026-09-07",
        views: 2500,
        reach: null,
        likes: 180,
        comments: 54,
        shares: 36,
        saves: null,
        avgWatchSeconds: null,
        completionRate: null,
      },
    ]);
    // tt_old never reaches video/query at all — filtered out using video/list's
    // own create_time, before spending a query call on it.
    const queryBodies = calls.filter((url) => url.includes("/video/query/"));
    expect(queryBodies).toHaveLength(1);
  });

  it("produces exactly one account_metrics_daily row with followerDelta/views/reach null", async () => {
    const { fetchImpl } = fakeTikTok();
    const result = await makeProvider(fetchImpl).fetchAccountData({
      platform: "tiktok",
      externalId: OPEN_ID,
      name: "ครัวชายทะเล",
      timezone: "Asia/Bangkok",
    });

    expect(result.accountMetrics).toEqual([
      { snapshotDate: "2026-09-07", followers: 91_300, followerDelta: null, views: null, reach: null },
    ]);
  });

  it("keeps every response verbatim for raw_payloads", async () => {
    const { fetchImpl } = fakeTikTok();
    const result = await makeProvider(fetchImpl).fetchAccountData({
      platform: "tiktok",
      externalId: OPEN_ID,
      name: "ครัวชายทะเล",
      timezone: "Asia/Bangkok",
    });

    const endpoints = result.rawPayloads.map((p) => p.endpoint);
    expect(endpoints).toContain("video.list#0");
    expect(endpoints).toContain("video.query#0");
    expect(endpoints).toContain("user.info");
  });

  it("follows the list cursor across pages", async () => {
    const calls: string[] = [];
    let page = 0;
    const fetchImpl: TikTokFetch = async (url, init) => {
      calls.push(url);
      if (url.includes("/video/list/")) {
        page += 1;
        const body = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
        if (page === 1) {
          expect(body.cursor).toBeUndefined();
          return ok({ data: { videos: [videoSummary("tt_a", "2026-09-05T10:00:00Z")], cursor: 111, has_more: true }, error: { code: "ok" } });
        }
        expect(body.cursor).toBe(111);
        return ok({ data: { videos: [videoSummary("tt_b", "2026-09-05T10:00:00Z")], cursor: 0, has_more: false }, error: { code: "ok" } });
      }
      if (url.includes("/video/query/")) {
        return ok({ data: { videos: [videoDetail("tt_a", "2026-09-05T10:00:00Z"), videoDetail("tt_b", "2026-09-05T10:00:00Z")] }, error: { code: "ok" } });
      }
      return ok({ data: { open_id: OPEN_ID, follower_count: 1000 }, error: { code: "ok" } });
    };

    const result = await makeProvider(fetchImpl).fetchAccountData({
      platform: "tiktok",
      externalId: OPEN_ID,
      name: "ครัวชายทะเล",
      timezone: "Asia/Bangkok",
    });

    expect(page).toBe(2);
    expect(result.contents.map((c) => c.externalId).sort()).toEqual(["tt_a", "tt_b"]);
  });
});
