import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubscribePage } from "./SubscribePage";

const DEVICE_ID = "11111111-1111-1111-1111-111111111111";
const DEVICE_KEY = "ynJ5Ft4atkMkWeo2PAvFhF";
const DEVICE_TOKEN_MASKED = "toke****naaa";

vi.mock("leaflet", () => {
  const map = {
    zoomControl: { setPosition: vi.fn() },
    setView: vi.fn().mockReturnThis(),
    on: vi.fn(),
    remove: vi.fn(),
    removeLayer: vi.fn(),
    fitBounds: vi.fn(),
  };
  class Control {
    static extend(spec: { onAdd: () => HTMLElement }) {
      return class {
        addTo() {
          spec.onAdd();
          return this;
        }
      };
    }
  }
  return {
    default: {
      map: () => map,
      tileLayer: () => ({ addTo: vi.fn() }),
      Control,
      DomUtil: {
        create: (_tag: string, _cls: string, parent?: HTMLElement) => {
          const el = document.createElement("button");
          parent?.append(el);
          return el;
        },
      },
      DomEvent: {
        disableClickPropagation: vi.fn(),
        disableScrollPropagation: vi.fn(),
        on: vi.fn(),
      },
      divIcon: vi.fn(),
      marker: vi.fn(() => ({
        on: vi.fn(),
        addTo: vi.fn(),
        setLatLng: vi.fn(),
        setIcon: vi.fn(),
      })),
    },
  };
});

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, message: "ok", data }), { status: 200 });
}

describe("SubscribePage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("goes back to devices when the device is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/devices") || url === "/api/devices") {
        return jsonResponse({ devices: [] });
      }
      if (url.includes("/api/status")) {
        return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
      }
      return jsonResponse({});
    }));
    render(
      <MemoryRouter initialEntries={[`/devices/${DEVICE_KEY}/subscribe`]}>
        <Routes>
          <Route path="/devices" element={<div>devices</div>} />
          <Route path="/devices/:id/subscribe" element={<SubscribePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("devices")).toBeInTheDocument();
  });

  it("renders the account shell header and a back-to-devices action", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/get-session")) {
        return new Response(JSON.stringify({ user: { id: "u1", name: "微信用户" } }), { status: 200 });
      }
      if (url.includes("/api/devices") && !url.includes("subscribe") && !url.includes("subscription")) {
        return jsonResponse({
          devices: [{
            id: DEVICE_ID,
            name: "设备1",
            deviceKey: DEVICE_KEY,
            deviceTokenMasked: DEVICE_TOKEN_MASKED,
            createdAt: 1,
            updatedAt: 1,
          }],
        });
      }
      if (url.includes("/api/status")) {
        return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
      }
      if (url.includes("/devices/") && url.endsWith("/subscription")) {
        return new Response(JSON.stringify({ success: false, message: "没有订阅" }), { status: 200 });
      }
      if (url.includes("/api/subscription-options")) {
        return jsonResponse({ categories: [] });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <MemoryRouter initialEntries={[`/devices/${DEVICE_KEY}/subscribe`]}>
        <Routes>
          <Route path="/devices/:id/subscribe" element={<SubscribePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "配置订阅" })).toBeInTheDocument();
    expect(await screen.findByText(/设备1/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "灾害预警" })).toHaveAttribute("href", "/devices");
    expect(screen.getByRole("link", { name: "返回设备" })).toHaveAttribute("href", "/devices");
    expect(screen.getByRole("link", { name: "设备管理" })).toHaveAttribute("href", "/devices");
    expect(screen.queryByRole("navigation", { name: "主导航" })).toBeNull();
    const account = screen.getByRole("button", { name: /微信用户|账号/ });
    fireEvent.click(account);
    expect(await screen.findByRole("link", { name: "账号设置" })).toHaveAttribute("href", "/settings");
    expect(container.querySelector("#bark-id")).toBeNull();
    expect(screen.queryByRole("heading", { name: "灾害预警" })).toBeNull();
    await vi.waitFor(() => {
      const hydrateCall = fetchMock.mock.calls.find(([input]) => String(input).includes("/subscription"));
      expect(String(hydrateCall?.[0])).toContain(`/api/devices/${DEVICE_KEY}/subscription`);
      expect(String(hydrateCall?.[0])).not.toContain(`/api/devices/${DEVICE_ID}/`);
    });
  });
});
