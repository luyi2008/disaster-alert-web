import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" data-token="tok-1" viewBox="0 0 120 32"><text>42</text></svg>`;
const REFRESH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" data-token="tok-2" viewBox="0 0 120 32"><text>99</text></svg>`;

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/devices" element={<div>devices</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function isCaptchaIssueUrl(url: string): boolean {
  return url.includes("/api/captcha") && !url.includes("/api/captcha/verify");
}

function isCaptchaVerifyUrl(url: string): boolean {
  return url.includes("/api/captcha/verify");
}

function mockLoginFetch(options?: {
  sendStatus?: number;
  sendBody?: unknown;
  challenges?: Array<{ captchaToken: string; svg: string }>;
}) {
  const challenges = options?.challenges ?? [{ captchaToken: "tok-1", svg: SAMPLE_SVG }];
  let codeIndex = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/auth/mock/wechat/ticket")) {
      return new Response(JSON.stringify({ success: true, data: { ticketId: "ticket-1" } }), { status: 200 });
    }
    if (url.includes("/api/auth/phone-number/send-otp")) {
      return new Response(JSON.stringify({ message: "public send-otp is closed" }), { status: 403 });
    }
    if (isCaptchaIssueUrl(url)) {
      const challenge = challenges[Math.min(codeIndex, challenges.length - 1)]!;
      codeIndex += 1;
      return new Response(JSON.stringify(challenge), { status: 200 });
    }
    if (isCaptchaVerifyUrl(url)) {
      const status = options?.sendStatus ?? 200;
      const body =
        options?.sendBody ??
        (status >= 400 ? { error: "CAPTCHA_INVALID" } : { ok: true, cooldown: 60 });
      return new Response(JSON.stringify(body), { status });
    }
    if (url.includes("/api/auth/phone-number/verify")) {
      return new Response(JSON.stringify({ status: true }), { status: 200 });
    }
    if (url.includes("/api/auth/mock/wechat/confirm")) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response("null", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openCaptcha(fetchMock: ReturnType<typeof mockLoginFetch>) {
  fireEvent.change(screen.getByLabelText("手机号"), { target: { value: "13812345678" } });
  fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => isCaptchaIssueUrl(String(url)))).toBe(true));
  return dialog;
}

function captchaField(dialog: HTMLElement) {
  return within(dialog).getByRole("textbox", { name: "图形验证码" });
}

