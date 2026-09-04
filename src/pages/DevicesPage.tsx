import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteDevice, fetchDevices, renameDevice, type DeviceRecord } from "../api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { RenameDialog } from "../components/RenameDialog";
import { AppShell } from "../components/AppShell";
import { DeviceCard, EmptyState, LoadingState } from "../components/DeviceCard";
import { StatusMessage } from "../components/Field";
import "../styles/base.css";
import "../styles/ds.css";

export function DevicesPage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<DeviceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<DeviceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceRecord | null>(null);

  async function refresh() {
    const result = await fetchDevices();
    if (result.status === 401) {
      navigate("/login", { replace: true });
      return;
    }
    setDevices(result.body.data?.devices ?? []);
    if (!result.body.success && result.status !== 200) {
      setError(result.body.message || "无法加载设备");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function submitRename(name: string) {
    const device = renameTarget;
    if (!device) {
      return;
    }
    const trimmed = name.trim();
    setRenameTarget(null);
    if (!trimmed || trimmed === device.name) {
      return;
    }
    const result = await renameDevice(device.id, trimmed);
    if (result.body.success) {
      await refresh();
    } else {
      setError(result.body.message || "无法改名");
    }
  }

  async function submitDelete() {
    const device = deleteTarget;
    if (!device) {
      return;
    }
    setDeleteTarget(null);
    const result = await deleteDevice(device.id);
    if (!result.body.success) {
      setError(result.body.message || "解绑失败");
      return;
    }
    await refresh();
  }

  return (
    <>
      <AppShell
        title="设备"
        description="每台设备使用自己的推送 token、地点和规则。"
        action={
          <Button asChild>
            <Link to="/devices/add">添加设备</Link>
          </Button>
        }
      >
        {error ? <StatusMessage kind="error">{error}</StatusMessage> : null}
        {devices === null ? (
          <LoadingState label="正在加载…" />
        ) : devices.length === 0 ? (
          <EmptyState
            title="还没有设备"
            body="输入 APNs device_token 添加后才能配置订阅。最长 128 位，不能为 deleted。"
            action={{ href: "/devices/add", label: "添加设备" }}
          />
        ) : (
          <div className="device-grid">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onRename={setRenameTarget}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </AppShell>
      <RenameDialog
        open={renameTarget !== null}
        initialValue={renameTarget?.name ?? ""}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
          }
        }}
        onConfirm={(name) => void submitRename(name)}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="解绑设备"
        description={deleteTarget ? `确定解绑「${deleteTarget.name}」？会先删除该设备的服务端订阅。` : ""}
        confirmLabel="确认解绑"
        destructive
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => void submitDelete()}
      />
    </>
  );
}
