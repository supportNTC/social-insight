import type { ContentKind, Platform } from "@prisma/client";
import { addDays, snapshotDateToColumn, type SnapshotDate } from "@/lib/datetime";
import { pick, randomIntInRange, rngFor } from "./random";
import type {
  ProviderAccountMetric,
  ProviderAccountRef,
  ProviderContent,
  ProviderContentMetric,
} from "../types";

/**
 * The mock universe is entirely a function of MOCK_SEED — no wall-clock
 * `Date.now()` anywhere in this file. MOCK_SEED doubles as the RNG seed AND
 * the anchor "today" for the generated timeline (see anchorDateFromSeed), so
 * the exact same dataset comes out no matter which real day `pnpm sync` runs
 * on. That is the whole idempotency guarantee for MockProvider.
 */

const CONTENT_PER_ACCOUNT = 40; // 3 accounts x 40 = ~120, per PROMPT.md
const HISTORY_DAYS = 90;
const RISING_WINDOW_DAYS = 2;
const ACCOUNT_METRIC_HISTORY_DAYS = 90;

const BRAND_NAME = "ครัวชายทะเล";

const CAPTION_POOL = [
  "เมนูพิเศษประจำสัปดาห์ พร้อมเสิร์ฟที่ร้านแล้ววันนี้",
  "เบื้องหลังการเตรียมวัตถุดิบสดใหม่ทุกเช้า",
  "รีวิวจากลูกค้าที่มาทานครบรอบเปิดร้าน",
  "โปรโมชั่นสั่งเดลิเวอรีวันนี้ ลดพิเศษ",
  "ทีมงานเตรียมพร้อมสำหรับอีเวนต์กลางแจ้งสุดสัปดาห์นี้",
  "ขั้นตอนการทำซอสสูตรเด็ดที่ไม่เคยเปิดเผยที่ไหนมาก่อน",
  "โพลสำรวจความคิดเห็นลูกค้าเรื่องบริการจัดส่ง",
  "แนะนำเมนูใหม่ที่ลูกค้าต่อคิวยาวที่สุดในสัปดาห์นี้",
  "บรรยากาศร้านช่วงเย็นวันศุกร์",
  "ขอบคุณลูกค้าทุกท่านที่ติดตามมาตลอดปีนี้",
  "เคล็ดลับการเลือกวัตถุดิบทะเลสดจากตลาด",
  "เบื้องหลังทีมครัวก่อนเปิดร้านทุกวัน",
  "แนะนำเครื่องดื่มซิกเนเจอร์ประจำร้าน",
  "อัปเดตเวลาทำการช่วงเทศกาล",
  "ไฮไลต์คอมเมนต์ฮาจากลูกค้าประจำ",
] as const;

type PlatformProfile = {
  followerBase: number;
  followerDailyGrowth: number;
  viewScale: number;
  /** null = this platform never reports content-level reach (rule: null, not 0). */
  contentReachRatio: number | null;
  savesSupported: boolean;
  /** null = this platform never reports account-level reach either. */
  accountReachSupported: boolean;
  kinds: readonly ContentKind[];
};

const PROFILE: Record<Extract<Platform, "facebook" | "instagram" | "tiktok">, PlatformProfile> = {
  facebook: {
    followerBase: 46_000,
    followerDailyGrowth: 6,
    viewScale: 1,
    contentReachRatio: 0.55,
    savesSupported: false,
    accountReachSupported: true,
    kinds: ["image", "video"],
  },
  instagram: {
    followerBase: 60_000,
    followerDailyGrowth: 14,
    viewScale: 1.6,
    contentReachRatio: 0.6,
    savesSupported: true,
    accountReachSupported: true,
    kinds: ["image", "carousel", "reel", "video"],
  },
  tiktok: {
    followerBase: 88_000,
    followerDailyGrowth: 34,
    viewScale: 3.2,
    // TikTok mock account has not reported reach for this window — same
    // "null ≠ 0" rule the real TikTok Insights API forces on us later.
    contentReachRatio: null,
    savesSupported: true,
    accountReachSupported: false,
    kinds: ["video"],
  },
};

