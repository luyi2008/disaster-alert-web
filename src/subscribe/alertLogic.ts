import type { AlertEntry, AlertRuleDraft, CategoryOption, IntensityBand, NotifyLevel, SubscriptionDraft } from "./types";

export const notifyLevelOrder: NotifyLevel[] = ["passive", "active", "critical"];

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function sourceIds(category: CategoryOption): string[] {
  return (category.source_groups || []).flatMap((group) => group.sources.map((source) => source.id));
}

export function sourceIdsFor(categories: CategoryOption[], categoryId: string): string[] {
  const option = categories.find((item) => item.id === categoryId);
  return option ? sourceIds(option) : [];
}

export function alertEntry(draft: SubscriptionDraft, category: string): AlertEntry | null {
  return draft.alerts_by_category[category] || null;
}

export function enabledAlertRules(draft: SubscriptionDraft): AlertRuleDraft[] {
  return Object.values(draft.alerts_by_category)
    .filter((entry) => entry.enabled)
    .map((entry) => entry.rule);
}

export function alertRuleForPayload(rule: AlertRuleDraft): AlertRuleDraft {
  const result = cloneJson(rule);
  if (result.category === "earthquake_report") result.min_magnitude = Number(result.min_magnitude);
  if (result.category === "weather_warning") {
    result.min_severity = Number(result.min_severity);
    result.fallback_radius_km = Number(result.fallback_radius_km);
  }
  if (result.category === "tsunami") result.min_severity = Number(result.min_severity);
  if (result.category === "typhoon") result.max_center_distance_km = Number(result.max_center_distance_km);
  return result;
}

export function sourceEnabled(draft: SubscriptionDraft, category: string, source: string): boolean {
  const selection = alertEntry(draft, category)?.rule.sources;
  return selection?.mode === "all"
    || Boolean(selection?.mode === "include" && Array.isArray(selection.ids) && selection.ids.includes(source));
}

export function setSelectedSources(
  draft: SubscriptionDraft,
  categories: CategoryOption[],
  category: string,
  ids: string[],
): void {
  const allIds = sourceIdsFor(categories, category);
  const selected = allIds.filter((id) => ids.includes(id));
  const rule = alertEntry(draft, category)?.rule;
  if (!rule) return;
  rule.sources = selected.length === allIds.length
    ? { mode: "all" }
    : { mode: "include", ids: selected };
}

export function defaultNotifyBands(): Array<{ min: number; max: number; level: NotifyLevel; label: string }> {
  return [
    { min: 1, max: 1, level: "passive", label: "低烈度" },
    { min: 2, max: 2, level: "active", label: "中等烈度" },
    { min: 3, max: 7, level: "critical", label: "高烈度" },
  ];
}

export function levelLabel(level: string): string {
  return level === "critical" ? "Critical" : level === "active" ? "Active" : "Passive";
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number.parseInt(String(value), 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function normalizeBands(bands: IntensityBand[] | undefined): Array<{ min: number; max: number; level: NotifyLevel; label: string }> {
  const result: Array<{ min: number; max: number; level: NotifyLevel; label: string }> = [];
  const usedLevels = new Set<string>();
  for (const band of bands || []) {
    const levelValue = band.interruption_level ?? band.level;
    const level = notifyLevelOrder.includes(String(levelValue || "").toLowerCase() as NotifyLevel)
      ? String(levelValue).toLowerCase() as NotifyLevel
      : "passive";
    if (usedLevels.has(level)) continue;
    usedLevels.add(level);
    const min = clampInt(band.min, 0, 7, 0);
    const max = clampInt(band.max, 0, 7, level === "critical" ? 7 : min);
    result.push({ min, max, level, label: String(band.label || levelLabel(level)).trim() });
    if (result.length >= 3) break;
  }
  return result.length ? result.sort((a, b) => a.min - b.min) : defaultNotifyBands();
}

export function sanitizeAlertRule(category: CategoryOption, candidate: AlertRuleDraft | undefined): AlertRuleDraft {
  const fallback = cloneJson(category.default_alert);
  if (!candidate || typeof candidate !== "object" || candidate.category !== category.id) return fallback;
  const knownSources = new Set(sourceIds(category));
  const selection = candidate.sources;
  if (selection?.mode === "all") {
    fallback.sources = { mode: "all" };
  } else if (selection?.mode === "include" && Array.isArray(selection.ids)) {
    fallback.sources = {
      mode: "include",
      ids: [...new Set(selection.ids.filter((id) => typeof id === "string" && knownSources.has(id)))],
    };
  }
  const numberInRange = (value: unknown, defaultValue: number | string | undefined, min: number, max: number, integer = false) => {
    if ((typeof value !== "number" && typeof value !== "string")
      || (typeof value === "string" && !value.trim())) return defaultValue;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number))
      ? number
      : defaultValue;
  };
  if (category.id === "earthquake_warning") {
    fallback.estimated_intensity_bands = normalizeBands(candidate.estimated_intensity_bands)
      .map((band) => ({ min: band.min, max: band.max, interruption_level: band.level }));
  } else if (category.id === "earthquake_report") {
    fallback.min_magnitude = numberInRange(candidate.min_magnitude, fallback.min_magnitude, 0, 10);
  } else if (category.id === "weather_warning") {
    fallback.min_severity = numberInRange(candidate.min_severity, fallback.min_severity, 1, 4, true);
    fallback.fallback_radius_km = numberInRange(candidate.fallback_radius_km, fallback.fallback_radius_km, 1, 2000);
  } else if (category.id === "tsunami") {
    fallback.min_severity = numberInRange(candidate.min_severity, fallback.min_severity, 1, 4, true);
  } else if (category.id === "typhoon") {
    fallback.max_center_distance_km = numberInRange(candidate.max_center_distance_km, fallback.max_center_distance_km, 1, 3000);
  }
  return fallback;
}

