import { Link } from "react-router-dom";

type DeviceIdentityProps = {
  barkId: string;
  onReloadConfig: () => void;
};

export function DeviceIdentity({ barkId, onReloadConfig }: DeviceIdentityProps) {
  return (
    <div className="device-identity">
      <div className="identity-label-row">
        <div className="identity-copy">
          <p>通知 APP：Bark</p>
          <p>Bark ID：{barkId}</p>
        </div>
        <div className="identity-actions">
          <Link className="change-device" to="/">
            更换设备
          </Link>
          <button className="change-device" type="button" onClick={onReloadConfig}>
            重新加载配置
          </button>
        </div>
      </div>
    </div>
  );
}
