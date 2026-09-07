import { describe, expect, it } from "vitest";
import { UnverifiedApiDetailError } from "./api-spec";
import {
  latestNumber,
  normalizeAccountMetrics,
  normalizeContentKind,
  normalizeContentMetric,
  normalizePost,
  parseInsights,
  readCommentCount,
  readShareCount,
  sumReactions,
} from "./normalize";

/** Shaped like a Graph published_posts entry with the documented fields. */
function postFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "123_456",
    message: "เมนูพิเศษประจำสัปดาห์",
    created_time: "2026-09-05T10:30:00+0000",
    permalink_url: "https://www.facebook.com/123/posts/456",
    full_picture: "https://scontent.example/full.jpg",
    attachments: { data: [{ type: "video", media_type: "video" }] },
    comments: { summary: { total_count: 12 } },
    shares: { count: 4 },
    ...overrides,
  };
}

function insightsFixture(entries: { name: string; value: unknown; end_time?: string }[]): unknown {
  return {
    data: entries.map((e) => ({
      name: e.name,
      period: "lifetime",
      values: [{ value: e.value, ...(e.end_time ? { end_time: e.end_time } : {}) }],
    })),
  };
}

describe("normalizePost", () => {
  it("maps the documented Page Post fields", () => {
    const content = normalizePost(postFixture());

    expect(content).not.toBeNull();
    expect(content?.externalId).toBe("123_456");
    expect(content?.caption).toBe("เมนูพิเศษประจำสัปดาห์");
    expect(content?.permalink).toBe("https://www.facebook.com/123/posts/456");
    expect(content?.thumbnailUrl).toBe("https://scontent.example/full.jpg");
    expect(content?.publishedAt.toISOString()).toBe("2026-09-05T10:30:00.000Z");
  });

  it("keeps a missing caption as null rather than an empty string", () => {
    const content = normalizePost(postFixture({ message: undefined }));
    expect(content?.caption).toBeNull();
  });

  it("leaves duration null — it is not confirmed to be readable from a post attachment", () => {
    expect(normalizePost(postFixture())?.durationSeconds).toBeNull();
  });

  it("returns null for a payload that is not a usable post", () => {
    expect(normalizePost(null)).toBeNull();
    expect(normalizePost({ id: "1" })).toBeNull();
    expect(normalizePost(postFixture({ created_time: "not a date" }))).toBeNull();
  });
});

describe("normalizeContentKind", () => {
  it("maps the documented StoryAttachment.type values", () => {
    expect(normalizeContentKind(postFixture())).toBe("video");
    expect(normalizeContentKind(postFixture({ attachments: { data: [{ type: "photo" }] } }))).toBe("image");
    expect(normalizeContentKind(postFixture({ attachments: { data: [{ type: "album" }] } }))).toBe("carousel");
  });

  it("treats an attachment-less status as an image post", () => {
    expect(normalizeContentKind(postFixture({ attachments: undefined }))).toBe("image");
  });

  it("refuses to guess a type the docs do not list", () => {
    // The reference ends its value list with "etc." — an unknown value has to
    // become a question, not a silently mis-filed content kind.
    expect(() => normalizeContentKind(postFixture({ attachments: { data: [{ type: "reel" }] } }))).toThrow(
      UnverifiedApiDetailError,
    );
  });
});

describe("parseInsights / latestNumber", () => {
  it("reads the latest numeric value of a metric", () => {
    const insights = parseInsights({
      data: [{ name: "post_media_view", values: [{ value: 10 }, { value: 42 }] }],
    });
    expect(latestNumber(insights, "post_media_view")).toBe(42);
  });

  it("returns null for an absent metric instead of 0", () => {
    const insights = parseInsights(insightsFixture([{ name: "post_media_view", value: 5 }]));
    expect(latestNumber(insights, "post_total_media_view_unique")).toBeNull();
  });

  it("ignores malformed envelopes rather than throwing", () => {
    expect(parseInsights(null).size).toBe(0);
    expect(parseInsights({ data: "nope" }).size).toBe(0);
    expect(latestNumber(parseInsights({ data: [{ name: "m", values: [{ value: "12" }] }] }), "m")).toBeNull();
  });
});

