import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BARK_KEY_STORAGE_KEY,
  clearCachedBarkKey,
  confirmBarkKey,
  maybeExpireBarkSession,
  readCachedBarkKey,
  writeCachedBarkKey,
} from "./session";
import { resolveBarkKey } from "../subscribe/barkKeyState";

const KEY = "ynJ5Ft4atkMkWeo2PAvFhF";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function stubCheck(data: { valid: boolean; registered: boolean } | "throw" | "http") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (data === "throw") {
        throw new Error("network");
      }
      if (data === "http") {
        return new Response("nope", { status: 500 });
      }
      return new Response(
        JSON.stringify({
          code: 200,
          message: "success",
          data: {
            device_key: KEY,
            valid: data.valid,
            registered: data.registered,
            reason: null,
          },
        }),
      );
    }),
  );
}

describe("bark session storage", () => {
  it("round-trips a locally valid key and drops illegal cache", () => {
    expect(readCachedBarkKey()).toBeNull();
    writeCachedBarkKey(KEY);
    expect(localStorage.getItem(BARK_KEY_STORAGE_KEY)).toBe(KEY);
    expect(readCachedBarkKey()).toBe(KEY);
    writeCachedBarkKey("not-a-key");
    expect(readCachedBarkKey()).toBeNull();
    writeCachedBarkKey(KEY);
    localStorage.setItem(BARK_KEY_STORAGE_KEY, "short");
    expect(readCachedBarkKey()).toBeNull();
    expect(localStorage.getItem(BARK_KEY_STORAGE_KEY)).toBeNull();
  });

  it("resolves location state before cache", () => {
    writeCachedBarkKey(KEY);
    expect(resolveBarkKey({ barkKey: KEY })).toBe(KEY);
    expect(resolveBarkKey(null)).toBe(KEY);
    clearCachedBarkKey();
    expect(resolveBarkKey({ barkKey: KEY })).toBe(KEY);
    expect(resolveBarkKey(null)).toBeNull();
  });
});

describe("confirmBarkKey", () => {
  it("returns ok, rejected, or unavailable", async () => {
    stubCheck({ valid: true, registered: true });
    await expect(confirmBarkKey(KEY)).resolves.toBe("ok");
    stubCheck({ valid: true, registered: false });
    await expect(confirmBarkKey(KEY)).resolves.toBe("rejected");
    stubCheck({ valid: false, registered: false });
    await expect(confirmBarkKey(KEY)).resolves.toBe("rejected");
    stubCheck("http");
    await expect(confirmBarkKey(KEY)).resolves.toBe("unavailable");
    stubCheck("throw");
    await expect(confirmBarkKey(KEY)).resolves.toBe("unavailable");
  });
});

describe("maybeExpireBarkSession", () => {
  it("expires only when /check rejects after a suspicious status", async () => {
    writeCachedBarkKey(KEY);
    stubCheck({ valid: true, registered: false });
    await expect(maybeExpireBarkSession(KEY, 502, "subscribe")).resolves.toBe(true);
    expect(readCachedBarkKey()).toBeNull();

    writeCachedBarkKey(KEY);
    stubCheck({ valid: true, registered: true });
    await expect(maybeExpireBarkSession(KEY, 401, "bearer")).resolves.toBe(false);
    expect(readCachedBarkKey()).toBe(KEY);

    stubCheck("throw");
    await expect(maybeExpireBarkSession(KEY, 502, "subscribe")).resolves.toBe(false);
    expect(readCachedBarkKey()).toBe(KEY);

    await expect(maybeExpireBarkSession(KEY, 404, "bearer")).resolves.toBe(false);
    expect(readCachedBarkKey()).toBe(KEY);
  });

  it("expires a locally invalid key without calling /check", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    writeCachedBarkKey(KEY);
    await expect(maybeExpireBarkSession("nope", 200, "subscribe")).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(readCachedBarkKey()).toBeNull();
  });
});
