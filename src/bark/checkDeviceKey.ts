export const BARK_CHECK_PRODUCTION_URL = "https://bark.mangguo.cloud/check";

export function barkCheckUrl(): string {
  return import.meta.env.DEV ? "/bark-check" : BARK_CHECK_PRODUCTION_URL;
}

export type BarkCheckData = {
  device_key: string;
  valid: boolean;
  registered: boolean;
  reason: string | null;
};

export function remoteStatusMessage(result: BarkCheckData): string {
  if (!result.valid) {
    const reason = result.reason ?? "";
    if (reason.includes("empty")) {
      return "请输入 Bark Key";
    }
    if (reason.includes("length")) {
      return "Bark Key 长度必须为 22 位";
    }
    if (reason.includes("invalid characters")) {
      return "Bark Key 只能包含字母和数字";
    }
    return "Bark Key 格式无效";
  }
  if (!result.registered) {
    return "该 Bark Key 尚未在推送服务注册";
  }
  return "校验通过";
}

export async function checkDeviceKey(deviceKey: string, signal?: AbortSignal): Promise<BarkCheckData> {
  const url = `${barkCheckUrl()}?device_key=${encodeURIComponent(deviceKey)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error("无法校验 Bark Key，请稍后重试");
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("无法校验 Bark Key，请稍后重试");
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("无法校验 Bark Key，请稍后重试");
  }
  const data = (json as { data?: unknown }).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("无法校验 Bark Key，请稍后重试");
  }
  const record = data as Record<string, unknown>;
  if (typeof record.valid !== "boolean" || typeof record.registered !== "boolean") {
    throw new Error("无法校验 Bark Key，请稍后重试");
  }
  return {
    device_key: typeof record.device_key === "string" ? record.device_key : deviceKey,
    valid: record.valid,
    registered: record.registered,
    reason: typeof record.reason === "string" ? record.reason : null,
  };
}
