import { describe, expect, it } from "vitest";
import { extractVideoId, normalizeAccountMetrics, normalizeContentMetric, normalizeVideo } from "./normalize";

const NOW = new Date("2026-09-07T10:00:00Z");

function videoFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "tt_1",
    create_time: Math.floor(new Date("2026-09-05T10:30:00Z").getTime() / 1000),
    cover_image_url: "https://p.tiktokcdn.example/cover.jpg",
    share_url: "https://www.tiktok.com/@brand/video/tt_1",
    video_description: "เมนูพิเศษประจำสัปดาห์",
    duration: 32,
    like_count: 180,
    comment_count: 54,
    share_count: 36,
    view_count: 2500,
    ...overrides,
  };
}

describe("extractVideoId", () => {
  it("reads the id from a video-shaped payload", () => {
    expect(extractVideoId(videoFixture())).toBe("tt_1");
  });

  it("returns null for an unusable payload", () => {
    expect(extractVideoId(null)).toBeNull();
    expect(extractVideoId({})).toBeNull();
  });
});

describe("normalizeVideo", () => {
  it("maps the confirmed video/query fields", () => {
    const content = normalizeVideo(videoFixture(), NOW);
    expect(content).toEqual({
      externalId: "tt_1",
      kind: "video",
      caption: "เมนูพิเศษประจำสัปดาห์",
      publishedAt: new Date("2026-09-05T10:30:00Z"),
      permalink: "https://www.tiktok.com/@brand/video/tt_1",
      thumbnailUrl: "https://p.tiktokcdn.example/cover.jpg",
      durationSeconds: 32,
      tags: [],
    });
  });

  it("returns null for a payload missing required fields", () => {
    expect(normalizeVideo(null, NOW)).toBeNull();
    expect(normalizeVideo(videoFixture({ id: undefined }), NOW)).toBeNull();
    expect(normalizeVideo(videoFixture({ create_time: undefined }), NOW)).toBeNull();
  });

  it("throws rather than silently storing an implausible date if create_time turns out not to be seconds", () => {
    // A real Unix-ms timestamp, fed in as if it were seconds, lands tens of
    // thousands of years away — exactly the case the sanity check exists for.
    const msTimestamp = new Date("2026-09-05T10:30:00Z").getTime();
    expect(() => normalizeVideo(videoFixture({ create_time: msTimestamp }), NOW)).toThrow(/implausibly far/);
  });
});

describe("normalizeContentMetric", () => {
  it("builds one cumulative-as-of-now snapshot", () => {
    const metric = normalizeContentMetric(videoFixture(), "2026-09-07");
    expect(metric).toEqual({
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
    });
  });

  it("returns null (not a row of zeros) when a required counter is missing", () => {
    expect(normalizeContentMetric(videoFixture({ view_count: undefined }), "2026-09-07")).toBeNull();
  });
});

describe("normalizeAccountMetrics", () => {
  it("produces exactly one row (today), with followerDelta/views/reach null", () => {
    expect(normalizeAccountMetrics({ followerCount: 91_300, snapshotDate: "2026-09-07" })).toEqual([
      { snapshotDate: "2026-09-07", followers: 91_300, followerDelta: null, views: null, reach: null },
    ]);
  });

  it("produces no row when follower_count is unavailable — NOT NULL in the schema", () => {
    expect(normalizeAccountMetrics({ followerCount: null, snapshotDate: "2026-09-07" })).toEqual([]);
  });
});
