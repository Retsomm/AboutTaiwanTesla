import { describe, expect, it } from "vitest";
import { selectPeriod, selectRange, toCsv, isStale } from "../src/domain/selectors";

const rows = [
  { period: "2026-06", count: 50, market: 500, share: 10, mom: null, yoy: null },
  { period: "2026-08", count: 100, market: 1000, share: 10, mom: null, yoy: null },
];
describe("verified dashboard selectors", () => {
  it("selects a published month without substituting another month", () => {
    expect(selectPeriod(rows, "2026-07")).toBeUndefined();
    expect(selectPeriod(rows, "2026-08")?.count).toBe(100);
  });
  it("limits ranges by calendar months, not array length", () => {
    expect(selectRange(rows, 1)).toHaveLength(1);
    expect(selectRange(rows, 3)).toHaveLength(2);
    expect(selectRange([], 12)).toEqual([]);
  });
  it("exports missing statistics as blank rather than zero", () => {
    expect(toCsv(rows)).toContain("2026-08,100,1000,10,,");
    expect(toCsv(rows)).not.toContain("null");
  });
  it("marks expired data independently of reported status", () => {
    expect(isStale("2026-10-01T00:00:00Z", "2026-10-09T00:00:00Z", 48)).toBe(true);
    expect(isStale(null, "2026-10-09T00:00:00Z", 48)).toBe(true);
  });
});
