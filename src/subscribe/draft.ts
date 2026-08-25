import { DRAFT_STORAGE_KEY } from "../api";
import { cloneTarget, createTarget, targetCoordinates, validCoordinate } from "./geo";
import { safeJson } from "./http";
import type { AlertEntry, AlertRuleDraft, SubscriptionDraft, SubscriptionTarget } from "./types";

export const LEGACY_STORAGE_KEY = "disaster_subscription_draft_v2";

export function createEmptyDraft(): SubscriptionDraft {
  return {
    schema_version: 3,
    bark_url: "",
    targets: [],
    alerts_by_category: {},
  };
}

export function draftForStorage(draft: SubscriptionDraft): SubscriptionDraft {
  return {
    schema_version: 3,
    bark_url: draft.bark_url,
    targets: draft.targets.map((target) => cloneTarget(target)),
    alerts_by_category: JSON.parse(JSON.stringify(draft.alerts_by_category)) as Record<string, AlertEntry>,
  };
}

export function draftSignature(draft: SubscriptionDraft): string {
  return JSON.stringify(draftForStorage(draft));
}

export function restoreDraftFromStorage(): SubscriptionDraft {
  const current = safeJson(localStorage.getItem(DRAFT_STORAGE_KEY)) as Record<string, unknown> | null;
  const legacy = safeJson(localStorage.getItem(LEGACY_STORAGE_KEY)) as Record<string, unknown> | null;
  const source = current?.schema_version === 3 ? current : legacy || {};
  const draft = createEmptyDraft();
  draft.bark_url = typeof source.bark_url === "string" ? source.bark_url : "";
  const legacyCurrent = source.current && typeof source.current === "object"
    ? source.current as Record<string, unknown>
    : null;
  const sourceTargets = Array.isArray(source.targets) && source.targets.length
    ? source.targets
    : legacyCurrent && validCoordinate(Number(legacyCurrent.latitude), Number(legacyCurrent.longitude))
      ? [{
          label: legacyCurrent.name,
          point: { latitude: legacyCurrent.latitude, longitude: legacyCurrent.longitude },
          region: { province: legacyCurrent.province, city: legacyCurrent.city, district: legacyCurrent.district },
        }]
      : [];
  draft.targets = sourceTargets.slice(0, 3)
    .filter((target): target is Record<string, unknown> => Boolean(target && typeof target === "object"))
    .map((target) => {
      const point = target.point && typeof target.point === "object" ? target.point as Record<string, unknown> : {};
      const region = target.region && typeof target.region === "object" ? target.region as Record<string, unknown> : {};
      return {
        id: typeof target.id === "string" && target.id ? target.id : createTarget().id,
        label: String(target.label || ""),
        point: {
          latitude: String(point.latitude ?? ""),
          longitude: String(point.longitude ?? ""),
        },
        region: {
          province: String(region.province || ""),
          city: String(region.city || ""),
          district: String(region.district || ""),
        },
      };
    });
  draft.alerts_by_category = source.alerts_by_category && typeof source.alerts_by_category === "object"
    ? JSON.parse(JSON.stringify(source.alerts_by_category)) as Record<string, AlertEntry>
    : {};
  draft.legacy_alerts = Array.isArray(source.alerts) ? JSON.parse(JSON.stringify(source.alerts)) as AlertRuleDraft[] : [];
  draft.legacy_disabled_alerts = Array.isArray(source.disabled_alerts)
    ? JSON.parse(JSON.stringify(source.disabled_alerts)) as AlertRuleDraft[]
    : [];
  return draft;
}

export function incompleteTarget(draft: SubscriptionDraft): SubscriptionTarget | undefined {
  return draft.targets.find((target) => !targetCoordinates(target));
}

export function writeDraft(draft: SubscriptionDraft): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, draftSignature(draft));
  } catch {
    // Ignore quota / private-mode failures; the in-memory draft remains usable.
  }
}
