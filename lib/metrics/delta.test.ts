import { describe, expect, it } from "vitest";
import { computeDeltas } from "./delta";

describe("computeDeltas", () => {
  it("treats the first snapshot's delta as the snapshot itself", () => {
    const result = computeDeltas([{ snapshotDate: "2026-09-01", value: 100 }]);
    expect(result).toEqual([{ snapshotDate: "2026-09-01", delta: 100 }]);
  });

  it("subtracts the previous cumulative value on later days", () => {
    const result = computeDeltas([
      { snapshotDate: "2026-09-01", value: 100 },
      { snapshotDate: "2026-09-02", value: 150 },
      { snapshotDate: "2026-09-03", value: 150 },
    ]);
    expect(result).toEqual([
      { snapshotDate: "2026-09-01", delta: 100 },
      { snapshotDate: "2026-09-02", delta: 50 },
      { snapshotDate: "2026-09-03", delta: 0 },
    ]);
  });

  it("keeps a null value as a null delta instead of treating it as 0", () => {
    const result = computeDeltas([
      { snapshotDate: "2026-09-01", value: 100 },
      { snapshotDate: "2026-09-02", value: null },
      { snapshotDate: "2026-09-03", value: 130 },
    ]);
    expect(result).toEqual([
      { snapshotDate: "2026-09-01", delta: 100 },
      { snapshotDate: "2026-09-02", delta: null },
      // Diffs against the last real value (100), not against the null gap.
      { snapshotDate: "2026-09-03", delta: 30 },
    ]);
  });

  it("returns an empty array for an empty series", () => {
    expect(computeDeltas([])).toEqual([]);
  });
});
