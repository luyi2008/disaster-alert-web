import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteDevice, fetchDevices, renameDevice, type DeviceRecord } from "../api";
import { AppShell, Toast } from "../components/ds/AppShell";
import { DeviceCard, EmptyState, LoadingState } from "../components/ds/DeviceCard";
import "../styles/base.css";
import "../styles/ds.css";

export function DevicesPage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<DeviceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function onRename(device: DeviceRecord) {
    const name = window.prompt("设备名称", device.name)?.trim();
    if (!name || name === device.name) {
      return;
    }
    const result = await renameDevice(device.id, name);
    if (result.body.success) {
      await refresh();
    } else {
      setError(result.body.message || "无法改名");
    }
  }

  async function onDelete(device: DeviceRecord) {
    if (!window.confirm(`确定解绑「${device.name}」？会先删除该设备的服务端订阅。`)) {
      return;
    }
    const result = await deleteDevice(device.id);
    if (!result.body.success) {
      setError(result.body.message || "解绑失败");
      return;
    }
    await refresh();
  }

  return (
    <AppShell
      title="设备"
      description="每台设备使用自己的推送 token、地点和规则。"
      action={
        <Link className="ds-btn ds-btn-primary" to="/devices/add">
          添加设备
        </Link>
      }
    >
      {error ? <Toast kind="error">{error}</Toast> : null}
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
            <DeviceCard key={device.id} device={device} onRename={onRename} onDelete={onDelete} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
