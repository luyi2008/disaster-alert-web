import { Link } from "react-router-dom";
import type { DeviceRecord } from "../../api";

export function DeviceCard({
  device,
  onRename,
  onDelete,
}: {
  device: DeviceRecord;
  onRename: (device: DeviceRecord) => void;
  onDelete: (device: DeviceRecord) => void;
}) {
  return (
    <article className="device-card">
      <header className="device-card-head">
        <div>
          <h2>{device.name}</h2>
          <p className="device-card-meta">Bark 推送设备</p>
        </div>
      </header>
      <div className="device-card-actions">
        <Link className="ds-btn ds-btn-primary" to={`/devices/${device.id}/subscribe`}>
          配置订阅
        </Link>
        <Link className="ds-btn ds-btn-ghost" to={`/devices/${device.id}/subscribe/test`}>
          测试通知
        </Link>
        <button className="ds-btn ds-btn-ghost" type="button" onClick={() => onRename(device)}>
          改名
        </button>
        <button className="ds-btn ds-btn-quiet" type="button" onClick={() => onDelete(device)}>
          解绑
        </button>
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
