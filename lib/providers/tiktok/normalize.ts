import type { SnapshotDate } from "@/lib/datetime";
import { asFiniteNumber, asRecord, asString } from "../meta/json-safe";
import type { ProviderAccountMetric, ProviderContent, ProviderContentMetric } from "../types";

/**
 * TikTok JSON -> our DTOs. Same two rules as facebook/normalize.ts and
 * instagram/normalize.ts:
 *   1. A missing required number skips the row rather than becoming 0.
 *   2. Reach, saves, avg-watch-seconds and completion-rate stay null for
 *      every row — this research found no confirmed metric for any of them
 *      (see UNVERIFIED.reachMetric / savesMetric / avgWatchAndCompletion in
 *      ./api-spec.ts). That is a documented gap, not a guess dressed as null.
 */

/** Just the id, for the list-then-query pagination flow — see tiktok-provider.ts. */
export function extractVideoId(raw: unknown): string | null {
  const video = asRecord(raw);
  return video ? asString(video.id) : null;
}

/**
 * create_time is assumed to be Unix seconds (UNVERIFIED.createTimeUnit — v1's
 * docs confirm seconds, v2's own reference did not restate the unit). Guarded
 * against the one failure mode that would matter: if seconds-interpretation
 * lands absurdly far from now, this is surfaced rather than silently stored.
 */
function parseCreateTime(value: unknown, now: Date): Date | null {
  const seconds = asFiniteNumber(value);
  if (seconds === null) return null;

  const asSeconds = new Date(seconds * 1000);
  const yearsFromNow = Math.abs(asSeconds.getTime() - now.getTime()) / (365 * 86_400_000);
  if (yearsFromNow > 20) {
    throw new Error(
      `TikTok API: create_time=${value} parses to ${asSeconds.toISOString()} as Unix seconds, which is ` +
        `implausibly far from now — re-check UNVERIFIED.createTimeUnit in lib/providers/tiktok/api-spec.ts ` +
        `(maybe this account's responses use milliseconds instead).`,
    );
  }
  return asSeconds;
}

/** Null when the payload is not a usable video. */
export function normalizeVideo(raw: unknown, now: Date): ProviderContent | null {
  const video = asRecord(raw);
  if (!video) return null;

  const externalId = asString(video.id);
  if (!externalId) return null;

  const publishedAt = parseCreateTime(video.create_time, now);
  if (!publishedAt) return null;

  return {
    externalId,
    // TikTok is video-first and this research found no field distinguishing
    // photo-mode posts (UNVERIFIED.photoPosts) — every item normalizes as
    // "video" rather than guessing a distinction the API doesn't expose here.
    kind: "video",
    caption: asString(video.video_description),
    publishedAt,
    permalink: asString(video.share_url),
    thumbnailUrl: asString(video.cover_image_url),
    durationSeconds: asFiniteNumber(video.duration),
    tags: [],
  };
}

/**
 * One cumulative-as-of-now snapshot. TikTok's video/query numbers are current
 * totals (not a delta), same treatment as Facebook/Instagram's lifetime
 * insights — one sync per day builds the cumulative history.
 */
export function normalizeContentMetric(raw: unknown, snapshotDate: SnapshotDate): ProviderContentMetric | null {
  const video = asRecord(raw);
  if (!video) return null;

  const contentExternalId = asString(video.id);
  if (!contentExternalId) return null;

  const views = asFiniteNumber(video.view_count);
  const likes = asFiniteNumber(video.like_count);
  const comments = asFiniteNumber(video.comment_count);
  const shares = asFiniteNumber(video.share_count);
  if (views === null || likes === null || comments === null || shares === null) return null;

  return {
    contentExternalId,
    snapshotDate,
    views,
    reach: null, // UNVERIFIED.reachMetric — no unique-viewer metric found
    likes,
    comments,
    shares,
    saves: null, // UNVERIFIED.savesMetric
    avgWatchSeconds: null, // UNVERIFIED.avgWatchAndCompletion
    completionRate: null, // UNVERIFIED.avgWatchAndCompletion
  };
}

/**
 * Account-level snapshot for TODAY only, same shape of limitation as
 * Instagram's normalizeAccountMetrics: follower_count is a plain "right now"
 * field with no confirmed history or time-series equivalent, so there is
 * nothing to backfill past days against, and followerDelta needs yesterday's
 * stored value — which only the database has, and providers do not read the
 * database. views/reach stay null: this research found no account-level
 * daily insights endpoint for TikTok's Developer API at all (unlike
 * Facebook's page_media_view or Instagram's account "views"/"reach").
 */
export function normalizeAccountMetrics(args: {
  followerCount: number | null;
  snapshotDate: SnapshotDate;
}): ProviderAccountMetric[] {
  if (args.followerCount === null) return []; // followers is NOT NULL — no usable row without it

  return [{ snapshotDate: args.snapshotDate, followers: args.followerCount, followerDelta: null, views: null, reach: null }];
}
