/**
 * Everything in lib/metrics/ is pure — no Prisma, no I/O. Callers (the query
 * layer, Stage 4) fetch rows and pass plain data in; that's what makes every
 * formula here trivially unit-testable without a database.
 */

export type MetricWeights = {
  likeWeight: number;
  commentWeight: number;
  shareWeight: number;
  saveWeight: number;
};

/** Mirrors prisma/schema.prisma MetricWeights `@default`s — keep in sync by hand. */
export const DEFAULT_METRIC_WEIGHTS: MetricWeights = {
  likeWeight: 1,
  commentWeight: 3,
  shareWeight: 5,
  saveWeight: 4,
};

/** Which number engagement rate was divided by. Must always travel with the ER value — never show one without the other. */
export type ErBasis = "reach" | "views";

export type EngagementRateResult = {
  /** Already scaled ×100 — 4.7 means "4.7%", not a 0..1 fraction. */
  value: number;
  basis: ErBasis;
};

export type EngagementCounts = {
  views: number;
  /** Null when the platform doesn't report reach — never substitute 0. */
  reach: number | null;
  likes: number;
  comments: number;
  shares: number;
  /** Null when the platform has no save/bookmark concept. */
  saves: number | null;
};
