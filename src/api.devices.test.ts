import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bindDevice,
  fetchDeviceSubscription,
  fetchDevices,
  saveDeviceSubscription,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BFF device client", () => {
  it("lists devices with credentials and without a Bark token header", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ success: true, message: "ok", data: { devices: [{ id: "dev-1", userId: "u1", name: "设备1", createdAt: 1, updatedAt: 1 }] } }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchDevices();
    expect(result.status).toBe(200);
    expect(result.body.data?.devices[0]?.id).toBe("dev-1");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/api/devices");
    expect(fetchMock.mock.calls[0]![1]?.credentials).toBe("include");
    expect(new Headers(fetchMock.mock.calls[0]![1]?.headers).get("Authorization")).toBeNull();
  });

  it("binds device_token and optional name", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ success: true, message: "ok", data: { device: { id: "dev-1", userId: "u1", name: "设备1", createdAt: 1, updatedAt: 1 } } }),
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
      JSON.stringify({ success: true, message: "ok", data: { device: { id: "dev-1", userId: "u1", name: "设备1", createdAt: 1, updatedAt: 1 } } }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    await bindDevice("short-apns-token");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({ device_token: "short-apns-token" });
  });

  it("GETs /api/devices/:id/subscription without Authorization", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ success: false, message: "没有订阅" }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchDeviceSubscription("dev-1");
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(false);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/api/devices/dev-1/subscription");
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
