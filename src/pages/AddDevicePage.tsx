import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { extractBarkKey } from "../bark/extractBarkKey";
import { AppShell, Toast } from "../components/ds/AppShell";
import { Button, Field } from "../components/ds/Button";
import { bindDevice, tokenAlreadyBound } from "../devices/store";
import "../styles/ds.css";

export function AddDevicePage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "error" | "ok">("idle");
  const [formError, setFormError] = useState<string | null>(null);

  function resolveToken(raw: string): string | null {
    return extractBarkKey(raw);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const resolved = resolveToken(token);
    if (!token.trim()) {
      setTokenError("Enter a device token.");
      return;
    }
    if (!resolved) {
      setTokenError("Enter a valid device token.");
      return;
    }
    if (tokenAlreadyBound(resolved)) {
      setTokenError("This token is already added.");
      return;
    }
    setTokenError(null);
    bindDevice({ token: resolved, name });
    setStatus("ok");
    window.setTimeout(() => navigate("/devices"), 500);
  }

  return (
    <AppShell
      title="Add Device"
      description="Enter the device token. A name is optional."
    >
      {status === "error" ? (
        <Toast kind="error">Unable to add this device. Please try again later.</Toast>
      ) : null}
      {status === "ok" ? <Toast kind="success">Device added.</Toast> : null}
      {formError ? <Toast kind="error">{formError}</Toast> : null}
      <form className="add-panel" onSubmit={onSubmit}>
        <Field
          label="Token"
          htmlFor="device-token"
          error={tokenError}
          hint={tokenError ? undefined : "Required"}
        >
          <input
            id="device-token"
            className={`ds-input ds-input-token${tokenError ? " is-invalid" : ""}`}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste the device token"
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
              setTokenError(null);
            }}
          />
        </Field>
        <Field label="Name" htmlFor="device-name" hint="Optional">
          <input
            id="device-name"
            className="ds-input"
            placeholder="e.g. Kitchen iPhone"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <div className="add-actions">
          <Button type="submit" variant="primary">
            Add device
          </Button>
          <Link className="ds-btn ds-btn-quiet" to="/devices">
            Back to devices
          </Link>
        </div>
      </form>
    </AppShell>
  );
}
