import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAFT_STORAGE_KEY } from "../api";
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
  return vi.fn(async (input: RequestInfo | URL) => {
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

    const teardown = mountSubscribeApp(host, { api: "", instanceTermsAccepted: true, deviceKey: KEY });
    const form = host.querySelector("#subscribe-form");
    expect(form).not.toBe(decoy);
    expect((form as HTMLFormElement | null)?.id).toBe("subscribe-form");
    expect(host.querySelector("#bark-id")).toBeNull();
    expect(host.querySelector("#bark-url")).toBeNull();

    teardown();
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

    const teardown = mountSubscribeApp(host, {
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
      expect(subscribeCall).toBeTruthy();
      const body = JSON.parse(String((subscribeCall?.[1] as RequestInit).body));
      expect(body.destination).toEqual({
        type: "bark",
        base_url: FIRST_URL,
        device_key: KEY,
      });
    });

    teardown();
  });
});
