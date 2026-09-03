import { Link } from "react-router-dom";
import { deviceRouteKey, type DeviceRecord } from "../../api";

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UnlinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m18.8 8.2 1.9-1.9a3.2 3.2 0 0 0-4.5-4.5L14.3 3.7M5.2 15.8 3.3 17.7a3.2 3.2 0 0 0 4.5 4.5l1.9-1.9M8 12h8M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DeviceCard({
  device,
  onRename,
  onDelete,
}: {
  device: DeviceRecord;
  onRename: (device: DeviceRecord) => void;
  onDelete: (device: DeviceRecord) => void;
}) {
  const pathKey = deviceRouteKey(device);
  return (
    <article className="device-card">
      <header className="device-card-head">
        <div>
          <div className="device-card-title">
            <h2>{device.name}</h2>
            <button className="ds-icon-btn" type="button" aria-label="改名" onClick={() => onRename(device)}>
              <PencilIcon />
            </button>
            <button className="ds-icon-btn" type="button" aria-label="解绑" onClick={() => onDelete(device)}>
              <UnlinkIcon />
            </button>
          </div>
          <dl className="device-card-kv">
            <div>
              <dt>deviceKey</dt>
              <dd>{device.deviceKey}</dd>
            </div>
            <div>
              <dt>deviceTokenMasked</dt>
              <dd>{device.deviceTokenMasked}</dd>
            </div>
          </dl>
        </div>
      </header>
      <div className="device-card-actions">
        <Link className="ds-btn ds-btn-primary" to={`/devices/${encodeURIComponent(pathKey)}/subscribe`}>
          配置订阅
        </Link>
        <Link className="ds-btn ds-btn-ghost" to={`/devices/${encodeURIComponent(pathKey)}/subscribe/test`}>
          测试通知
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
