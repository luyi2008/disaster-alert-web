import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bffFetch } from "../auth/session";
import { normalizeMainlandPhone } from "../auth/phone";
import { AppBrand } from "../components/AppBrand";
import "../styles/base.css";
import "../styles/account.css";

export function SettingsPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [openid, setOpenid] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function sendOtp() {
    const normalized = normalizeMainlandPhone(phone);
    if (!normalized) {
      setStatus("请输入 11 位大陆手机号");
      return;
    }
    const response = await bffFetch("/api/settings/phone/send-otp", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: phone.trim() }),
    });
    if (response.status === 401) {
      navigate("/login", { replace: true });
      return;
    }
    const body = await response.json() as { success?: boolean; message?: string };
    setStatus(response.ok && body.success !== false ? "验证码已发送" : body.message || "验证码发送失败");
  }

  async function verifyPhone(event: React.FormEvent) {
    event.preventDefault();
    const response = await bffFetch("/api/settings/phone/verify", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: phone.trim(), code: code.trim() }),
    });
    if (response.status === 401) {
      navigate("/login", { replace: true });
      return;
    }
    const body = await response.json() as { success?: boolean; message?: string };
    if (response.status === 409) {
      setStatus(body.message || "已在其他账号使用");
      return;
    }
    setStatus(response.ok && body.success !== false ? "手机号已绑定" : body.message || "验证失败");
  }

  async function linkWechat(event: React.FormEvent) {
    event.preventDefault();
    const response = await bffFetch("/api/settings/mock/wechat/confirm", {
      method: "POST",
      body: JSON.stringify({ openid: openid.trim() }),
    });
    if (response.status === 401) {
      navigate("/login", { replace: true });
      return;
    }
    const body = await response.json() as { success?: boolean; message?: string };
    if (response.status === 409) {
      setStatus(body.message || "已在其他账号使用");
      return;
    }
    setStatus(response.ok && body.success !== false ? "微信已绑定" : body.message || "绑定失败");
  }

  return (
    <div className="account-page">
      <main>
        <div className="account-toolbar">
          <AppBrand />
          <Link to="/devices">设备</Link>
        </div>
        <h1>账号设置</h1>
        <p className="account-note">给当前账号补绑手机号或微信。已被其他账号使用的身份不会合并。</p>
        <form className="settings-form" onSubmit={(event) => void verifyPhone(event)}>
          <label htmlFor="settings-phone">手机号</label>
          <input id="settings-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <button type="button" onClick={() => void sendOtp()}>发送验证码</button>
          <label htmlFor="settings-code">验证码</label>
          <input id="settings-code" value={code} onChange={(event) => setCode(event.target.value)} />
          <button type="submit">绑定手机号</button>
        </form>
        <form className="settings-form" onSubmit={(event) => void linkWechat(event)}>
          <label htmlFor="settings-openid">微信 openid（开发）</label>
          <input id="settings-openid" value={openid} onChange={(event) => setOpenid(event.target.value)} />
          <button type="submit">模拟绑定微信</button>
        </form>
        {status ? <p className="account-error" role="status">{status}</p> : null}
      </main>
    </div>
  );
}
