import { Link } from "react-router-dom";

type DeviceIdentityProps = {
  barkId: string;
};

export function DeviceIdentity({ barkId }: DeviceIdentityProps) {
  return (
    <div className="device-identity">
      <div className="identity-label-row">
        <div className="identity-copy">
          <p>通知 APP：Bark</p>
          <p>Bark ID：{barkId}</p>
        </div>
        <Link className="change-device" to="/">
          更换设备
        </Link>
      </div>
    </div>
  );
}
