import type { ContentKind } from "@prisma/client";
import { snapshotDateFor, type SnapshotDate } from "@/lib/datetime";
import type { ProviderAccountMetric, ProviderContent, ProviderContentMetric } from "../types";
import { asArray, asFiniteNumber, asRecord, asString } from "../meta/json-safe";
import { latestNumber, parseInsights, type InsightEntry } from "../meta/insights";
import {
  ATTACHMENT_TYPE_TO_KIND,
  PAGE_METRICS,
  POST_METRICS,
  UnverifiedApiDetailError,
} from "./api-spec";

/**
 * Graph JSON -> our DTOs. Pure: no network, no Prisma, so every rule below is
 * unit-testable against recorded payloads (which is the only way to test this
 * at all — CLAUDE.md rule 2 forbids code that needs real credentials to run).
 *
 * Two rules run through the whole file:
 *   1. A missing number becomes null, or the row is skipped entirely. It never
 *      becomes 0 (CLAUDE.md rule 3): "nobody saw this" and "the API did not
 *      tell us" must stay distinguishable all the way to the UI.
 *   2. Anything the docs did not confirm raises UnverifiedApiDetailError with
 *      the page to check, instead of being guessed (CLAUDE.md rule 1).
 *
 * The insight envelope itself ({data:[{name, values:[{value, end_time}]}]}) is
 * read defensively — every access is guarded, so a shape change surfaces as a
 * skipped row or a raised error, never as a silent zero.
 */

// ---- posts ------------------------------------------------------------------

/** The `attachments` edge is `{data:[{type, media_type}]}` when present. */
function firstAttachmentType(post: Record<string, unknown>): string | null {
  const attachments = asRecord(post.attachments);
  if (!attachments) return null;
  const first = asRecord(asArray(attachments.data)[0]);
  return first ? asString(first.type) : null;
}

/**
 * A post with no attachment at all is a plain text status; we still have to
 * store SOME ContentKind, and `image` is the closest of the four our schema
 * allows. Anything with an attachment type outside the documented list stops
 * the sync with the value it saw, rather than being filed under a guess.
 */
export function normalizeContentKind(post: Record<string, unknown>): ContentKind {
  const type = firstAttachmentType(post);
  if (type === null) return "image";

  const mapped = (ATTACHMENT_TYPE_TO_KIND as Record<string, ContentKind | undefined>)[type];
  if (!mapped) throw new UnverifiedApiDetailError("attachmentType", `attachments.data[0].type="${type}"`);

  return mapped;
}

/** Null when the payload is not a usable post (no id or no publish time). */
export function normalizePost(raw: unknown): ProviderContent | null {
  const post = asRecord(raw);
  if (!post) return null;

  const externalId = asString(post.id);
  const createdTime = asString(post.created_time);
  if (!externalId || !createdTime) return null;

  const publishedAt = new Date(createdTime);
  if (Number.isNaN(publishedAt.getTime())) return null;

  return {
    externalId,
    kind: normalizeContentKind(post),
    caption: asString(post.message),
    publishedAt,
    permalink: asString(post.permalink_url),
    thumbnailUrl: asString(post.full_picture),
    // Duration needs the Video node; not confirmed for post attachments, so
    // it stays null rather than being derived from something adjacent.
    durationSeconds: null,
    tags: [],
  };
}

// ---- insights ---------------------------------------------------------------

// Moved to lib/providers/meta/insights.ts — Instagram's insights envelope is
// byte-for-byte the same shape, so both providers share one parser instead of
// each maintaining their own. Re-exported here so existing imports of these
// names from this module keep working.
export { parseInsights, latestNumber, type InsightEntry };

/**
 * post_reactions_by_type_total is an object keyed by reaction name
 * ({like: 12, love: 3, ...}). Our model has a single "likes" counter, so all
 * reaction types are summed — a "love" is a reaction to the post just as a
 * "like" is, and dropping the others would understate every post.
 */
export function sumReactions(insights: Map<string, InsightEntry>): number | null {
  const entry = insights.get(POST_METRICS.reactionsByType);
  if (!entry) return null;

  for (let i = entry.values.length - 1; i >= 0; i -= 1) {
    const value = entry.values[i]?.value;
    const direct = asFiniteNumber(value);
    if (direct !== null) return direct;

    const byType = asRecord(value);
    if (!byType) continue;

    let total = 0;
    let counted = false;
    for (const raw of Object.values(byType)) {
      const n = asFiniteNumber(raw);
      if (n !== null) {
        total += n;
        counted = true;
      }
    }
    if (counted) return total;
  }

  return null;
}

/**
 * Comment total, from `comments.summary.total_count` — confirmed on the Post
 * Comments reference (order / total_count / can_comment are the documented
 * summary fields; see the citation in this file's header). Still raises
 * rather than assuming 0 if a real response omits it, but that is now a
 * "the API behaved unexpectedly" error, not an open question — most likely a
 * missing `pages_read_user_content` permission on the token.
 */
