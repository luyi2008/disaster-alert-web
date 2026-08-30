export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data?: T;
};

export type PublicEvent = {
  category: string;
  source: string;
  event_id: string;
  revision: string;
  report_num: number;
  title: string;
  description: string;
  affected_regions: string[];
  latitude: number | null;
  longitude: number | null;
  magnitude: number | null;
  depth_km: number | null;
  radius_km: number | null;
  level: number;
  occurred_at: string;
  final_report: boolean;
  cancel: boolean;
  training: boolean;
};

export type NotificationTarget = {
  label: string;
  latitude: number;
  longitude: number;
  province: string;
  city: string;
  district: string;
};

export type NotificationTiming = {
  epicentral_distance_km: number;
  hypocentral_distance_km: number;
  estimated_intensity: number;
  p_arrival_at_ms: number;
  s_arrival_at_ms: number;
};

export type AlertRule = {
  category: string;
  sources?: { mode: string; ids?: string[] };
  estimated_intensity_bands?: Array<{
    min: number;
    max: number;
    interruption_level: string;
  }>;
  min_magnitude?: number;
  min_severity?: number;
  fallback_radius_km?: number;
  max_center_distance_km?: number;
};

export type IncidentReportSummary = {
  category: string;
  source: string;
  report_num: number;
  revision: string;
  observed_at_ms: number;
  magnitude: number | null;
  latitude: number | null;
  longitude: number | null;
  depth_km: number | null;
  level: number;
  final_report: boolean;
  cancel: boolean;
};

export type IncidentView = {
  id: string;
  category: string;
  updated_at_ms: number;
  latest_by_source: PublicEvent[];
  timeline: IncidentReportSummary[];
};

export type NotificationSnapshot = {
  incident_id: string;
  issued_at_ms: number;
  event: PublicEvent;
  target: NotificationTarget;
  timing: NotificationTiming | null;
  interruption_level: string;
  matched_rule: AlertRule;
};

export type IncidentDetail = {
  snapshot: NotificationSnapshot;
  incident: IncidentView | null;
};

export type StatusData = {
  instance_terms_accepted: boolean;
  total_subscriptions: number;
};

const apiRoot = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

export function apiUrl(path: string): string {
  return `${apiRoot}${path}`;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const response = await fetch(apiUrl(path), init);
  const body = (await response.json()) as ApiEnvelope<T>;
  return body;
}

export async function fetchStatus(): Promise<StatusData> {
  const body = await fetchJson<StatusData>("/api/status");
  if (!body.success || !body.data) {
    throw new Error(body.message || "运行状态暂时无法获取");
  }
  return body.data;
}

export async function fetchIncidentDetail(
  incidentId: string,
  token: string,
): Promise<{ status: number; body: ApiEnvelope<IncidentDetail> }> {
  const response = await fetch(
    apiUrl(`/api/incidents/${encodeURIComponent(incidentId)}/notifications/${encodeURIComponent(token)}`),
  );
  const body = (await response.json()) as ApiEnvelope<IncidentDetail>;
  return { status: response.status, body };
}

export const DRAFT_STORAGE_KEY = "disaster_subscription_draft_v3";

/** Draft blob must not hold the login Key; identity lives in `disaster_bark_key`. */
export function draftOmitsBarkKey(draft: unknown): boolean {
  if (!draft || typeof draft !== "object") {
    return true;
  }
  const record = draft as Record<string, unknown>;
  return !("barkKey" in record) && !("device_key" in record) && !("bark_id" in record);
}
