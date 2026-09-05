import { describe, expect, it } from "vitest";
import { normalizeMainlandPhone } from "./phone";

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
