import { Link } from "react-router-dom";
import type { ManagedDevice } from "../../devices/store";
import { formatLastActive } from "../../devices/store";
import { Badge, StatusDot } from "./Status";

export function DeviceCard({ device }: { device: ManagedDevice }) {
  return (
    <article className="device-card">
      <header className="device-card-head">
        <div>
          <h2>{device.name}</h2>
          <p className="device-card-meta">
            {device.os}
            <span aria-hidden="true"> · </span>
            {device.kind === "phone" ? "Phone" : device.kind === "tablet" ? "Tablet" : "Watch"}
          </p>
        </div>
        <StatusDot online={device.online} />
      </header>
      <dl className="device-card-facts">
        <div>
          <dt>Notification Service</dt>
          <dd>
            <Badge tone={device.notificationsEnabled ? "ok" : "quiet"}>
              {device.notificationsEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </dd>
        </div>
        <div>
          <dt>Last active</dt>
          <dd>{device.online ? formatLastActive(device.lastActiveAt) : "Device offline"}</dd>
        </div>
      </dl>
      <div className="device-card-actions">
        <Link className="ds-btn ds-btn-primary" to={`/devices/${device.id}/subscription`}>
          Notification Subscription
        </Link>
        <Link className="ds-btn ds-btn-ghost" to={`/devices/${device.id}/test`}>
          Test Notification
        </Link>
      </div>
    </article>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="ds-empty">
      <h2>{title}</h2>
      <p>{body}</p>
      {action ? (
        <Link className="ds-btn ds-btn-primary" to={action.href}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="ds-loading" role="status">
      <span className="ds-spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div className="ds-error" role="alert">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}
