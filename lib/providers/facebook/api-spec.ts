/**
 * Every Graph API string this provider sends lives here — endpoints, fields,
 * metric names — with the doc page each one came from and the date it was
 * checked. Nothing in this file may be written from memory (CLAUDE.md rule 1):
 * Meta renames and removes Page Insights metrics on a published schedule, and
 * a wrong metric name does not fail loudly, it returns an empty series that
 * looks exactly like "this page had no activity".
 *
 * Verified 2026-09-07 against:
 *   - https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25/
 *   - https://developers.facebook.com/documentation/pages-api/platforminsights/page
 *   - https://developers.facebook.com/documentation/pages-api/platforminsights/page/deprecated-metrics
 *   - https://developers.facebook.com/docs/graph-api/reference/insights/
 *   - https://developers.facebook.com/docs/graph-api/reference/page/published_posts/
 *   - https://developers.facebook.com/docs/graph-api/reference/page-post/
 *   - https://developers.facebook.com/docs/graph-api/reference/story-attachment/
 *   - https://developers.facebook.com/docs/graph-api/reference/post/comments/ (re-checked 2026-09-07)
 *
 * Re-check this file whenever Meta publishes a new version; see DEPRECATED
 * below for what the last two rounds already removed.
 */

// GRAPH_API_VERSION / GRAPH_API_BASE_URL moved to ../meta/constants.ts — the
// same values are confirmed for Instagram too. Re-exported here so existing
// imports of these two names from this module keep working.
export { GRAPH_API_VERSION, GRAPH_API_BASE_URL } from "../meta/constants";

/** Reading a page's own published posts. Max `limit` is 100; ~600 ranked posts per year are returned. */
export const PUBLISHED_POSTS_EDGE = "published_posts";
export const PUBLISHED_POSTS_MAX_LIMIT = 100;

/** PagePost fields confirmed readable on the Page Post node reference. */
export const POST_FIELDS = [
  "id",
  "message",
  "created_time",
  "permalink_url",
  "full_picture",
  "attachments{type,media_type}",
] as const;

/**
 * Best-effort field expansions for the two counters that have no insights
 * metric: comment total and share total. The `summary` parameter is documented
 * on the Page Post node, its exact expression is NOT (see UNVERIFIED). They are
 * requested anyway — if Meta returns them, normalization uses them; if not, it
 * raises UnverifiedApiDetailError rather than writing 0 for a missing count.
 */
export const POST_FIELDS_UNVERIFIED = ["comments.summary(true).limit(0)", "shares"] as const;

/**
 * The comments edge's `summary` object fields, confirmed on the Post Comments
 * reference (see the citation above, re-checked 2026-09-07): `order`,
 * `total_count` (uint32), `can_comment`. `comments.summary.total_count` is
 * therefore a real, documented path — no longer a guess — which is why
 * normalize.ts's readCommentCount() only raises on a genuinely unexpected
 * response shape now, not on principle.
 */

/**
 * Post-level insights. `post_impressions` / `post_impressions_unique` — the
 * metrics most third-party guides still use — are GONE (see DEPRECATED); these
 * are their documented replacements.
 */
export const POST_METRICS = {
  /** Replaces post_impressions (deprecated 2025-11-15). Lifetime total plays/displays. */
  views: "post_media_view",
  /** Replaces post_impressions_unique (deprecated 2025-06-15). Lifetime unique viewers = our "reach". */
  reach: "post_total_media_view_unique",
  /** Lifetime totals per reaction type, keyed by reaction name in the value object. */
  reactionsByType: "post_reactions_by_type_total",
  /** Lifetime video plays. Null for non-video posts. */
  videoViews: "post_video_views",
  /** Lifetime total playback in MILLISECONDS — see UNVERIFIED.avgWatchSeconds before deriving an average from it. */
  videoViewTime: "post_video_view_time",
} as const;

/**
 * Page-level insights, `period=day`, read with since/until. `page_fans` and
 * `page_impressions` are GONE (see DEPRECATED) — these replace them.
 */
export const PAGE_METRICS = {
  /** Replaces page_fans (deprecated 2025-11-15). Net follower count for the day. */
  followers: "page_follows",
  /** Replaces page_impressions (deprecated 2025-11-15). */
  views: "page_media_view",
  /** Replaces page_impressions_unique (deprecated 2025-06-15). */
  reach: "page_total_media_view_unique",
} as const;

/**
 * StoryAttachment.type values documented on the node reference. The docs end
 * that list with "etc.", so an unlisted value is possible and must NOT be
 * guessed at — normalize.ts raises UnverifiedApiDetailError naming the value
 * it saw, which turns a guess into a one-line answerable question.
 */
export const ATTACHMENT_TYPE_TO_KIND = {
  video: "video",
  video_autoplay: "video",
  photo: "image",
  cover_photo: "image",
  profile_media: "image",
  animated_image_autoplay: "image",
  album: "carousel",
  multiple: "carousel",
} as const;

/**
 * Metric names that are removed platform-wide, kept here so a future edit
 * cannot reintroduce one. Calling any of these returns an "invalid metric"
 * error, not data.
 */
