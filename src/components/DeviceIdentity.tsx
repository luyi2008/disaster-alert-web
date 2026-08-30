import { Link } from "react-router-dom";
import { maskBarkId } from "../bark/maskBarkId";
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
        <p className="identity-copy" title={barkId} aria-label={`Bark ID ${barkId}`}>
          {maskBarkId(barkId)}
        </p>
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
              重新加载
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
