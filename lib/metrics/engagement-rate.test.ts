import { describe, expect, it } from "vitest";
import { computeEngagementRate } from "./engagement-rate";
import { DEFAULT_METRIC_WEIGHTS } from "./types";

describe("computeEngagementRate", () => {
  it("uses reach as the basis when reach is reported", () => {
    const result = computeEngagementRate(
      { views: 1000, reach: 500, likes: 50, comments: 0, shares: 0, saves: null },
      DEFAULT_METRIC_WEIGHTS,
    );
    // weighted = 50*1 = 50; 50 / 500 * 100 = 10
    expect(result).toEqual({ value: 10, basis: "reach" });
  });

  it("falls back to views when reach is null — and flags the basis as views", () => {
    const result = computeEngagementRate(
      { views: 1000, reach: null, likes: 50, comments: 0, shares: 0, saves: null },
      DEFAULT_METRIC_WEIGHTS,
    );
    // weighted = 50; 50 / 1000 * 100 = 5
    expect(result).toEqual({ value: 5, basis: "views" });
  });

  it("returns null (not Infinity/NaN) when views is 0 and reach is null", () => {
    const result = computeEngagementRate(
      { views: 0, reach: null, likes: 0, comments: 0, shares: 0, saves: null },
      DEFAULT_METRIC_WEIGHTS,
    );
    expect(result).toBeNull();
  });

  it("returns null when reach is explicitly reported as 0 — does not silently fall back to views", () => {
    const result = computeEngagementRate(
      { views: 1000, reach: 0, likes: 50, comments: 0, shares: 0, saves: null },
      DEFAULT_METRIC_WEIGHTS,
    );
    expect(result).toBeNull();
  });

  it("never confuses null reach with 0 reach", () => {
    const nullReach = computeEngagementRate(
      { views: 100, reach: null, likes: 10, comments: 0, shares: 0, saves: null },
      DEFAULT_METRIC_WEIGHTS,
    );
    const zeroReach = computeEngagementRate(
      { views: 100, reach: 0, likes: 10, comments: 0, shares: 0, saves: null },
      DEFAULT_METRIC_WEIGHTS,
    );
    expect(nullReach).toEqual({ value: 10, basis: "views" });
    expect(zeroReach).toBeNull();
  });
});
