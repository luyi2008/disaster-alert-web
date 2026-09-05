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
      return "请输入推送令牌";
    case "length":
      return "推送令牌长度不能超过 128 位";
    case "deleted":
      return "推送令牌不能为 deleted";
  }
}
