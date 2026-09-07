import { describe, expect, it } from "vitest";
import { median } from "./median";

describe("median", () => {
  it("returns null for an empty array — no data, not 0", () => {
    expect(median([])).toBeNull();
  });

  it("returns the middle value for an odd-length array", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("averages the two middle values for an even-length array", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("handles a single value", () => {
    expect(median([42])).toBe(42);
  });

  it("does not mutate its input", () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });

  it("handles a small sample (account with < 5 contents)", () => {
    expect(median([10, 20])).toBe(15);
    expect(median([10, 20, 30])).toBe(20);
  });
});
