import { describe, expect, it } from "vitest";
import { UnverifiedApiDetailError } from "./api-spec";
import {
  isSupportedProductType,
  normalizeAccountMetrics,
  normalizeContentMetric,
  normalizeMedia,
  normalizeMediaKind,
} from "./normalize";

function mediaFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "ig_1",
    caption: "แนะนำเมนูใหม่",
    media_type: "IMAGE",
    media_product_type: "FEED",
    timestamp: "2026-09-05T10:30:00+0000",
    permalink: "https://www.instagram.com/p/ig_1/",
    thumbnail_url: null,
    media_url: "https://scontent.example/ig_1.jpg",
    like_count: 40,
    comments_count: 3,
    ...overrides,
  };
}

function insightsFixture(entries: { name: string; value: unknown }[]): unknown {
  return { data: entries.map((e) => ({ name: e.name, period: "lifetime", values: [{ value: e.value }] })) };
}

describe("isSupportedProductType", () => {
  it("accepts FEED and REELS, rejects STORY and AD", () => {
    expect(isSupportedProductType("FEED")).toBe(true);
    expect(isSupportedProductType("REELS")).toBe(true);
    expect(isSupportedProductType("STORY")).toBe(false);
    expect(isSupportedProductType("AD")).toBe(false);
  });
});

describe("normalizeMediaKind", () => {
  it("maps the confirmed media_type values", () => {
    expect(normalizeMediaKind("CAROUSEL_ALBUM", "FEED")).toBe("carousel");
    expect(normalizeMediaKind("IMAGE", "FEED")).toBe("image");
    expect(normalizeMediaKind("VIDEO", "FEED")).toBe("video");
  });

  it("treats media_product_type=REELS as a reel regardless of media_type", () => {
    expect(normalizeMediaKind("VIDEO", "REELS")).toBe("reel");
  });

  it("refuses to guess an unlisted media_type", () => {
    expect(() => normalizeMediaKind("GIF", "FEED")).toThrow(UnverifiedApiDetailError);
  });
});

describe("normalizeMedia", () => {
  it("maps the documented IG Media fields", () => {
    const content = normalizeMedia(mediaFixture());
    expect(content).not.toBeNull();
    expect(content?.externalId).toBe("ig_1");
    expect(content?.kind).toBe("image");
    expect(content?.caption).toBe("แนะนำเมนูใหม่");
    expect(content?.publishedAt.toISOString()).toBe("2026-09-05T10:30:00.000Z");
  });

  it("falls back to media_url when thumbnail_url is absent (documented as video-only)", () => {
    const content = normalizeMedia(mediaFixture());
    expect(content?.thumbnailUrl).toBe("https://scontent.example/ig_1.jpg");
  });

  it("prefers thumbnail_url when present", () => {
    const content = normalizeMedia(mediaFixture({ thumbnail_url: "https://scontent.example/thumb.jpg" }));
    expect(content?.thumbnailUrl).toBe("https://scontent.example/thumb.jpg");
  });

  it("filters out STORY and AD media — out of scope, not a guess", () => {
    expect(normalizeMedia(mediaFixture({ media_product_type: "STORY" }))).toBeNull();
    expect(normalizeMedia(mediaFixture({ media_product_type: "AD" }))).toBeNull();
  });

  it("returns null for a payload missing required fields", () => {
    expect(normalizeMedia(null)).toBeNull();
    expect(normalizeMedia(mediaFixture({ timestamp: undefined }))).toBeNull();
    expect(normalizeMedia(mediaFixture({ timestamp: "not a date" }))).toBeNull();
  });

  it("leaves duration null — not confirmed readable on IG Media", () => {
    expect(normalizeMedia(mediaFixture())?.durationSeconds).toBeNull();
  });
});

describe("normalizeContentMetric", () => {
  it("builds one cumulative snapshot from a media item plus its insights", () => {
    const metric = normalizeContentMetric({
      media: mediaFixture(),
      insights: insightsFixture([
        { name: "views", value: 1500 },
        { name: "reach", value: 900 },
        { name: "saved", value: 5 },
        { name: "shares", value: 2 },
      ]),
      snapshotDate: "2026-09-07",
    });

    expect(metric).toEqual({
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

  it("returns null (not a row of zeros) when views is not yet available", () => {
    const metric = normalizeContentMetric({
      media: mediaFixture(),
      insights: insightsFixture([]),
      snapshotDate: "2026-09-07",
    });
    expect(metric).toBeNull();
  });

  it("reads ig_reels_avg_watch_time for a reel", () => {
    const metric = normalizeContentMetric({
      media: mediaFixture({ media_product_type: "REELS", media_type: "VIDEO" }),
      insights: insightsFixture([
        { name: "views", value: 1500 },
        { name: "reach", value: 900 },
        { name: "saved", value: 5 },
        { name: "shares", value: 2 },
        { name: "ig_reels_avg_watch_time", value: 12.5 },
      ]),
      snapshotDate: "2026-09-07",
    });
    expect(metric?.avgWatchSeconds).toBe(12.5);
  });
});

describe("normalizeAccountMetrics", () => {
  const dailyInsights = insightsFixture([
    { name: "reach", value: 900 },
    { name: "views", value: 1500 },
  ]);

  it("produces exactly one row (today) with followerDelta always null", () => {
    const rows = normalizeAccountMetrics({ dailyInsights, followersCount: 62_500, snapshotDate: "2026-09-07" });
    expect(rows).toEqual([
      { snapshotDate: "2026-09-07", followers: 62_500, followerDelta: null, views: 1500, reach: 900 },
    ]);
  });

  it("produces no row when followers_count is unavailable — NOT NULL in the schema", () => {
    expect(normalizeAccountMetrics({ dailyInsights, followersCount: null, snapshotDate: "2026-09-07" })).toEqual([]);
  });
});
