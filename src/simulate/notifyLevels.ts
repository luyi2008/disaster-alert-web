export type NotifyLevelOption = {
  id: string;
  min: number;
  max: number;
};

export const FALLBACK_NOTIFY_LEVELS: NotifyLevelOption[] = [
  { id: "passive", min: 1, max: 1 },
  { id: "active", min: 2, max: 2 },
  { id: "critical", min: 3, max: 7 },
];

export function notifyLevelLabel(id: string): string {
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

export function formatIntensityRange(min: number, max: number): string {
  return min === max ? `烈度 ${min}` : `烈度 ${min}–${max}`;
}

export function notifyLevelsFromOptions(data: unknown): NotifyLevelOption[] {
  if (!data || typeof data !== "object") {
    return FALLBACK_NOTIFY_LEVELS;
  }
  const categories = (data as { categories?: unknown }).categories;
  if (!Array.isArray(categories)) {
    return FALLBACK_NOTIFY_LEVELS;
  }
  const warning = categories.find((item) => (
    Boolean(item && typeof item === "object" && (item as { id?: unknown }).id === "earthquake_warning")
  ));
  const bands = warning && typeof warning === "object"
    ? (warning as { default_alert?: { estimated_intensity_bands?: unknown } }).default_alert?.estimated_intensity_bands
    : undefined;
  if (!Array.isArray(bands) || bands.length === 0) {
    return FALLBACK_NOTIFY_LEVELS;
  }

  const seen = new Set<string>();
  const levels: NotifyLevelOption[] = [];
  for (const band of bands) {
    if (!band || typeof band !== "object") {
      continue;
    }
    const record = band as { interruption_level?: unknown; level?: unknown; min?: unknown; max?: unknown };
    const id = String(record.interruption_level ?? record.level ?? "").trim().toLowerCase();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const min = Number(record.min);
    const max = Number(record.max);
    levels.push({
      id,
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : (Number.isFinite(min) ? min : 0),
    });
  }
  return levels.length ? levels : FALLBACK_NOTIFY_LEVELS;
}
