import { Link } from "react-router-dom";
import { Pencil, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { deviceRouteKey, type DeviceRecord } from "../api";

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
    <Card className="device-card max-w-none gap-4 py-5 shadow-none">
      <CardHeader className="device-card-head px-5">
        <div>
          <div className="device-card-title">
            <h2 className="m-0 text-lg font-semibold">{device.name}</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label="改名"
              onClick={() => onRename(device)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label="解绑"
              onClick={() => onDelete(device)}
            >
              <Unlink />
            </Button>
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
      </CardHeader>
      <CardFooter className="device-card-actions grid grid-cols-2 gap-2 px-5">
        <Button asChild>
          <Link to={`/devices/${encodeURIComponent(pathKey)}/subscribe`}>配置订阅</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={`/devices/${encodeURIComponent(pathKey)}/subscribe/test`}>测试通知</Link>
        </Button>
      </CardFooter>
    </Card>
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
    <div className="grid justify-items-start gap-2 py-8">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      <p className="m-0 text-sm leading-6 text-muted-foreground">{body}</p>
      {action ? (
        <Button asChild>
          <Link to={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-8 text-sm text-muted-foreground" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden="true" />
      {label}
    </div>
  );
}
