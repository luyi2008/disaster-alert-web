import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeCachedBarkKey } from "../bark/session";
import { SubscribePage } from "./SubscribePage";

const KEY = "ynJ5Ft4atkMkWeo2PAvFhF";

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
    localStorage.clear();
  });

  it("redirects to the entry page without a validated bark key", () => {
    render(
      <MemoryRouter initialEntries={["/subscribe"]}>
        <Routes>
          <Route path="/" element={<div>entry</div>} />
          <Route path="/subscribe" element={<SubscribePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("entry")).toBeInTheDocument();
  });

  it("renders Bark identity in React and does not keep Bark controls in the shell", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/bark-urls")) {
          return jsonResponse({ bark_urls: ["https://bark.example", "https://bark.other"] });
        }
        if (url.includes("/api/subscription-options")) {
          return jsonResponse({ categories: [] });
        }
        if (url.includes("/api/status")) {
          return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
        }
        return jsonResponse({});
      }),
    );

    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: "/subscribe", state: { barkKey: KEY } }]}>
        <Routes>
          <Route path="/" element={<div>entry</div>} />
          <Route path="/subscribe" element={<SubscribePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("通知 APP：Bark")).toBeInTheDocument();
    expect(screen.getByText(`Bark ID：${KEY}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "测试" })).toHaveAttribute("href", "/subscribe/test");
    expect(screen.getByRole("link", { name: "更换设备" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "重新加载配置" })).toBeInTheDocument();
    expect(container.querySelector("#bark-id")).toBeNull();
    expect(container.querySelector("#bark-url")).toBeNull();
    expect(container.querySelector("#retry-config")).toBeNull();
    expect(container.querySelector("input#bark-id")).toBeNull();
    expect(await screen.findByRole("heading", { name: "发个通知" })).toBeInTheDocument();
  });

  it("reloads subscription options from the React identity action", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/bark-urls")) {
        return jsonResponse({ bark_urls: ["https://bark.example"] });
      }
      if (url.includes("/api/subscription-options")) {
        return jsonResponse({ categories: [] });
      }
      if (url.includes("/api/status")) {
        return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={[{ pathname: "/subscribe", state: { barkKey: KEY } }]}>
        <Routes>
          <Route path="/" element={<div>entry</div>} />
          <Route path="/subscribe" element={<SubscribePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "发个通知" });
    const callsFor = (path: string) => fetchMock.mock.calls.filter(([input]) => String(input).includes(path));
    await vi.waitFor(() => expect(callsFor("/api/bark-urls").length).toBeGreaterThan(0));
    const barkCallsBefore = callsFor("/api/bark-urls").length;
    const optionCallsBefore = callsFor("/api/subscription-options").length;

    fireEvent.click(screen.getByRole("button", { name: "重新加载配置" }));
    await vi.waitFor(() => {
      expect(callsFor("/api/bark-urls")).toHaveLength(barkCallsBefore + 1);
      expect(callsFor("/api/subscription-options")).toHaveLength(optionCallsBefore + 1);
    });
  });

  it("renders from a cached Bark Key when location state is missing", async () => {
    writeCachedBarkKey(KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/bark-urls")) {
          return jsonResponse({ bark_urls: ["https://bark.example"] });
        }
        if (url.includes("/api/subscription-options")) {
          return jsonResponse({ categories: [] });
        }
        if (url.includes("/api/status")) {
          return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
        }
        return jsonResponse({});
      }),
    );

    render(
      <MemoryRouter initialEntries={["/subscribe"]}>
        <Routes>
          <Route path="/" element={<div>entry</div>} />
          <Route path="/subscribe" element={<SubscribePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(`Bark ID：${KEY}`)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "发个通知" })).toBeInTheDocument();
  });
});
