import { afterEach, describe, expect, it, vi } from "vitest";
import bodyHtml from "./body.html?raw";
import footerHtml from "./footer.html?raw";
import headerHtml from "./header.html?raw";
import { mountSubscribeApp } from "./subscribeApp";

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

function fillHost(host: HTMLElement): void {
  host.innerHTML = `${headerHtml}<section class="panel">${bodyHtml}</section>${footerHtml}`;
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

describe("mountSubscribeApp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
    localStorage.clear();
    mapRemove.mockClear();
  });

  it("scopes queries to the host and removes the map on teardown", async () => {
    vi.stubGlobal("fetch", stubSubscribeFetches());

    const decoy = document.createElement("form");
    decoy.id = "subscribe-form";
    document.body.append(decoy);

    const host = document.createElement("div");
    fillHost(host);
    document.body.append(host);

    const app = mountSubscribeApp(host, { api: "", instanceTermsAccepted: true, deviceId: DEVICE_ID, deviceKey: KEY });
    const form = host.querySelector("#subscribe-form");
    expect(form).not.toBe(decoy);
    expect((form as HTMLFormElement | null)?.id).toBe("subscribe-form");
    expect(host.querySelector("#bark-id")).toBeNull();
    expect(host.querySelector("#bark-url")).toBeNull();
    expect(host.querySelector("#retry-config")).toBeNull();

    app.teardown();
    expect(mapRemove).toHaveBeenCalled();
    document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });

  it("hydrates and submits the device subscription through the BFF", async () => {
    const fetchMock = stubSubscribeFetches();
    vi.stubGlobal("fetch", fetchMock);

    const host = document.createElement("div");
    fillHost(host);
    document.body.append(host);

    const app = mountSubscribeApp(host, {
      api: "",
      instanceTermsAccepted: true,
      deviceId: DEVICE_ID,
      deviceKey: KEY,
    });

    const submit = host.querySelector("#submit") as HTMLButtonElement;
    await vi.waitFor(() => expect(submit.disabled).toBe(false));
    (host.querySelector("#subscribe-form") as HTMLFormElement).requestSubmit();

    await vi.waitFor(() => {
      const subscribeCall = fetchMock.mock.calls.find(([input, init]) => (
        String(input).includes(`/api/devices/${DEVICE_ID}/subscribe`) && (init as RequestInit | undefined)?.method === "POST"
      ));
      if (!subscribeCall) {
        throw new Error("missing subscribe request");
      }
      const body = JSON.parse(String((subscribeCall[1] as RequestInit).body));
      expect(body.destination).toBeUndefined();
      expect(body.targets[0].point).toEqual({ latitude: 35, longitude: 139 });
      expect(subscribeCall[1]?.credentials).toBe("include");
    });

    const hydrateCall = fetchMock.mock.calls.find(([input]) => (
      String(input).includes(`/api/devices/${KEY}/subscription`)
    ));
    expect(hydrateCall).toBeDefined();
    expect(new Headers((hydrateCall?.[1] as RequestInit | undefined)?.headers).get("Authorization")).toBeNull();

    app.teardown();
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

    const host = document.createElement("div");
    fillHost(host);
    document.body.append(host);
    const app = mountSubscribeApp(host, { api: "", instanceTermsAccepted: true, deviceId: DEVICE_ID, deviceKey: KEY });
    const startAddLocation = host.querySelector("#start-add-location") as HTMLButtonElement;

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

    await vi.waitFor(() => expect(startAddLocation.disabled).toBe(false));
    expect(host.querySelector("#locations-list")?.textContent).toContain("server home");
    expect(host.querySelector("#locations-list")?.textContent).toContain("35.0000, 139.0000");
    app.teardown();
  });

  it("does not treat 200 success:false as a load error", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/devices/") && url.endsWith("/subscription")) {
        return new Response(JSON.stringify({ success: false, message: "没有订阅" }), { status: 200 });
      }
      if (url.includes("/api/bark-urls")) return jsonResponse({ bark_urls: [FIRST_URL] });
      if (url.includes("/api/subscription-options")) return jsonResponse({ categories: [simpleCategory] });
      if (url.includes("/api/status")) return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
      return jsonResponse({});
    }));
    const host = document.createElement("div");
    fillHost(host);
    document.body.append(host);
    const app = mountSubscribeApp(host, { api: "", instanceTermsAccepted: true, deviceId: DEVICE_ID, deviceKey: KEY });
    const submit = host.querySelector("#submit") as HTMLButtonElement;
    await vi.waitFor(() => expect(submit.disabled).toBe(false));
    expect(host.textContent).not.toContain("无法加载已保存的订阅");
    const toggle = host.querySelector(".category-toggle[data-category='earthquake_report']") as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    app.teardown();
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
      if (url.includes("/api/bark-urls")) return jsonResponse({ bark_urls: [FIRST_URL] });
      if (url.includes("/api/subscription-options")) {
        return jsonResponse({ categories: [simpleCategory, weatherCategory, typhoonCategory] });
      }
      if (url.includes("/api/status")) return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
      return jsonResponse({});
    }));
    const host = document.createElement("div");
    fillHost(host);
    document.body.append(host);
    const app = mountSubscribeApp(host, { api: "", instanceTermsAccepted: true, deviceId: DEVICE_ID, deviceKey: KEY });
    const submit = host.querySelector("#submit") as HTMLButtonElement;
    await vi.waitFor(() => expect(submit.disabled).toBe(false));
    const checked = (category: string) => (
      host.querySelector(`.category-toggle[data-category='${category}']`) as HTMLInputElement
    ).checked;
    expect(checked("typhoon")).toBe(true);
    expect(checked("earthquake_report")).toBe(false);
    expect(checked("weather_warning")).toBe(false);
    expect(host.textContent).toContain("中心 300 km 内");
    app.teardown();
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
    const host = document.createElement("div");
    fillHost(host);
    document.body.append(host);
    const app = mountSubscribeApp(host, {
      api: "",
      instanceTermsAccepted: true,
      deviceId: DEVICE_ID,
      deviceKey: KEY,
      onUnauthorized,
    });
    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
    app.teardown();
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
      if (url.includes("/api/bark-urls")) {
        return jsonResponse({ bark_urls: [FIRST_URL] });
      }
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

    const host = document.createElement("div");
    fillHost(host);
    document.body.append(host);

    const app = mountSubscribeApp(host, { api: "", instanceTermsAccepted: true, deviceId: DEVICE_ID, deviceKey: KEY });
    const sources = host.querySelector("#alert-type-sources") as HTMLElement;
    await vi.waitFor(() => {
      expect(sources.hidden).toBe(false);
      expect(sources.textContent).toBe("Wolfx ｜ FAN Studio");
    });

    expect(sources.textContent).not.toContain("Huania");
    expect(host.querySelector("#status-shell")).toBeNull();
    expect(host.querySelector("#status-chip-wolfx")).toBeNull();
    expect(host.querySelector(".subhead")).toBeNull();
    expect(host.textContent).not.toContain("将所选地点的提醒推送到当前设备");
    expect((host.querySelector("#unsubscribe") as HTMLButtonElement).className).toBe("secondary");
    expect((host.querySelector("#submit") as HTMLButtonElement).textContent).toBe("保存订阅");
    expect(host.querySelector("#status-label")).toBeNull();
    expect(host.querySelector("#status-details")).toBeNull();
    expect(host.querySelector("#service-status")).toBeNull();
    expect(host.textContent).not.toContain("个订阅");
    expect(host.textContent).not.toContain("状态未知");
    expect(host.textContent).not.toContain("服务运行状态");
    expect(host.textContent).not.toContain("数据源 2/3");
    expect(host.textContent).not.toContain("已连接");
    expect(host.textContent).not.toContain("未连接");
    expect(host.textContent).not.toContain("配置草稿保存在当前浏览器");
    expect(host.textContent).not.toContain("Bark ID 不会保存");
    const footer = host.querySelector("footer");
    expect(footer?.textContent).not.toContain("数据来源");
    expect(footer?.textContent).not.toContain("开源项目");
    expect(footer?.innerHTML).not.toContain("ws-api.wolfx.jp");
    expect(footer?.innerHTML).not.toContain("github.com/luyi2008/disaster-alert");
    expect(footer?.textContent).toContain("本服务仅用于灾害信息转发与个人提醒");

    app.teardown();
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

    const host = document.createElement("div");
    fillHost(host);
    document.body.append(host);
    const app = mountSubscribeApp(host, {
      api: "",
      instanceTermsAccepted: true,
      deviceId: DEVICE_ID,
      deviceKey: KEY,
      onUnauthorized,
    });
    const submit = host.querySelector("#submit") as HTMLButtonElement;
    await vi.waitFor(() => expect(submit.disabled).toBe(false));
    (host.querySelector("#subscribe-form") as HTMLFormElement).requestSubmit();
    await vi.waitFor(() => expect(host.textContent).toContain("Bark 拒绝"));
    expect(onUnauthorized).not.toHaveBeenCalled();
    app.teardown();
  });
});
