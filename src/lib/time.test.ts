import { describe, expect, it } from "vitest";
import { formatAbsoluteTime } from "./time";

describe("formatAbsoluteTime", () => {
  it("formats an epoch as a local YYYY-MM-DD HH:mm:ss timestamp", () => {
    const ms = new Date(2026, 8, 24, 15, 40, 58).getTime();
    expect(formatAbsoluteTime(ms)).toBe("2026-09-24 15:40:58");
  });

  it("returns an empty string for an invalid timestamp", () => {
    expect(formatAbsoluteTime(Number.NaN)).toBe("");
  });
});
