import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppShell", () => {
  it("puts device management in the header and has no sidebar nav", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/get-session")) {
        return new Response(JSON.stringify({ user: { id: "u1", name: "微信用户" } }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));

    render(
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes>
          <Route
            path="/devices"
            element={(
              <AppShell title="设备">
                <p>desk</p>
              </AppShell>
            )}
          />
          <Route path="/settings" element={<div>settings</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const devicesLink = await screen.findByRole("link", { name: "设备管理" });
    expect(devicesLink).toHaveAttribute("href", "/devices");
    expect(devicesLink).toHaveClass("hover:bg-accent");
    expect(devicesLink).toHaveClass("cursor-pointer");
    expect(devicesLink).not.toHaveClass("flex-col");
    expect(devicesLink).not.toHaveClass("p-2");
    expect(screen.queryByRole("navigation", { name: "主导航" })).toBeNull();
    const account = await screen.findByRole("button", { name: /微信用户/ });
    expect(account).toHaveClass("hover:bg-accent");
    expect(account).toHaveClass("cursor-pointer");
    fireEvent.click(account);
    const settings = await screen.findByRole("link", { name: "账号设置" });
    expect(settings).toHaveAttribute("href", "/settings");
    expect(settings.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("button", { name: "登出" }).querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("menuitem", { name: "账号设置" })).toBeNull();
  });
});
