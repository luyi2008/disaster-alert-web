import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { normalizeMainlandPhone } from "../auth/phone";
import { bffFetch } from "../auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandMark } from "../components/AppShell";
import { Field, StatusMessage } from "../components/Field";
import { LegalFooter } from "../components/LegalFooter";
import { OtpInput, PhoneInput } from "../components/PhoneInput";
import { SocialLogin } from "../components/SocialLogin";
import { ThemeToggle } from "../components/ThemeToggle";
import "../styles/base.css";
import "../styles/ds.css";

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
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"error" | "ok" | "checking">("error");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [wechatOpen, setWechatOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const countdownRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (countdownRef.current !== null) {
        window.clearInterval(countdownRef.current);
      }
    };
  }, []);

  function startCountdown() {
    if (countdownRef.current !== null) {
      window.clearInterval(countdownRef.current);
    }
    setCountdown(60);
    countdownRef.current = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          if (countdownRef.current !== null) {
            window.clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }

  async function sendOtp() {
    const normalized = normalizeMainlandPhone(phone);
    if (!normalized) {
      setPhoneError("请输入 11 位大陆手机号");
      return;
    }
    setPhoneError(null);
    setFormError(null);
    setSending(true);
    try {
      const response = await bffFetch("/api/auth/phone-number/send-otp", {
        method: "POST",
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setStatusKind("error");
        setFormError(messageFromBody(body, "验证码发送失败"));
        return;
      }
      setStatusKind("ok");
      setFormError(null);
      startCountdown();
    } catch {
      setStatusKind("error");
      setFormError("验证码发送失败");
    } finally {
      setSending(false);
    }
  }

  async function loginWithOtp(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeMainlandPhone(phone);
    if (!normalized) {
      setPhoneError("请输入 11 位大陆手机号");
      return;
    }
    setPhoneError(null);
    if (!code.trim()) {
      setOtpError("请输入验证码");
      return;
    }
    setOtpError(null);
    setSubmitting(true);
    try {
      const response = await bffFetch("/api/auth/phone-number/verify", {
        method: "POST",
        body: JSON.stringify({ phoneNumber: phone.trim(), code: code.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setStatusKind("error");
        setFormError(messageFromBody(body, "验证失败"));
        return;
      }
      navigate("/devices");
    } catch {
      setStatusKind("error");
      setFormError("登录失败，请稍后重试");
    } finally {
      setSubmitting(false);
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
        setFormError(messageFromBody(body, "二维码已过期，请刷新"));
        return;
      }
      navigate("/devices");
    } catch {
      setStatusKind("error");
      setFormError("扫码确认失败");
    }
  }

  return (
    <div className="login-page">
      <section className="login-form-col">
        <div className="login-panel">
          <div className="login-toolbar">
            <div className="login-brand">
              <BrandMark className="login-mark" />
              <h1>灾害预警</h1>
            </div>
            <ThemeToggle compact />
          </div>
          <p className="login-headline">及时知情，及时避险</p>
          <p className="login-lead">用手机号或微信登录后，再绑定设备的推送令牌。</p>
          {formError ? <StatusMessage kind={statusKind === "ok" ? "success" : "error"}>{formError}</StatusMessage> : null}
          <Card className="shadow-none">
            <CardContent className="grid gap-4 pt-1">
          <form className="login-stack" onSubmit={(event) => void loginWithOtp(event)}>
            <Field label="手机号" htmlFor="login-phone" error={phoneError} reserveMessage>
              <PhoneInput
                id="login-phone"
                value={phone}
                invalid={Boolean(phoneError)}
                onChange={(value) => {
                  setPhone(value);
                  setPhoneError(null);
                }}
              />
            </Field>
            <Field label="验证码" htmlFor="login-code" error={otpError}>
              <div className="otp-row">
                <OtpInput
                  id="login-code"
                  value={code}
                  invalid={Boolean(otpError)}
                  onChange={(value) => {
                    setCode(value);
                    setOtpError(null);
                  }}
                />
                <Button type="button" variant="outline" disabled={countdown > 0 || sending} onClick={() => void sendOtp()}>
                  {sending ? "发送中" : countdown > 0 ? `${countdown}s` : "发送验证码"}
                </Button>
              </div>
            </Field>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "登录中…" : "登录"}
            </Button>
          </form>
            </CardContent>
          </Card>
          <SocialLogin
            onSelect={(method) => {
              if (method === "wechat") {
                setWechatOpen(true);
                if (!ticketId) {
                  setFormError("微信扫码暂不可用，请使用手机号登录");
                }
              }
            }}
          />
          {wechatOpen ? (
            <Card aria-label="模拟微信登录">
              <CardHeader>
                <CardTitle>微信扫一扫（开发）</CardTitle>
                <CardDescription>
                  {ticketId
                    ? "开发 mock 票据。生产环境将替换为微信开放平台二维码。"
                    : "未拿到微信登录票据。确认 BFF 已开启 AUTH_MOCK，或改用手机号登录。"}
                </CardDescription>
              </CardHeader>
              {ticketId ? (
                <CardContent className="grid gap-3">
                  <p className="wechat-ticket">{ticketId}</p>
                  <Button onClick={() => void confirmWechat()}>模拟确认</Button>
                </CardContent>
              ) : null}
            </Card>
          ) : null}
          <LegalFooter />
        </div>
      </section>
      <aside className="login-visual" aria-hidden="true">
        <svg viewBox="0 0 640 720" fill="none">
          <circle cx="320" cy="340" r="280" stroke="var(--border)" strokeWidth="1" />
          <circle cx="320" cy="340" r="196" stroke="var(--border)" strokeWidth="1" />
          <circle cx="320" cy="340" r="112" stroke="var(--muted-foreground)" strokeWidth="1.25" />
          <circle cx="320" cy="340" r="8" fill="currentColor" />
          <path d="M320 60v560M40 340h560" stroke="var(--border)" strokeWidth="1" />
          <path d="M320 340 L 534 188" stroke="currentColor" strokeWidth="1.25" opacity="0.45" />
          <path d="M168 248c42-58 96-86 152-86s110 28 152 86" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
          <path d="M188 430c38 40 84 62 132 62s94-22 132-62" stroke="currentColor" strokeWidth="1.4" opacity="0.4" />
        </svg>
        <div className="login-visual-copy">
          <strong>值班台</strong>
          <p>为地震、海啸和天气预警准备的安静监测台。</p>
        </div>
      </aside>
    </div>
  );
}
