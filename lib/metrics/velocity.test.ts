import { describe, expect, it } from "vitest";
import { computeVelocity } from "./velocity";

describe("computeVelocity", () => {
  it("is 1.0 when first-24h views matches the recent median exactly", () => {
    expect(computeVelocity(100, [80, 100, 120])).toBe(1);
  });

  it("is >= 1.5 for a clip that clearly outpaces recent history", () => {
    expect(computeVelocity(300, [80, 100, 120])).toBeGreaterThanOrEqual(1.5);
  });

  it("returns null for a brand-new account with no comparison set yet", () => {
    expect(computeVelocity(100, [])).toBeNull();
  });

  it("returns null when the recent median is 0 (division by zero)", () => {
    expect(computeVelocity(100, [0, 0, 0])).toBeNull();
  });

  it("works with a small sample — account with fewer than 5 contents", () => {
    expect(computeVelocity(50, [25, 75])).toBe(1);
  });

  it("does not mutate the caller's array", () => {
    const recent = [80, 100, 120];
    computeVelocity(100, recent);
    expect(recent).toEqual([80, 100, 120]);
  });
});