export const DEPRECATED_METRICS: Readonly<Record<string, { removedOn: string; replacement: string | null }>> = {
  post_impressions: { removedOn: "2025-11-15", replacement: "post_media_view" },
  post_impressions_unique: { removedOn: "2025-06-15", replacement: "post_total_media_view_unique" },
  post_impressions_paid: { removedOn: "2025-11-15", replacement: "post_media_view" },
  post_impressions_organic: { removedOn: "2025-11-15", replacement: "post_media_view" },
  post_impressions_fan: { removedOn: "2025-11-15", replacement: "post_media_view" },
  post_activity: { removedOn: "2024-03-14", replacement: null },
  page_fans: { removedOn: "2025-11-15", replacement: "page_follows" },
  page_fan_adds: { removedOn: "2025-11-15", replacement: null },
  page_fan_removes: { removedOn: "2025-11-15", replacement: null },
  page_impressions: { removedOn: "2025-11-15", replacement: "page_media_view" },
  page_impressions_unique: { removedOn: "2025-06-15", replacement: "page_total_media_view_unique" },
  page_engaged_users: { removedOn: "2024-03-14", replacement: null },
  page_posts_impressions: { removedOn: "2025-06-15", replacement: null },
};

/**
 * Details this provider needs but that could NOT be confirmed from the docs
 * above. Nothing here is filled in by guesswork — the code raises
 * UnverifiedApiDetailError pointing at the doc page instead, so a wrong number
 * can never reach the database. Each entry is a question for the user.
 */
export const UNVERIFIED = {
  shareCount: {
    question:
      "The PagePost `shares` field is confirmed as a struct with key `count` (Page Post reference). Whether it is omitted entirely for zero shares was NOT confirmable from any first-party doc as of 2026-09-07 — resolved as a team decision instead (see readShareCount in normalize.ts: a missing `shares` field is treated as 0). This entry stays open only for the case `shares` is present but malformed (no numeric `count`), which is a genuine shape surprise worth re-checking this doc page for.",
    docUrl: "https://developers.facebook.com/docs/graph-api/reference/page-post/",
  },
  attachmentType: {
    question:
      "The complete StoryAttachment.type value set — the reference ends its list with \"etc.\", so an unlisted value must be mapped to a ContentKind by hand rather than guessed.",
    docUrl: "https://developers.facebook.com/docs/graph-api/reference/story-attachment/",
  },
  pageInsightsEndTime: {
    question:
      "What `end_time` on a period=day insight value marks — the start or the end of the day window, and in which timezone — since that decides which Asia/Bangkok snapshot_date the row belongs to.",
    docUrl: "https://developers.facebook.com/documentation/pages-api/platforminsights/page",
  },
  reelKind: {
    question:
      "How a Facebook Reel is identified — StoryAttachment.type has no documented `reel` value, so reels currently normalize as `video`.",
    docUrl: "https://developers.facebook.com/docs/graph-api/reference/story-attachment/",
  },
  avgWatchSeconds: {
    question:
      "Whether post_video_view_time (milliseconds) divided by post_video_views is the average watch time Meta itself reports, or whether a dedicated metric exists.",
    docUrl: "https://developers.facebook.com/docs/graph-api/reference/insights/",
  },
  completionRate: {
    question:
      "Whether any current metric expresses video completion rate (post_video_complete_views_30s is a count of 30s+ plays, not a rate).",
    docUrl: "https://developers.facebook.com/docs/graph-api/reference/insights/",
  },
  durationSeconds: {
    question: "How to read a page post video's duration (the Video node `length` field is not confirmed for post attachments).",
    docUrl: "https://developers.facebook.com/docs/graph-api/reference/video/",
  },
  postInsightsHistory: {
    question:
      "Whether /{post-id}/insights accepts since/until for backfill, or only ever returns lifetime totals as of now (which is what this provider assumes).",
    docUrl: "https://developers.facebook.com/documentation/pages-api/platforminsights/page",
  },
  pageInsightsWindow: {
    question:
      "Accepted format of since/until on /{page-id}/insights (unix seconds vs YYYY-MM-DD) and the maximum window one call may cover, for first-run backfill.",
    docUrl: "https://developers.facebook.com/documentation/pages-api/platforminsights/page",
  },
  permissions: {
    question:
      "Exact permission/feature set for these calls (pages_read_engagement, pages_read_user_content, read_insights, Page Public Content Access) and whether the token must be a long-lived Page token.",
    docUrl: "https://developers.facebook.com/docs/pages-api/getting-started/",
  },
} as const;

export type UnverifiedDetailKey = keyof typeof UNVERIFIED;

/**
 * Thrown instead of inventing a value. The message is Thai because it surfaces
 * to the user through sync_runs.error_message and the settings page.
 */
export class UnverifiedApiDetailError extends Error {
  readonly detail: UnverifiedDetailKey;

  constructor(detail: UnverifiedDetailKey, context?: string) {
    const entry = UNVERIFIED[detail];
    super(
      `ยังไม่ได้ยืนยันรายละเอียด Facebook API เรื่อง "${detail}" จาก docs${context ? ` (เจอค่า: ${context})` : ""} — ` +
        `ต้องเช็ค ${entry.docUrl} ก่อน แล้วเติมค่าใน lib/providers/facebook/api-spec.ts`,
    );
    this.name = "UnverifiedApiDetailError";
    this.detail = detail;
  }
}

/** Facebook exposes no save/bookmark count for Page posts — the column stays null, never 0 (CLAUDE.md rule 3). */
export const SAVES_UNSUPPORTED = true;
