const captchaOrigin =
  (import.meta.env.CAPTCHA_ORIGIN as string | undefined)?.replace(/\/$/, "") ?? "";

export function captchaUrl(path: string): string {
  return `${captchaOrigin}${path}`;
}

export class CaptchaError extends Error {
  override readonly name = "CaptchaError";
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type CaptchaChallenge = {
  token: string;
  svg: string;
};

export type SendSmsAfterCaptchaInput = {
  token: string;
  code: string;
  phone: string;
};

export type SendSmsAfterCaptchaResult = {
  cooldown: number;
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

function readErrorCode(body: unknown): string | undefined {
  const record = asRecord(body);
  return record ? pickString(record, ["error"]) ?? undefined : undefined;
}

function edgeErrorMessage(body: unknown, status: number, fallback: string): string {
  const record = asRecord(body);
  const code = record ? pickString(record, ["error"]) : null;
  switch (code) {
    case "INVALID_PHONE":
      return "请输入 11 位大陆手机号";
    case "CAPTCHA_REQUIRED":
      return "请输入图形验证码";
    case "CAPTCHA_INVALID":
      return "图形验证码不正确";
    case "CAPTCHA_EXPIRED":
      return "图形验证码已过期，请换一张";
    case "SMS_FAILED":
      return (record && pickString(record, ["message"])) || "短信发送失败，请稍后重试";
    default:
      break;
  }
  if (status === 429) {
    return "请求过于频繁，请稍后重试";
  }
  if (status === 401) {
    return "图形验证码已过期，请换一张";
  }
  if (status === 502) {
    return (record && pickString(record, ["message"])) || "短信发送失败，请稍后重试";
  }
  if (status >= 500) {
    return "图形验证码暂不可用";
  }
  return fallback;
}

function readCooldown(body: unknown): number {
  const value = asRecord(body)?.cooldown;
  return typeof value === "number" && value > 0 ? value : 60;
}

export function parseCaptchaChallenge(body: unknown): CaptchaChallenge {
  const root = asRecord(body);
  if (!root) {
    throw new CaptchaError("图形验证码暂不可用");
  }
  const data = asRecord(root.data) ?? root;
  const token = pickString(data, ["captchaToken", "captcha_token", "token", "id"]);
  const svg = pickString(data, ["svg", "captchaSvg", "captcha_svg", "image", "captcha"]);
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
    response = await fetch(captchaUrl("/api/captcha"), { credentials: "include" });
  } catch {
    throw new CaptchaError("图形验证码暂不可用");
  }
  const body = await readBody(response);
  if (!response.ok) {
    throw new CaptchaError(
      edgeErrorMessage(body, response.status, "图形验证码暂不可用"),
      response.status,
      readErrorCode(body),
    );
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

export async function sendSmsAfterCaptcha(
  input: SendSmsAfterCaptchaInput,
): Promise<SendSmsAfterCaptchaResult> {
  let response: Response;
  try {
    response = await fetch(captchaUrl("/api/captcha/verify"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: input.phone,
        captchaToken: input.token,
        captchaCode: input.code,
      }),
    });
  } catch {
    throw new CaptchaError("图形验证码暂不可用");
  }
  const body = await readBody(response);
  if (response.ok) {
    return { cooldown: readCooldown(body) };
  }
  throw new CaptchaError(
    edgeErrorMessage(body, response.status, "图形验证码不正确"),
    response.status,
    readErrorCode(body),
  );
}

export function isSmsSendFailure(error: unknown): boolean {
  return error instanceof CaptchaError && (error.code === "SMS_FAILED" || error.status === 502);
}
