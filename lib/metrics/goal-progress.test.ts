import { describe, expect, it } from "vitest";
import { computeGoalProgress } from "./goal-progress";

describe("computeGoalProgress", () => {
  it("computes a ratio below 1 when under target", () => {
    expect(computeGoalProgress(30, 100)).toEqual({ actual: 30, target: 100, ratio: 0.3 });
  });

  it("computes a ratio above 1 when over target — not capped", () => {
    expect(computeGoalProgress(150, 100)).toEqual({ actual: 150, target: 100, ratio: 1.5 });
  });

  it("returns null (not 0 or Infinity) when target is 0", () => {
    expect(computeGoalProgress(10, 0).ratio).toBeNull();
  });

  it("returns null when target is negative", () => {
    expect(computeGoalProgress(10, -5).ratio).toBeNull();
  });

  it("is 0 progress when actual is 0 and target is positive", () => {
    expect(computeGoalProgress(0, 100)).toEqual({ actual: 0, target: 100, ratio: 0 });
  });
});
