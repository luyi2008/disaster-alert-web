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

describe("AddDevicePage", () => {
  it("does not POST a short token", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).includes("/api/auth/get-session")) {
        return new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 });
      }
      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/devices/add"]}>
        <Routes>
          <Route path="/devices/add" element={<AddDevicePage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByLabelText("Bark token");
    fireEvent.change(screen.getByLabelText("Bark token"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "添加设备" }));
    const posts = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST");
    expect(posts).toHaveLength(0);
  });

  it("POSTs only the token string when binding", async () => {
    const token = "ynJ5Ft4atkMkWeo2PAvFhF";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/auth/get-session")) {
        return new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 });
      }
      if (init?.method === "POST") {
        return json({ device: { id: "dev-1", userId: "u1", name: "设备1", createdAt: 1, updatedAt: 1 } });
      }
      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/devices/add"]}>
        <Routes>
          <Route path="/devices/add" element={<AddDevicePage />} />
          <Route path="/devices" element={<div>devices</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByLabelText("Bark token");
    fireEvent.change(screen.getByLabelText("Bark token"), { target: { value: token } });
    fireEvent.click(screen.getByRole("button", { name: "添加设备" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ token });
    expect(await screen.findByText("devices")).toBeInTheDocument();
  });
});
