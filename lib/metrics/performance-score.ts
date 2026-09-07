import { median } from "./median";
import type { EngagementRateResult } from "./types";

/**
 * performanceScore = contentER / median(accountER_last30d)
 * — restricted to history entries sharing the content's own ER basis
 * (CLAUDE.md: never rank/compare reach-basis ER against views-basis ER).
 *
 * Returns null, not 0 or 1, when there's no usable baseline: a brand-new
 * account with zero comparable history, or one whose median happens to be 0.
 * "No score yet" and "performing at 0% of normal" must never look the same
 * to the UI.
 */
export function computePerformanceScore(
  contentEr: EngagementRateResult,
  accountErHistory: readonly EngagementRateResult[],
): number | null {
  const sameBasisValues = accountErHistory
    .filter((entry) => entry.basis === contentEr.basis)
    .map((entry) => entry.value);

  const baseline = median(sameBasisValues);
  if (baseline === null || baseline === 0) return null;

  return contentEr.value / baseline;
}
