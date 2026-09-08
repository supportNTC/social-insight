/**
 * Every TikTok API string this provider sends lives here, same discipline as
 * lib/providers/facebook/api-spec.ts (CLAUDE.md rule 1) — nothing written
 * from memory, every entry cites the doc page and the date checked.
 *
 * IMPORTANT — product choice, not just endpoint choice: TikTok has at least
 * three separate API surfaces and this research (2026-09-07) found them far
 * less consistently documented than Meta's:
 *   1. "TikTok for Developers" Display/Content API (open.tiktokapis.com/v2) —
 *      OAuth login by the account owner, confirmed to return engagement
 *      counts (like_count, view_count, ...) on video/query. Used here.
 *   2. "TikTok API for Business" (business-api.tiktok.com) — advertiser/
 *      Business Center focused (ad accounts, GMV Max, Business Center
 *      billing). Its docs portal is a JS-rendered SPA this research could not
 *      read directly, and what search summaries described kept pointing back
 *      at ADS tooling, not organic content for an owned account. NOT used.
 *   3. TikTok Research API — gated to approved academic/research use. Not
 *      applicable to an internal marketing dashboard. NOT used.
 * (1) was chosen because it is the one confirmed, from a first-party page, to
 * return the exact counters our schema needs from a normal OAuth login — the
 * same shape of access Facebook Page Login / Instagram Business Login give.
 *
 * Verified 2026-09-07 against:
 *   - https://developers.tiktok.com/docs/en/tiktok-api-v2-video-query (fields, endpoint, example request)
 *   - https://developers.tiktok.com/doc/tiktok-api-v2-video-list (list endpoint, cursor/max_count/has_more)
 *   - https://developers.tiktok.com/docs/en/tiktok-api-v2-get-user-info (user/info fields + required scopes)
 *   - https://developers.tiktok.com/docs/en/display-api-get-started (base URL confirms open.tiktokapis.com/v2)
 *
 * Confidence note: this file's confirmations rest on fewer, less redundant
 * sources than Facebook's or Instagram's (TikTok's official docs are heavily
 * JS-rendered and several searches surfaced contradicting/stale summaries
 * before these specific pages resolved cleanly). Re-verify before relying on
 * this in a way Facebook/Instagram's citations would not need.
 */

export const TIKTOK_API_BASE_URL = "https://open.tiktokapis.com";
export const TIKTOK_API_VERSION = "v2";

export const VIDEO_LIST_PATH = "video/list/";
export const VIDEO_QUERY_PATH = "video/query/";
export const USER_INFO_PATH = "user/info/";

/** Confirmed on the List Videos reference. Hard max enforced by the API itself. */
export const VIDEO_LIST_MAX_COUNT = 20;

/**
 * Fields confirmed on the Video Query reference's example field list. Only
 * fetched through video/query (by id), not video/list — video/list's own
 * "fields" support was not clearly confirmed to include the stat fields, so
 * list is used purely for cursoring through ids, and query for everything else.
 */
export const VIDEO_QUERY_FIELDS = [
  "id",
  "create_time",
  "cover_image_url",
  "share_url",
  "video_description",
  "duration",
  "like_count",
  "comment_count",
  "share_count",
  "view_count",
] as const;

/**
 * Fields confirmed on the Get User Info reference, with the OAuth scope each
 * requires. follower_count needs `user.info.stats`, which must be included
 * in the app's granted scopes at OAuth time, not just requested here.
 */
export const USER_INFO_FIELDS = {
  basic: ["open_id", "display_name"] as const,
  stats: ["follower_count"] as const,
};

export const REQUIRED_SCOPES = ["video.list", "user.info.basic", "user.info.stats"] as const;

/**
 * Details this provider needs but that could NOT be confirmed with the same
 * confidence as Facebook/Instagram's UNVERIFIED entries. The code raises
 * UnverifiedApiDetailError for the ones that would otherwise silently produce
 * a wrong number; the rest are noted here and handled by leaving the field
 * null, which is always a safe default regardless of the answer.
 */
export const UNVERIFIED = {
  createTimeUnit: {
    question:
      "create_time is documented as a Unix epoch on the older v1 List Videos reference (seconds) — v2's own reference did not restate the unit explicitly. Assumed seconds by name-continuity; if actual responses parse to implausible dates (e.g. 1970 or the far future), this is the first thing to re-check.",
    docUrl: "https://developers.tiktok.com/docs/en/tiktok-api-v1-video-list",
  },
  videoListFieldsScope: {
    question:
      "Whether POST video/list/'s own `fields` parameter can return like_count/view_count etc. directly (skipping the separate video/query call), or is restricted to display metadata only. Assumed restricted (the safer assumption — a two-step list-then-query flow works either way); revisit if this turns out to be needlessly conservative.",
    docUrl: "https://developers.tiktok.com/doc/tiktok-api-v2-video-list",
  },
  savesMetric: {
    question:
      "No saves/bookmark counter appears in the confirmed video/query field list (unlike Facebook's or Instagram's `saved`). A few third-party sources mention `collect_count` on the separate Business/Marketing API, which this provider does not use. Treated as unavailable (null), not 0.",
    docUrl: "https://developers.tiktok.com/docs/en/tiktok-api-v2-video-query",
  },
  reachMetric: {
    question:
      "No unique-viewer/reach metric appears in the confirmed field list — only view_count (total plays). Treated as unavailable (null) for every TikTok content and account row, same as this project's MockProvider already assumes for TikTok.",
    docUrl: "https://developers.tiktok.com/docs/en/tiktok-api-v2-video-query",
  },
  avgWatchAndCompletion: {
    question: "No average-watch-time or completion-rate metric appears in the confirmed field list. Stays null.",
    docUrl: "https://developers.tiktok.com/docs/en/tiktok-api-v2-video-query",
  },
  photoPosts: {
    question:
      "The confirmed video/query fields (duration, height, width, cover_image_url) describe a VIDEO post. TikTok also supports photo-mode posts; no field distinguishing post type was found in this research, so every item from this provider normalizes as ContentKind 'video' — a real photo post would be mis-typed rather than rejected. Re-check before this account posts photo-mode content.",
    docUrl: "https://developers.tiktok.com/docs/en/tiktok-api-v2-video-query",
  },
  tokenRefresh: {
    question:
      "TikTok OAuth access tokens are short-lived (commonly ~24h, refreshed via a longer-lived refresh_token) — well-established platform behavior, but this provider does not implement a refresh flow; it reads TIKTOK_ACCESS_TOKEN from the environment on every run, same as FacebookProvider reads a long-lived Page token. An expired token will fail loudly (401), not silently.",
    docUrl: "https://developers.tiktok.com/docs/en/oauth-user-access-token-management",
  },
} as const;

export type UnverifiedDetailKey = keyof typeof UNVERIFIED;

export class UnverifiedApiDetailError extends Error {
  readonly detail: UnverifiedDetailKey;

  constructor(detail: UnverifiedDetailKey, context?: string) {
    const entry = UNVERIFIED[detail];
    super(
      `ยังไม่ได้ยืนยันรายละเอียด TikTok API เรื่อง "${detail}" จาก docs${context ? ` (เจอค่า: ${context})` : ""} — ` +
        `ต้องเช็ค ${entry.docUrl} ก่อน แล้วเติมค่าใน lib/providers/tiktok/api-spec.ts`,
    );
    this.name = "UnverifiedApiDetailError";
    this.detail = detail;
  }
}
