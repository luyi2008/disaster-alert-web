import { Link } from "react-router-dom";
import { clearCachedBarkKey } from "../bark/session";

type DeviceIdentityProps = {
  barkId: string;
  onReloadConfig?: () => void;
  currentPage?: "subscribe" | "test";
};

export function DeviceIdentity({
  barkId,
  onReloadConfig,
  currentPage = "subscribe",
}: DeviceIdentityProps) {
  return (
    <div className="device-identity">
      <div className="identity-label-row">
        <div className="identity-copy">
          <p>通知 APP：Bark</p>
          <p>Bark ID：{barkId}</p>
        </div>
        <div className="identity-actions">
          {currentPage === "test" ? (
            <Link className="btn-ghost" to="/subscribe" state={{ barkKey: barkId }}>
              返回订阅
            </Link>
          ) : (
            <Link className="btn-ghost" to="/subscribe/test" state={{ barkKey: barkId }}>
              测试
            </Link>
          )}
          <Link className="btn-ghost" to="/" onClick={() => clearCachedBarkKey()}>
            更换设备
          </Link>
          {onReloadConfig ? (
            <button className="btn-ghost" type="button" onClick={onReloadConfig}>
              重新加载配置
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
