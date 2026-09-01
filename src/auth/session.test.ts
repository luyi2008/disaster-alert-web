import { afterEach, describe, expect, it, vi } from "vitest";
import { getSession, signOut } from "./session";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getSession", () => {
  it("returns the user when Better Auth has a session", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain("/api/auth/get-session");
      expect(init?.credentials).toBe("include");
      return new Response(JSON.stringify({ user: { id: "u1", name: "微信用户" } }), { status: 200 });
    }));
    await expect(getSession()).resolves.toEqual({ user: { id: "u1", name: "微信用户" } });
  });

  it("returns null when the body has no user", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("null", { status: 200 })));
    await expect(getSession()).resolves.toBeNull();
  });
});

describe("signOut", () => {
  it("POSTs /api/auth/sign-out with credentials", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await signOut();
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/api/auth/sign-out");
    expect(fetchMock.mock.calls[0]![1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[0]![1]?.credentials).toBe("include");
  });
});
