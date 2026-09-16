import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteDevice, fetchDevices, renameDevice, type DeviceRecord } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { RenameDialog } from "../components/RenameDialog";
import { AppShell } from "../components/AppShell";
import { DeviceCard, LoadingState } from "../components/DeviceCard";
import { StatusMessage } from "../components/Field";
import { AddDeviceDialog } from "../devices/AddDeviceDialog";
import { AddDeviceForm } from "../devices/AddDeviceForm";
import "../styles/base.css";
import "../styles/ds.css";

export function DevicesPage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<DeviceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<DeviceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceRecord | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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
          devices && devices.length > 0 ? (
            <Button onClick={() => setAddOpen(true)}>添加设备</Button>
          ) : null
        }
      >
        {error ? <StatusMessage kind="error">{error}</StatusMessage> : null}
        {devices === null ? (
          <LoadingState label="正在加载…" />
        ) : devices.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold">还没有设备</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  直接在下方添加第一台设备。最长 128 位，不能为 deleted。
                </p>
              </div>
              <AddDeviceForm onSuccess={() => void refresh()} />
            </CardContent>
          </Card>
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
      <AddDeviceDialog open={addOpen} onOpenChange={setAddOpen} onAdded={() => void refresh()} />
    </>
  );
}
