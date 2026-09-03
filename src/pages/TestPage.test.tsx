import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDraftUpdatedAt } from "../simulate/subscriptionPreview";
import { TestPage } from "./TestPage";

const DEVICE_ID = "11111111-1111-1111-1111-111111111111";
const DEVICE_KEY = "ynJ5Ft4atkMkWeo2PAvFhF";
const DEVICE_TOKEN_MASKED = "toke****naaa";
const KEY = DEVICE_KEY;
const UPDATED_AT = 1_700_000_000_000;

function jsonResponse(data: unknown, status = 200, message = "ok"): Response {
  return new Response(JSON.stringify({ success: status < 400, message, data }), { status });
}

function envelopeResponse(success: boolean, data: unknown, status = 200, message = "ok"): Response {
  return new Response(JSON.stringify({ success, message, data }), { status });
}

function savedSubscriptions() {
  return {
    subscriptions: [{
      destination: {
        type: "bark",
        base_url: "https://bark.example",
        device_key: KEY,
      },
      targets: [{
        label: "上海家中",
        point: { latitude: 31.2304, longitude: 121.4737 },
        region: { province: "上海市", city: "上海市", district: "浦东新区" },
      }],
      alerts: [{
        category: "earthquake_warning",
        sources: { mode: "all" },
        estimated_intensity_bands: [
          { min: 1, max: 1, interruption_level: "passive" },
          { min: 2, max: 2, interruption_level: "active" },
          { min: 3, max: 7, interruption_level: "critical" },
        ],
      }],
      updated_at: UPDATED_AT,
    }],
  };
}

function warningBands(bands: Array<{ min: number; max: number; interruption_level: string }>) {
  return {
    categories: [{
      id: "earthquake_warning",
      label: "地震预警",
      source_groups: [],
      default_alert: {
        category: "earthquake_warning",
        sources: { mode: "all" },
        estimated_intensity_bands: bands,
      },
    }],
  };
}

function historyRecords() {
  return {
    source: "major",
    records: [
      {
        source: "major",
        key: "wenchuan-2008",
        event_id: "CENC-20080512",
        origin_time: "2008-05-12T06:28:01Z",
        hypocenter: "四川汶川",
        latitude: 31.0,
        longitude: 103.4,
        magnitude: 7.9,
        depth_km: 19,
        max_intensity: "XI",
        note: "汶川",
        distance_km: 80,
        estimated_intensity: 8.1,
      },
    ],
  };
}

