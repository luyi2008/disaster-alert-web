import { apiUrl } from "../api";

export class CaptchaError extends Error {
  override readonly name = "CaptchaError";
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export type CaptchaChallenge = {
  token: string;
  svg: string;
};

export type SendSmsAfterCaptchaInput = {
  token: string;
  code: string;
  phoneNumber: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function messageFromBody(body: unknown): string | null {
  const record = asRecord(body);
  if (!record) {
    return null;
  }
  const nested = asRecord(record.data);
  const message = pickString(record, ["message"]) ?? (nested ? pickString(nested, ["message"]) : null);
  return message;
}

export function parseCaptchaChallenge(body: unknown): CaptchaChallenge {
  const root = asRecord(body);
  if (!root) {
    throw new CaptchaError("图形验证码暂不可用");
  }
  const data = asRecord(root.data) ?? root;
  const token = pickString(data, ["token", "captchaToken", "id"]);
  const svg = pickString(data, ["svg", "image", "captchaSvg", "captcha"]);
  if (!token || !svg) {
    throw new CaptchaError("图形验证码暂不可用");
  }
  return { token, svg };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function fetchCaptchaChallenge(): Promise<CaptchaChallenge> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/api/code"), { credentials: "include" });
  } catch {
    throw new CaptchaError("图形验证码暂不可用");
  }
  const body = await readBody(response);
  if (!response.ok) {
    throw new CaptchaError("图形验证码暂不可用", response.status);
  }
  try {
    return parseCaptchaChallenge(body);
  } catch (error) {
    if (error instanceof CaptchaError) {
      throw error;
    }
    throw new CaptchaError("图形验证码暂不可用", response.status);
  }
}

export async function sendSmsAfterCaptcha(input: SendSmsAfterCaptchaInput): Promise<void> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/api/send-code"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: input.token,
        code: input.code,
        phoneNumber: input.phoneNumber,
      }),
    });
  } catch {
    throw new CaptchaError("图形验证码暂不可用");
  }
  if (response.ok) {
    return;
  }
  const body = await readBody(response);
  throw new CaptchaError(
    messageFromBody(body) ?? "图形验证码不正确",
    response.status,
  );
}
