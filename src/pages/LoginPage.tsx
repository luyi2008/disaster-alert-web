import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEFAULT_DIAL, e164, validateNationalNumber } from "../auth/phone";
import { writeAccount } from "../auth/session";
import { Button, Field } from "../components/ds/Button";
import { CaptchaSlot } from "../components/ds/CaptchaSlot";
import { OtpInput, PhoneInput } from "../components/ds/PhoneInput";
import { SocialLogin } from "../components/ds/SocialLogin";
import { Toast } from "../components/ds/AppShell";
import "../styles/ds.css";

const SEND_FAIL_NUMBER = "10000000000";

export function LoginPage() {
  const navigate = useNavigate();
  const [dial, setDial] = useState(DEFAULT_DIAL);
  const [national, setNational] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function startCountdown() {
    setCountdown(59);
    const timer = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }

  async function sendCode() {
    const error = validateNationalNumber(dial, national);
    if (error) {
      setPhoneError(error);
      return;
    }
    setPhoneError(null);
    setFormError(null);
    if (!captchaOk) {
      setCaptchaOpen(true);
      return;
    }
    setSending(true);
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    if (national.replace(/\D/g, "") === SEND_FAIL_NUMBER) {
      setSending(false);
      setFormError("Unable to send verification code. Please try again later.");
      return;
    }
    const code = "248193";
    setSentCode(code);
    setSending(false);
    startCountdown();
  }

  function verifyCaptcha() {
    setCaptchaLoading(true);
    window.setTimeout(() => {
      setCaptchaLoading(false);
      setCaptchaOk(true);
      window.setTimeout(() => {
        void sendCodeAfterCaptcha();
      }, 40);
    }, 240);
  }

  async function sendCodeAfterCaptcha() {
    const error = validateNationalNumber(dial, national);
    if (error) {
      setPhoneError(error);
      return;
    }
    setSending(true);
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    if (national.replace(/\D/g, "") === SEND_FAIL_NUMBER) {
      setSending(false);
      setFormError("Unable to send verification code. Please try again later.");
      return;
    }
    setSentCode("248193");
    setSending(false);
    startCountdown();
  }

  function finishLogin() {
    writeAccount({
      method: "phone",
      label: e164(dial, national),
      phone: e164(dial, national),
    });
    navigate("/devices", { replace: true });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const error = validateNationalNumber(dial, national);
    if (error) {
      setPhoneError(error);
      return;
    }
    setPhoneError(null);
    if (!sentCode) {
      setOtpError("Send a verification code first.");
      return;
    }
    if (otp.length !== 6) {
      setOtpError("请输入验证码");
      return;
    }
    if (otp !== sentCode) {
      setOtpError("Verification code is incorrect.");
      return;
    }
    setOtpError(null);
    setSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    finishLogin();
  }

  return (
    <div className="login-page">
      <section className="login-form-col">
        <div className="login-panel">
          <div className="login-brand">
            <span className="login-mark" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 12h3.2l2.4 7 4.8-14 2.4 7H21"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h1>Disaster Alert</h1>
            <p>Stay informed. Stay safe.</p>
            <span>A calm place to manage devices and disaster notifications.</span>
          </div>
          {formError ? <Toast kind="error">{formError}</Toast> : null}
          <form className="login-stack" onSubmit={onSubmit}>
            <Field label="手机号" htmlFor="phone" error={phoneError}>
              <PhoneInput
                id="phone"
                dial={dial}
                national={national}
                invalid={Boolean(phoneError)}
                onDialChange={(value) => {
                  setDial(value);
                  setNational("");
                  setPhoneError(null);
                }}
                onNationalChange={(value) => {
                  setNational(value);
                  setPhoneError(null);
                }}
              />
            </Field>
            <Field label="验证码" htmlFor="otp" error={otpError}>
              <div className="ds-otp-row">
                <OtpInput id="otp" value={otp} invalid={Boolean(otpError)} onChange={setOtp} />
                <Button
                  variant="ghost"
                  disabled={countdown > 0 || sending}
                  onClick={() => void sendCode()}
                >
                  {sending ? "Sending" : countdown > 0 ? `${countdown}s` : "发送验证码"}
                </Button>
              </div>
            </Field>
            <CaptchaSlot
              open={captchaOpen}
              verified={captchaOk}
              loading={captchaLoading}
              onVerify={verifyCaptcha}
            />
            <Button type="submit" variant="primary" block disabled={submitting}>
              {submitting ? "Signing in…" : "登录"}
            </Button>
          </form>
          <SocialLogin
            onSelect={(method) => {
              writeAccount({
                method,
                label: method === "wechat" ? "WeChat" : method === "alipay" ? "Alipay" : "Google",
              });
              navigate("/devices", { replace: true });
            }}
          />
          <p className="login-legal">
            <Link to="/privacy">隐私政策</Link>
            {" · "}
            <Link to="/terms">服务条款</Link>
          </p>
        </div>
      </section>
      <aside className="login-visual" aria-hidden="true">
        <svg viewBox="0 0 640 720" fill="none">
          <circle cx="320" cy="340" r="280" stroke="#c5d0d8" strokeWidth="1" />
          <circle cx="320" cy="340" r="196" stroke="#c5d0d8" strokeWidth="1" />
          <circle cx="320" cy="340" r="112" stroke="#9fb0bc" strokeWidth="1.25" />
          <circle cx="320" cy="340" r="8" fill="#1e3a4c" />
          <path d="M320 60v560M40 340h560" stroke="#c5d0d8" strokeWidth="1" />
          <path d="M320 340 L 534 188" stroke="#1e3a4c" strokeWidth="1.25" opacity="0.45" />
          <path
            d="M168 248c42-58 96-86 152-86s110 28 152 86"
            stroke="#1e3a4c"
            strokeWidth="1.4"
            opacity="0.55"
          />
          <path
            d="M188 430c38 40 84 62 132 62s94-22 132-62"
            stroke="#1e3a4c"
            strokeWidth="1.4"
            opacity="0.4"
          />
        </svg>
        <div className="login-visual-copy">
          <strong>Watch desk</strong>
          <p>Radar-quiet monitoring for earthquakes, tsunami, and weather warnings.</p>
        </div>
      </aside>
    </div>
  );
}
