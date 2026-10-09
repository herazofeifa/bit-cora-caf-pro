import { describe, expect, it } from "vitest";
import { crDay, crRange, inCrRange } from "@/lib/date-range";

describe("inclusive day ranges in Costa Rica time", () => {
  it("hasta=today includes a delivery at 23:16 UTC that same day (17:16 in Costa Rica)", () => {
    const r = crRange("2026-01-01", "2026-10-09");
    const t = "2026-10-09T23:16:00Z";
    expect(t >= r.from && new Date(t) < new Date(r.toExclusive)).toBe(true);
    expect(inCrRange(t, "2026-01-01", "2026-10-09")).toBe(true);
  });
  it("end of range is the start of the next Costa Rica day (06:00 UTC)", () => {
    expect(crRange("2026-10-09", "2026-10-09")).toEqual({ from: "2026-10-09T06:00:00.000Z", toExclusive: "2026-10-10T06:00:00.000Z" });
  });
  it("05:59 UTC belongs to the previous Costa Rica day; 06:00 UTC to the new one", () => {
    expect(crDay("2026-10-10T05:59:59Z")).toBe("2026-10-09");
    expect(crDay("2026-10-10T06:00:00Z")).toBe("2026-10-10");
    expect(inCrRange("2026-10-10T05:59:59Z", "2026-10-01", "2026-10-09")).toBe(true);
    expect(inCrRange("2026-10-10T06:00:00Z", "2026-10-01", "2026-10-09")).toBe(false);
  });
  it("plain dates are compared as calendar days", () => {
    expect(inCrRange("2026-10-09", "2026-10-09", "2026-10-09")).toBe(true);
  });
});
