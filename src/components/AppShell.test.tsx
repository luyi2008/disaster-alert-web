import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { ThemeProvider } from "../theme/ThemeProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppShell", () => {
  it("puts device management in the header and account actions in a menu", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/get-session")) {
        return new Response(JSON.stringify({ user: { id: "u1", name: "微信用户" } }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));

    render(
      <ThemeProvider>
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
        </MemoryRouter>
      </ThemeProvider>,
    );

    const devicesLink = await screen.findByRole("link", { name: "设备管理" });
    expect(devicesLink).toHaveAttribute("href", "/devices");
    expect(devicesLink).toHaveClass("hover:bg-accent");
    expect(screen.queryByRole("navigation", { name: "主导航" })).toBeNull();
    expect(screen.getByRole("button", { name: "切换外观" })).toBeInTheDocument();
    const account = await screen.findByRole("button", { name: "微信用户" });
    fireEvent.pointerDown(account);
    fireEvent.click(account);
    const settings = await screen.findByRole("menuitem", { name: "账号设置" });
    expect(settings).toHaveAttribute("href", "/settings");
    expect(settings.querySelector("svg")).not.toBeNull();
    const signOutButton = screen.getByRole("menuitem", { name: "登出" });
    expect(signOutButton.querySelector("svg")).not.toBeNull();
  });
});
