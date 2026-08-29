import { afterEach, describe, expect, it, vi } from "vitest";
import shell from "./shell.html?raw";
import { mountSubscribeApp } from "./subscribeApp";

const { mapRemove } = vi.hoisted(() => ({ mapRemove: vi.fn() }));

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

describe("mountSubscribeApp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
    mapRemove.mockClear();
  });

  it("scopes queries to the host and removes the map on teardown", async () => {
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
          return jsonResponse({
            instance_terms_accepted: true,
            total_subscriptions: 0,
          });
        }
        return jsonResponse({});
      }),
    );

    const decoy = document.createElement("form");
    decoy.id = "subscribe-form";
    document.body.append(decoy);

    const host = document.createElement("div");
    host.innerHTML = shell;
    document.body.append(host);

    const teardown = mountSubscribeApp(host, { api: "", instanceTermsAccepted: true });
    const form = host.querySelector("#subscribe-form");
    expect(form).not.toBe(decoy);
    expect((form as HTMLFormElement | null)?.id).toBe("subscribe-form");

    teardown();
    expect(mapRemove).toHaveBeenCalled();
    document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });

  it("fills a readonly Bark Key from initialBarkKey", async () => {
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
          return jsonResponse({
            instance_terms_accepted: true,
            total_subscriptions: 0,
          });
        }
        return jsonResponse({});
      }),
    );

    const host = document.createElement("div");
    host.innerHTML = shell;
    document.body.append(host);

    const teardown = mountSubscribeApp(host, {
      api: "",
      instanceTermsAccepted: true,
      initialBarkKey: "ynJ5Ft4atkMkWeo2PAvFhF",
    });
    const input = host.querySelector("#bark-id") as HTMLInputElement;
    expect(input.value).toBe("ynJ5Ft4atkMkWeo2PAvFhF");
    expect(input.readOnly).toBe(true);
    expect(host.querySelector(".change-device")?.getAttribute("href")).toBe("/");
    teardown();
  });
});
