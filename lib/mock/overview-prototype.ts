/**
 * Static data for the Overview visual prototype only. This is NOT the real
 * MockProvider (Stage 2) or the metrics layer (Stage 3) — those don't exist
 * yet. Numbers here exist purely to give the design a body to render; they
 * are hand-picked, not generated, and follow the same null-handling rules
 * (`reach` can be null) so the UI can show the real "—" treatment.
 */

export type Platform = "facebook" | "instagram" | "tiktok";

export const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

export type TrendPoint = {
  date: string; // "DD MMM" (Asia/Bangkok), display label only
  facebook: number;
  instagram: number;
  tiktok: number;
};

const TREND_30D: TrendPoint[] = [
  { date: "9 ส.ค.", facebook: 4200, instagram: 6100, tiktok: 9800 },
  { date: "12 ส.ค.", facebook: 4350, instagram: 6400, tiktok: 11200 },
  { date: "15 ส.ค.", facebook: 4100, instagram: 7000, tiktok: 10500 },
  { date: "18 ส.ค.", facebook: 4600, instagram: 7300, tiktok: 13400 },
  { date: "21 ส.ค.", facebook: 4800, instagram: 7100, tiktok: 15600 },
  { date: "24 ส.ค.", facebook: 5100, instagram: 7800, tiktok: 14200 },
  { date: "27 ส.ค.", facebook: 5000, instagram: 8400, tiktok: 17800 },
  { date: "30 ส.ค.", facebook: 5400, instagram: 8900, tiktok: 19100 },
  { date: "2 ก.ย.", facebook: 5250, instagram: 8600, tiktok: 18300 },
  { date: "5 ก.ย.", facebook: 5700, instagram: 9400, tiktok: 22400 },
];

export const TREND_7D: TrendPoint[] = TREND_30D.slice(-5);

export function getTrend(range: "7d" | "30d"): TrendPoint[] {
  return range === "7d" ? TREND_7D : TREND_30D;
}

export type PlatformShare = {
  platform: Platform;
  /** Weighted engagement share of total, 0..1 */
  share: number;
  /** Median engagement rate for the period. Null = platform did not report reach for this window. */
  engagementRate: number | null;
  erBasis: "reach" | "views";
  followers: number;
  followerDelta: number;
};

export const PLATFORM_SHARE: PlatformShare[] = [
  {
    platform: "facebook",
    share: 0.21,
    engagementRate: 0.034,
    erBasis: "reach",
    followers: 48200,
    followerDelta: 180,
  },
  {
    platform: "instagram",
    share: 0.35,
    engagementRate: 0.058,
    erBasis: "reach",
    followers: 62500,
    followerDelta: 410,
  },
  {
    platform: "tiktok",
    // TikTok's mock account hasn't reported reach for this window yet —
    // demonstrates the "null ≠ 0" rule from CLAUDE.md rule 3.
    share: 0.44,
    engagementRate: null,
    erBasis: "views",
    followers: 91300,
    followerDelta: 2650,
  },
];

export type RisingContent = {
  id: string;
  platform: Platform;
  caption: string;
  publishedHoursAgo: number;
  velocity: number; // ≥ 1.5 && within 72h => "rising"
  performanceScore: number; // ER ÷ 30-day median ER of the same account
  views: number;
};

export const RISING_CONTENT: RisingContent[] = [
  {
    id: "c1",
    platform: "tiktok",
    caption: "รีวิวเมนูใหม่ 3 จานที่คนต่อคิวยาวสุดสัปดาห์นี้",
    publishedHoursAgo: 14,
    velocity: 2.8,
    performanceScore: 3.1,
    views: 184000,
  },
  {
    id: "c2",
    platform: "instagram",
    caption: "Behind the scenes: ทีมงานเตรียมงานอีเวนต์กลางแจ้ง",
    publishedHoursAgo: 31,
    velocity: 2.1,
    performanceScore: 2.4,
    views: 52300,
  },
  {
    id: "c3",
    platform: "facebook",
    caption: "โพลสำรวจความเห็นลูกค้าเรื่องบริการจัดส่ง",
    publishedHoursAgo: 58,
    velocity: 1.6,
    performanceScore: 1.8,
    views: 21100,
  },
];

export type KpiSummary = {
  totalReach: number;
  totalReachDeltaPct: number;
  avgEngagementRate: number;
  avgEngagementRateDeltaPct: number;
  risingCount: number;
  totalFollowers: number;
  totalFollowerDelta: number;
};

export const KPI_SUMMARY: KpiSummary = {
  totalReach: 612_400,
  totalReachDeltaPct: 12.4,
  avgEngagementRate: 0.047,
  avgEngagementRateDeltaPct: -3.2,
  risingCount: RISING_CONTENT.length,
  totalFollowers: 202_000,
  totalFollowerDelta: 3240,
};
