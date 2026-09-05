import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SettingsPage", () => {
  it("shows the other-account message on 409", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/get-session")) {
        return new Response(JSON.stringify({ user: { id: "u1", name: "微信用户" } }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ success: false, message: "已在其他账号使用" }),
        { status: 409 },
      );
    }));
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(await screen.findByLabelText("手机号"), { target: { value: "13800000000" } });
    fireEvent.change(screen.getByLabelText("验证码"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "绑定手机号" }));
    expect(await screen.findByText("已在其他账号使用")).toBeInTheDocument();
  });
});