export function severityLabel(value: unknown): string {
  return ({ 1: "蓝色/信息", 2: "黄色", 3: "橙色", 4: "红色" } as Record<number, string>)[Number(value)] || `级别 ${value}`;
}

export function categoryRuleSummary(draft: SubscriptionDraft, category: string): string {
  const alert = alertEntry(draft, category)?.rule;
  if (!alert || !alertEntry(draft, category)?.enabled) return "";
  if (category === "earthquake_warning") return `${(alert.estimated_intensity_bands || []).length} 段烈度规则`;
  if (category === "earthquake_report") return `M ≥ ${Number(alert.min_magnitude).toFixed(1)}`;
  if (category === "weather_warning") return `≥ ${severityLabel(alert.min_severity)} · 回退 ${Number(alert.fallback_radius_km)} km`;
  if (category === "tsunami") return `≥ ${severityLabel(alert.min_severity)}`;
  if (category === "typhoon") return `中心 ${Number(alert.max_center_distance_km)} km 内`;
  return "";
}

export function validateBands(bands: Array<{ min: number; max: number; level: string; label: string }>): string {
  if (!bands.length) return "请至少保留一条通知级别规则";
  const levels = new Set<string>();
  const used = new Set<number>();
  for (const band of bands) {
    if (!notifyLevelOrder.includes(band.level as NotifyLevel)) return "通知级别无效";
    if (levels.has(band.level)) return "每个通知级别只能添加一条规则";
    levels.add(band.level);
    if (!Number.isInteger(band.min) || !Number.isInteger(band.max) || band.min > band.max || band.min < 0 || band.max > 7) return "烈度范围无效";
    if (band.level === "critical" && band.max !== 7) return "Critical 规则上限必须覆盖烈度 7";
    if (String(band.label || "").trim().length > 32) return "通知级别标签最多 32 个字符";
    for (let value = band.min; value <= band.max; value++) {
      if (used.has(value)) return "烈度范围不能重叠";
      used.add(value);
    }
  }
  return "";
}

export function collectBands(draft: SubscriptionDraft): Array<{ min: number; max: number; level: string; label: string }> {
  return (alertEntry(draft, "earthquake_warning")?.rule.estimated_intensity_bands || []).map((band) => {
    const level = String(band.interruption_level ?? band.level ?? "").toLowerCase();
    const minRaw = String(band.min ?? "").trim();
    const maxRaw = String(band.max ?? "").trim();
    const min = minRaw ? Number(minRaw) : Number.NaN;
    const max = maxRaw ? Number(maxRaw) : Number.NaN;
    return { min, max, level, label: levelLabel(level) };
  });
}

export function commitBands(draft: SubscriptionDraft): string {
  const bands = collectBands(draft);
  const error = validateBands(bands);
  if (error) return error;
  const rule = alertEntry(draft, "earthquake_warning")?.rule;
  if (rule) {
    rule.estimated_intensity_bands = bands.sort((left, right) => left.min - right.min).map((band) => ({
      min: band.min, max: band.max, interruption_level: band.level,
    }));
  }
  return "";
}

export function validateAlertRules(draft: SubscriptionDraft, categories: CategoryOption[]): string {
  const alerts = enabledAlertRules(draft);
  if (!alerts.length) return "请至少启用一种灾害类别";
  const numeric = (value: unknown) => String(value ?? "").trim() ? Number(value) : Number.NaN;
  const magnitude = numeric(alertEntry(draft, "earthquake_report")?.rule.min_magnitude);
  const weatherRadius = numeric(alertEntry(draft, "weather_warning")?.rule.fallback_radius_km);
  const typhoonRadius = numeric(alertEntry(draft, "typhoon")?.rule.max_center_distance_km);
  const weatherLevel = numeric(alertEntry(draft, "weather_warning")?.rule.min_severity);
  const tsunamiLevel = numeric(alertEntry(draft, "tsunami")?.rule.min_severity);
  if (alertEntry(draft, "earthquake_report")?.enabled && (!Number.isFinite(magnitude) || magnitude < 0 || magnitude > 10)) return "最低震级必须在 0 到 10 之间";
  if (alertEntry(draft, "weather_warning")?.enabled && (!Number.isFinite(weatherRadius) || weatherRadius < 1 || weatherRadius > 2000)) return "气象预警回退半径必须在 1 到 2000 公里之间";
  if (alertEntry(draft, "typhoon")?.enabled && (!Number.isFinite(typhoonRadius) || typhoonRadius < 1 || typhoonRadius > 3000)) return "台风中心最大距离必须在 1 到 3000 公里之间";
  if (alertEntry(draft, "weather_warning")?.enabled && ![1, 2, 3, 4].includes(weatherLevel)) return "气象预警最低级别必须在 1 到 4 之间";
  if (alertEntry(draft, "tsunami")?.enabled && ![1, 2, 3, 4].includes(tsunamiLevel)) return "海啸预警最低级别必须在 1 到 4 之间";
  for (const category of categories) {
    const entry = alertEntry(draft, category.id);
    if (entry?.enabled && entry.rule.sources?.mode === "include" && !entry.rule.sources.ids?.length) return `${category.label}请至少启用一个来源`;
  }
  return "";
}
