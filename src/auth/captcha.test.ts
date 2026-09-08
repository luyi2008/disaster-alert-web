import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CaptchaError,
  fetchCaptchaChallenge,
  parseCaptchaChallenge,
  sendSmsAfterCaptcha,
} from "./captcha";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32"><text>42</text></svg>`;

describe("parseCaptchaChallenge", () => {
  it("reads token and svg from a flat body", () => {
    expect(parseCaptchaChallenge({ token: "tok-1", svg: SAMPLE_SVG })).toEqual({
      token: "tok-1",
      svg: SAMPLE_SVG,
    });
  });

  it("reads nested data envelopes and alternate field names", () => {
    expect(
      parseCaptchaChallenge({
        success: true,
        data: { captchaToken: "tok-2", image: "data:image/svg+xml;utf8,<svg></svg>" },
      }),
    ).toEqual({
      token: "tok-2",
      svg: "data:image/svg+xml;utf8,<svg></svg>",
    });
  });

  it("does not keep an answer field on the challenge", () => {
    const parsed = parseCaptchaChallenge({
      token: "tok-3",
      svg: SAMPLE_SVG,
      answer: "123456",
      code: "123456",
    });
    expect(parsed).toEqual({ token: "tok-3", svg: SAMPLE_SVG });
    expect(parsed).not.toHaveProperty("answer");
    expect(parsed).not.toHaveProperty("code");
  });

  it("rejects a body without a token or svg", () => {
    expect(() => parseCaptchaChallenge({ token: "tok" })).toThrow(CaptchaError);
    expect(() => parseCaptchaChallenge({ svg: SAMPLE_SVG })).toThrow(CaptchaError);
    expect(() => parseCaptchaChallenge(null)).toThrow(CaptchaError);
  });
});

describe("fetchCaptchaChallenge", () => {
  it("GETs /api/code with credentials and returns the challenge", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain("/api/code");
      expect(init?.credentials).toBe("include");
      expect(init?.method ?? "GET").toBe("GET");
      return new Response(JSON.stringify({ token: "tok-1", svg: SAMPLE_SVG }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchCaptchaChallenge()).resolves.toEqual({ token: "tok-1", svg: SAMPLE_SVG });
  });

  it("maps a failed GET to 图形验证码暂不可用", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "down" }), { status: 503 })),
    );
    await expect(fetchCaptchaChallenge()).rejects.toMatchObject({
      name: "CaptchaError",
      message: "图形验证码暂不可用",
    });
  });
});

describe("sendSmsAfterCaptcha", () => {
  it("POSTs token, 6-digit code, and phone with credentials", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain("/api/send-code");
      expect(init?.method).toBe("POST");
      expect(init?.credentials).toBe("include");
      expect(JSON.parse(String(init?.body))).toEqual({
        token: "tok-1",
        code: "123456",
        phoneNumber: "+8613812345678",
      });
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendSmsAfterCaptcha({
        token: "tok-1",
        code: "123456",
        phoneNumber: "+8613812345678",
      }),
    ).resolves.toBeUndefined();
  });

  it("maps a 4xx send to 图形验证码不正确 when the body has no message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 400 })));
    await expect(
      sendSmsAfterCaptcha({ token: "tok-1", code: "000000", phoneNumber: "+8613812345678" }),
    ).rejects.toMatchObject({
      name: "CaptchaError",
      message: "图形验证码不正确",
    });
  });
});
