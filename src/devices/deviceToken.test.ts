import { describe, expect, it } from "vitest";
import { deviceTokenMessage, validateDeviceToken } from "./deviceToken";

describe("validateDeviceToken", () => {
  it("rejects empty values", () => {
    expect(validateDeviceToken(null)).toBe("empty");
    expect(validateDeviceToken("")).toBe("empty");
    expect(validateDeviceToken("   ")).toBe("empty");
    expect(deviceTokenMessage("empty")).toBe("请输入 device_token");
  });

  it("rejects tokens longer than 128", () => {
    expect(validateDeviceToken("a".repeat(129))).toBe("length");
    expect(validateDeviceToken("a".repeat(128))).toBeNull();
    expect(deviceTokenMessage("length")).toBe("device_token 长度不能超过 128");
  });

  it("rejects the literal deleted token", () => {
    expect(validateDeviceToken("deleted")).toBe("deleted");
    expect(validateDeviceToken(" deleted ")).toBe("deleted");
    expect(validateDeviceToken("Deleted")).toBeNull();
    expect(deviceTokenMessage("deleted")).toBe("device_token 不能为 deleted");
  });

  it("accepts a short non-empty token", () => {
    expect(validateDeviceToken("short")).toBeNull();
  });
});
