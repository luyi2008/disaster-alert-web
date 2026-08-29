import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DeviceIdentity } from "./DeviceIdentity";

describe("DeviceIdentity", () => {
  it("shows the Bark app hint and Bark ID without form controls", () => {
    const { container } = render(
      <MemoryRouter>
        <DeviceIdentity barkId="ynJ5Ft4atkMkWeo2PAvFhF" onReloadConfig={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText("通知 APP：Bark")).toBeInTheDocument();
    expect(screen.getByText("Bark ID：ynJ5Ft4atkMkWeo2PAvFhF")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "更换设备" })).toHaveAttribute("href", "/");
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });

  it("places reload config after change-device and calls onReloadConfig", () => {
    const onReloadConfig = vi.fn();
    render(
      <MemoryRouter>
        <DeviceIdentity barkId="ynJ5Ft4atkMkWeo2PAvFhF" onReloadConfig={onReloadConfig} />
      </MemoryRouter>,
    );
    const changeDevice = screen.getByRole("link", { name: "更换设备" });
    const reloadConfig = screen.getByRole("button", { name: "重新加载配置" });
    expect(changeDevice.compareDocumentPosition(reloadConfig) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(reloadConfig);
    expect(onReloadConfig).toHaveBeenCalledTimes(1);
  });
});
