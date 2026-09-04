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

    expect(await screen.findByRole("link", { name: "设备管理" })).toHaveAttribute("href", "/devices");
    expect(screen.queryByRole("navigation", { name: "主导航" })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /微信用户/ }));
    expect(screen.getByRole("menuitem", { name: "账号设置" })).toHaveAttribute("href", "/settings");
  });
});
