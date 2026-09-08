import type { ContentKind } from "@prisma/client";
import { snapshotDateFor, type SnapshotDate } from "@/lib/datetime";
import { asFiniteNumber, asRecord, asString } from "../meta/json-safe";
import { latestNumber, parseInsights } from "../meta/insights";
import type { ProviderAccountMetric, ProviderContent, ProviderContentMetric } from "../types";
import {
  MEDIA_METRICS,
  MEDIA_TYPE_TO_KIND,
  SUPPORTED_PRODUCT_TYPES,
  UnverifiedApiDetailError,
  type SupportedProductType,
} from "./api-spec";

/**
 * Graph JSON -> our DTOs, same two rules as facebook/normalize.ts: a missing
 * required number skips the row rather than becoming 0 (CLAUDE.md rule 3),
 * and an unconfirmed shape raises UnverifiedApiDetailError rather than being
 * guessed (CLAUDE.md rule 1).
 */

export function isSupportedProductType(value: string): value is SupportedProductType {
  return (SUPPORTED_PRODUCT_TYPES as readonly string[]).includes(value);
}

/**
 * media_product_type STORY has no ContentKind (ephemeral, 24h — out of scope
 * for a lasting content-performance dashboard) and AD is not organic content;
 * both are filtered out by the caller before this is reached. REELS is a
 * media_product_type, not a media_type — a reel's own media_type is VIDEO,
 * so product type must be checked first.
 */
export function normalizeMediaKind(mediaType: string, productType: SupportedProductType): ContentKind {
  if (productType === "REELS") return "reel";
  if (mediaType === "VIDEO") return "video";

  const mapped = (MEDIA_TYPE_TO_KIND as Record<string, ContentKind | undefined>)[mediaType];
  if (!mapped) throw new UnverifiedApiDetailError("mediaTypeUnknown", `media_type="${mediaType}"`);
  return mapped;
}

/** Null when the payload is not a usable FEED/REELS media item. */
export function normalizeMedia(raw: unknown): ProviderContent | null {
  const media = asRecord(raw);
  if (!media) return null;

  const externalId = asString(media.id);
  const timestamp = asString(media.timestamp);
  const mediaType = asString(media.media_type);
  const productType = asString(media.media_product_type);
  if (!externalId || !timestamp || !mediaType || !productType) return null;
  if (!isSupportedProductType(productType)) return null; // STORY / AD — out of scope, not a guess

  const publishedAt = new Date(timestamp);
  if (Number.isNaN(publishedAt.getTime())) return null;

  return {
    externalId,
    kind: normalizeMediaKind(mediaType, productType),
    caption: asString(media.caption),
    publishedAt,
    permalink: asString(media.permalink),
    // thumbnail_url is documented as video-only; media_url is the closest
    // fallback for image/carousel cover art rather than leaving it empty.
    thumbnailUrl: asString(media.thumbnail_url) ?? asString(media.media_url),
    // Not confirmed readable on IG Media (UNVERIFIED.durationSeconds).
    durationSeconds: null,
    tags: [],
  };
}

/**
 * One cumulative snapshot for one media item. `views`/`likes`/`comments`/
 * `shares` are all NOT NULL in our schema, so a genuinely missing one skips
 * the whole row rather than writing a guessed 0 — same as
 * facebook/normalize.ts's normalizeContentMetric.
 */
export function normalizeContentMetric(args: {
  media: unknown;
  insights: unknown;
  snapshotDate: SnapshotDate;
}): ProviderContentMetric | null {
  const media = asRecord(args.media);
  if (!media) return null;

  const contentExternalId = asString(media.id);
  if (!contentExternalId) return null;

  const insights = parseInsights(args.insights);
  const views = latestNumber(insights, MEDIA_METRICS.views);
  const likes = asFiniteNumber(media.like_count);
  const comments = asFiniteNumber(media.comments_count);
  const shares = latestNumber(insights, MEDIA_METRICS.shares);
  if (views === null || likes === null || comments === null || shares === null) return null;

  return {
    contentExternalId,
    snapshotDate: args.snapshotDate,
    views,
    reach: latestNumber(insights, MEDIA_METRICS.reach),
    likes,
    comments,
    shares,
    saves: latestNumber(insights, MEDIA_METRICS.saved),
    avgWatchSeconds: latestNumber(insights, MEDIA_METRICS.reelAvgWatchTime),
    // Not confirmed available on any current Instagram metric (UNVERIFIED.completionRate).
    completionRate: null,
  };
}

/**
 * Account-level snapshot for TODAY only — not a backfillable series. `reach`/
 * `views` are confirmed day-windowed insights metrics, but `followers_count`
 * (see FOLLOWERS_COUNT_FIELD) is a plain "right now" field with no confirmed
 * historical equivalent, so there is nothing to backfill past days against.
 * `followerDelta` needs yesterday's stored value, which only the database
 * has — providers do not read the database, so it is always null here, not
 * a guess (schema allows this: follower_delta is nullable).
 */
export function normalizeAccountMetrics(args: {
  dailyInsights: unknown;
  followersCount: number | null;
  snapshotDate: SnapshotDate;
}): ProviderAccountMetric[] {
  if (args.followersCount === null) return []; // followers is NOT NULL — no usable row without it

  const insights = parseInsights(args.dailyInsights);

  return [
    {
      snapshotDate: args.snapshotDate,
      followers: args.followersCount,
      followerDelta: null,
      views: latestNumber(insights, "views"),
      reach: latestNumber(insights, "reach"),
    },
  ];
}

/** The Bangkok day an instant belongs to — re-exported for the provider's convenience. */
export function snapshotDateOf(at: Date): SnapshotDate {
  return snapshotDateFor(at);
}
