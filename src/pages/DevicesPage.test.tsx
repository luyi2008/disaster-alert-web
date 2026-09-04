import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DevicesPage } from "./DevicesPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: status < 400, message: "ok", data }), { status });
}

function session() {
  return new Response(JSON.stringify({ user: { id: "u1", name: "微信用户" } }), { status: 200 });
}

const DEVICE_ID = "11111111-1111-1111-1111-111111111111";
const DEVICE_KEY = "ynJ5Ft4atkMkWeo2PAvFhF";
const DEVICE_TOKEN_MASKED = "toke****naaa";

describe("DevicesPage", () => {
  it("lists deviceKey and deviceTokenMasked and links subscribe/test with deviceKey", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/get-session")) {
        return session();
      }
      if (String(input).includes("/api/devices") && !String(input).includes("/subscribe")) {
        return json({
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
      return json({});
    }));
    render(
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes>
          <Route path="/devices" element={<DevicesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "设备1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "改名" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "解绑" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "改名" })?.closest(".device-card-title")).toContainElement(
      screen.getByRole("heading", { name: "设备1" }),
    );
    expect(screen.getByText("deviceKey")).toBeInTheDocument();
    expect(screen.getByText(DEVICE_KEY)).toBeInTheDocument();
    expect(screen.getByText("deviceTokenMasked")).toBeInTheDocument();
    expect(screen.getByText(DEVICE_TOKEN_MASKED)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "配置订阅" })).toHaveAttribute("href", `/devices/${DEVICE_KEY}/subscribe`);
    expect(screen.getByRole("link", { name: "测试通知" })).toHaveAttribute("href", `/devices/${DEVICE_KEY}/subscribe/test`);
    expect(screen.getByRole("link", { name: "添加设备" })).toHaveAttribute("href", "/devices/add");
    expect(screen.getByRole("link", { name: "设备管理" })).toHaveAttribute("href", "/devices");
    expect(screen.queryByRole("navigation", { name: "主导航" })).toBeNull();
    expect(screen.queryByText(DEVICE_ID)).toBeNull();
  });

  it("shows an empty state that points at add device", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/get-session")) {
        return session();
      }
      return json({ devices: [] });
    }));
    render(
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes>
          <Route path="/devices" element={<DevicesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("还没有设备")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "添加设备" }).length).toBeGreaterThan(0);
  });

  it("renames a device through a dialog instead of window.prompt", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/auth/get-session")) {
        return session();
      }
      if (init?.method === "PATCH") {
        return json({
          device: {
            id: DEVICE_ID,
            name: "厨房",
            deviceKey: DEVICE_KEY,
            deviceTokenMasked: DEVICE_TOKEN_MASKED,
            createdAt: 1,
            updatedAt: 1,
          },
        });
      }
      if (String(input).includes("/api/devices") && !String(input).includes("/subscribe")) {
        return json({
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
      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes>
          <Route path="/devices" element={<DevicesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "改名" }));
    const nameInput = await screen.findByLabelText("设备名称");
    expect(nameInput).toHaveValue("设备1");
    fireEvent.change(nameInput, { target: { value: "厨房" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, requestInit]) => requestInit?.method === "PATCH");
      expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ name: "厨房" });
    });
  });

  it("does not rename when the dialog is cancelled", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).includes("/api/auth/get-session")) {
        return session();
      }
      if (String(input).includes("/api/devices") && !String(input).includes("/subscribe")) {
        return json({
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
      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes>
          <Route path="/devices" element={<DevicesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "改名" }));
    fireEvent.click(await screen.findByRole("button", { name: "取消" }));
    await waitFor(() => expect(screen.queryByLabelText("设备名称")).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.every(([, requestInit]) => requestInit?.method !== "PATCH")).toBe(true);
  });

  it("unbinds a device after confirming in a dialog", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/auth/get-session")) {
        return session();
      }
      if (init?.method === "DELETE") {
        return json({});
      }
      if (String(input).includes("/api/devices") && !String(input).includes("/subscribe")) {
        return json({
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
      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes>
          <Route path="/devices" element={<DevicesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "解绑" }));
    expect(await screen.findByText("确定解绑「设备1」？会先删除该设备的服务端订阅。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认解绑" }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, requestInit]) => requestInit?.method === "DELETE")).toBe(true);
    });
  });

  it("does not unbind when the confirmation is cancelled", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).includes("/api/auth/get-session")) {
        return session();
      }
      return json({
        devices: [{
          id: DEVICE_ID,
          name: "设备1",
          deviceKey: DEVICE_KEY,
          deviceTokenMasked: DEVICE_TOKEN_MASKED,
          createdAt: 1,
          updatedAt: 1,
        }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes>
          <Route path="/devices" element={<DevicesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "解绑" }));
    fireEvent.click(await screen.findByRole("button", { name: "取消" }));
    await waitFor(() => expect(screen.queryByText(/确定解绑/)).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.every((call) => (call[1] as RequestInit | undefined)?.method !== "DELETE")).toBe(true);
  });
});
