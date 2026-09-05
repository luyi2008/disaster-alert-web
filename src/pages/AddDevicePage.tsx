import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bindDevice } from "../api";
import { AppShell } from "../components/AppShell";
import { Field, StatusMessage } from "../components/Field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deviceTokenMessage, validateDeviceToken } from "../devices/deviceToken";
import "../styles/base.css";
import "../styles/ds.css";

export function AddDevicePage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const trimmed = token.trim();
    const failure = validateDeviceToken(trimmed);
    if (failure) {
      setTokenError(deviceTokenMessage(failure));
      return;
    }
    setTokenError(null);
    const result = await bindDevice(trimmed, name);
    if (result.status === 401) {
      navigate("/login", { replace: true });
      return;
    }
    if (!result.body.success || !result.body.data?.device) {
      setFormError(result.body.message || "无法绑定设备");
      return;
    }
    setOk(true);
    navigate("/devices");
  }

  return (
    <AppShell title="添加设备" description="输入这台设备的推送令牌。名称可选。">
      {formError ? <StatusMessage kind="error">{formError}</StatusMessage> : null}
      {ok ? <StatusMessage kind="success">设备已添加。</StatusMessage> : null}
      <Card>
        <CardContent>
          <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
            <Field
              label="推送令牌"
              htmlFor="device-token"
              error={tokenError}
              hint={tokenError ? undefined : "必填，最长 128 位，不能为 deleted"}
            >
              <Input
                id="device-token"
                className="font-mono tracking-wide"
                autoComplete="off"
                spellCheck={false}
                placeholder="APNs 推送令牌"
                aria-invalid={Boolean(tokenError) || undefined}
                value={token}
                onChange={(event) => {
                  setToken(event.target.value);
                  setTokenError(null);
                }}
              />
            </Field>
            <Field label="名称" htmlFor="device-name" hint="可选，省略时自动生成">
              <Input
                id="device-name"
                placeholder="例如：厨房 iPhone"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline">
                <Link to="/devices">返回设备</Link>
              </Button>
              <Button type="submit">添加设备</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
