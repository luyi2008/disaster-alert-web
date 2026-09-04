import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
            <Button asChild variant="ghost" size="sm">
              <Link to={`/devices/${deviceId}/subscribe`}>返回订阅</Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to={`/devices/${deviceId}/subscribe/test`}>测试</Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link to="/devices">换设备</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => {
              void signOut().then(() => navigate("/login"));
            }}
          >
            登出
          </Button>
        </div>
      </div>
    </div>
  );
}