describe("LoginPage", () => {
  it("does not request captcha or verify for an invalid phone number", () => {
    const fetchMock = mockLoginFetch();
    renderLogin();
    fireEvent.change(screen.getByLabelText("手机号"), { target: { value: "138" } });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
    expect(screen.getByText("请输入 11 位大陆手机号")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => isCaptchaIssueUrl(String(url)))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => isCaptchaVerifyUrl(String(url)))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("send-otp"))).toBe(false);
  });

  it("keeps a reserved error slot under the phone field", () => {
    mockLoginFetch();
    renderLogin();
    const phoneField = screen.getByLabelText("手机号").closest("[data-slot=field]");
    const message = phoneField?.querySelector("[data-slot=field-message]");
    expect(message).not.toBeNull();
    expect(message).toBeEmptyDOMElement();
  });

  it("greys out Alipay and Google while leaving WeChat available", async () => {
    mockLoginFetch();
    renderLogin();
    expect(screen.getByRole("button", { name: "支付宝登录本期暂未开放" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Google 登录本期暂未开放" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "微信" }));
    expect(await screen.findByText("ticket-1")).toBeInTheDocument();
  });

  it("opens the captcha dialog after GET /api/captcha", async () => {
    const fetchMock = mockLoginFetch();
    renderLogin();
    const dialog = await openCaptcha(fetchMock);
    expect(within(dialog).getByRole("heading", { name: "图形验证码" })).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: "图形验证码" }).innerHTML).toContain("<svg");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("send-otp"))).toBe(false);
  });

  it("refreshes the captcha token when 换一张 is clicked", async () => {
    const fetchMock = mockLoginFetch({
      challenges: [
        { captchaToken: "tok-1", svg: SAMPLE_SVG },
        { captchaToken: "tok-2", svg: REFRESH_SVG },
      ],
    });
    renderLogin();
    const dialog = await openCaptcha(fetchMock);
    fireEvent.click(within(dialog).getByRole("button", { name: "换一张" }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => isCaptchaIssueUrl(String(url)))).toHaveLength(2);
    });
    expect(within(dialog).getByRole("img", { name: "图形验证码" }).innerHTML).toContain("tok-2");
    fireEvent.change(captchaField(dialog), { target: { value: "123456" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => isCaptchaVerifyUrl(String(url)))).toBe(true));
    const send = fetchMock.mock.calls.find(([url]) => isCaptchaVerifyUrl(String(url)));
    expect(JSON.parse(String(send?.[1]?.body))).toMatchObject({
      captchaToken: "tok-2",
      captchaCode: "123456",
      phone: "13812345678",
    });
  });

  it("POSTs /api/captcha/verify with token, digits, phone, and credentials", async () => {
    const fetchMock = mockLoginFetch();
    renderLogin();
    const dialog = await openCaptcha(fetchMock);
    fireEvent.change(captchaField(dialog), { target: { value: "123456" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => isCaptchaVerifyUrl(String(url)))).toBe(true));
    const send = fetchMock.mock.calls.find(([url]) => isCaptchaVerifyUrl(String(url)));
    expect(JSON.parse(String(send?.[1]?.body))).toEqual({
      phone: "13812345678",
      captchaToken: "tok-1",
      captchaCode: "123456",
    });
    expect(send?.[1]?.credentials).toBe("include");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("send-otp"))).toBe(false);
  });

  it("keeps the dialog open and refreshes the image after captcha/verify 4xx", async () => {
    const fetchMock = mockLoginFetch({
      sendStatus: 400,
      challenges: [
        { captchaToken: "tok-1", svg: SAMPLE_SVG },
        { captchaToken: "tok-2", svg: REFRESH_SVG },
      ],
    });
    renderLogin();
    const dialog = await openCaptcha(fetchMock);
    fireEvent.change(captchaField(dialog), { target: { value: "000000" } });
    expect(await within(dialog).findByText("图形验证码不正确")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => isCaptchaIssueUrl(String(url)))).toHaveLength(2);
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: "图形验证码" }).innerHTML).toContain("tok-2");
    expect(captchaField(dialog)).toHaveValue("");
  });

  it("closes the dialog and shows SMS failure on the login form after SMS_FAILED", async () => {
    const fetchMock = mockLoginFetch({
      sendStatus: 400,
      sendBody: { error: "SMS_FAILED", message: "短信发送失败，请稍后重试" },
    });
    renderLogin();
    const dialog = await openCaptcha(fetchMock);
    fireEvent.change(captchaField(dialog), { target: { value: "123456" } });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("短信发送失败，请稍后重试")).toBeInTheDocument();
    expect(screen.queryByText("图形验证码不正确")).not.toBeInTheDocument();
    expect(screen.queryByText("短信验证码已发送")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => isCaptchaIssueUrl(String(url)))).toHaveLength(1);
  });

  it("closes the dialog and shows 短信验证码已发送 after captcha/verify 200", async () => {
    const fetchMock = mockLoginFetch();
    renderLogin();
    const dialog = await openCaptcha(fetchMock);
    fireEvent.change(captchaField(dialog), { target: { value: "123456" } });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("短信验证码已发送")).toBeInTheDocument();
  });

  it("does not POST captcha/verify when the captcha dialog is cancelled", async () => {
    const fetchMock = mockLoginFetch();
    renderLogin();
    const dialog = await openCaptcha(fetchMock);
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([url]) => isCaptchaVerifyUrl(String(url)))).toBe(false);
  });

  it("asks to send SMS before login if captcha never succeeded", async () => {
    const fetchMock = mockLoginFetch();
    renderLogin();
    fireEvent.change(screen.getByLabelText("手机号"), { target: { value: "13812345678" } });
    fireEvent.change(screen.getByLabelText("短信验证码"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(screen.getByText("请先发送短信验证码")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/auth/phone-number/verify"))).toBe(false);
  });

  it("verifies SMS OTP and goes to devices without calling public send-otp", async () => {
    const fetchMock = mockLoginFetch();
    renderLogin();
    const dialog = await openCaptcha(fetchMock);
    fireEvent.change(captchaField(dialog), { target: { value: "123456" } });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("短信验证码"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByText("devices")).toBeInTheDocument();
    const verify = fetchMock.mock.calls.find(([url]) => String(url).includes("/api/auth/phone-number/verify"));
    expect(JSON.parse(String(verify?.[1]?.body))).toEqual({ phoneNumber: "13812345678", code: "000000" });
    expect(verify?.[1]?.credentials).toBe("include");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("send-otp"))).toBe(false);
  });

  it("does not request /api/captcha on the WeChat path", async () => {
    const fetchMock = mockLoginFetch();
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "微信" }));
    expect(await screen.findByText("ticket-1")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => isCaptchaIssueUrl(String(url)))).toBe(false);
  });

  it("confirms the mock WeChat ticket and goes to devices", async () => {
    const fetchMock = mockLoginFetch();
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "微信" }));
    expect(await screen.findByText("ticket-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "模拟确认" }));
    expect(await screen.findByText("devices")).toBeInTheDocument();
    const confirm = fetchMock.mock.calls.find(([url]) => String(url).includes("confirm"));
    expect(JSON.parse(String(confirm?.[1]?.body))).toEqual({ ticketId: "ticket-1" });
  });
});
