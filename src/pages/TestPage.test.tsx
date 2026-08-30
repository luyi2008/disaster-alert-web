import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAFT_STORAGE_KEY } from "../api";
import { writeCachedBarkKey, readCachedBarkKey } from "../bark/session";
import { TestPage } from "./TestPage";

const KEY = "ynJ5Ft4atkMkWeo2PAvFhF";

function jsonResponse(data: unknown, status = 200, message = "ok"): Response {
  return new Response(JSON.stringify({ success: status < 400, message, data }), { status });
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
  check?: { valid: boolean; registered: boolean };
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/bark-check")) {
      const check = options.check ?? { valid: true, registered: true };
      return jsonResponse({
        device_key: KEY,
        valid: check.valid,
        registered: check.registered,
        reason: null,
      });
    }
    if (url.includes("/api/bark-urls")) {
      return jsonResponse({ bark_urls: ["https://bark.example"] });
    }
    if (url.includes("/api/subscription-options")) {
      return jsonResponse(warningBands(options.bands ?? [
        { min: 1, max: 1, interruption_level: "passive" },
        { min: 2, max: 2, interruption_level: "active" },
        { min: 3, max: 7, interruption_level: "critical" },
      ]));
    }
    if (url.includes("/api/history")) {
      const status = options.historyStatus ?? 200;
      return jsonResponse(options.history ?? historyRecords(), status, status === 401 ? "缺少或无效的 Bearer Bark Key" : "ok");
    }
    if (url.includes("/api/simulate")) {
      const status = options.simulateStatus ?? 200;
      return jsonResponse({
        event_id: "SIM-TEST",
        pushed: 1,
        skipped: 0,
        temporary: false,
      }, status, status === 401 ? "缺少或无效的 Bearer Bark Key" : "已向目标设备尝试推送");
    }
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderTestPage() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/subscribe/test", state: { barkKey: KEY } }]}>
      <Routes>
        <Route path="/" element={<div>entry</div>} />
        <Route path="/subscribe/test" element={<TestPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TestPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("redirects to the entry page without a validated bark key", () => {
    render(
      <MemoryRouter initialEntries={["/subscribe/test"]}>
        <Routes>
          <Route path="/" element={<div>entry</div>} />
          <Route path="/subscribe/test" element={<TestPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("entry")).toBeInTheDocument();
  });

  it("previews draft subscription fields and renders three dynamic levels", async () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      schema_version: 3,
      bark_url: "https://draft.example",
      updated_at: 1_700_000_000_000,
      targets: [{
        id: "home",
        label: "上海家中",
        point: { latitude: "31.2304", longitude: "121.4737" },
        region: { province: "上海市", city: "上海市", district: "浦东新区" },
      }],
      alerts_by_category: {
        earthquake_warning: {
          enabled: true,
          rule: {
            category: "earthquake_warning",
            estimated_intensity_bands: [{ min: 3, max: 7, interruption_level: "critical" }],
          },
        },
      },
    }));
    stubApis({});
    renderTestPage();

    expect(screen.getAllByText("Bark · ••••FhF").length).toBeGreaterThan(0);
    expect(screen.queryByText("订阅项目与通知规则")).toBeNull();
    expect(screen.getByText("上海家中 · 上海市 · 浦东新区")).toBeInTheDocument();
    expect(screen.getByText("地震预警")).toBeInTheDocument();
    expect(screen.getByText("3–7")).toBeInTheDocument();
    await screen.findByText("bark.example");
    expect(screen.getByText("静默")).toBeInTheDocument();
    expect(screen.getByText("重要")).toBeInTheDocument();
    expect(screen.getAllByText("紧急").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "发送测试" })).toHaveLength(3);
  });

  it("renders only the levels returned by subscription options", async () => {
    stubApis({
      bands: [
        { min: 1, max: 2, interruption_level: "passive" },
        { min: 3, max: 7, interruption_level: "critical" },
      ],
    });
    renderTestPage();
    await screen.findByText("静默");
    expect(screen.getByText("紧急")).toBeInTheDocument();
    expect(screen.queryByText("重要")).toBeNull();
    expect(screen.getAllByRole("button", { name: "发送测试" })).toHaveLength(2);
  });

  it("posts notify_level with the current bearer key", async () => {
    const fetchMock = stubApis({});
    renderTestPage();
    const buttons = await screen.findAllByRole("button", { name: "发送测试" });
    fireEvent.click(buttons[1]);
    await waitFor(() => {
      const simulateCall = fetchMock.mock.calls.find(([input, init]) => (
        String(input).includes("/api/simulate?notify_level=active") && (init as RequestInit | undefined)?.method === "POST"
      ));
      expect(simulateCall).toBeTruthy();
      const headers = new Headers(simulateCall?.[1]?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${KEY}`);
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
        return url.includes("/api/simulate?")
          && url.includes("source=major")
          && url.includes("key=wenchuan-2008")
          && (init as RequestInit | undefined)?.method === "POST";
      });
      expect(simulateCall).toBeTruthy();
      const headers = new Headers(simulateCall?.[1]?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${KEY}`);
    });
  });

  it("opens from a cached key without location state", async () => {
    writeCachedBarkKey(KEY);
    stubApis({});
    render(
      <MemoryRouter initialEntries={["/subscribe/test"]}>
        <Routes>
          <Route path="/" element={<div>entry</div>} />
          <Route path="/subscribe/test" element={<TestPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Bark · ••••FhF").length).toBeGreaterThan(0);
    await screen.findByText("静默");
  });

  it("expires the session when simulate 401 and /check rejects the key", async () => {
    writeCachedBarkKey(KEY);
    stubApis({ simulateStatus: 401, check: { valid: true, registered: false } });
    renderTestPage();
    const buttons = await screen.findAllByRole("button", { name: "发送测试" });
    fireEvent.click(buttons[0]);
    expect(await screen.findByText("entry")).toBeInTheDocument();
    expect(readCachedBarkKey()).toBeNull();
  });

  it("keeps the session when simulate 401 but /check still accepts the key", async () => {
    writeCachedBarkKey(KEY);
    stubApis({ simulateStatus: 401, check: { valid: true, registered: true } });
    renderTestPage();
    const buttons = await screen.findAllByRole("button", { name: "发送测试" });
    fireEvent.click(buttons[0]);
    expect(await screen.findByText("缺少或无效的 Bearer Bark Key")).toBeInTheDocument();
    expect(readCachedBarkKey()).toBe(KEY);
    expect(screen.queryByText("entry")).toBeNull();
  });
});