describe("sumReactions", () => {
  it("sums every reaction type, not just likes", () => {
    const insights = parseInsights(
      insightsFixture([{ name: "post_reactions_by_type_total", value: { like: 10, love: 3, wow: 2 } }]),
    );
    expect(sumReactions(insights)).toBe(15);
  });

  it("accepts a plain number if the metric ever returns one", () => {
    const insights = parseInsights(insightsFixture([{ name: "post_reactions_by_type_total", value: 7 }]));
    expect(sumReactions(insights)).toBe(7);
  });

  it("returns null when the metric is missing", () => {
    expect(sumReactions(parseInsights(insightsFixture([])))).toBeNull();
  });
});

describe("readCommentCount / readShareCount", () => {
  it("reads the summary totals when present", () => {
    expect(readCommentCount(postFixture())).toBe(12);
    expect(readShareCount(postFixture())).toBe(4);
  });

  it("raises instead of assuming 0 when the field expansion is absent", () => {
    expect(() => readCommentCount(postFixture({ comments: undefined }))).toThrow(UnverifiedApiDetailError);
    expect(() => readShareCount(postFixture({ shares: undefined }))).toThrow(UnverifiedApiDetailError);
  });
});

describe("normalizeContentMetric", () => {
  const insights = insightsFixture([
    { name: "post_media_view", value: 1500 },
    { name: "post_total_media_view_unique", value: 900 },
    { name: "post_reactions_by_type_total", value: { like: 40, love: 10 } },
  ]);

  it("builds one cumulative snapshot from a post plus its insights", () => {
    const metric = normalizeContentMetric({
      post: postFixture(),
      insights,
      snapshotDate: "2026-09-07",
    });

    expect(metric).toEqual({
      contentExternalId: "123_456",
      snapshotDate: "2026-09-07",
      views: 1500,
      reach: 900,
      likes: 50,
      comments: 12,
      shares: 4,
      saves: null,
      avgWatchSeconds: null,
      completionRate: null,
    });
  });

  it("keeps reach null when the metric is absent — TikTok is not the only source that omits it", () => {
    const metric = normalizeContentMetric({
      post: postFixture(),
      insights: insightsFixture([
        { name: "post_media_view", value: 1500 },
        { name: "post_reactions_by_type_total", value: { like: 1 } },
      ]),
      snapshotDate: "2026-09-07",
    });
    expect(metric?.reach).toBeNull();
    expect(metric?.views).toBe(1500);
  });

  it("writes nothing at all when a mandatory counter is missing", () => {
    const metric = normalizeContentMetric({
      post: postFixture(),
      insights: insightsFixture([{ name: "post_total_media_view_unique", value: 900 }]),
      snapshotDate: "2026-09-07",
    });
    expect(metric).toBeNull();
  });
});

describe("normalizeAccountMetrics", () => {
  const pageInsights = {
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
        values: [
          { value: 1200, end_time: "2026-09-06T07:00:00+0000" },
          { value: 1500, end_time: "2026-09-07T07:00:00+0000" },
        ],
      },
      {
        name: "page_total_media_view_unique",
        period: "day",
        values: [{ value: 800, end_time: "2026-09-07T07:00:00+0000" }],
      },
    ],
  };

  it("produces one row per day with a derived follower delta", () => {
    const rows = normalizeAccountMetrics(pageInsights);

    expect(rows).toHaveLength(2);
    // end_time closes the window, so the row belongs to the day before it.
    expect(rows[0]).toEqual({
      snapshotDate: "2026-09-06",
      followers: 46_000,
      followerDelta: null,
      views: 1200,
      reach: null,
    });
    expect(rows[1]).toEqual({
      snapshotDate: "2026-09-07",
      followers: 46_030,
      followerDelta: 30,
      views: 1500,
      reach: 800,
    });
  });

  it("skips a day with no follower number instead of writing 0 followers", () => {
    const rows = normalizeAccountMetrics({
      data: [
        {
          name: "page_media_view",
          period: "day",
          values: [{ value: 1200, end_time: "2026-09-06T07:00:00+0000" }],
        },
      ],
    });
    expect(rows).toEqual([]);
  });

  it("returns nothing for an empty or malformed payload", () => {
    expect(normalizeAccountMetrics(null)).toEqual([]);
    expect(normalizeAccountMetrics({ data: [] })).toEqual([]);
  });
});
