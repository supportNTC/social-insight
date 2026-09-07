/**
 * "Underperforming" is a funnel diagnosis, not a score: it answers *which
 * step broke first*, so the answer must be produced by checking the steps in
 * order and stopping at the first failure.
 *
 *   1. reach       — fewer people were shown it than usual
 *   2. views       — normal reach, but fewer of those people opened it
 *   3. engagement  — normal reach and views, but the people who watched did
 *                    not react (performance score below normal)
 *
 * A step whose baseline is missing is *skipped*, never treated as passed or
 * failed: TikTok reports no content-level reach at all, so TikTok content is
 * diagnosed from step 2 onwards. Callers must say so in the UI (rule 3 in
 * CLAUDE.md — an absent number is "—", never 0).
 */

export type UnderperformanceStage = "reach" | "views" | "engagement";

export type UnderperformanceThresholds = {
  /** Fail step 1 below this share of the account's median reach. */
  reachRatio: number;
  /** Fail step 2 below this share of the account's median views. */
  viewsRatio: number;
  /** Fail step 3 below this performance score (1.0 = the account's normal). */
  performanceScore: number;
};

/** Mirrors the env defaults in lib/env.ts — keep the two in sync by hand. */
export const DEFAULT_UNDERPERFORMANCE_THRESHOLDS: UnderperformanceThresholds = {
  reachRatio: 0.5,
  viewsRatio: 0.5,
  performanceScore: 0.5,
};

export type UnderperformanceInput = {
  /**
   * Reach and views compared at *equal maturity* — every content measured at
   * the same number of days after its own publish date (see
   * lib/queries/recommendations.ts). Comparing a two-day-old post's running
   * total against a month-old one's would flag every new post as failing.
   */
  reachAtMaturity: number | null;
  /** Null when this account has no comparable reach history — skip step 1. */
  medianReachAtMaturity: number | null;
  viewsAtMaturity: number;
  /** Null when this account has no comparable views history — skip step 2. */
  medianViewsAtMaturity: number | null;
  /** Null when there is no ER baseline yet — skip step 3 ("not known", not "bad"). */
  performanceScore: number | null;
};

export type UnderperformanceDiagnosis = {
  stage: UnderperformanceStage;
  /**
   * How far below normal, as a fraction of the baseline: 0.32 means "32% of
   * this account's usual". For the engagement stage this is the performance
   * score itself, which is already exactly that ratio.
   */
  ratio: number;
};

/** Returns null when the content cleared every step it could be judged on. */
export function diagnoseUnderperformance(
  input: UnderperformanceInput,
  thresholds: UnderperformanceThresholds = DEFAULT_UNDERPERFORMANCE_THRESHOLDS,
): UnderperformanceDiagnosis | null {
  const reachRatio = safeRatio(input.reachAtMaturity, input.medianReachAtMaturity);
  if (reachRatio !== null && reachRatio < thresholds.reachRatio) {
    return { stage: "reach", ratio: reachRatio };
  }

  const viewsRatio = safeRatio(input.viewsAtMaturity, input.medianViewsAtMaturity);
  if (viewsRatio !== null && viewsRatio < thresholds.viewsRatio) {
    return { stage: "views", ratio: viewsRatio };
  }

  const { performanceScore } = input;
  if (performanceScore !== null && performanceScore < thresholds.performanceScore) {
    return { stage: "engagement", ratio: performanceScore };
  }

  return null;
}

/** Null when either side is unavailable or the baseline is 0 — "x times zero" says nothing. */
function safeRatio(value: number | null, baseline: number | null): number | null {
  if (value === null || baseline === null || baseline === 0) return null;
  return value / baseline;
}
