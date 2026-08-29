import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BarkKeyPage } from "./BarkKeyPage";

const KEY = "ynJ5Ft4atkMkWeo2PAvFhF";

afterEach(() => {
  vi.unstubAllGlobals();
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}:${(location.state as { barkKey?: string } | null)?.barkKey ?? ""}`}</div>;
}

function renderEntry() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<BarkKeyPage />} />
        <Route path="/subscribe" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function stubCheck(data: { valid: boolean; registered: boolean; reason?: string | null }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: 200,
          message: "success",
          data: {
            device_key: KEY,
            valid: data.valid,
            registered: data.registered,
            reason: data.reason ?? null,
          },
        }),
      ),
    ),
  );
}

describe("BarkKeyPage", () => {
  it("keeps the continue button disabled for invalid input", () => {
    renderEntry();
    const button = screen.getByRole("button", { name: "进入订阅配置" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Bark 测试链接"), { target: { value: "not-a-key" } });
    expect(screen.getByText("无法从内容中提取 Bark Key")).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("keeps the button disabled while checking and when the key is not registered", async () => {
    stubCheck({ valid: true, registered: false });
    renderEntry();
    fireEvent.change(screen.getByLabelText("Bark 测试链接"), { target: { value: KEY } });
    expect(screen.getByRole("button", { name: "进入订阅配置" })).toBeDisabled();
    expect(screen.getByText("正在校验…")).toBeInTheDocument();
    expect(await screen.findByText("该 Bark Key 尚未在推送服务注册")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "进入订阅配置" })).toBeDisabled();
  });

  it("enables continue after a registered key and navigates with state", async () => {
    stubCheck({ valid: true, registered: true });
    renderEntry();
    fireEvent.change(screen.getByLabelText("Bark 测试链接"), {
      target: { value: `https://bark.mangguo.cloud/${KEY}/测试` },
    });
    const button = screen.getByRole("button", { name: "进入订阅配置" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(screen.getByTestId("location").textContent).toBe(`/subscribe:${KEY}`);
  });
});
