import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/ds/AppShell";
import { ErrorState } from "../components/ds/DeviceCard";
import { getDevice } from "../devices/store";
import { SubscribePage } from "./SubscribePage";
import { TestPage } from "./TestPage";
import "../styles/ds.css";

function DeviceMissing() {
  return (
    <AppShell title="Device">
      <ErrorState title="Device not found" body="This device is no longer in your account." />
      <Link className="ds-btn ds-btn-ghost" to="/devices">
        Back to devices
      </Link>
    </AppShell>
  );
}

function BindPrompt({ deviceId, intent }: { deviceId: string; intent: "subscription" | "test" }) {
  const title = intent === "test" ? "Notification Test" : "Disaster Subscription";
  return (
    <AppShell title={title} description="Bind a notification service on this device first.">
      <ErrorState
        title="Notification service is not bound"
        body="Open the Bark key page to connect this device, then return here to configure alerts."
      />
      <div className="device-card-actions" style={{ maxWidth: 420 }}>
        <Link className="ds-btn ds-btn-primary" to="/" state={{ returnTo: `/devices/${deviceId}/${intent === "test" ? "test" : "subscription"}` }}>
          Bind notification service
        </Link>
        <Link className="ds-btn ds-btn-ghost" to="/devices">
          Back to devices
        </Link>
      </div>
    </AppShell>
  );
}

export function DeviceSubscriptionPage() {
  const { deviceId } = useParams();
  const device = getDevice(deviceId);
  if (!device) {
    return <DeviceMissing />;
  }
  if (!device.barkKey) {
    return <BindPrompt deviceId={device.id} intent="subscription" />;
  }
  return <SubscribePage />;
}

export function DeviceTestPage() {
  const { deviceId } = useParams();
  const device = getDevice(deviceId);
  if (!device) {
    return <DeviceMissing />;
  }
  if (!device.barkKey) {
    return <BindPrompt deviceId={device.id} intent="test" />;
  }
  return <TestPage />;
}

export function LegalPlaceholder({ title }: { title: string }) {
  return (
    <div className="login-page" style={{ gridTemplateColumns: "1fr" }}>
      <section className="login-form-col">
        <div className="login-panel">
          <h1>{title}</h1>
          <p className="login-legal">This is a product legal placeholder for the Disaster Alert service.</p>
          <Link className="ds-btn ds-btn-ghost" to="/login">
            Back to login
          </Link>
        </div>
      </section>
    </div>
  );
}
