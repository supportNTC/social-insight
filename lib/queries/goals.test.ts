import { describe, expect, it } from "vitest";
import { addMonths, currentMonthKey, isMonthKey, monthEnd, monthStart } from "./goals";

describe("isMonthKey", () => {
  it("accepts YYYY-MM", () => {
    expect(isMonthKey("2026-09")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isMonthKey("2026-9")).toBe(false);
    expect(isMonthKey("2026-09-01")).toBe(false);
    expect(isMonthKey(undefined)).toBe(false);
    expect(isMonthKey("")).toBe(false);
  });
});

describe("currentMonthKey", () => {
  it("takes the year-month prefix of a snapshot date", () => {
    expect(currentMonthKey("2026-09-07")).toBe("2026-09");
  });
});

describe("monthStart / monthEnd", () => {
  it("gives the first and last day of a 31-day month", () => {
    expect(monthStart("2026-08")).toBe("2026-08-01");
    expect(monthEnd("2026-08")).toBe("2026-08-31");
  });

  it("gives the last day of a 30-day month", () => {
    expect(monthEnd("2026-09")).toBe("2026-09-30");
  });

  it("handles February in a leap year", () => {
    expect(monthEnd("2028-02")).toBe("2028-02-29");
  });

  it("handles February in a non-leap year", () => {
    expect(monthEnd("2026-02")).toBe("2026-02-28");
  });

  it("rolls December over correctly", () => {
    expect(monthEnd("2026-12")).toBe("2026-12-31");
  });

  it("rejects a malformed month key", () => {
    expect(() => monthStart("2026-9")).toThrow(RangeError);
  });
});

describe("addMonths", () => {
  it("adds within the same year", () => {
    expect(addMonths("2026-09", 2)).toBe("2026-11");
  });

  it("rolls forward across a year boundary", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
  });

  it("rolls backward across a year boundary", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("is a no-op for delta 0", () => {
    expect(addMonths("2026-09", 0)).toBe("2026-09");
  });
});
