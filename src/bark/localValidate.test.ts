import { describe, expect, it } from "vitest";
import { localValidateBarkKey, localValidateMessage } from "./localValidate";

describe("localValidateBarkKey", () => {
  it("rejects empty values", () => {
    expect(localValidateBarkKey(null)).toBe("empty");
    expect(localValidateBarkKey("")).toBe("empty");
    expect(localValidateMessage("empty")).toContain("测试链接");
  });

  it("requires length 22", () => {
    expect(localValidateBarkKey("abc")).toBe("length");
    expect(localValidateBarkKey("a".repeat(21))).toBe("length");
    expect(localValidateBarkKey("a".repeat(23))).toBe("length");
    expect(localValidateMessage("length")).toContain("22");
  });

  it("rejects non-alphanumeric characters", () => {
    expect(localValidateBarkKey("ynJ5Ft4atkMkWeo2PAvFh-")).toBe("characters");
    expect(localValidateMessage("characters")).toContain("字母和数字");
  });

  it("accepts a 22-character alphanumeric key", () => {
    expect(localValidateBarkKey("ynJ5Ft4atkMkWeo2PAvFhF")).toBeNull();
  });
});
