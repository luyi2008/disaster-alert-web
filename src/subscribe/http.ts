import type { ApiEnvelope } from "../api";

export function safeJson(value: string | null): unknown {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function cleanApiMessage(value: unknown): string {
  if (typeof value !== "string") return "";
  const message = value.replace(/\s+/g, " ").trim();
  if (!message || /<\s*(?:!doctype|html|head|body)\b/i.test(message)) return "";
  return message.length > 240 ? `${message.slice(0, 239)}…` : message;
}

export function httpFailureMessage(res: Response): string {
  if (res.ok) return "服务返回了无法识别的响应";
  if ([502, 503, 504].includes(res.status)) return "服务暂时不可用，请稍后重试";
  if (res.status >= 500) return "服务器处理请求时发生错误，请稍后重试";
  if (res.status === 429) return "请求过于频繁，请稍后重试";
  if (res.status === 404) return "请求的服务不存在";
  if (res.status === 413) return "提交的内容过大";
  if (res.status === 400) return "提交内容无效，请检查后重试";
  return `请求失败（HTTP ${res.status || "未知"}）`;
}

export async function parseApiResponse(res: Response, fallbackMessage = ""): Promise<ApiEnvelope<unknown>> {
  const text = await res.text();
  const json = safeJson(text);
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return {
      ...record,
      success: record.success === true,
      message: cleanApiMessage(record.message) || cleanApiMessage(fallbackMessage) || httpFailureMessage(res),
    } as ApiEnvelope<unknown>;
  }
  return {
    success: false,
    message: cleanApiMessage(fallbackMessage) || httpFailureMessage(res),
  };
}