const PLATFORMS = Object.keys(PROFILE) as Array<keyof typeof PROFILE>;

type QualityTier = "standout" | "typical" | "underperformer";

export type GeneratedAccount = {
  account: ProviderAccountRef;
  contents: ProviderContent[];
  contentMetrics: ProviderContentMetric[];
  accountMetrics: ProviderAccountMetric[];
};

/** MOCK_SEED is a YYYYMMDD string — parsed as the mock universe's "today". */
export function anchorDateFromSeed(seed: string): SnapshotDate {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(seed);
  if (!match) {
    throw new RangeError(
      `MOCK_SEED must be an 8-digit YYYYMMDD string (got "${seed}") — it doubles as the mock timeline's anchor date`,
    );
  }
  const [, year, month, day] = match;
  const candidate = `${year}-${month}-${day}`;
  // Throws RangeError for an impossible date (e.g. 2026-02-30) via the same
  // round-trip check snapshotDateToColumn already does.
  snapshotDateToColumn(candidate);
  return candidate;
}

export function generateMockUniverse(seed: string): GeneratedAccount[] {
  const anchor = anchorDateFromSeed(seed);
  return PLATFORMS.map((platform) => generateAccount(seed, anchor, platform));
}

function generateAccount(
  seed: string,
  anchor: SnapshotDate,
  platform: keyof typeof PROFILE,
): GeneratedAccount {
  const profile = PROFILE[platform];
  const externalId = `mock-${platform}-01`;
  const account: ProviderAccountRef = {
    platform,
    externalId,
    name: BRAND_NAME,
    timezone: "Asia/Bangkok",
  };

  const contents: ProviderContent[] = [];
  const contentMetrics: ProviderContentMetric[] = [];

  for (let index = 0; index < CONTENT_PER_ACCOUNT; index += 1) {
    const contentExternalId = `mock-${platform}-content-${String(index).padStart(3, "0")}`;
    const contentRng = rngFor(seed, contentExternalId);

    // Reserve a few indices so every account deterministically has at least
    // one of each kind PROMPT.md asks for, instead of leaving it to chance.
    const isRising = index === 0;
    const tier: QualityTier = index === 1 ? "standout" : index === 2 ? "underperformer" : "typical";

    const daysAgo = isRising
      ? randomIntInRange(contentRng, 0, RISING_WINDOW_DAYS)
      : randomIntInRange(contentRng, RISING_WINDOW_DAYS + 1, HISTORY_DAYS - 1);
    const publishedDate = addDays(anchor, -daysAgo);
    const publishedHour = randomIntInRange(contentRng, 6, 22);
    const publishedAt = new Date(snapshotDateToColumn(publishedDate).getTime() + publishedHour * 3_600_000);

    const kind = pick(contentRng, profile.kinds);
    const isVideoLike = kind === "video" || kind === "reel";

    contents.push({
      externalId: contentExternalId,
      kind,
      caption: pick(contentRng, CAPTION_POOL),
      publishedAt,
      permalink: `https://example-mock.invalid/${platform}/${contentExternalId}`,
      thumbnailUrl: `https://example-mock.invalid/${platform}/${contentExternalId}/thumb.jpg`,
      durationSeconds: isVideoLike ? randomIntInRange(contentRng, 15, 180) : null,
      tags: [],
    });

    contentMetrics.push(
      ...generateContentMetrics({
        contentExternalId,
        publishedDate,
        anchor,
        profile,
        tier,
        isRising,
        isVideoLike,
        rng: rngFor(seed, contentExternalId, "metrics"),
      }),
    );
  }

  const accountMetrics = generateAccountMetrics({ seed, anchor, platform, profile });

  return { account, contents, contentMetrics, accountMetrics };
}

