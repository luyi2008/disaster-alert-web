import { checkDeviceKey } from "./checkDeviceKey";
import { localValidateBarkKey } from "./localValidate";

export const BARK_KEY_STORAGE_KEY = "disaster_bark_key";

export type BarkKeyConfirm = "ok" | "rejected" | "unavailable";

export type BarkFailureSource = "subscribe" | "bearer";

export function readCachedBarkKey(): string | null {
  const stored = localStorage.getItem(BARK_KEY_STORAGE_KEY);
  if (typeof stored !== "string" || localValidateBarkKey(stored)) {
    if (stored !== null) {
      localStorage.removeItem(BARK_KEY_STORAGE_KEY);
    }
    return null;
  }
  return stored;
}

export function writeCachedBarkKey(key: string): void {
  if (localValidateBarkKey(key)) {
    localStorage.removeItem(BARK_KEY_STORAGE_KEY);
    return;
  }
  localStorage.setItem(BARK_KEY_STORAGE_KEY, key);
}

export function clearCachedBarkKey(): void {
  localStorage.removeItem(BARK_KEY_STORAGE_KEY);
}

export async function confirmBarkKey(key: string, signal?: AbortSignal): Promise<BarkKeyConfirm> {
  try {
    const result = await checkDeviceKey(key, signal);
    if (result.valid && result.registered) {
      return "ok";
    }
    return "rejected";
  } catch (error: { name?: string } | unknown) {
    if (error && typeof error === "object" && (error as { name?: string }).name === "AbortError") {
      return "unavailable";
    }
    return "unavailable";
  }
}

export function isSuspiciousBarkFailure(status: number, source: BarkFailureSource): boolean {
  return source === "subscribe" ? status === 502 : status === 401;
}

export async function maybeExpireBarkSession(
  key: string,
  status: number,
  source: BarkFailureSource,
): Promise<boolean> {
  if (localValidateBarkKey(key)) {
    clearCachedBarkKey();
    return true;
  }
  if (!isSuspiciousBarkFailure(status, source)) {
    return false;
  }
  const result = await confirmBarkKey(key);
  if (result === "rejected") {
    clearCachedBarkKey();
    return true;
  }
  return false;
}
