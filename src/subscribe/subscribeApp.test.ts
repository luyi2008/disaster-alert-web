import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAFT_STORAGE_KEY } from "../api";
import { readCachedBarkKey, writeCachedBarkKey } from "../bark/session";
import bodyHtml from "./body.html?raw";
import footerHtml from "./footer.html?raw";
import headerHtml from "./header.html?raw";
import { mountSubscribeApp } from "./subscribeApp";

const { mapRemove } = vi.hoisted(() => ({ mapRemove: vi.fn() }));
const KEY = "ynJ5Ft4atkMkWeo2PAvFhF";
const FIRST_URL = "https://bark.first.example";
const SECOND_URL = "https://bark.second.example";

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

function stubSubscribeFetches() {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/bark-urls")) {
      return jsonResponse({ bark_urls: [FIRST_URL, SECOND_URL] });
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
    if (url.includes("/api/subscribe")) {
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

    const app = mountSubscribeApp(host, { api: "", instanceTermsAccepted: true, deviceKey: KEY });
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

  it("submits deviceKey from options and the first bark URL, ignoring DOM and saved draft URLs", async () => {
    const fetchMock = stubSubscribeFetches();
    vi.stubGlobal("fetch", fetchMock);

    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      schema_version: 3,
      bark_url: SECOND_URL,
      targets: [{
        id: "t1",
        label: "home",
        point: { latitude: "35.0000", longitude: "139.0000" },
        region: { province: "", city: "", district: "" },
      }],
      alerts_by_category: {},
    }));

    const host = document.createElement("div");
    fillHost(host);
    const decoyKey = document.createElement("input");
    decoyKey.id = "bark-id";
    decoyKey.value = "WRONGKEYWRONGKEYWRONG1";
    const decoyUrl = document.createElement("select");
    decoyUrl.id = "bark-url";
    decoyUrl.innerHTML = `<option value="${SECOND_URL}" selected>${SECOND_URL}</option>`;
    host.append(decoyKey, decoyUrl);
    document.body.append(host);

    const app = mountSubscribeApp(host, {
      api: "",
      instanceTermsAccepted: true,
      deviceKey: KEY,
    });

    const submit = host.querySelector("#submit") as HTMLButtonElement;
    await vi.waitFor(() => expect(submit.disabled).toBe(false));
    (host.querySelector("#subscribe-form") as HTMLFormElement).requestSubmit();

    await vi.waitFor(() => {
      const subscribeCall = fetchMock.mock.calls.find(([input, init]) => (
        String(input).includes("/api/subscribe") && (init as RequestInit | undefined)?.method === "POST"
      ));
      if (!subscribeCall) {
        throw new Error("missing subscribe request");
      }
      const body = JSON.parse(String((subscribeCall[1] as RequestInit).body));
      expect(body.destination).toEqual({
        type: "bark",
        base_url: FIRST_URL,
        device_key: KEY,
      });
    });

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

    const app = mountSubscribeApp(host, { api: "", instanceTermsAccepted: true, deviceKey: KEY });
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

  it("expires the Bark session when subscribe returns 502 and /check rejects the key", async () => {
    const onInvalidBarkKey = vi.fn();
    writeCachedBarkKey(KEY);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/bark-check")) {
        return new Response(JSON.stringify({
          data: { device_key: KEY, valid: true, registered: false, reason: null },
        }));
      }
      if (url.includes("/api/bark-urls")) {
        return jsonResponse({ bark_urls: [FIRST_URL] });
      }
      if (url.includes("/api/subscription-options")) {
        return jsonResponse({ categories: [simpleCategory] });
      }
      if (url.includes("/api/status")) {
        return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
      }
      if (url.includes("/api/subscribe")) {
        return new Response(JSON.stringify({ success: false, message: "Bark 拒绝" }), { status: 502 });
      }
      return jsonResponse({});
    }));

    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      schema_version: 3,
      bark_url: FIRST_URL,
      targets: [{
        id: "t1",
        label: "home",
        point: { latitude: "35.0000", longitude: "139.0000" },
        region: { province: "", city: "", district: "" },
      }],
      alerts_by_category: {},
    }));

    const host = document.createElement("div");
    fillHost(host);
    document.body.append(host);
    const app = mountSubscribeApp(host, {
      api: "",
      instanceTermsAccepted: true,
      deviceKey: KEY,
      onInvalidBarkKey,
    });
    const submit = host.querySelector("#submit") as HTMLButtonElement;
    await vi.waitFor(() => expect(submit.disabled).toBe(false));
    (host.querySelector("#subscribe-form") as HTMLFormElement).requestSubmit();
    await vi.waitFor(() => expect(onInvalidBarkKey).toHaveBeenCalledTimes(1));
    expect(readCachedBarkKey()).toBeNull();
    app.teardown();
  });

  it("keeps the Bark session when subscribe returns 502 but /check still accepts the key", async () => {
    const onInvalidBarkKey = vi.fn();
    writeCachedBarkKey(KEY);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/bark-check")) {
        return new Response(JSON.stringify({
          data: { device_key: KEY, valid: true, registered: true, reason: null },
        }));
      }
      if (url.includes("/api/bark-urls")) {
        return jsonResponse({ bark_urls: [FIRST_URL] });
      }
      if (url.includes("/api/subscription-options")) {
        return jsonResponse({ categories: [simpleCategory] });
      }
      if (url.includes("/api/status")) {
        return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
      }
      if (url.includes("/api/subscribe")) {
        return new Response(JSON.stringify({ success: false, message: "Bark 拒绝" }), { status: 502 });
      }
      return jsonResponse({});
    }));

    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      schema_version: 3,
      bark_url: FIRST_URL,
      targets: [{
        id: "t1",
        label: "home",
        point: { latitude: "35.0000", longitude: "139.0000" },
        region: { province: "", city: "", district: "" },
      }],
      alerts_by_category: {},
    }));

    const host = document.createElement("div");
    fillHost(host);
    document.body.append(host);
    const app = mountSubscribeApp(host, {
      api: "",
      instanceTermsAccepted: true,
      deviceKey: KEY,
      onInvalidBarkKey,
    });
    const submit = host.querySelector("#submit") as HTMLButtonElement;
    await vi.waitFor(() => expect(submit.disabled).toBe(false));
    (host.querySelector("#subscribe-form") as HTMLFormElement).requestSubmit();
    await vi.waitFor(() => expect(host.textContent).toContain("Bark 拒绝"));
    expect(onInvalidBarkKey).not.toHaveBeenCalled();
    expect(readCachedBarkKey()).toBe(KEY);
    app.teardown();
  });
});
