import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import type { IncidentListItem } from "../api";
import { EventsPage } from "./EventsPage";

afterEach(() => {
  toast.dismiss();
  vi.unstubAllGlobals();
});

function session() {
  return new Response(JSON.stringify({ user: { id: "u1", name: "微信用户" } }), { status: 200 });
}

function envelope(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: status < 400, message: "ok", data }), { status });
}

function makeItem(overrides: Partial<IncidentListItem> & { incident_id: string; updated_at_ms: number }): IncidentListItem {
  return {
    category: "earthquake_report",
    first_seen_at_ms: overrides.updated_at_ms,
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
        title: "地震信息 Türkiye",
        description: "M5.3 Türkiye",
        affected_regions: [],
        latitude: 37.4547,
        longitude: 38.8236,
        magnitude: 5.3,
        depth_km: 10,
        radius_km: null,
        level: 2,
        occurred_at: "2026-09-24 15:40:58",
        final_report: false,
        cancel: false,
        training: false,
      },
    ],
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/events"]}>
      <Toaster />
      <Routes>
        <Route path="/events" element={<EventsPage />} />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("EventsPage", () => {
  it("renders the first page of events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/auth/get-session")) return session();
        if (String(input).includes("/api/subscription/events")) {
          return envelope({ events: [makeItem({ incident_id: "a", updated_at_ms: 1000 })], has_more: false });
        }
        return envelope({});
      }),
    );
    renderPage();
    expect(await screen.findByText("地震信息 Türkiye")).toBeInTheDocument();
    expect(screen.getByText("速报")).toBeInTheDocument();
    expect(screen.getByText("没有更多了")).toBeInTheDocument();
  });

  it("shows the empty state when there are no events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/auth/get-session")) return session();
        if (String(input).includes("/api/subscription/events")) {
          return envelope({ events: [], has_more: false });
        }
        return envelope({});
      }),
    );
    renderPage();
    expect(await screen.findByText("没有符合条件的地震信息")).toBeInTheDocument();
  });

  it("re-fetches with matched_only when the filter chip is clicked", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/get-session")) return session();
      if (String(input).includes("/api/subscription/events")) {
        return envelope({ events: [makeItem({ incident_id: "a", updated_at_ms: 1000 })], has_more: false });
      }
      return envelope({});
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await screen.findByText("地震信息 Türkiye");
    fireEvent.click(screen.getByRole("button", { name: "已匹配订阅" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).includes("matched_only=true")),
      ).toBe(true),
    );
  });

  it("loads the next page when the sentinel intersects and stops at the end", async () => {
    let ioCallback: IntersectionObserverCallback | null = null;
    class IOStub {
      constructor(cb: IntersectionObserverCallback) {
        ioCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal("IntersectionObserver", IOStub);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/get-session")) return session();
      if (String(input).includes("/api/subscription/events")) {
        if (String(input).includes("before_ms")) {
          return envelope({ events: [makeItem({ incident_id: "b", updated_at_ms: 500 })], has_more: false });
        }
        return envelope({ events: [makeItem({ incident_id: "a", updated_at_ms: 1000 })], has_more: true });
      }
      return envelope({});
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await screen.findByText("地震信息 Türkiye");
    expect(screen.queryByText("没有更多了")).toBeNull();

    await act(async () => {
      ioCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes("before_ms=1000"))).toBe(true),
    );
    await screen.findByText("没有更多了");
  });

  it("toasts a service outage instead of leaving an inline alert", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/auth/get-session")) return session();
        if (String(input).includes("/api/subscription/events")) {
          return new Response("<html>bad gateway</html>", { status: 502 });
        }
        return envelope({});
      }),
    );
    renderPage();
    const message = "服务暂时不可用，请稍后重试";
    const toastEl = await screen.findByText(message);
    const toastNode = toastEl.closest("[data-sonner-toast]");
    expect(toastNode).toHaveAttribute("data-type", "error");
    expect(toastNode).toHaveAttribute("data-rich-colors", "true");
    expect(document.querySelector("[data-slot=alert]")).toBeNull();
    expect(await screen.findByText("没有符合条件的地震信息")).toBeInTheDocument();
  });

  it("toasts when the events request cannot be completed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/auth/get-session")) return session();
        if (String(input).includes("/api/subscription/events")) {
          throw new Error("network");
        }
        return envelope({});
      }),
    );
    renderPage();
    const message = "无法加载地震信息，请稍后重试";
    const toastEl = await screen.findByText(message);
    const toastNode = toastEl.closest("[data-sonner-toast]");
    expect(toastNode).toHaveAttribute("data-type", "error");
    expect(toastNode).toHaveAttribute("data-rich-colors", "true");
    expect(document.querySelector("[data-slot=alert]")).toBeNull();
  });

  it("redirects to /login on a 401 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/auth/get-session")) return session();
        if (String(input).includes("/api/subscription/events")) {
          return envelope({ message: "未登录" }, 401);
        }
        return envelope({});
      }),
    );
    renderPage();
    expect(await screen.findByText("login page")).toBeInTheDocument();
  });
});
