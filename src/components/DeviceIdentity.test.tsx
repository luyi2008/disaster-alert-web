import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceIdentity } from "./DeviceIdentity";

const DEVICE_ID = "11111111-1111-1111-1111-111111111111";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DeviceIdentity", () => {
  it("shows the device name and account actions", () => {
    const { container } = render(
      <MemoryRouter>
        <DeviceIdentity deviceId={DEVICE_ID} deviceName="设备1" />
      </MemoryRouter>,
    );
    expect(screen.getByText("设备1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "测试" })).toHaveAttribute("href", `/devices/${DEVICE_ID}/subscribe/test`);
    expect(screen.getByRole("link", { name: "换设备" })).toHaveAttribute("href", "/devices");
    expect(screen.getByRole("button", { name: "登出" })).toBeInTheDocument();
    expect(container.querySelector("input")).toBeNull();
  });

  it("signs out and goes to login", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    render(
      <MemoryRouter initialEntries={["/devices/x/subscribe"]}>
        <Routes>
          <Route path="/login" element={<div>login</div>} />
          <Route path="/devices/x/subscribe" element={<DeviceIdentity deviceId={DEVICE_ID} deviceName="设备1" />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "登出" }));
    expect(await screen.findByText("login")).toBeInTheDocument();
  });

  it("shows a back-to-subscribe link on the test page", () => {
    render(
      <MemoryRouter>
        <DeviceIdentity deviceId={DEVICE_ID} deviceName="设备1" currentPage="test" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "返回订阅" })).toHaveAttribute("href", `/devices/${DEVICE_ID}/subscribe`);
    expect(screen.queryByRole("link", { name: "测试" })).toBeNull();
  });
});
