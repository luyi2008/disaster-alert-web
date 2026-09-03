import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bindDevice } from "../api";
import { AppShell, Toast } from "../components/ds/AppShell";
import { Button, Field } from "../components/ds/Button";
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
    <AppShell title="添加设备" description="输入 APNs device_token。名称可选。">
      {formError ? <Toast kind="error">{formError}</Toast> : null}
      {ok ? <Toast kind="success">设备已添加。</Toast> : null}
      <form className="add-panel" onSubmit={(event) => void onSubmit(event)}>
        <Field
          label="device_token"
          htmlFor="device-token"
          error={tokenError}
          hint={tokenError ? undefined : "必填，最长 128 位，不能为 deleted"}
        >
          <input
            id="device-token"
            className={`ds-input ds-input-token${tokenError ? " is-invalid" : ""}`}
            autoComplete="off"
            spellCheck={false}
            placeholder="APNs device_token"
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
              setTokenError(null);
            }}
          />
        </Field>
        <Field label="名称" htmlFor="device-name" hint="可选，省略时自动生成">
          <input
            id="device-name"
            className="ds-input"
            placeholder="例如：厨房 iPhone"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <div className="add-actions">
          <Button type="submit" variant="primary">
            添加设备
          </Button>
          <Link className="ds-btn ds-btn-quiet" to="/devices">
            返回设备
          </Link>
        </div>
      </form>
    </AppShell>
  );
}
