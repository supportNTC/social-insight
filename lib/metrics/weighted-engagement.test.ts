import { describe, expect, it } from "vitest";
import { computeWeightedEngagement } from "./weighted-engagement";
import { DEFAULT_METRIC_WEIGHTS } from "./types";

describe("computeWeightedEngagement", () => {
  it("applies each weight to its own counter", () => {
    const result = computeWeightedEngagement(
      { likes: 10, comments: 2, shares: 1, saves: 3 },
      { likeWeight: 1, commentWeight: 3, shareWeight: 5, saveWeight: 4 },
    );
    // 10*1 + 2*3 + 1*5 + 3*4 = 10 + 6 + 5 + 12
    expect(result).toBe(33);
  });

  it("treats null saves as 0 — not as missing data to error on", () => {
    const result = computeWeightedEngagement(
      { likes: 10, comments: 0, shares: 0, saves: null },
      DEFAULT_METRIC_WEIGHTS,
    );
    expect(result).toBe(10);
  });

  it("is 0 when every counter is 0", () => {
    const result = computeWeightedEngagement(
      { likes: 0, comments: 0, shares: 0, saves: 0 },
      DEFAULT_METRIC_WEIGHTS,
    );
    expect(result).toBe(0);
  });
});