function generateContentMetrics(args: {
  contentExternalId: string;
  publishedDate: SnapshotDate;
  anchor: SnapshotDate;
  profile: PlatformProfile;
  tier: QualityTier;
  isRising: boolean;
  isVideoLike: boolean;
  rng: () => number;
}): ProviderContentMetric[] {
  const { contentExternalId, publishedDate, anchor, profile, tier, isRising, isVideoLike, rng } = args;

  const tierMultiplier =
    tier === "standout"
      ? randomIntInRange(rng, 260, 420) / 100
      : tier === "underperformer"
        ? randomIntInRange(rng, 20, 45) / 100
        : randomIntInRange(rng, 80, 160) / 100;

  const potentialViews =
    (900 * profile.viewScale * tierMultiplier * randomIntInRange(rng, 85, 115)) / 100;
  // Rising content grows far faster in its first 24-48h than normal content
  // ever does — that's what makes velocity >= 1.5 emerge from the same curve
  // formula rather than being hand-set.
  const decayRate = isRising ? randomIntInRange(rng, 90, 130) / 100 : randomIntInRange(rng, 12, 28) / 100;

  const likeRatio = randomIntInRange(rng, 6, 10) / 100;
  const commentRatio = randomIntInRange(rng, 1, 3) / 100;
  const shareRatio = randomIntInRange(rng, 1, 2) / 100;
  const saveRatio = profile.savesSupported ? randomIntInRange(rng, 2, 5) / 100 : 0;

  const avgWatchSeconds = randomIntInRange(rng, 8, 95);
  const completionRate = randomIntInRange(rng, 30, 85) / 100;

  const out: ProviderContentMetric[] = [];
  let day = publishedDate;
  let daysSincePublish = 0;
  // Cumulative snapshot for every day from publish through the anchor date —
  // schema rule 1: this is a running total, not a per-day delta.
  while (true) {
    const views = Math.round(potentialViews * (1 - Math.exp(-decayRate * (daysSincePublish + 1))));
    const reach = profile.contentReachRatio === null ? null : Math.round(views * profile.contentReachRatio);

    out.push({
      contentExternalId,
      snapshotDate: day,
      views,
      reach,
      likes: Math.round(views * likeRatio),
      comments: Math.round(views * commentRatio),
      shares: Math.round(views * shareRatio),
      saves: profile.savesSupported ? Math.round(views * saveRatio) : null,
      avgWatchSeconds: isVideoLike ? avgWatchSeconds : null,
      completionRate: isVideoLike ? completionRate : null,
    });

    if (day === anchor) break;
    day = addDays(day, 1);
    daysSincePublish += 1;
  }
  return out;
}

function generateAccountMetrics(args: {
  seed: string;
  anchor: SnapshotDate;
  platform: keyof typeof PROFILE;
  profile: PlatformProfile;
}): ProviderAccountMetric[] {
  const { seed, anchor, platform, profile } = args;
  const rng = rngFor(seed, platform, "account-metrics");

  const out: ProviderAccountMetric[] = [];
  let previousFollowers: number | null = null;

  for (let daysAgo = ACCOUNT_METRIC_HISTORY_DAYS; daysAgo >= 0; daysAgo -= 1) {
    const day = addDays(anchor, -daysAgo);
    const dayIndex = ACCOUNT_METRIC_HISTORY_DAYS - daysAgo;

    const jitter = randomIntInRange(rng, -3, 3);
    const followers = Math.max(0, Math.round(profile.followerBase + profile.followerDailyGrowth * dayIndex + jitter));
    const followerDelta = previousFollowers === null ? null : followers - previousFollowers;
    previousFollowers = followers;

    // Weekly seasonality (Sat/Sun busier) plus daily jitter — independent of
    // content rollups, matching the schema note that this table is reported
    // by the platform on its own basis, not derived from content deltas.
    const weekday = snapshotDateToColumn(day).getUTCDay();
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.25 : 1;
    const dailyViews = Math.round(600 * profile.viewScale * weekendBoost * (randomIntInRange(rng, 80, 130) / 100));
    const dailyReach = profile.accountReachSupported ? Math.round(dailyViews * 0.7) : null;

    out.push({
      snapshotDate: day,
      followers,
      followerDelta,
      views: dailyViews,
      reach: dailyReach,
    });
  }

  return out;
}
