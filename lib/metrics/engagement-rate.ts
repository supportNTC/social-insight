import { computeWeightedEngagement } from "./weighted-engagement";
import type { EngagementCounts, EngagementRateResult, ErBasis, MetricWeights } from "./types";

/**
 * engagementRate = weightedEngagements / (reach ?? views) * 100
 *
 * Basis rule (CLAUDE.md): the divisor is `reach` when the platform reported
 * it, else `views` — and the basis always travels with the number so callers
 * never compare an ER computed on reach against one computed on views.
 *
 * Returns null — not Infinity/NaN, not 0 — when the divisor is 0. That covers
 * both "views is genuinely 0" and "reach was explicitly reported as 0"; in
 * neither case does it make sense to silently fall back to a different basis.
 */
export function computeEngagementRate(
  counts: EngagementCounts,
  weights: MetricWeights,
): EngagementRateResult | null {
  const denominator = counts.reach ?? counts.views;
  if (denominator <= 0) return null;

  const basis: ErBasis = counts.reach !== null ? "reach" : "views";
  const weighted = computeWeightedEngagement(counts, weights);

  return { value: (weighted / denominator) * 100, basis };
}
