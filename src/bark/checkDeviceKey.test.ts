import { afterEach, describe, expect, it, vi } from "vitest";
import { barkCheckUrl, checkDeviceKey, remoteStatusMessage } from "./checkDeviceKey";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkDeviceKey", () => {
  it("uses the Vite proxy path in development", () => {
    expect(barkCheckUrl()).toBe("/bark-check");
  });

  it("parses the check envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe("/bark-check?device_key=ynJ5Ft4atkMkWeo2PAvFhF");
        return new Response(
          JSON.stringify({
            code: 200,
            message: "success",
            data: {
              device_key: "ynJ5Ft4atkMkWeo2PAvFhF",
              valid: true,
              registered: true,
              reason: null,
            },
          }),
        );
      }),
    );

    await expect(checkDeviceKey("ynJ5Ft4atkMkWeo2PAvFhF")).resolves.toEqual({
      device_key: "ynJ5Ft4atkMkWeo2PAvFhF",
      valid: true,
      registered: true,
      reason: null,
    });
  });

  it("maps unregistered and invalid reasons", () => {
    expect(remoteStatusMessage({ device_key: "x", valid: true, registered: false, reason: null })).toContain("尚未");
    expect(
      remoteStatusMessage({
        device_key: "x",
        valid: false,
        registered: false,
        reason: "device key length is invalid",
      }),
    ).toContain("22");
    expect(
      remoteStatusMessage({
        device_key: "x",
        valid: false,
        registered: false,
        reason: "device key contains invalid characters",
      }),
    ).toContain("字母和数字");
  });
});
