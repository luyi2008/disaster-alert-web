import type { AlertEntry, AlertRuleDraft, CategoryOption } from "./types";

export type SanitizeAlertRule = (
  category: CategoryOption,
  candidate: AlertRuleDraft | undefined,
) => AlertRuleDraft;

export function mergeAlertsByCategory(
  categories: CategoryOption[],
  savedEntries: Record<string, AlertEntry>,
  sanitize: SanitizeAlertRule,
): Record<string, AlertEntry> {
  return Object.fromEntries(categories.map((category) => {
    const savedEntry = savedEntries[category.id];
    const candidate = savedEntry?.rule || category.default_alert;
    return [category.id, { enabled: true, rule: sanitize(category, candidate) }];
  }));
}
