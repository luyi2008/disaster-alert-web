import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { SubscribeWorkspace } from "./SubscribeWorkspace";

const { mapRemove } = vi.hoisted(() => ({ mapRemove: vi.fn() }));
const DEVICE_ID = "11111111-1111-1111-1111-111111111111";
const KEY = "ynJ5Ft4atkMkWeo2PAvFhF";
const FIRST_URL = "https://bark.first.example";

vi.mock("leaflet", () => {
  const map = {
    zoomControl: { setPosition: vi.fn() },
    setView: vi.fn().mockReturnThis(),
    on: vi.fn(),
    remove: mapRemove,
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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, message: "ok", data }), { status });
}

const simpleCategory = {
  id: "earthquake_report",
  label: "地震速报",
  source_groups: [{ id: "all", label: "全部", sources: [{ id: "wolfx", label: "Wolfx" }] }],
  default_alert: {
    category: "earthquake_report",
    sources: { mode: "all" },
    min_magnitude: 3,
  },
};

const typhoonCategory = {
  id: "typhoon",
  label: "台风信息",
  source_groups: [{ id: "all", label: "全部", sources: [{ id: "nmc", label: "中央气象台" }] }],
  default_alert: {
    category: "typhoon",
    sources: { mode: "all" },
    max_center_distance_km: 500,
  },
};

const weatherCategory = {
  id: "weather_warning",
  label: "气象预警",
  source_groups: [{ id: "all", label: "全部", sources: [{ id: "nmc", label: "中央气象台" }] }],
  default_alert: {
    category: "weather_warning",
    sources: { mode: "all" },
    min_severity: 2,
    fallback_radius_km: 50,
  },
};

const simpleAlert = {
  category: "earthquake_report",
  sources: { mode: "all" },
  min_magnitude: 3,
};

function savedRow(alerts: unknown[] = [simpleAlert]) {
  return {
    destination: { type: "bark", base_url: FIRST_URL, device_key: KEY },
    targets: [{
      label: "home",
      point: { latitude: 35, longitude: 139 },
      region: { province: "", city: "", district: "" },
    }],
    alerts,
  };
}

function stubSubscribeFetches() {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/devices/") && url.endsWith("/subscription")) {
      return jsonResponse({
        subscriptions: [savedRow()],
      });
    }
    if (url.includes("/api/subscription-options")) {
      return jsonResponse({ categories: [simpleCategory] });
    }
    if (url.includes("/api/status")) {
      return jsonResponse({
        instance_terms_accepted: true,
        total_subscriptions: 0,
      });
    }
    if (url.includes("/subscribe") && !url.includes("subscription-options")) {
      return jsonResponse({ saved: true });
    }
    return jsonResponse({});
  });
}

function renderWorkspace(options: {
  instanceTermsAccepted?: boolean;
  onUnauthorized?: () => void;
  onMissingDevice?: () => void;
} = {}) {
  return render(
    <MemoryRouter>
      <Toaster />
      <SubscribeWorkspace
        api=""
        instanceTermsAccepted={options.instanceTermsAccepted ?? true}
        deviceKey={KEY}
        onUnauthorized={options.onUnauthorized}
        onMissingDevice={options.onMissingDevice}
      />
    </MemoryRouter>,
  );
}

