import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe("LoginPage", () => {
  it("does not send OTP for an invalid phone number", () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).includes("/api/auth/mock/wechat/ticket")) {
        return new Response(JSON.stringify({ success: true, data: { ticketId: "ticket-1" } }), { status: 200 });
      }
      return new Response("null", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderLogin();
    fireEvent.change(screen.getByLabelText("手机号"), { target: { value: "138" } });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
    expect(screen.getByText("请输入 11 位大陆手机号")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("send-otp"))).toBe(false);
  });

  it("keeps a reserved error slot under the phone field", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("null", { status: 200 })));
    renderLogin();
    const phoneField = screen.getByLabelText("手机号").closest("[data-slot=field]");
    const message = phoneField?.querySelector("[data-slot=field-message]");
    expect(message).not.toBeNull();
    expect(message).toBeEmptyDOMElement();
  });

  it("greys out Alipay and Google while leaving WeChat available", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/mock/wechat/ticket")) {
        return new Response(JSON.stringify({ success: true, data: { ticketId: "ticket-1" } }), { status: 200 });
      }
      return new Response("null", { status: 200 });
    }));
    renderLogin();
    expect(screen.getByRole("button", { name: "支付宝登录本期暂未开放" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Google 登录本期暂未开放" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "微信" }));
    expect(await screen.findByText("ticket-1")).toBeInTheDocument();
  });

  it("verifies OTP and goes to devices", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/auth/mock/wechat/ticket")) {
        return new Response(JSON.stringify({ success: true, data: { ticketId: "ticket-1" } }), { status: 200 });
      }
      if (url.includes("/api/auth/phone-number/send-otp")) {
        return new Response(JSON.stringify({ status: true }), { status: 200 });
      }
      if (url.includes("/api/auth/phone-number/verify")) {
        return new Response(JSON.stringify({ status: true }), { status: 200 });
      }
      return new Response("null", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderLogin();
    fireEvent.change(screen.getByLabelText("手机号"), { target: { value: "13812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("send-otp"))).toBe(true));
    fireEvent.change(screen.getByLabelText("验证码"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByText("devices")).toBeInTheDocument();
    const verify = fetchMock.mock.calls.find(([url]) => String(url).includes("verify"));
    expect(JSON.parse(String(verify?.[1]?.body))).toEqual({ phoneNumber: "13812345678", code: "000000" });
    expect(verify?.[1]?.credentials).toBe("include");
  });

  it("confirms the mock WeChat ticket and goes to devices", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/auth/mock/wechat/ticket")) {
        return new Response(JSON.stringify({ success: true, data: { ticketId: "ticket-1" } }), { status: 200 });
      }
      if (url.includes("/api/auth/mock/wechat/confirm")) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response("null", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "微信" }));
    expect(await screen.findByText("ticket-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "模拟确认" }));
    expect(await screen.findByText("devices")).toBeInTheDocument();
    const confirm = fetchMock.mock.calls.find(([url]) => String(url).includes("confirm"));
    expect(JSON.parse(String(confirm?.[1]?.body))).toEqual({ ticketId: "ticket-1" });
  });
});
