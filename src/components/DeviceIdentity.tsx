import { Link, useParams } from "react-router-dom";
import { maskBarkId } from "../bark/maskBarkId";
import { clearCachedBarkKey } from "../bark/session";

type DeviceIdentityProps = {
  barkId: string;
  currentPage?: "subscribe" | "test";
  deviceId?: string;
};

export function DeviceIdentity({
  barkId,
  currentPage = "subscribe",
  deviceId,
}: DeviceIdentityProps) {
  const params = useParams();
  const scopedId = deviceId ?? params.deviceId;
  const subscribeTo = scopedId ? `/devices/${scopedId}/subscription` : "/subscribe";
  const testTo = scopedId ? `/devices/${scopedId}/test` : "/subscribe/test";
  const homeTo = scopedId ? "/devices" : "/";
  const homeLabel = scopedId ? "设备中心" : "更换设备";

  return (
    <div className="device-identity">
      <div className="identity-label-row">
        <p className="identity-copy" title={barkId} aria-label={`Bark ID ${barkId}`}>
          {maskBarkId(barkId)}
        </p>
        <div className="identity-actions">
          {currentPage === "test" ? (
            <Link className="btn-ghost" to={subscribeTo} state={{ barkKey: barkId }}>
              返回订阅
            </Link>
          ) : (
            <Link className="btn-ghost" to={testTo} state={{ barkKey: barkId }}>
              测试
            </Link>
          )}
          <Link
            className="btn-ghost"
            to={homeTo}
            onClick={() => {
              if (!scopedId) {
                clearCachedBarkKey();
              }
            }}
          >
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
