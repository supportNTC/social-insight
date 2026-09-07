import { median } from "./median";

/**
 * velocity = first24hViews / median(first24hViews of the 20 most recent
 * contents in the same account)
 *
 * `recentFirst24hViews` is whatever the caller judged "recent" (Stage 4's
 * query layer supplies up to 20, excluding the content being scored) — this
 * function only does the division. Returns null, not 0 or 1, when there's no
 * comparison set yet (a brand-new account, or every comparable value being 0).
 */
export function computeVelocity(
  first24hViews: number,
  recentFirst24hViews: readonly number[],
): number | null {
  const baseline = median([...recentFirst24hViews]);
  if (baseline === null || baseline === 0) return null;

  return first24hViews / baseline;
}
