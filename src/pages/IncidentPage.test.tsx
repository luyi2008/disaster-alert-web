import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IncidentPage } from "./IncidentPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

function eventFixture(title: string) {
  return {
    category: "earthquake_warning",
    source: "source",
    event_id: "event",
    revision: "1",
    report_num: 1,
    title,
    description: "A & B",
    affected_regions: ["<东京>"],
    latitude: 35,
    longitude: 139,
    magnitude: 5,
    depth_km: 10,
    radius_km: 120,
    level: 3,
    occurred_at: "2026-07-12 12:00:00",
    final_report: false,
    cancel: false,
    training: false,
  };
}

describe("IncidentPage", () => {
  it("renders signed snapshot text without injecting HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        json: async () => ({
          success: true,
          message: "灾害详情获取成功",
          data: {
            snapshot: {
              incident_id: "aaaaaaaaaaaaaaaaaaaaaa",
              issued_at_ms: 0,
              event: eventFixture("<script>alert(1)</script>"),
              target: {
                label: "<住所>",
                latitude: 35.6,
                longitude: 139.6,
                province: "东京都",
                city: "东京",
                district: "",
              },
              timing: null,
              interruption_level: "critical",
              matched_rule: {
                category: "earthquake_warning",
                sources: { mode: "all" },
                estimated_intensity_bands: [{ min: 3, max: 7, interruption_level: "critical" }],
              },
            },
            incident: null,
          },
        }),
      })),
    );

    const { container } = render(
      <MemoryRouter initialEntries={["/incidents/aaaaaaaaaaaaaaaaaaaaaa/notifications/token"]}>
        <Routes>
          <Route
            path="/incidents/:incidentId/notifications/:token"
            element={<IncidentPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("<script>alert(1)</script>");
    });
    expect(container.innerHTML).not.toContain("<script>alert(1)</script>");
    expect(screen.getAllByText("<住所>").length).toBeGreaterThan(0);
    expect(screen.getByText("可能受影响区域")).toBeInTheDocument();
    expect(screen.getByText("3-7: 紧急")).toBeInTheDocument();
  });
});
