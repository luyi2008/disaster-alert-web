import { Link, useNavigate } from "react-router-dom";
import { signOut } from "../auth/session";

type DeviceIdentityProps = {
  deviceId: string;
  deviceName: string;
  currentPage?: "subscribe" | "test";
};

export function DeviceIdentity({
  deviceId,
  deviceName,
  currentPage = "subscribe",
}: DeviceIdentityProps) {
  const navigate = useNavigate();
  return (
    <div className="device-identity">
      <div className="identity-label-row">
        <p className="identity-copy" title={deviceName} aria-label={`当前设备 ${deviceName}`}>
          {deviceName}
        </p>
        <div className="identity-actions">
          {currentPage === "test" ? (
            <Link className="btn-ghost" to={`/devices/${deviceId}/subscribe`}>
              返回订阅
            </Link>
          ) : (
            <Link className="btn-ghost" to={`/devices/${deviceId}/subscribe/test`}>
              测试
            </Link>
          )}
          <Link className="btn-ghost" to="/devices">
            换设备
          </Link>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => {
              void signOut().then(() => navigate("/login"));
            }}
          >
            登出
          </button>
        </div>
      </div>
    </div>
  );
}
