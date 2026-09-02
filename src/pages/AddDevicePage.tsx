import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell, Toast } from "../components/ds/AppShell";
import { Button } from "../components/ds/Button";
import { bindDevice, generateDeviceCode } from "../devices/store";
import "../styles/ds.css";

export function AddDevicePage() {
  const navigate = useNavigate();
  const code = useMemo(() => generateDeviceCode(), []);
  const [status, setStatus] = useState<"idle" | "error" | "ok">("idle");

  function bind() {
    bindDevice({ name: "iPhone 15 Pro", os: "iOS", kind: "phone" });
    setStatus("ok");
    window.setTimeout(() => navigate("/devices"), 700);
  }

  return (
    <AppShell
      title="Add Device"
      description="Install Disaster Alert, sign in, then enter this device code."
    >
      {status === "error" ? (
        <Toast kind="error">Unable to bind this device. Please try again later.</Toast>
      ) : null}
      {status === "ok" ? <Toast kind="success">Device bound.</Toast> : null}
      <section className="add-panel">
        <ol className="add-steps">
          <li>Install Disaster Alert</li>
          <li>Sign in</li>
          <li>Enter this device code</li>
        </ol>
        <div className="add-code">
          <span className="ds-field-label">Device Code</span>
          <strong>{code}</strong>
        </div>
        <div className="add-qr">Scan QR Code</div>
        <Button variant="primary" onClick={bind}>
          Bind Device
        </Button>
        <Link className="ds-btn ds-btn-quiet" to="/devices">
          Back to devices
        </Link>
      </section>
    </AppShell>
  );
}
