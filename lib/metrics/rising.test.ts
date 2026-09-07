import { describe, expect, it } from "vitest";
import { isRising, RISING_MAX_AGE_HOURS, RISING_VELOCITY_THRESHOLD } from "./rising";

const NOW = new Date("2026-09-07T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

describe("isRising", () => {
  it("is true at exactly the velocity threshold and well within the age window", () => {
    expect(
      isRising({ velocity: RISING_VELOCITY_THRESHOLD, publishedAt: hoursAgo(1), now: NOW }),
    ).toBe(true);
  });

  it("is false just under the velocity threshold", () => {
    expect(
      isRising({ velocity: RISING_VELOCITY_THRESHOLD - 0.01, publishedAt: hoursAgo(1), now: NOW }),
    ).toBe(false);
  });

  it("is true at exactly the age boundary", () => {
    expect(isRising({ velocity: 2, publishedAt: hoursAgo(RISING_MAX_AGE_HOURS), now: NOW })).toBe(
      true,
    );
  });

  it("is false just past the age boundary", () => {
    expect(
      isRising({ velocity: 2, publishedAt: hoursAgo(RISING_MAX_AGE_HOURS + 0.01), now: NOW }),
    ).toBe(false);
  });

  it("is never true when velocity has no baseline yet (null)", () => {
    expect(isRising({ velocity: null, publishedAt: hoursAgo(1), now: NOW })).toBe(false);
  });

  it("is false for a publishedAt after now (clock skew / bad data), not true via a negative age", () => {
    const future = new Date(NOW.getTime() + 3_600_000);
    expect(isRising({ velocity: 10, publishedAt: future, now: NOW })).toBe(false);
  });
});
