import { describe, it, expect } from "vitest";
import { formatMmSs, formatCountdown, formatClock, ordinal } from "./format";

describe("formatMmSs", () => {
  it("rounds to nearest second (worked example)", () => {
    expect(formatMmSs(1_496_481)).toBe("24:56");
  });
  it("pads seconds, not minutes", () => {
    expect(formatMmSs(5 * 60_000)).toBe("5:00");
    expect(formatMmSs(65_000)).toBe("1:05");
  });
  it("clamps negatives to 0:00", () => {
    expect(formatMmSs(-5000)).toBe("0:00");
  });
});

describe("formatCountdown", () => {
  it("ceils so the final second reads 0:01 then 0:00", () => {
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatCountdown(1000)).toBe("0:01");
    expect(formatCountdown(0)).toBe("0:00");
  });
});

describe("formatClock", () => {
  it("formats HH:MM:SS 24-hour", () => {
    const d = new Date(2026, 4, 31, 9, 4, 7);
    expect(formatClock(d)).toBe("09:04:07");
  });
});

describe("ordinal", () => {
  it("handles common and teen cases", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(21)).toBe("21st");
  });
});