function stubApis(options: {
  bands?: Array<{ min: number; max: number; interruption_level: string }>;
  history?: unknown;
  simulateStatus?: number;
  historyStatus?: number;
  subscriptions?: unknown;
  subscriptionsSuccess?: boolean;
  subscriptionsStatus?: number;
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/devices" || /\/api\/devices$/.test(url)) {
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
    if (url.includes("/api/subscription-options")) {
      return jsonResponse(warningBands(options.bands ?? [
        { min: 1, max: 1, interruption_level: "passive" },
        { min: 2, max: 2, interruption_level: "active" },
        { min: 3, max: 7, interruption_level: "critical" },
      ]));
    }
    if (url.includes("/devices/") && url.endsWith("/subscription")) {
      const status = options.subscriptionsStatus ?? 200;
      const success = options.subscriptionsSuccess ?? status < 400;
      return envelopeResponse(
        success,
        options.subscriptions ?? savedSubscriptions(),
        status,
        status === 401 ? "未登录" : "ok",
      );
    }
    if (url.includes("/api/history")) {
      const status = options.historyStatus ?? 200;
      return jsonResponse(options.history ?? historyRecords(), status);
    }
    if (url.includes("/simulate")) {
      const status = options.simulateStatus ?? 200;
      return jsonResponse({
        event_id: "SIM-TEST",
        pushed: 1,
        skipped: 0,
        temporary: false,
      }, status, status === 401 ? "未登录" : "已向目标设备尝试推送");
    }
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderTestPage() {
  return render(
    <MemoryRouter initialEntries={[`/devices/${DEVICE_KEY}/subscribe/test`]}>
      <Routes>
        <Route path="/login" element={<div>login</div>} />
        <Route path="/devices" element={<div>devices</div>} />
        <Route path="/devices/:id/subscribe/test" element={<TestPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TestPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("previews saved subscription fields and renders three dynamic levels", async () => {
    const fetchMock = stubApis({});
    renderTestPage();

    expect(await screen.findAllByText("设备1")).not.toHaveLength(0);
    expect(await screen.findByText("上海家中 · 上海市 · 浦东新区")).toBeInTheDocument();
    expect(screen.getByText("地震预警")).toBeInTheDocument();
    expect(screen.getByText("3–7")).toBeInTheDocument();
    expect(screen.getByText(`上次更新 ${formatDraftUpdatedAt(UPDATED_AT)}`)).toBeInTheDocument();
    const hydrateCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/subscription"));
    expect(hydrateCall).toBeTruthy();
    expect(new Headers(hydrateCall?.[1]?.headers).get("Authorization")).toBeNull();
    await screen.findByText("bark.example");
    expect(screen.getByText("静默")).toBeInTheDocument();
    expect(screen.getByText("重要")).toBeInTheDocument();
    expect(screen.getAllByText("紧急").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "发送测试" })).toHaveLength(3);
  });

  it("shows the server-only empty preview when subscriptions returns success false", async () => {
    stubApis({
      subscriptions: undefined,
      subscriptionsSuccess: false,
    });
    renderTestPage();

    expect(screen.getByText("模拟接口只认本实例已保存的订阅，请先回到订阅页保存。")).toBeInTheDocument();
    expect(screen.getByText("尚未配置规则")).toBeInTheDocument();
    expect(screen.getByText("模拟接口只认本实例已保存的订阅，请先回到订阅页保存。")).toBeInTheDocument();
  });

  it("goes to login when subscription GET returns 401", async () => {
    stubApis({ subscriptionsStatus: 401 });
    renderTestPage();
    expect(await screen.findByText("login")).toBeInTheDocument();
  });

  it("posts notify_level to the device simulate route", async () => {
    const fetchMock = stubApis({});
    renderTestPage();
    const buttons = await screen.findAllByRole("button", { name: "发送测试" });
    fireEvent.click(buttons[1]);
    await waitFor(() => {
      const simulateCall = fetchMock.mock.calls.find(([input, init]) => (
        String(input).includes(`/api/devices/${DEVICE_ID}/simulate?notify_level=active`)
        && (init as RequestInit | undefined)?.method === "POST"
      ));
      expect(simulateCall).toBeTruthy();
      expect(simulateCall?.[1]?.credentials).toBe("include");
      expect(new Headers(simulateCall?.[1]?.headers).get("Authorization")).toBeNull();
    });
    expect(await screen.findByText(/已向目标设备尝试推送/)).toBeInTheDocument();
  });

  it("loads history records and posts source plus key from the test button", async () => {
    const fetchMock = stubApis({});
    renderTestPage();
    fireEvent.click(screen.getByRole("tab", { name: "历史回放" }));
    expect(await screen.findByText("四川汶川")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "测试" }));
    await waitFor(() => {
      const simulateCall = fetchMock.mock.calls.find(([input, init]) => {
        const url = String(input);
        return url.includes(`/api/devices/${DEVICE_ID}/simulate?`)
          && url.includes("source=major")
          && url.includes("key=wenchuan-2008")
          && (init as RequestInit | undefined)?.method === "POST";
      });
      expect(simulateCall).toBeTruthy();
    });
  });

  it("goes to login when simulate returns 401", async () => {
    stubApis({ simulateStatus: 401 });
    renderTestPage();
    const buttons = await screen.findAllByRole("button", { name: "发送测试" });
    fireEvent.click(buttons[0]);
    expect(await screen.findByText("login")).toBeInTheDocument();
  });
});
