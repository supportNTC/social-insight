import { describe, expect, it } from "vitest";
import { addDays, daysBetween, snapshotDateFor } from "@/lib/datetime";
import { anchorDateFromSeed, generateMockUniverse, type GeneratedAccount } from "./generate";

const SEED = "20260907";
const ANCHOR = "2026-09-07";

/** `!` is banned project-wide — this is the sanctioned "or throw" instead. */
function mustFind<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

describe("anchorDateFromSeed", () => {
  it("reads MOCK_SEED as YYYYMMDD", () => {
    expect(anchorDateFromSeed("20260907")).toBe("2026-09-07");
  });

  it("rejects a seed that isn't 8 digits", () => {
    expect(() => anchorDateFromSeed("2026-09-07")).toThrow(RangeError);
    expect(() => anchorDateFromSeed("abc")).toThrow(RangeError);
  });

  it("rejects an 8-digit seed that isn't a real calendar date", () => {
    expect(() => anchorDateFromSeed("20260230")).toThrow(RangeError);
  });
});

describe("generateMockUniverse", () => {
  it("is fully deterministic for a given seed", () => {
    const a = generateMockUniverse(SEED);
    const b = generateMockUniverse(SEED);
    // Dates compare by reference, not value — normalize through JSON so the
    // whole tree (including nested Date fields) round-trips to primitives.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produces one account per platform with ~120 contents total", () => {
    const universe = generateMockUniverse(SEED);
    expect(universe.map((a) => a.account.platform).sort()).toEqual([
      "facebook",
      "instagram",
      "tiktok",
    ]);

    const totalContents = universe.reduce((sum, a) => sum + a.contents.length, 0);
    expect(totalContents).toBe(120);
  });

  it("gives every account a content item published within the rising window", () => {
    const universe = generateMockUniverse(SEED);
    for (const { contents } of universe) {
      const recent = contents.filter(
        (c) => daysBetween(snapshotDateFor(c.publishedAt), ANCHOR) <= 2,
      );
      expect(recent.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("never fabricates content-level reach for TikTok (null, not 0)", () => {
    const universe = generateMockUniverse(SEED);
    const tiktok = findAccount(universe, "tiktok");
    expect(tiktok.contentMetrics.length).toBeGreaterThan(0);
    for (const metric of tiktok.contentMetrics) {
      expect(metric.reach).toBeNull();
    }
    expect(tiktok.accountMetrics.every((m) => m.reach === null)).toBe(true);
  });

  it("reports content-level reach as a number for Facebook and Instagram", () => {
    const universe = generateMockUniverse(SEED);
    for (const platform of ["facebook", "instagram"] as const) {
      const account = findAccount(universe, platform);
      for (const metric of account.contentMetrics) {
        expect(typeof metric.reach).toBe("number");
      }
    }
  });

  it("keeps cumulative views non-decreasing across consecutive snapshots", () => {
    const universe = generateMockUniverse(SEED);
    for (const { contents, contentMetrics } of universe) {
      for (const content of contents) {
        const series = contentMetrics
          .filter((m) => m.contentExternalId === content.externalId)
          .sort((x, y) => (x.snapshotDate < y.snapshotDate ? -1 : 1));

        for (let i = 1; i < series.length; i += 1) {
          const previous = mustFind(series[i - 1], "missing snapshot");
          const current = mustFind(series[i], "missing snapshot");
          expect(current.views).toBeGreaterThanOrEqual(previous.views);
        }
      }
    }
  });

  it("gives account-level daily metrics a full 91-day history ending on the anchor", () => {
    const universe = generateMockUniverse(SEED);
    for (const { accountMetrics } of universe) {
      expect(accountMetrics.length).toBe(91);
      const last = mustFind(accountMetrics.at(-1), "empty accountMetrics");
      const first = mustFind(accountMetrics[0], "empty accountMetrics");
      expect(last.snapshotDate).toBe(ANCHOR);
      expect(first.followerDelta).toBeNull();
    }
  });

  it("never lets a content's publish date fall after the anchor", () => {
    const universe = generateMockUniverse(SEED);
    for (const { contents } of universe) {
      for (const content of contents) {
        expect(daysBetween(snapshotDateFor(content.publishedAt), ANCHOR)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

function findAccount(universe: GeneratedAccount[], platform: string): GeneratedAccount {
  return mustFind(
    universe.find((a) => a.account.platform === platform),
    `no generated account for platform "${platform}"`,
  );
}

// Sanity check the addDays helper is actually being exercised the way this
// suite assumes (anchor minus 90 days is a real, earlier calendar date).
describe("fixture sanity", () => {
  it("anchor - 90 days is before the anchor", () => {
    expect(daysBetween(addDays(ANCHOR, -90), ANCHOR)).toBe(90);
  });
});
