import type { AlertEntry, SubscriptionDraft, SubscriptionTarget } from "../subscribe/types";

const CATEGORY_LABELS: Record<string, string> = {
  earthquake_warning: "地震预警",
  earthquake_report: "地震速报",
  weather_warning: "气象预警",
  tsunami: "海啸预警",
  typhoon: "台风信息",
};

const SEVERITY_LABELS: Record<number, string> = {
  1: "蓝色",
  2: "黄色",
  3: "橙色",
  4: "红色",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}

export function formatDraftUpdatedAt(epochMs: number | null): string {
  if (epochMs == null || !Number.isFinite(epochMs) || epochMs <= 0) {
    return "尚无";
  }
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) {
    return "尚无";
  }
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatTarget(target: SubscriptionTarget): string {
  const name = target.label.trim() || "未命名地点";
  const region = [target.region.province, target.region.city, target.region.district].filter(Boolean).join(" / ");
  const coords = [target.point.latitude, target.point.longitude].filter((value) => String(value).trim()).join(", ");
  if (region && coords) {
    return `${name} · ${region} · ${coords}`;
  }
  if (region) {
    return `${name} · ${region}`;
  }
  if (coords) {
    return `${name} · ${coords}`;
  }
  return name;
}

export function formatTargetChip(target: SubscriptionTarget): string {
  const name = target.label.trim() || "未命名地点";
  const city = target.region.city.trim() || target.region.province.trim();
  const district = target.region.district.trim();
  const place = [city, district].filter((part, index, parts) => part && parts.indexOf(part) === index);
  return place.length ? `${name} · ${place.join(" · ")}` : name;
}

export function formatBarkHost(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "尚未获取";
  }
  try {
    const host = new URL(trimmed).hostname;
    return host || trimmed;
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").split("/")[0] || trimmed;
  }
}

export type RuleCardTone = "warn" | "primary" | "yellow" | "quiet";

export type AlertRuleCard = {
  category: string;
  title: string;
  tone: RuleCardTone;
  badge?: { label: string; tone: RuleCardTone };
  metric?: string;
};

function notifyLevelTone(id: string): RuleCardTone {
  switch (id) {
    case "critical":
      return "warn";
    case "active":
      return "primary";
    default:
      return "quiet";
  }
}

function severityTone(severity: number): RuleCardTone {
  if (severity >= 4) {
    return "warn";
  }
  if (severity >= 2) {
    return "yellow";
  }
  return "primary";
}

function categoryTone(category: string, entry: AlertEntry): RuleCardTone {
  if (!entry.enabled) {
    return "quiet";
  }
  switch (category) {
    case "earthquake_warning": {
      const bands = entry.rule.estimated_intensity_bands || [];
      const levels = bands
        .map((band) => String(band.interruption_level ?? band.level ?? "").trim().toLowerCase())
        .filter(Boolean);
      if (levels.includes("critical")) {
        return "warn";
      }
      if (levels.includes("active")) {
        return "primary";
      }
      return "quiet";
    }
    case "weather_warning":
    case "tsunami":
      return "yellow";
    case "typhoon":
      return "primary";
    default:
      return "quiet";
  }
}

export function alertRuleCards(draft: SubscriptionDraft): AlertRuleCard[] {
  return Object.entries(draft.alerts_by_category).map(([category, entry]) => {
    const title = categoryLabel(entry.rule.category || category);
    const tone = categoryTone(category, entry);
    if (!entry.enabled) {
      return { category, title, tone: "quiet", badge: { label: "未启用", tone: "quiet" } };
    }

    const bands = entry.rule.estimated_intensity_bands || [];
    const criticalBand = [...bands].reverse().find((band) => {
      const level = String(band.interruption_level ?? band.level ?? "").trim().toLowerCase();
      return level === "critical";
    }) ?? bands[bands.length - 1];
    const levelId = criticalBand
      ? String(criticalBand.interruption_level ?? criticalBand.level ?? "").trim().toLowerCase()
      : "";

    let badge: AlertRuleCard["badge"];
    let metric: string | undefined;

    if (criticalBand && formatBand(criticalBand)) {
      const range = formatBand(criticalBand).replace(/\s+(紧急|重要|静默)$/, "");
      metric = range || undefined;
      if (levelId) {
        badge = { label: notifyLevelLabel(levelId), tone: notifyLevelTone(levelId) };
      }
    }

    if (entry.rule.min_magnitude != null && String(entry.rule.min_magnitude) !== "") {
      const magnitude = Number(entry.rule.min_magnitude);
      metric = `M ≥ ${Number.isFinite(magnitude) ? magnitude.toFixed(1) : entry.rule.min_magnitude}`;
    }

    if (entry.rule.min_severity != null && String(entry.rule.min_severity) !== "") {
      const severity = Number(entry.rule.min_severity);
      const severityLabel = Number.isFinite(severity) ? SEVERITY_LABELS[severity] : "";
      if (severityLabel) {
        badge = { label: severityLabel, tone: Number.isFinite(severity) ? severityTone(severity) : "quiet" };
      }
    }

    const radius = entry.rule.fallback_radius_km ?? entry.rule.max_center_distance_km;
    if (radius != null && String(radius) !== "") {
      metric = `${radius}km`;
    }

    return { category, title, tone, badge, metric };
  });
}

function notifyLevelLabel(id: string): string {
  switch (id) {
    case "critical":
      return "紧急";
    case "active":
      return "重要";
    case "passive":
      return "静默";
    default:
      return id;
  }
}

function formatBand(band: { min?: unknown; max?: unknown; interruption_level?: unknown; level?: unknown }): string {
  const min = Number(band.min);
  const max = Number(band.max);
  const level = String(band.interruption_level ?? band.level ?? "").trim().toLowerCase();
  const range = Number.isFinite(min) && Number.isFinite(max)
    ? (min === max ? `${min}` : `${min}–${max}`)
    : "";
  const label = level ? notifyLevelLabel(level) : "";
  if (range && label) {
    return `${range} ${label}`;
  }
  return range || label;
}

export function formatAlertEntry(category: string, entry: AlertEntry): string {
  const name = categoryLabel(entry.rule.category || category);
  if (!entry.enabled) {
    return `${name}：未启用`;
  }
  const details: string[] = [];
  const bands = entry.rule.estimated_intensity_bands || [];
  if (bands.length) {
    details.push(bands.map((band) => formatBand(band)).filter(Boolean).join(" / "));
  }
  if (entry.rule.min_magnitude != null && String(entry.rule.min_magnitude) !== "") {
    details.push(`最低震级 ${entry.rule.min_magnitude}`);
  }
  if (entry.rule.min_severity != null && String(entry.rule.min_severity) !== "") {
    const severity = Number(entry.rule.min_severity);
    const severityLabel = Number.isFinite(severity) ? SEVERITY_LABELS[severity] : "";
    details.push(severityLabel ? `最低 ${severityLabel}` : `最低严重度 ${entry.rule.min_severity}`);
  }
  if (entry.rule.fallback_radius_km != null && String(entry.rule.fallback_radius_km) !== "") {
    details.push(`回退半径 ${entry.rule.fallback_radius_km} km`);
  }
  if (entry.rule.max_center_distance_km != null && String(entry.rule.max_center_distance_km) !== "") {
    details.push(`中心距离 ${entry.rule.max_center_distance_km} km`);
  }
  return details.length ? `${name}：${details.join(" · ")}` : `${name}：已启用`;
}

export function formatAlertSummaries(draft: SubscriptionDraft): string[] {
  return Object.entries(draft.alerts_by_category).map(([category, entry]) => formatAlertEntry(category, entry));
}
