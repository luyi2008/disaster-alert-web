export type DeviceTokenFailure = "empty" | "length" | "deleted";

const DEVICE_TOKEN_MAX = 128;

export function validateDeviceToken(raw: string | null | undefined): DeviceTokenFailure | null {
  const token = raw?.trim() ?? "";
  if (!token) {
    return "empty";
  }
  if (token.length > DEVICE_TOKEN_MAX) {
    return "length";
  }
  if (token === "deleted") {
    return "deleted";
  }
  return null;
}

export function deviceTokenMessage(failure: DeviceTokenFailure): string {
  switch (failure) {
    case "empty":
      return "请输入 device_token";
    case "length":
      return "device_token 长度不能超过 128";
    case "deleted":
      return "device_token 不能为 deleted";
  }
}
