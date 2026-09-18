import type { ApiEnvelope } from "../api";
import { apiUrl } from "../api";
import { bffFetch } from "../auth/session";
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

async function requestEnvelope<T>(path: string, init?: RequestInit, viaBff = false): Promise<SimulateCallResult<T>> {
  const response = viaBff ? await bffFetch(path, init) : await fetch(apiUrl(path), init);
  const body = await parseApiResponse(response) as ApiEnvelope<T>;
  return { status: response.status, body };
}

export async function fetchSubscriptionOptions(): Promise<unknown> {
  const { body } = await requestEnvelope<unknown>("/api/subscription-options");
  if (!body.success) {
    throw new Error(body.message || "无法获取订阅选项");
  }
  return body.data ?? {};
}

export async function fetchHistoryCatalog(source = "major"): Promise<SimulateCallResult<HistoryCatalog>> {
  return requestEnvelope<HistoryCatalog>(`/api/history?source=${encodeURIComponent(source)}`);
}

export async function simulateNotifyLevel(
  deviceKey: string,
  level: string,
): Promise<SimulateCallResult<SimulateResult>> {
  return requestEnvelope<SimulateResult>(
    `/api/devices/${encodeURIComponent(deviceKey)}/simulate?notify_level=${encodeURIComponent(level)}`,
    { method: "POST", body: "{}" },
    true,
  );
}

export async function simulateHistoryReplay(
  deviceKey: string,
  source: string,
  key: string,
): Promise<SimulateCallResult<SimulateResult>> {
  const query = new URLSearchParams({ source, key });
  return requestEnvelope<SimulateResult>(
    `/api/devices/${encodeURIComponent(deviceKey)}/simulate?${query}`,
    { method: "POST", body: "{}" },
    true,
  );
}
