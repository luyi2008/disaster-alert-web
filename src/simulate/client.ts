import type { ApiEnvelope } from "../api";
import { apiUrl } from "../api";
import { parseApiResponse } from "../subscribe/http";

export type SimulateResult = {
  event_id: string;
  pushed: number;
  skipped: number;
  temporary: boolean;
  notify_level?: string;
  source?: string;
  key?: string;
};

export type HistoryRecord = {
  source: string;
  key: string;
  event_id: string;
  origin_time: string;
  hypocenter: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  depth_km: number;
  max_intensity: string;
  note: string;
  estimated_intensity?: number;
  distance_km?: number;
  hypocentral_km?: number;
};

export type HistoryCatalog = {
  source: string;
  records: HistoryRecord[];
};

export type SimulateCallResult<T> = {
  status: number;
  body: ApiEnvelope<T>;
};

function withBarkAuth(barkKey: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${barkKey}`);
  return { ...init, headers };
}

async function requestEnvelope<T>(path: string, init?: RequestInit): Promise<SimulateCallResult<T>> {
  const response = await fetch(apiUrl(path), init);
  const body = await parseApiResponse(response) as ApiEnvelope<T>;
  return { status: response.status, body };
}

export async function fetchBarkUrls(): Promise<string[]> {
  const { body } = await requestEnvelope<{ bark_urls?: unknown }>("/api/bark-urls");
  const urls = body.data?.bark_urls;
  if (!body.success || !Array.isArray(urls)) {
    return [];
  }
  return urls.filter((item): item is string => typeof item === "string" && Boolean(item));
}

export async function fetchSubscriptionOptions(): Promise<unknown> {
  const { body } = await requestEnvelope<unknown>("/api/subscription-options");
  if (!body.success) {
    throw new Error(body.message || "无法获取订阅选项");
  }
  return body.data ?? {};
}

export async function fetchHistoryCatalog(
  barkKey: string,
  source = "major",
): Promise<SimulateCallResult<HistoryCatalog>> {
  return requestEnvelope<HistoryCatalog>(
    `/api/history?source=${encodeURIComponent(source)}`,
    withBarkAuth(barkKey),
  );
}

export async function simulateNotifyLevel(
  barkKey: string,
  level: string,
): Promise<SimulateCallResult<SimulateResult>> {
  return requestEnvelope<SimulateResult>(
    `/api/simulate?notify_level=${encodeURIComponent(level)}`,
    withBarkAuth(barkKey, { method: "POST" }),
  );
}

export async function simulateHistoryReplay(
  barkKey: string,
  source: string,
  key: string,
): Promise<SimulateCallResult<SimulateResult>> {
  const query = new URLSearchParams({ source, key });
  return requestEnvelope<SimulateResult>(
    `/api/simulate?${query}`,
    withBarkAuth(barkKey, { method: "POST" }),
  );
}
