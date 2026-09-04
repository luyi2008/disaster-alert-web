import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlertRulesPanel } from "./AlertRulesPanel";
import type { CategoryOption, SubscriptionDraft } from "./types";

const categories: CategoryOption[] = [
  {
    id: "earthquake_warning",
    label: "地震预警",
    source_groups: [{ id: "all", label: "全部", sources: [{ id: "wolfx", label: "Wolfx" }] }],
    default_alert: { category: "earthquake_warning", sources: { mode: "all" }, estimated_intensity_bands: [{ min: 3, max: 7, interruption_level: "critical" }] },
  },
  {
    id: "tsunami",
    label: "海啸预警",
    source_groups: [{ id: "all", label: "全部", sources: [{ id: "nta", label: "海啸中心" }] }],
    default_alert: { category: "tsunami", sources: { mode: "all" }, min_severity: 2 },
  },
];

function draft(disabled: string[] = []): SubscriptionDraft {
  return {
    schema_version: 3,
    bark_url: "",
    targets: [],
    alerts_by_category: Object.fromEntries(categories.map((category) => [
      category.id,
      {
        enabled: !disabled.includes(category.id),
        rule: { ...category.default_alert },
      },
    ])),
  };
}

function renderPanel(disabled: string[] = []) {
  const setDraft = vi.fn();
  render(
    <AlertRulesPanel
      draft={draft(disabled)}
      setDraft={setDraft}
      categories={categories}
      configurationReady
      inFlight={false}
      onResetRequest={() => {}}
      connectedSources=""
    />,
  );
}

describe("AlertRulesPanel list design", () => {
  it("renders a circular icon for each category and selects the first row", () => {
    renderPanel();
    expect(document.querySelector("[data-category-icon='earthquake_warning']")).not.toBeNull();
    expect(document.querySelector("[data-category-icon='tsunami']")).not.toBeNull();
    expect(document.querySelector("[data-category-card='earthquake_warning']")).toHaveAttribute("data-state", "open");
    expect(document.querySelector("[data-category-icon='earthquake_warning']")).toHaveAttribute("data-active", "true");
  });

  it("keeps source and rule summary when a category switch is off", () => {
    renderPanel(["tsunami"]);
    expect(screen.queryByText("已关闭")).not.toBeInTheDocument();
    expect(screen.getByText("全部 1 个来源 · ≥ 黄色")).toBeInTheDocument();
  });

  it("hides the accordion chevron on category rows", () => {
    renderPanel();
    const trigger = document.querySelector("[data-expand-category='earthquake_warning']");
    expect(trigger?.querySelector("svg.lucide-chevron-down")).toBeNull();
  });

  it("expands a row when its header is clicked", () => {
    renderPanel();
    fireEvent.click(document.querySelector("[data-expand-category='tsunami']") as HTMLButtonElement);
    expect(document.querySelector("[data-category-card='tsunami']")).toHaveAttribute("data-state", "open");
    expect(document.querySelector("[data-category-icon='tsunami']")).toHaveAttribute("data-active", "true");
  });
});
