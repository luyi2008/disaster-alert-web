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
  option("weather_warning", { category: "weather_warning", sources: { mode: "all" }, min_severity: 2 }),
  option("tsunami", { category: "tsunami", sources: { mode: "all" }, min_severity: 1 }),
  option("typhoon", { category: "typhoon", sources: { mode: "all" }, max_center_distance_km: 500 }),
];

function passthrough(category: CategoryOption, candidate: AlertRuleDraft | undefined): AlertRuleDraft {
  return candidate ?? category.default_alert;
}

function typhoonSaved(): Record<string, AlertEntry> {
  return {
    typhoon: {
      enabled: true,
      rule: {
        category: "typhoon",
        sources: { mode: "all" },
        max_center_distance_km: 300,
      },
    },
  };
}

describe("mergeAlertsByCategory", () => {
  it("keeps only payload categories enabled when hydrating a saved subscription", () => {
    const merged = mergeAlertsByCategory(categories, typhoonSaved(), false, passthrough);
    expect(merged.typhoon.enabled).toBe(true);
    expect(merged.typhoon.rule.max_center_distance_km).toBe(300);
    expect(merged.earthquake_warning.enabled).toBe(false);
    expect(merged.earthquake_report.enabled).toBe(false);
    expect(merged.weather_warning.enabled).toBe(false);
    expect(merged.tsunami.enabled).toBe(false);
    expect(merged.earthquake_report.rule).toEqual(categories[1].default_alert);
    expect(merged.weather_warning.rule).toEqual(categories[2].default_alert);
  });

  it("uses option defaults with every category enabled when there is no saved subscription", () => {
    const merged = mergeAlertsByCategory(categories, {}, true, passthrough);
    expect(Object.values(merged).every((entry) => entry.enabled)).toBe(true);
    expect(merged.typhoon.rule.max_center_distance_km).toBe(500);
    expect(merged.earthquake_report.rule.min_magnitude).toBe(3);
  });

  it("treats a saved category that is explicitly off as disabled", () => {
    const merged = mergeAlertsByCategory(categories, {
      typhoon: { enabled: false, rule: { category: "typhoon", max_center_distance_km: 120 } },
    }, false, passthrough);
    expect(merged.typhoon.enabled).toBe(false);
    expect(merged.typhoon.rule.max_center_distance_km).toBe(120);
  });
});
