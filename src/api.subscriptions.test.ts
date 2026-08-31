import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSavedSubscriptions } from "./api";

const KEY = "ynJ5Ft4atkMkWeo2PAvFhF";

describe("fetchSavedSubscriptions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GETs /api/subscriptions with a Bearer header and keeps success: false", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ success: false, message: "没有订阅" }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchSavedSubscriptions(KEY);
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/subscriptions");
    expect(String(url)).not.toContain("device_key=");
    expect(new Headers((init as RequestInit).headers).get("Authorization")).toBe(`Bearer ${KEY}`);
  });
});
