import type { AlertEntry, AlertRuleDraft, CategoryOption } from "./types";

export type SanitizeAlertRule = (
  category: CategoryOption,
  candidate: AlertRuleDraft | undefined,
) => AlertRuleDraft;

export function mergeAlertsByCategory(
  categories: CategoryOption[],
  savedEntries: Record<string, AlertEntry>,
  missingEnabled: boolean,
  sanitize: SanitizeAlertRule,
): Record<string, AlertEntry> {
  return Object.fromEntries(categories.map((category) => {
    const savedEntry = savedEntries[category.id];
    const enabled = savedEntry ? savedEntry.enabled === true : missingEnabled;
    const candidate = savedEntry?.rule || category.default_alert;
    return [category.id, { enabled, rule: sanitize(category, candidate) }];
  }));
}
