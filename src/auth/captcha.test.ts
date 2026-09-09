import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CaptchaError,
  captchaUrl,
  fetchCaptchaChallenge,
  parseCaptchaChallenge,
  sendSmsAfterCaptcha,
} from "./captcha";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32"><text>42</text></svg>`;

describe("parseCaptchaChallenge", () => {
  it("reads captchaToken and svg from the edge issue body", () => {
    expect(parseCaptchaChallenge({ captchaToken: "tok-1", svg: SAMPLE_SVG })).toEqual({
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

describe("captchaUrl", () => {
  it("returns the path unchanged when CAPTCHA_ORIGIN is unset", () => {
    expect(captchaUrl("/api/captcha")).toBe("/api/captcha");
    expect(captchaUrl("/api/captcha/verify")).toBe("/api/captcha/verify");
  });
});

describe("fetchCaptchaChallenge", () => {
  it("GETs /api/captcha with credentials and returns the challenge", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/captcha");
      expect(init?.credentials).toBe("include");
      expect(init?.method ?? "GET").toBe("GET");
      return new Response(JSON.stringify({ captchaToken: "tok-1", svg: SAMPLE_SVG }), { status: 200 });
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
  it("POSTs phone, captchaToken, and captchaCode to /api/captcha/verify with credentials", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/captcha/verify");
      expect(init?.method).toBe("POST");
      expect(init?.credentials).toBe("include");
      expect(JSON.parse(String(init?.body))).toEqual({
        phone: "13812345678",
        captchaToken: "tok-1",
        captchaCode: "123456",
      });
      return new Response(JSON.stringify({ ok: true, cooldown: 60 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendSmsAfterCaptcha({
        token: "tok-1",
        code: "123456",
        phone: "13812345678",
      }),
    ).resolves.toEqual({ cooldown: 60 });
  });

  it("maps CAPTCHA_INVALID to 图形验证码不正确", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "CAPTCHA_INVALID" }), { status: 400 })),
    );
    await expect(
      sendSmsAfterCaptcha({ token: "tok-1", code: "000000", phone: "13812345678" }),
    ).rejects.toMatchObject({
      name: "CaptchaError",
      message: "图形验证码不正确",
    });
  });

  it("maps SMS_FAILED to 短信发送失败，请稍后重试", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "SMS_FAILED", message: "短信发送失败，请稍后重试" }), {
            status: 400,
          }),
      ),
    );
    await expect(
      sendSmsAfterCaptcha({ token: "tok-1", code: "123456", phone: "13812345678" }),
    ).rejects.toMatchObject({
      name: "CaptchaError",
      message: "短信发送失败，请稍后重试",
      code: "SMS_FAILED",
    });
  });

  it("maps origin 502 to 短信发送失败，请稍后重试", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "SMS_FAILED" }), { status: 502 })),
    );
    await expect(
      sendSmsAfterCaptcha({ token: "tok-1", code: "123456", phone: "13812345678" }),
    ).rejects.toMatchObject({
      name: "CaptchaError",
      message: "短信发送失败，请稍后重试",
      code: "SMS_FAILED",
      status: 502,
    });
  });
});
