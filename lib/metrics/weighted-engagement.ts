import type { EngagementCounts, MetricWeights } from "./types";

/**
 * weightedEngagements = likes*w.like + comments*w.comment + shares*w.share + (saves??0)*w.save
 * `saves` is null (not missing-and-0) on platforms without a save concept —
 * treated as 0 here only for this sum, never displayed as 0 in the UI.
 */
export function computeWeightedEngagement(
  counts: Pick<EngagementCounts, "likes" | "comments" | "shares" | "saves">,
  weights: MetricWeights,
): number {
  return (
    counts.likes * weights.likeWeight +
    counts.comments * weights.commentWeight +
    counts.shares * weights.shareWeight +
    (counts.saves ?? 0) * weights.saveWeight
  );
}
