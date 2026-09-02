import { describe, expect, it } from "vitest";
import { rewriteLoopbackHost } from "./rewriteLoopbackHost";

describe("rewriteLoopbackHost", () => {
  it("rewrites localhost Vite origin to the BFF default trusted origin", () => {
    expect(rewriteLoopbackHost("http://localhost:5173")).toBe("http://127.0.0.1:5173");
  });

  it("rewrites IPv6 loopback origin", () => {
    expect(rewriteLoopbackHost("http://[::1]:5173")).toBe("http://127.0.0.1:5173");
  });

  it("keeps 127.0.0.1 and referer paths", () => {
    expect(rewriteLoopbackHost("http://127.0.0.1:5173")).toBe("http://127.0.0.1:5173");
    expect(rewriteLoopbackHost("http://localhost:5173/login")).toBe("http://127.0.0.1:5173/login");
  });

  it("leaves missing values unchanged", () => {
    expect(rewriteLoopbackHost(undefined)).toBeUndefined();
  });
});