describe("SubscribeWorkspace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
    localStorage.clear();
    mapRemove.mockClear();
  });

  it("removes the map on unmount", async () => {
    vi.stubGlobal("fetch", stubSubscribeFetches());
    const { unmount } = renderWorkspace();
    expect(document.querySelector("#subscribe-form")).not.toBeNull();
    expect(document.querySelector("#bark-id")).toBeNull();
    unmount();
    expect(mapRemove).toHaveBeenCalled();
  });

  it("hydrates and submits the device subscription through the BFF", async () => {
    const fetchMock = stubSubscribeFetches();
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();
    const submit = await screen.findByRole("button", { name: "保存订阅" });
    await waitFor(() => expect(submit).toBeEnabled());
    expect(screen.getByRole("link", { name: "返回设备" })).toHaveAttribute("href", "/devices");
    fireEvent.submit(document.querySelector("#subscribe-form") as HTMLFormElement);
    await waitFor(() => {
      const subscribeCall = fetchMock.mock.calls.find(([input, init]) => (
        String(input).includes(`/api/devices/${KEY}/subscribe`) && (init as RequestInit | undefined)?.method === "POST"
      ));
      if (!subscribeCall) {
        throw new Error("missing subscribe request");
      }
      const body = JSON.parse(String((subscribeCall[1] as RequestInit).body));
      expect(body.destination).toBeUndefined();
      expect(body.targets[0].point).toEqual({ latitude: 35, longitude: 139 });
      expect(String(subscribeCall[0])).not.toContain(`/api/devices/${DEVICE_ID}/`);
      expect(subscribeCall[1]?.credentials).toBe("include");
    });
    const hydrateCall = fetchMock.mock.calls.find(([input]) => (
      String(input).includes(`/api/devices/${KEY}/subscription`)
    ));
    expect(hydrateCall).toBeDefined();
    expect(new Headers((hydrateCall?.[1] as RequestInit | undefined)?.headers).get("Authorization")).toBeNull();
  });

  it("disables adding locations until the server subscription is hydrated", async () => {
    let resolveSubscriptions!: (response: Response) => void;
    const subscriptionsResponse = new Promise<Response>((resolve) => {
      resolveSubscriptions = resolve;
    });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/devices/") && url.includes("/subscription")) return subscriptionsResponse;
      if (url.includes("/api/subscription-options")) {
        return Promise.resolve(jsonResponse({ categories: [simpleCategory] }));
      }
      if (url.includes("/api/status")) {
        return Promise.resolve(jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 }));
      }
      return Promise.resolve(jsonResponse({}));
    }));
    renderWorkspace();
    const startAddLocation = document.querySelector("#start-add-location") as HTMLButtonElement;
    expect(startAddLocation.disabled).toBe(true);
    resolveSubscriptions(jsonResponse({
      subscriptions: [{
        ...savedRow(),
        targets: [{
          label: "server home",
          point: { latitude: 35, longitude: 139 },
          region: { province: "", city: "", district: "" },
        }],
      }],
    }));
    await waitFor(() => expect(startAddLocation.disabled).toBe(false));
    expect(document.querySelector("#locations-list")?.textContent).toContain("server home");
    expect(document.querySelector("#locations-list")?.textContent).toContain("35.0000, 139.0000");
  });

  it("does not treat 200 success:false as a load error", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/devices/") && url.endsWith("/subscription")) {
        return new Response(JSON.stringify({ success: false, message: "没有订阅" }), { status: 200 });
      }
      if (url.includes("/api/subscription-options")) return jsonResponse({ categories: [simpleCategory] });
      if (url.includes("/api/status")) return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
      return jsonResponse({});
    }));
    renderWorkspace();
    const submit = await screen.findByRole("button", { name: "保存订阅" });
    await waitFor(() => expect(submit).toBeEnabled());
    expect(screen.queryByText("无法加载已保存的订阅")).not.toBeInTheDocument();
    const toggle = document.querySelector(".category-toggle[data-category='earthquake_report']");
    expect(toggle).toHaveAttribute("data-state", "checked");
  });

  it("enables only the categories present in the saved subscription alerts", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/devices/") && url.endsWith("/subscription")) {
        return jsonResponse({
          subscriptions: [savedRow([{
            category: "typhoon",
            sources: { mode: "all" },
            max_center_distance_km: 300,
          }])],
        });
      }
      if (url.includes("/api/subscription-options")) {
        return jsonResponse({ categories: [simpleCategory, weatherCategory, typhoonCategory] });
      }
      if (url.includes("/api/status")) return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
      return jsonResponse({});
    }));
    renderWorkspace();
    await waitFor(() => expect(screen.getByRole("button", { name: "保存订阅" })).toBeEnabled());
    const checked = (category: string) => (
      document.querySelector(`.category-toggle[data-category='${category}']`)?.getAttribute("data-state") === "checked"
    );
    expect(checked("typhoon")).toBe(true);
    expect(checked("earthquake_report")).toBe(false);
    expect(checked("weather_warning")).toBe(false);
    expect(screen.getByText(/中心 300 km 内/)).toBeInTheDocument();
  });

  it("calls onUnauthorized when the subscription GET returns 401", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/devices/") && url.endsWith("/subscription")) {
        return new Response(JSON.stringify({ success: false, message: "未登录" }), { status: 401 });
      }
      if (url.includes("/api/status")) return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
      return jsonResponse({});
    }));
    renderWorkspace({ onUnauthorized });
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
  });

  it("lists connected /api/status sources after the alert-type heading", async () => {
    function channel(connected: boolean) {
      return {
        connected,
        last_message_epoch_ms: connected ? 1_700_000_000_000 : null,
        reconnects: connected ? 1 : 0,
        messages: connected ? 12 : 0,
        parse_errors: 0,
        notifications_succeeded: 0,
        notifications_failed: 0,
      };
    }
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/subscription-options")) {
        return jsonResponse({
          categories: [{
            ...simpleCategory,
            source_groups: [{
              id: "all",
              label: "全部",
              sources: [
                { id: "wolfx", label: "Wolfx" },
                { id: "fanstudio", label: "FAN Studio" },
                { id: "huania", label: "Huania" },
              ],
            }],
          }],
        });
      }
      if (url.includes("/api/status")) {
        return jsonResponse({
          instance_terms_accepted: true,
          total_subscriptions: 3,
          wolfx: channel(true),
          fanstudio: channel(true),
          huania: channel(false),
        });
      }
      return jsonResponse({});
    }));
    renderWorkspace();
    const sources = await screen.findByText("Wolfx ｜ FAN Studio");
    expect(sources).toHaveAttribute("id", "alert-type-sources");
    expect(sources).not.toHaveAttribute("hidden");
    expect(sources.textContent).not.toContain("Huania");
    expect(document.querySelector("#status-shell")).toBeNull();
    expect(screen.getByRole("button", { name: "取消订阅" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存订阅" })).toBeInTheDocument();
  });

  it("shows a 502 from the BFF without treating it as a logout", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/devices/") && url.endsWith("/subscription")) {
        return jsonResponse({ subscriptions: [savedRow()] });
      }
      if (url.includes("/api/subscription-options")) {
        return jsonResponse({ categories: [simpleCategory] });
      }
      if (url.includes("/api/status")) {
        return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
      }
      if (url.includes("/subscribe") && init?.method === "POST") {
        return new Response(JSON.stringify({ success: false, message: "Bark 拒绝" }), { status: 502 });
      }
      return jsonResponse({});
    }));
    renderWorkspace({ onUnauthorized });
    const submit = await screen.findByRole("button", { name: "保存订阅" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.submit(document.querySelector("#subscribe-form") as HTMLFormElement);
    expect(await screen.findByText("Bark 拒绝")).toBeInTheDocument();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("asks for confirmation before deleting the server subscription", async () => {
    const fetchMock = stubSubscribeFetches();
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();
    await waitFor(() => expect(screen.getByRole("button", { name: "保存订阅" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "取消订阅" }));
    expect(await screen.findByText("确定删除该设备对应的服务端订阅？")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await waitFor(() => expect(screen.queryByText("确定删除该设备对应的服务端订阅？")).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "DELETE")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "取消订阅" }));
    fireEvent.click(await screen.findByRole("button", { name: "确认取消" }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input, init]) => (
        String(input).includes(`/api/devices/${KEY}/subscribe`) && init?.method === "DELETE"
      ))).toBe(true);
    });
  });

  it("asks for confirmation before resetting alert rules", async () => {
    vi.stubGlobal("fetch", stubSubscribeFetches());
    renderWorkspace();
    await waitFor(() => expect(screen.getByRole("button", { name: "保存订阅" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "重置规则" }));
    expect(await screen.findByText("恢复所有预警类型和规则为默认设置？监测地点和接收设备不会改变。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await waitFor(() => {
      expect(screen.queryByText("恢复所有预警类型和规则为默认设置？监测地点和接收设备不会改变。")).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "重置规则" }));
    fireEvent.click(await screen.findByRole("button", { name: "恢复默认" }));
    expect(await screen.findByText("预警规则已恢复默认设置")).toBeInTheDocument();
  });
});
