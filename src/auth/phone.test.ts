import { describe, expect, it } from "vitest";
import { nationalMainlandPhone, normalizeMainlandPhone } from "./phone";

describe("nationalMainlandPhone", () => {
  it("returns 11 digits without a +86 prefix", () => {
    expect(nationalMainlandPhone("13812345678")).toBe("13812345678");
    expect(nationalMainlandPhone("+8613812345678")).toBe("13812345678");
  });
});

describe("normalizeMainlandPhone", () => {
  it("accepts 11-digit mainland numbers", () => {
    expect(normalizeMainlandPhone("13812345678")).toBe("+8613812345678");
    expect(normalizeMainlandPhone("+8613812345678")).toBe("+8613812345678");
  });

  it("rejects invalid numbers", () => {
    expect(normalizeMainlandPhone("138")).toBeNull();
    expect(normalizeMainlandPhone("12345678901")).toBeNull();
  });
});
