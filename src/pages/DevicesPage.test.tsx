import { render, screen } from "@testing-library/react";
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
});
