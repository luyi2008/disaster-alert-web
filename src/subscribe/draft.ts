import { cloneTarget, createTarget, validCoordinate } from "./geo";
import type { AlertEntry, AlertRuleDraft, SavedSubscription, SubscriptionDraft } from "./types";

export function createEmptyDraft(): SubscriptionDraft {
  return {
    schema_version: 3,
    bark_url: "",
    targets: [],
    alerts_by_category: {},
  };
}

export function canonicalDraft(draft: SubscriptionDraft): SubscriptionDraft {
  return {
    schema_version: 3,
    bark_url: draft.bark_url,
    targets: draft.targets.map((target) => cloneTarget(target)),
    alerts_by_category: JSON.parse(JSON.stringify(draft.alerts_by_category)) as Record<string, AlertEntry>,
  };
}

export function draftSignature(draft: SubscriptionDraft): string {
  return JSON.stringify(canonicalDraft(draft));
}

export function selectSavedSubscription(
  subscriptions: SavedSubscription[] | undefined,
  deviceKey: string,
  barkUrls: string[],
): SavedSubscription | null {
  const list = Array.isArray(subscriptions) ? subscriptions : [];
  const byKey = list.filter((row) => row.destination?.device_key === deviceKey);
  if (!byKey.length) {
    return null;
  }
  const allow = new Set(barkUrls);
  const preferred = byKey.filter((row) => (
    typeof row.destination?.base_url === "string" && allow.has(row.destination.base_url)
  ));
  return preferred[0] || byKey[0];
}

function formatCoord(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(4) : "";
}

export function draftFromSavedSubscription(row: SavedSubscription, barkUrls: string[]): SubscriptionDraft {
  const draft = createEmptyDraft();
  const base = row.destination?.base_url;
  draft.bark_url = typeof base === "string" && barkUrls.includes(base)
    ? base
    : (barkUrls[0] || "");
  const sourceTargets = Array.isArray(row.targets) ? row.targets : [];
  draft.targets = sourceTargets.slice(0, 3).map((target) => {
    const created = createTarget();
    const lat = Number(target.point?.latitude);
    const lon = Number(target.point?.longitude);
    const pointOk = validCoordinate(lat, lon);
    return {
      id: created.id,
      label: String(target.label || ""),
      point: {
        latitude: pointOk ? formatCoord(lat) : "",
        longitude: pointOk ? formatCoord(lon) : "",
      },
      region: {
        province: String(target.region?.province || ""),
        city: String(target.region?.city || ""),
        district: String(target.region?.district || ""),
      },
    };
  });
  const alerts = Array.isArray(row.alerts) ? row.alerts : [];
  draft.alerts_by_category = {};
  for (const alert of alerts) {
    if (!alert || typeof alert !== "object" || typeof alert.category !== "string" || !alert.category) {
      continue;
    }
    draft.alerts_by_category[alert.category] = {
      enabled: true,
      rule: JSON.parse(JSON.stringify(alert)) as AlertRuleDraft,
    };
  }
  return draft;
}
