import { describe, expect, it } from "vitest";
import { deviceTokenMessage, validateDeviceToken } from "./deviceToken";

describe("validateDeviceToken", () => {
  it("rejects empty values", () => {
    expect(validateDeviceToken(null)).toBe("empty");
    expect(validateDeviceToken("")).toBe("empty");
    expect(validateDeviceToken("   ")).toBe("empty");
    expect(deviceTokenMessage("empty")).toBe("请输入推送令牌");
  });

  it("rejects tokens longer than 128", () => {
    expect(validateDeviceToken("a".repeat(129))).toBe("length");
    expect(validateDeviceToken("a".repeat(128))).toBeNull();
    expect(deviceTokenMessage("length")).toBe("推送令牌长度不能超过 128 位");
  });

  it("rejects the literal deleted token", () => {
    expect(validateDeviceToken("deleted")).toBe("deleted");
    expect(validateDeviceToken(" deleted ")).toBe("deleted");
    expect(validateDeviceToken("Deleted")).toBeNull();
    expect(deviceTokenMessage("deleted")).toBe("推送令牌不能为 deleted");
  });

  it("accepts a short non-empty token", () => {
    expect(validateDeviceToken("short")).toBeNull();
  });
});
