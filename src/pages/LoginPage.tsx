import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { normalizeMainlandPhone } from "../auth/phone";
import { bffFetch } from "../auth/session";
import { AppBrand } from "../components/AppBrand";
import "../styles/base.css";
import "../styles/entry.css";
import "../styles/account.css";

function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as { message?: unknown };
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
  }
  return fallback;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"error" | "ok" | "checking">("error");
  const [ticketId, setTicketId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bffFetch("/api/auth/mock/wechat/ticket", { method: "POST" })
      .then(async (response) => {
        const body = await response.json() as { data?: { ticketId?: string } };
        if (!cancelled && response.ok && body.data?.ticketId) {
          setTicketId(body.data.ticketId);
        }
      })
      .catch(() => {
        /* mock WeChat is optional when AUTH_MOCK is off */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendOtp() {
    const normalized = normalizeMainlandPhone(phone);
    if (!normalized) {
      setStatusKind("error");
      setStatus("请输入 11 位大陆手机号");
      return;
    }
    setStatusKind("checking");
    setStatus("正在发送验证码…");
    try {
      const response = await bffFetch("/api/auth/phone-number/send-otp", {
        method: "POST",
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setStatusKind("error");
        setStatus(messageFromBody(body, "验证码发送失败"));
        return;
      }
      setStatusKind("ok");
      setStatus("验证码已发送");
    } catch {
      setStatusKind("error");
      setStatus("验证码发送失败");
    }
  }

  async function loginWithOtp(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeMainlandPhone(phone);
    if (!normalized) {
      setStatusKind("error");
      setStatus("请输入 11 位大陆手机号");
      return;
    }
    if (!code.trim()) {
      setStatusKind("error");
      setStatus("请输入验证码");
      return;
    }
    try {
      const response = await bffFetch("/api/auth/phone-number/verify", {
        method: "POST",
        body: JSON.stringify({ phoneNumber: phone.trim(), code: code.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setStatusKind("error");
        setStatus(messageFromBody(body, "验证失败"));
        return;
      }
      navigate("/devices");
    } catch {
      setStatusKind("error");
      setStatus("登录失败，请稍后重试");
    }
  }

  async function confirmWechat() {
    if (!ticketId) {
      return;
    }
    try {
      const response = await bffFetch("/api/auth/mock/wechat/confirm", {
        method: "POST",
        body: JSON.stringify({ ticketId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setStatusKind("error");
        setStatus(messageFromBody(body, "二维码已过期，请刷新"));
        return;
      }
      navigate("/devices");
    } catch {
      setStatusKind("error");
      setStatus("扫码确认失败");
    }
  }

  return (
    <div className="entry-page">
      <main className="entry-main">
        <AppBrand as="div" />
        <h1>登录灾害预警</h1>
        <p className="entry-lead">用手机号或微信登录后，再绑定设备上的 Bark token。</p>
        <form className="entry-form" onSubmit={loginWithOtp}>
          <div>
            <label htmlFor="login-phone">手机号</label>
            <input
              id="login-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="11 位大陆手机号"
            />
          </div>
          <button className="primary" type="button" onClick={() => void sendOtp()}>
            发送验证码
          </button>
          <div>
            <label htmlFor="login-code">验证码</label>
            <input
              id="login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="6 位验证码"
            />
          </div>
          {status ? (
            <p className={`entry-status ${statusKind === "ok" ? "is-ok" : statusKind === "checking" ? "is-checking" : "is-error"}`} role="status">
              {status}
            </p>
          ) : null}
          <button className="primary" type="submit">
            登录
          </button>
        </form>
        {ticketId ? (
          <section className="wechat-mock" aria-label="模拟微信登录">
            <h2>微信扫一扫（开发）</h2>
            <p className="entry-hint">开发 mock 票据</p>
            <p className="wechat-ticket">{ticketId}</p>
            <button className="primary" type="button" onClick={() => void confirmWechat()}>
              模拟确认
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
