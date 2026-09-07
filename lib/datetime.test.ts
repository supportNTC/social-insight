import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  eachDay,
  snapshotDateFor,
  snapshotDateFromColumn,
  snapshotDateToColumn,
} from "./datetime";

describe("snapshotDateFor", () => {
  it("uses the Asia/Bangkok day, not the UTC day", () => {
    // 16:59:59Z is still 23:59:59 on the 6th in Bangkok.
    expect(snapshotDateFor(new Date("2026-09-06T16:59:59Z"))).toBe("2026-09-06");
    // 17:00:00Z is 00:00:00 on the 7th in Bangkok.
    expect(snapshotDateFor(new Date("2026-09-06T17:00:00Z"))).toBe("2026-09-07");
  });

  it("handles the UTC year boundary", () => {
    expect(snapshotDateFor(new Date("2025-12-31T17:00:00Z"))).toBe("2026-01-01");
  });

  it("rejects an invalid Date", () => {
    expect(() => snapshotDateFor(new Date("nope"))).toThrow(RangeError);
  });
});

describe("snapshot date column round-trip", () => {
  it("stores a day label as UTC midnight", () => {
    expect(snapshotDateToColumn("2026-09-07").toISOString()).toBe(
      "2026-09-07T00:00:00.000Z",
    );
  });

  it("round-trips, including a real leap day", () => {
    for (const label of ["2026-09-07", "2028-02-29", "2026-01-01"]) {
      expect(snapshotDateFromColumn(snapshotDateToColumn(label))).toBe(label);
    }
  });

  it("rejects a malformed label", () => {
    expect(() => snapshotDateToColumn("2026-9-7")).toThrow(RangeError);
    expect(() => snapshotDateToColumn("07/09/2026")).toThrow(RangeError);
  });

  it("rejects a day that does not exist instead of rolling it over", () => {
    // 2026 is not a leap year — Date would silently give us 2026-03-01.
    expect(() => snapshotDateToColumn("2026-02-29")).toThrow(RangeError);
    expect(() => snapshotDateToColumn("2026-04-31")).toThrow(RangeError);
    expect(() => snapshotDateToColumn("2026-13-01")).toThrow(RangeError);
  });
});

describe("addDays / daysBetween / eachDay", () => {
  it("crosses a month boundary", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
  });

  it("crosses a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("measures a 90 day window", () => {
    expect(daysBetween("2026-06-09", "2026-09-07")).toBe(90);
    expect(daysBetween("2026-09-07", "2026-06-09")).toBe(-90);
  });

  it("lists days inclusively", () => {
    expect(eachDay("2026-09-05", "2026-09-07")).toEqual([
      "2026-09-05",
      "2026-09-06",
      "2026-09-07",
    ]);
    expect(eachDay("2026-09-07", "2026-09-07")).toEqual(["2026-09-07"]);
  });

  it("returns nothing for a reversed range", () => {
    expect(eachDay("2026-09-07", "2026-09-05")).toEqual([]);
  });
});
