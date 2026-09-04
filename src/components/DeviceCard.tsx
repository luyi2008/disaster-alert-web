import { Link } from "react-router-dom";
import { Pencil, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
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
              <dt>设备密钥</dt>
              <dd>{device.deviceKey}</dd>
            </div>
            <div>
              <dt>推送令牌</dt>
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
    <Empty>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{body}</EmptyDescription>
      {action ? (
        <EmptyContent>
          <Button asChild>
            <Link to={action.href}>{action.label}</Link>
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-8 text-sm text-muted-foreground" role="status">
      <Skeleton className="size-4 rounded-full" aria-hidden="true" />
      {label}
    </div>
  );
}
