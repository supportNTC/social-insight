import { describe, expect, it } from "vitest";
import {
  DEFAULT_UNDERPERFORMANCE_THRESHOLDS,
  diagnoseUnderperformance,
  type UnderperformanceInput,
} from "./underperformance";

/** A content that clears every step comfortably; tests override one field at a time. */
const healthy: UnderperformanceInput = {
  reachAtMaturity: 1000,
  medianReachAtMaturity: 1000,
  viewsAtMaturity: 1800,
  medianViewsAtMaturity: 1800,
  performanceScore: 1.1,
};

describe("diagnoseUnderperformance", () => {
  it("returns null when nothing is below normal", () => {
    expect(diagnoseUnderperformance(healthy)).toBeNull();
  });

  it("reports the reach step when reach is the first failure", () => {
    const result = diagnoseUnderperformance({
      ...healthy,
      reachAtMaturity: 300,
      viewsAtMaturity: 100,
      performanceScore: 0.1,
    });
    // views and engagement are ALSO below threshold here — the funnel must
    // report the earliest broken step, not the worst one.
    expect(result).toEqual({ stage: "reach", ratio: 0.3 });
  });

  it("moves on to views when reach is normal", () => {
    const result = diagnoseUnderperformance({ ...healthy, viewsAtMaturity: 540 });
    expect(result).toEqual({ stage: "views", ratio: 0.3 });
  });

  it("reports engagement only when reach and views are both normal", () => {
    const result = diagnoseUnderperformance({ ...healthy, performanceScore: 0.4 });
    expect(result).toEqual({ stage: "engagement", ratio: 0.4 });
  });

  it("skips the reach step for a platform that reports no reach (TikTok)", () => {
    const result = diagnoseUnderperformance({
      ...healthy,
      reachAtMaturity: null,
      medianReachAtMaturity: null,
      viewsAtMaturity: 200,
    });
    expect(result).toEqual({ stage: "views", ratio: 200 / 1800 });
  });

  it("skips a step whose baseline is missing rather than failing it", () => {
    const result = diagnoseUnderperformance({
      ...healthy,
      reachAtMaturity: 1,
      medianReachAtMaturity: null,
    });
    expect(result).toBeNull();
  });

  it("skips a step whose baseline is 0 instead of dividing by zero", () => {
    const result = diagnoseUnderperformance({
      ...healthy,
      reachAtMaturity: 0,
      medianReachAtMaturity: 0,
      viewsAtMaturity: 0,
      medianViewsAtMaturity: 0,
    });
    expect(result).toBeNull();
  });

  it("treats a null performance score as unknown, never as a failure", () => {
    expect(diagnoseUnderperformance({ ...healthy, performanceScore: null })).toBeNull();
  });

  it("does not flag a content sitting exactly on the threshold", () => {
    expect(
      diagnoseUnderperformance({ ...healthy, reachAtMaturity: 500 }),
    ).toBeNull();
    expect(diagnoseUnderperformance({ ...healthy, performanceScore: 0.5 })).toBeNull();
  });

  it("honours caller-supplied thresholds", () => {
    const stricter = { reachRatio: 0.2, viewsRatio: 0.2, performanceScore: 0.2 };
    const input = { ...healthy, reachAtMaturity: 400 };

    expect(diagnoseUnderperformance(input)).toEqual({ stage: "reach", ratio: 0.4 });
    expect(diagnoseUnderperformance(input, stricter)).toBeNull();
  });

  it("defaults to the documented 50 / 50 / 0.5 thresholds", () => {
    expect(DEFAULT_UNDERPERFORMANCE_THRESHOLDS).toEqual({
      reachRatio: 0.5,
      viewsRatio: 0.5,
      performanceScore: 0.5,
    });
  });
});
