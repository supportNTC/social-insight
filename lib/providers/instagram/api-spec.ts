/**
 * Every Graph API string this provider sends lives here, same discipline as
 * lib/providers/facebook/api-spec.ts (CLAUDE.md rule 1): nothing is written
 * from memory, every entry cites the doc page and the date it was checked.
 *
 * Verified 2026-09-07 against:
 *   - https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started
 *     (instagram_business_account field, base URL, API version)
 *   - https://developers.facebook.com/docs/instagram-platform/reference/instagram-media
 *     (media_type, media_product_type, and other IG Media fields)
 *   - https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights
 *     (per-media metrics table, by media_product_type)
 *   - https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/
 *     (IG User fields incl. followers_count)
 *   - https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/insights/
 *     (account-level daily metrics)
 *
 * Instagram Business accounts are managed through the SAME Graph API as
 * Facebook Pages (graph.facebook.com, same version scheme, same Bearer-token
 * auth) — confirmed by the example request on the get-started page above, not
 * assumed by analogy. That is why this provider reuses
 * lib/providers/meta/graph-client.ts rather than writing a new client.
 */

export { GRAPH_API_BASE_URL, GRAPH_API_VERSION } from "../meta/constants";

/** Field on a Facebook Page node that names its connected Instagram Business Account. */
export const PAGE_INSTAGRAM_ACCOUNT_FIELD = "instagram_business_account";

/** Reading an IG User's own published media. Same cursor-based paging as Facebook's edges. */
export const MEDIA_EDGE = "media";
export const MEDIA_MAX_LIMIT = 100;

/** IG Media fields confirmed on the node reference. */
export const MEDIA_FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_product_type",
  "timestamp",
  "permalink",
  "thumbnail_url",
  "media_url",
  "like_count",
  "comments_count",
] as const;

/**
 * media_type values confirmed on the node reference: CAROUSEL_ALBUM, IMAGE,
 * VIDEO. A VIDEO's media_product_type further distinguishes FEED (a regular
 * video post) from REELS — our ContentKind needs both.
 */
export const MEDIA_TYPE_TO_KIND = {
  CAROUSEL_ALBUM: "carousel",
  IMAGE: "image",
} as const;

/**
 * media_product_type values confirmed on the node reference: AD, FEED, STORY,
 * REELS. STORY has no equivalent in our ContentKind (and is ephemeral/24h by
 * design) and AD is not organic content this dashboard tracks — both are
 * filtered out before normalization, not guessed at.
 */
export const SUPPORTED_PRODUCT_TYPES = ["FEED", "REELS"] as const;
export type SupportedProductType = (typeof SUPPORTED_PRODUCT_TYPES)[number];

/**
 * Per-media insights, confirmed on the Instagram Media insights reference
 * table together with which media_product_type each applies to:
 *   views              FEED, REELS, STORY
 *   reach              FEED, REELS, STORY
 *   likes              FEED, REELS        (NOT STORY)
 *   comments           FEED, REELS        (NOT STORY)
 *   saved              FEED, REELS        (NOT STORY)
 *   shares             FEED, REELS, STORY
 *   ig_reels_avg_watch_time         REELS only
 *   ig_reels_video_view_total_time  REELS only
 * We only ever request FEED/REELS media (see SUPPORTED_PRODUCT_TYPES), so the
 * STORY-only gaps above never matter here.
 */
export const MEDIA_METRICS = {
  views: "views",
  reach: "reach",
  saved: "saved",
  shares: "shares",
  reelAvgWatchTime: "ig_reels_avg_watch_time",
} as const;

/**
 * Account-level daily insights, confirmed on the IG User insights reference
 * (period=day, type=total_value): reach, views. followers is NOT a time-series
 * metric here — see FOLLOWERS_COUNT_FIELD below.
 */
export const ACCOUNT_METRICS = {
  reach: "reach",
  views: "views",
} as const;

/**
 * followers_count is a plain field on the IG User node (confirmed: "Total
 * number of Instagram users following the user"), not an insights metric —
 * there is no confirmed time-series follower-count metric, so each sync just
 * reads today's value as today's account_metrics_daily row (same shape the
 * schema already expects: a point-in-time count, not cumulative).
 */
export const FOLLOWERS_COUNT_FIELD = "followers_count";

/**
 * Details this provider needs but that could NOT be confirmed from the docs
 * above — same contract as lib/providers/facebook/api-spec.ts's UNVERIFIED:
 * the code raises UnverifiedApiDetailError rather than guessing.
 */
export const UNVERIFIED = {
  mediaTypeUnknown: {
    question:
      "The IG Media node reference lists media_type as exactly CAROUSEL_ALBUM, IMAGE, or VIDEO — if a real response reports something else, that is a documentation gap, not a value to guess a ContentKind for.",
    docUrl: "https://developers.facebook.com/docs/instagram-platform/reference/instagram-media",
  },
  accountInsightsWindow: {
    question:
      "Accepted since/until format and maximum backfill window on GET /{ig-user-id}/insights (unix seconds vs YYYY-MM-DD), for first-run backfill — not confirmed for Instagram specifically, only inferred by analogy to Facebook's Page insights.",
    docUrl: "https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/insights/",
  },
  completionRate: {
    question:
      "Whether any current Instagram metric expresses reel completion rate (reels_skip_rate is the inverse of the first 3 seconds only, not a full-video completion rate).",
    docUrl: "https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights",
  },
  durationSeconds: {
    question: "Whether IG Media exposes a video/reel duration field — not seen on the fields confirmed above.",
    docUrl: "https://developers.facebook.com/docs/instagram-platform/reference/instagram-media",
  },
  permissions: {
    question:
      "Exact permission set for these calls (instagram_basic, instagram_manage_insights, pages_show_list) and whether Instagram API with Facebook Login vs Instagram API with Instagram Login changes what a Page-connected setup needs.",
    docUrl: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started",
  },
} as const;

export type UnverifiedDetailKey = keyof typeof UNVERIFIED;

export class UnverifiedApiDetailError extends Error {
  readonly detail: UnverifiedDetailKey;

  constructor(detail: UnverifiedDetailKey, context?: string) {
    const entry = UNVERIFIED[detail];
    super(
      `ยังไม่ได้ยืนยันรายละเอียด Instagram API เรื่อง "${detail}" จาก docs${context ? ` (เจอค่า: ${context})` : ""} — ` +
        `ต้องเช็ค ${entry.docUrl} ก่อน แล้วเติมค่าใน lib/providers/instagram/api-spec.ts`,
    );
    this.name = "UnverifiedApiDetailError";
    this.detail = detail;
  }
}

/** Instagram exposes no completion-rate or duration field we could confirm — stays null (CLAUDE.md rule 3), not a guess. */
export const COMPLETION_RATE_UNSUPPORTED = true;
export const DURATION_UNSUPPORTED = true;
/** Instagram Media insights expose no reach-equivalent nullability quirk per platform the way TikTok/Facebook do — reach is confirmed available for both FEED and REELS. */
export const REACH_SUPPORTED = true;