export function readCommentCount(post: Record<string, unknown>): number {
  const comments = asRecord(post.comments);
  const summary = comments ? asRecord(comments.summary) : null;
  const total = summary ? asFiniteNumber(summary.total_count) : null;
  if (total === null) {
    throw new Error(
      "Facebook API: expected comments.summary.total_count on a post but it was missing — " +
        "this field is documented and normally always present once requested, so check the " +
        "token's permissions (pages_read_user_content) rather than api-spec.ts.",
    );
  }
  return total;
}

/**
 * Share total. `shares` is confirmed as `{count: N}` when present (Page Post
 * reference), but whether Meta omits it entirely for zero shares, and whether
 * that means "zero" or "not reported", is not confirmed by any doc found
 * 2026-09-07 (see UNVERIFIED.shareCount). Team decision on that date: treat a
 * missing `shares` field as 0 — shares is NOT NULL in our schema (unlike
 * reach/saves), and 0 is overwhelmingly the more likely real value for a post
 * nobody shared, so this is the assumption, not a doc-confirmed fact.
 *
 * Still throws if `shares` is present but malformed (e.g. `count` missing or
 * non-numeric) — that is a genuine shape surprise, not the documented omission.
 */
export function readShareCount(post: Record<string, unknown>): number {
  if (post.shares === undefined || post.shares === null) return 0;

  const shares = asRecord(post.shares);
  const count = shares ? asFiniteNumber(shares.count) : null;
  if (count === null) throw new UnverifiedApiDetailError("shareCount");
  return count;
}

/**
 * One cumulative snapshot for one post. Returns null — writing nothing — when
 * the mandatory counters are missing, because a row of zeros would be
 * indistinguishable from a genuinely dead post.
 */
export function normalizeContentMetric(args: {
  post: unknown;
  insights: unknown;
  snapshotDate: SnapshotDate;
}): ProviderContentMetric | null {
  const post = asRecord(args.post);
  if (!post) return null;

  const contentExternalId = asString(post.id);
  if (!contentExternalId) return null;

  const insights = parseInsights(args.insights);

  const views = latestNumber(insights, POST_METRICS.views);
  const likes = sumReactions(insights);
  if (views === null || likes === null) return null;

  return {
    contentExternalId,
    snapshotDate: args.snapshotDate,
    views,
    reach: latestNumber(insights, POST_METRICS.reach),
    likes,
    comments: readCommentCount(post),
    shares: readShareCount(post),
    // Facebook exposes no save/bookmark count for Page posts.
    saves: null,
    // Both need an unverified derivation — see UNVERIFIED in api-spec.ts.
    avgWatchSeconds: null,
    completionRate: null,
  };
}

// ---- account (page) metrics -------------------------------------------------

/**
 * `end_time` marks when a period=day window closed, so the day it describes is
 * the one containing the instant just before it. Which timezone Meta closes
 * that window in is unconfirmed (UNVERIFIED.pageInsightsEndTime) — the worst
 * case is a row landing on the neighbouring day label, never a wrong number.
 */
function snapshotDateForEndTime(endTime: string): SnapshotDate | null {
  const instant = new Date(endTime);
  if (Number.isNaN(instant.getTime())) return null;
  return snapshotDateFor(new Date(instant.getTime() - 1));
}

/**
 * Page-level daily rows. Unlike content metrics these are per-day values, not
 * cumulative — see the comment on account_metrics_daily in schema.prisma.
 * `followerDelta` is derived from the follower series itself and stays null for
 * the first day, where there is nothing to subtract.
 */
export function normalizeAccountMetrics(raw: unknown): ProviderAccountMetric[] {
  const insights = parseInsights(raw);

  const byDate = new Map<SnapshotDate, { followers: number | null; views: number | null; reach: number | null }>();

  const collect = (metric: string, key: "followers" | "views" | "reach") => {
    const entry = insights.get(metric);
    if (!entry) return;
    for (const point of entry.values) {
      if (!point.endTime) continue;
      const date = snapshotDateForEndTime(point.endTime);
      if (!date) continue;
      const value = asFiniteNumber(point.value);
      const row = byDate.get(date) ?? { followers: null, views: null, reach: null };
      row[key] = value;
      byDate.set(date, row);
    }
  };

  collect(PAGE_METRICS.followers, "followers");
  collect(PAGE_METRICS.views, "views");
  collect(PAGE_METRICS.reach, "reach");

  const dates = Array.from(byDate.keys()).sort();
  const out: ProviderAccountMetric[] = [];
  let previousFollowers: number | null = null;

  for (const date of dates) {
    const row = byDate.get(date);
    if (!row) continue;

    // followers is NOT NULL in the schema: a day with no follower number is a
    // day we cannot store, so it is skipped rather than zero-filled.
    if (row.followers === null) continue;

    out.push({
      snapshotDate: date,
      followers: row.followers,
      followerDelta: previousFollowers === null ? null : row.followers - previousFollowers,
      views: row.views,
      reach: row.reach,
    });
    previousFollowers = row.followers;
  }

  return out;
}

/** The Bangkok day a lifetime snapshot taken `at` belongs to. */
export function snapshotDateOf(at: Date): SnapshotDate {
  return snapshotDateFor(at);
}
