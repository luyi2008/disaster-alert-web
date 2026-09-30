import { describe, expect, it } from "vitest";
import { mergeAlertsByCategory } from "./mergeAlerts";
import type { AlertEntry, AlertRuleDraft, CategoryOption } from "./types";

function option(
  id: string,
  defaultAlert: AlertRuleDraft,
): CategoryOption {
  return {
    id,
    label: id,
    source_groups: [],
    default_alert: defaultAlert,
  };
}

const categories: CategoryOption[] = [
  option("earthquake_warning", { category: "earthquake_warning", sources: { mode: "all" } }),
  option("earthquake_report", { category: "earthquake_report", sources: { mode: "all" }, min_magnitude: 3 }),
];

function passthrough(category: CategoryOption, candidate: AlertRuleDraft | undefined): AlertRuleDraft {
  return candidate ?? category.default_alert;
}

function warningSaved(): Record<string, AlertEntry> {
  return {
    earthquake_warning: {
      enabled: true,
      rule: {
        category: "earthquake_warning",
        sources: { mode: "all" },
        estimated_intensity_bands: [{ min: 3, max: 7, interruption_level: "critical" }],
      },
    },
  };
}

describe("mergeAlertsByCategory", () => {
  it("enables every category when hydrating a saved subscription", () => {
    const merged = mergeAlertsByCategory(categories, warningSaved(), passthrough);
    expect(merged.earthquake_warning.enabled).toBe(true);
    expect(merged.earthquake_warning.rule.estimated_intensity_bands).toEqual([
      { min: 3, max: 7, interruption_level: "critical" },
    ]);
    expect(merged.earthquake_report.enabled).toBe(true);
    expect(merged.earthquake_report.rule).toEqual(categories[1].default_alert);
  });

  it("uses option defaults with every category enabled when there is no saved subscription", () => {
    const merged = mergeAlertsByCategory(categories, {}, passthrough);
    expect(Object.values(merged).every((entry) => entry.enabled)).toBe(true);
    expect(merged.earthquake_report.rule.min_magnitude).toBe(3);
  });

  it("ignores a saved enabled=false flag and keeps the category enabled", () => {
    const merged = mergeAlertsByCategory(categories, {
      earthquake_report: { enabled: false, rule: { category: "earthquake_report", min_magnitude: 4.5 } },
    }, passthrough);
    expect(merged.earthquake_report.enabled).toBe(true);
    expect(merged.earthquake_report.rule.min_magnitude).toBe(4.5);
  });
});
