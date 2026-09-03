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

describe("DevicesPage", () => {
  it("lists devices without showing the Bark token", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/get-session")) {
        return session();
      }
      if (String(input).includes("/api/devices") && !String(input).includes("/subscribe")) {
        return json({ devices: [{ id: "dev-1", userId: "u1", name: "设备1", createdAt: 1, updatedAt: 1 }] });
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
    expect(screen.getByRole("link", { name: "配置订阅" })).toHaveAttribute("href", "/devices/dev-1/subscribe");
    expect(screen.getByRole("link", { name: "添加设备" })).toHaveAttribute("href", "/devices/add");
    expect(screen.queryByText(/AbAb/)).toBeNull();
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
