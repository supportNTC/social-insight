import { describe, expect, it } from "vitest";
import { pick, randomIntInRange, rngFor } from "./random";

describe("rngFor", () => {
  it("is deterministic: same key -> same sequence", () => {
    const a = rngFor("seed", "content-01");
    const b = rngFor("seed", "content-01");
    const sequenceA = Array.from({ length: 10 }, () => a());
    const sequenceB = Array.from({ length: 10 }, () => b());
    expect(sequenceA).toEqual(sequenceB);
  });

  it("differs for a different key", () => {
    const a = rngFor("seed", "content-01")();
    const b = rngFor("seed", "content-02")();
    expect(a).not.toBe(b);
  });

  it("stays within [0, 1)", () => {
    const rng = rngFor("seed", "range-check");
    for (let i = 0; i < 200; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("randomIntInRange", () => {
  it("is inclusive on both ends and never escapes the range", () => {
    const rng = rngFor("seed", "int-range");
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) {
      const value = randomIntInRange(rng, 1, 3);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(3);
      seen.add(value);
    }
    expect(seen).toEqual(new Set([1, 2, 3]));
  });
});

describe("pick", () => {
  it("only returns elements from the array", () => {
    const rng = rngFor("seed", "pick");
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 50; i += 1) {
      expect(items).toContain(pick(rng, items));
    }
  });

  it("throws on an empty array instead of returning undefined", () => {
    const rng = rngFor("seed", "pick-empty");
    expect(() => pick(rng, [])).toThrow();
  });
});
