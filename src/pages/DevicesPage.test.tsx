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

describe("DevicesPage", () => {
  it("lists devices without showing the Bark token", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
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
    expect(screen.getByRole("link", { name: "配置订阅" })).toHaveAttribute("href", "/devices/dev-1/subscribe");
    expect(screen.queryByText(/AbAb/)).toBeNull();
  });

  it("does not POST a short token", async () => {
    const fetchMock = vi.fn(async () => json({ devices: [] }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes>
          <Route path="/devices" element={<DevicesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("还没有设备。输入 Bark token 添加后才能配置订阅。");
    fireEvent.change(screen.getByLabelText("Bark token"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "添加设备" }));
    const posts = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST");
    expect(posts).toHaveLength(0);
  });

  it("POSTs only the token string when binding", async () => {
    const token = "ynJ5Ft4atkMkWeo2PAvFhF";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        return json({ device: { id: "dev-1", userId: "u1", name: "设备1", createdAt: 1, updatedAt: 1 } });
      }
      return json({ devices: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes>
          <Route path="/devices" element={<DevicesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByLabelText("Bark token");
    fireEvent.change(screen.getByLabelText("Bark token"), { target: { value: token } });
    fireEvent.click(screen.getByRole("button", { name: "添加设备" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ token });
  });
});
