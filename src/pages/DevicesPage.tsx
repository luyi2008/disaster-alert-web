import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bindDevice, deleteDevice, fetchDevices, renameDevice, type DeviceRecord } from "../api";
import { signOut } from "../auth/session";
import { localValidateBarkKey, localValidateMessage } from "../bark/localValidate";
import { AppBrand } from "../components/AppBrand";
import "../styles/base.css";
import "../styles/account.css";

export function DevicesPage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onBind(event: React.FormEvent) {
    event.preventDefault();
    const failure = localValidateBarkKey(token.trim());
    if (failure) {
      setError(localValidateMessage(failure).replace("Bark Key", "Bark token").replace("Bark 测试链接或 Key", "Bark token"));
      return;
    }
    const result = await bindDevice(token.trim());
    if (result.status === 401) {
      navigate("/login", { replace: true });
      return;
    }
    if (!result.body.success || !result.body.data?.device) {
      setError(result.body.message || "无法绑定设备");
      return;
    }
    setToken("");
    setError(null);
    await refresh();
  }

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
    <div className="account-page">
      <main>
        <div className="account-toolbar">
          <AppBrand />
          <div>
            <Link to="/settings">账号设置</Link>
            {" · "}
            <button
              type="button"
              onClick={() => {
                void signOut().then(() => navigate("/login"));
              }}
            >
              登出
            </button>
          </div>
        </div>
        <h1>设备</h1>
        <p className="account-note">每台设备使用自己的 Bark token、地点和规则。不要粘贴测试链接，只输入 22 位 token。</p>
        {loading ? <p className="account-note">正在加载…</p> : null}
        {!loading && devices.length === 0 ? (
          <p className="account-note">还没有设备。输入 Bark token 添加后才能配置订阅。</p>
        ) : (
          <ul className="device-list">
            {devices.map((device) => (
              <li className="device-card" key={device.id}>
                <h2>{device.name}</h2>
                <div className="device-card-actions">
                  <Link to={`/devices/${device.id}/subscribe`}>配置订阅</Link>
                  <button type="button" onClick={() => void onRename(device)}>改名</button>
                  <button type="button" onClick={() => void onDelete(device)}>解绑</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form className="token-form" onSubmit={(event) => void onBind(event)}>
          <label htmlFor="bark-token">Bark token</label>
          <input
            id="bark-token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="22 位字母或数字"
          />
          {error ? <p className="account-error" role="status">{error}</p> : null}
          <button type="submit">添加设备</button>
        </form>
      </main>
    </div>
  );
}
