import { prisma } from "@/lib/db";
import { DEFAULT_METRIC_WEIGHTS, type MetricWeights } from "@/lib/metrics";

export async function getMetricWeights(): Promise<MetricWeights> {
  const row = await prisma.metricWeights.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_METRIC_WEIGHTS; // seed.ts always creates it; this is a defensive fallback only
  return {
    likeWeight: row.likeWeight,
    commentWeight: row.commentWeight,
    shareWeight: row.shareWeight,
    saveWeight: row.saveWeight,
  };
}

/**
 * `updatedBy` is free text — CLAUDE.md: there is no auth/SSO decision yet, so
 * there is no real user identity to attribute this to.
 */
export async function updateMetricWeights(weights: MetricWeights, updatedBy: string): Promise<void> {
  await prisma.metricWeights.upsert({
    where: { id: 1 },
    update: { ...weights, updatedBy },
    create: { id: 1, ...weights, updatedBy },
  });
}
