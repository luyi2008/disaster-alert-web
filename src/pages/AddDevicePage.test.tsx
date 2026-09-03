import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddDevicePage } from "./AddDevicePage";

afterEach(() => {
  vi.unstubAllGlobals();
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: status < 400, message: "ok", data }), { status });
}

function renderAdd() {
  return render(
    <MemoryRouter initialEntries={["/devices/add"]}>
      <Routes>
        <Route path="/devices/add" element={<AddDevicePage />} />
        <Route path="/devices" element={<div>devices</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AddDevicePage", () => {
  it("does not POST an empty, overlong, or deleted token", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).includes("/api/auth/get-session")) {
        return new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 });
      }
      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    renderAdd();
    const field = await screen.findByLabelText("device_token");

    fireEvent.click(screen.getByRole("button", { name: "添加设备" }));
    expect(screen.getByText("请输入 device_token")).toBeInTheDocument();

    fireEvent.change(field, { target: { value: "deleted" } });
    fireEvent.click(screen.getByRole("button", { name: "添加设备" }));
    expect(screen.getByText("device_token 不能为 deleted")).toBeInTheDocument();

    fireEvent.change(field, { target: { value: "a".repeat(129) } });
    fireEvent.click(screen.getByRole("button", { name: "添加设备" }));
    expect(screen.getByText("device_token 长度不能超过 128")).toBeInTheDocument();

    const posts = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST");
    expect(posts).toHaveLength(0);
  });

  it("POSTs device_token and optional name", async () => {
    const token = "short-apns-token";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/auth/get-session")) {
        return new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 });
      }
      if (init?.method === "POST") {
        return json({ device: { id: "dev-1", userId: "u1", name: "厨房 iPhone", createdAt: 1, updatedAt: 1 } });
      }
      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    renderAdd();
    await screen.findByLabelText("device_token");
    fireEvent.change(screen.getByLabelText("device_token"), { target: { value: token } });
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "厨房 iPhone" } });
    fireEvent.click(screen.getByRole("button", { name: "添加设备" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ device_token: token, name: "厨房 iPhone" });
    expect(await screen.findByText("devices")).toBeInTheDocument();
  });
});
