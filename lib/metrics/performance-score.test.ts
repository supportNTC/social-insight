import { describe, expect, it } from "vitest";
import { computePerformanceScore } from "./performance-score";
import type { EngagementRateResult } from "./types";

const reach = (value: number): EngagementRateResult => ({ value, basis: "reach" });
const views = (value: number): EngagementRateResult => ({ value, basis: "views" });

describe("computePerformanceScore", () => {
  it("is 1.0 when the content matches the account median exactly", () => {
    expect(computePerformanceScore(reach(5), [reach(4), reach(5), reach(6)])).toBe(1);
  });

  it("returns null for a new content with no baseline yet (empty history)", () => {
    expect(computePerformanceScore(reach(5), [])).toBeNull();
  });

  it("returns null when the account median happens to be 0 (division by zero)", () => {
    expect(computePerformanceScore(reach(5), [reach(0), reach(0)])).toBeNull();
  });

  it("only compares against history sharing the same ER basis", () => {
    // The views-basis entries would drag the median down to 1 if included;
    // they must be filtered out, leaving only the reach-basis median (10).
    const history = [reach(8), reach(10), reach(12), views(1), views(1), views(1)];
    expect(computePerformanceScore(reach(10), history)).toBe(1);
  });

  it("returns null when history exists but none of it shares the content's basis", () => {
    expect(computePerformanceScore(reach(10), [views(5), views(6)])).toBeNull();
  });

  it("works with a small sample — account with fewer than 5 contents", () => {
    const score = computePerformanceScore(reach(9), [reach(6), reach(12)]);
    // median([6, 12]) = 9 -> 9 / 9 = 1
    expect(score).toBe(1);
  });
});
