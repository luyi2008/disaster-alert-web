import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bindDevice,
  deviceRouteKey,
  fetchDeviceSubscription,
  fetchDevices,
  matchDevice,
  saveDeviceSubscription,
} from "./api";

const DEVICE = {
  id: "dev-1",
  name: "设备1",
  deviceKey: "ynJ5Ft4atkMkWeo2PAvFhF",
  deviceTokenMasked: "toke****naaa",
  createdAt: 1,
  updatedAt: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BFF device client", () => {
  it("lists devices with credentials and without a Bark token header", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ success: true, message: "ok", data: { devices: [DEVICE] } }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchDevices();
    expect(result.status).toBe(200);
    expect(result.body.data?.devices[0]).toEqual(DEVICE);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/api/devices");
    expect(fetchMock.mock.calls[0]![1]?.credentials).toBe("include");
    expect(new Headers(fetchMock.mock.calls[0]![1]?.headers).get("Authorization")).toBeNull();
  });

  it("binds device_token and optional name", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ success: true, message: "ok", data: { device: DEVICE } }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    await bindDevice("short-apns-token", "厨房 iPhone");
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      device_token: "short-apns-token",
      name: "厨房 iPhone",
    });
    expect(init?.credentials).toBe("include");
  });

  it("omits name when binding without one", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ success: true, message: "ok", data: { device: DEVICE } }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    await bindDevice("short-apns-token");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({ device_token: "short-apns-token" });
  });

  it("matches devices by deviceKey for subscribe routes and keeps id for BFF paths", () => {
    expect(deviceRouteKey(DEVICE)).toBe(DEVICE.deviceKey);
    expect(matchDevice([DEVICE], DEVICE.deviceKey)).toEqual(DEVICE);
    expect(matchDevice([DEVICE], DEVICE.id)?.id).toBe(DEVICE.id);
    expect(matchDevice([DEVICE], "missing")).toBeUndefined();
  });

  it("GETs /api/devices/:device_key/subscription without Authorization", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ success: false, message: "没有订阅" }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchDeviceSubscription(DEVICE.deviceKey);
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(false);
    expect(String(fetchMock.mock.calls[0]![0])).toContain(`/api/devices/${DEVICE.deviceKey}/subscription`);
    expect(String(fetchMock.mock.calls[0]![0])).not.toContain(`/api/devices/${DEVICE.id}/`);
    expect(String(fetchMock.mock.calls[0]![0])).not.toContain("device_key=");
    expect(new Headers(fetchMock.mock.calls[0]![1]?.headers).get("Authorization")).toBeNull();
    expect(fetchMock.mock.calls[0]![1]?.credentials).toBe("include");
  });

  it("POSTs subscribe targets and alerts without destination", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ success: true, message: "ok", data: { saved: true } }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    await saveDeviceSubscription("dev-1", { targets: [], alerts: [] });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/api/devices/dev-1/subscribe");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ targets: [], alerts: [] });
    expect(JSON.parse(String(init?.body)).destination).toBeUndefined();
  });
});
