import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/ds/AppShell";
import { DeviceCard, EmptyState, LoadingState } from "../components/ds/DeviceCard";
import { readDevices, type ManagedDevice } from "../devices/store";
import "../styles/ds.css";

export function DevicesPage() {
  const [devices, setDevices] = useState<ManagedDevice[] | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDevices(readDevices()), 180);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AppShell
      title="Devices"
      description="Manage your devices and notification services."
      action={
        <Link className="ds-btn ds-btn-primary" to="/devices/add">
          + Add Device
        </Link>
      }
    >
      {devices === null ? (
        <LoadingState label="Loading devices…" />
      ) : devices.length === 0 ? (
        <EmptyState
          title="No devices yet"
          body="Add a phone or tablet to start receiving disaster alerts."
          action={{ href: "/devices/add", label: "+ Add Device" }}
        />
      ) : (
        <div className="device-grid">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
