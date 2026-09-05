import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { bffFetch } from "../auth/session";
import { normalizeMainlandPhone } from "../auth/phone";
import { AppShell } from "../components/AppShell";
import { Field, StatusMessage } from "../components/Field";
import { OtpInput, PhoneInput } from "../components/PhoneInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import "../styles/base.css";
import "../styles/ds.css";

export function SettingsPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [openid, setOpenid] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function sendOtp() {
    const normalized = normalizeMainlandPhone(phone);
    if (!normalized) {
      setOk(false);
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
    const success = response.ok && body.success !== false;
    setOk(success);
    setStatus(success ? "验证码已发送" : body.message || "验证码发送失败");
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
      setOk(false);
      setStatus(body.message || "已在其他账号使用");
      return;
    }
    const success = response.ok && body.success !== false;
    setOk(success);
    setStatus(success ? "手机号已绑定" : body.message || "验证失败");
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
      setOk(false);
      setStatus(body.message || "已在其他账号使用");
      return;
    }
    const success = response.ok && body.success !== false;
    setOk(success);
    setStatus(success ? "微信已绑定" : body.message || "绑定失败");
  }

  return (
    <AppShell title="账号设置" description="给当前账号补绑手机号或微信。已被其他账号使用的身份不会合并。">
      {status ? <StatusMessage kind={ok ? "success" : "error"}>{status}</StatusMessage> : null}
      <div className="grid gap-4">
        <Card>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => void verifyPhone(event)}>
              <Field label="手机号" htmlFor="settings-phone">
                <PhoneInput
                  id="settings-phone"
                  value={phone}
                  onChange={setPhone}
                />
              </Field>
              <Field label="验证码" htmlFor="settings-code">
                <div className="otp-row">
                  <OtpInput id="settings-code" value={code} onChange={setCode} />
                  <Button type="button" variant="outline" onClick={() => void sendOtp()}>
                    发送验证码
                  </Button>
                </div>
              </Field>
              <Button type="submit">绑定手机号</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => void linkWechat(event)}>
              <Field label="微信 openid（开发）" htmlFor="settings-openid">
                <Input id="settings-openid" value={openid} onChange={(event) => setOpenid(event.target.value)} />
              </Field>
              <Button type="submit">模拟绑定微信</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
