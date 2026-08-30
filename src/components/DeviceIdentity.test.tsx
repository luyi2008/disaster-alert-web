import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readCachedBarkKey, writeCachedBarkKey } from "../bark/session";
import { DeviceIdentity } from "./DeviceIdentity";

const KEY = "ynJ5Ft4atkMkWeo2PAvFhF";

afterEach(() => {
  localStorage.clear();
});

describe("DeviceIdentity", () => {
  it("shows the Bark app hint and Bark ID without form controls", () => {
    const { container } = render(
      <MemoryRouter>
        <DeviceIdentity barkId={KEY} onReloadConfig={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText("通知 APP：Bark")).toBeInTheDocument();
    expect(screen.getByText(`Bark ID：${KEY}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "测试" })).toHaveAttribute("href", "/subscribe/test");
    expect(screen.getByRole("link", { name: "更换设备" })).toHaveAttribute("href", "/");
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });

  it("places test before change-device and reload config", () => {
    const onReloadConfig = vi.fn();
    render(
      <MemoryRouter>
        <DeviceIdentity barkId={KEY} onReloadConfig={onReloadConfig} />
      </MemoryRouter>,
    );
    const testLink = screen.getByRole("link", { name: "测试" });
    const changeDevice = screen.getByRole("link", { name: "更换设备" });
    const reloadConfig = screen.getByRole("button", { name: "重新加载配置" });
    expect(testLink.compareDocumentPosition(changeDevice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(changeDevice.compareDocumentPosition(reloadConfig) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(reloadConfig);
    expect(onReloadConfig).toHaveBeenCalledTimes(1);
  });

  it("clears the cached Bark Key when changing device", () => {
    writeCachedBarkKey(KEY);
    render(
      <MemoryRouter>
        <DeviceIdentity barkId={KEY} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("link", { name: "更换设备" }));
    expect(readCachedBarkKey()).toBeNull();
  });

  it("shows a back-to-subscribe link on the test page", () => {
    render(
      <MemoryRouter>
        <DeviceIdentity barkId={KEY} currentPage="test" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "返回订阅" })).toHaveAttribute("href", "/subscribe");
    expect(screen.queryByRole("link", { name: "测试" })).toBeNull();
    expect(screen.queryByRole("button", { name: "重新加载配置" })).toBeNull();
  });
});
