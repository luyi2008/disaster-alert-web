import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { IncidentListItem } from "../api";
import { EventCard } from "./EventCard";

function makeItem(overrides: Partial<IncidentListItem["latest"][number]> = {}): IncidentListItem {
  return {
    incident_id: "inc-1",
    category: "earthquake_report",
    first_seen_at_ms: 1_758_700_000_000,
    updated_at_ms: Date.now() - 3 * 60 * 60 * 1000,
    has_matched_subscribers: false,
    timeline: [],
    latest: [
      {
        category: "earthquake_report",
        channel: "Fan Studio 地震速报",
        source: "fanstudio.fssn",
        event_id: "EVT1",
        revision: "rev-1",
        report_num: 0,
        title: "四川宜宾市珙县",
        description: "M4.2",
        affected_regions: ["四川宜宾市珙县"],
        latitude: 28.2,
        longitude: 104.7,
        magnitude: 4.2,
        depth_km: 12.6,
        radius_km: null,
        level: 2,
        occurred_at: "2026-09-24 15:40:58",
        final_report: false,
        cancel: false,
        training: false,
        ...overrides,
      },
    ],
  };
}

describe("EventCard", () => {
  it("shows the origin time instead of a relative time", () => {
    render(<EventCard item={makeItem()} />);
    expect(screen.getByText("2026-09-24 15:40:58")).toBeInTheDocument();
    expect(screen.queryByText(/小时前|分钟前|天前|刚刚/)).toBeNull();
  });

  it("falls back to an absolute update time when origin time is blank", () => {
    const updatedAtMs = new Date(2026, 8, 27, 8, 5, 6).getTime();
    render(<EventCard item={{ ...makeItem({ occurred_at: "  " }), updated_at_ms: updatedAtMs }} />);
    expect(screen.getByText("2026-09-27 08:05:06")).toBeInTheDocument();
    expect(screen.queryByText(/小时前/)).toBeNull();
  });

  it("rounds focal depth to the nearest integer kilometer", () => {
    const { rerender } = render(<EventCard item={makeItem({ depth_km: 12.6 })} />);
    expect(screen.getByText("震源深度 13 km")).toBeInTheDocument();

    rerender(<EventCard item={makeItem({ depth_km: 12.4 })} />);
    expect(screen.getByText("震源深度 12 km")).toBeInTheDocument();

    rerender(<EventCard item={makeItem({ depth_km: 10 })} />);
    expect(screen.getByText("震源深度 10 km")).toBeInTheDocument();
  });

  it("omits focal depth when it is unknown", () => {
    render(<EventCard item={makeItem({ depth_km: null })} />);
    expect(screen.queryByText(/震源深度/)).toBeNull();
  });
});
