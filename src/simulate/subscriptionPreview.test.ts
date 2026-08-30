import { describe, expect, it } from "vitest";
import type { SubscriptionDraft } from "../subscribe/types";
import { alertRuleCards, formatBarkHost, formatTargetChip } from "./subscriptionPreview";

describe("subscriptionPreview cards", () => {
  it("builds compact rule cards from draft alerts", () => {
    const draft: SubscriptionDraft = {
      schema_version: 3,
      bark_url: "https://bark.example/path",
      targets: [{
        id: "home",
        label: "上海家中",
        point: { latitude: "31.2304", longitude: "121.4737" },
        region: { province: "上海市", city: "上海市", district: "浦东新区" },
      }],
      alerts_by_category: {
        earthquake_warning: {
          enabled: true,
          rule: {
            category: "earthquake_warning",
            estimated_intensity_bands: [{ min: 3, max: 7, interruption_level: "critical" }],
          },
        },
        earthquake_report: {
          enabled: true,
          rule: { category: "earthquake_report", min_magnitude: 1.0 },
        },
      },
    };

    expect(formatTargetChip(draft.targets[0])).toBe("上海家中 · 上海市 · 浦东新区");
    expect(formatBarkHost(draft.bark_url)).toBe("bark.example");
    expect(alertRuleCards(draft)).toEqual([
      {
        category: "earthquake_warning",
        title: "地震预警",
        tone: "warn",
        badge: { label: "紧急", tone: "warn" },
        metric: "3–7",
      },
      {
        category: "earthquake_report",
        title: "地震速报",
        tone: "quiet",
        badge: undefined,
        metric: "M ≥ 1.0",
      },
    ]);
  });
});
