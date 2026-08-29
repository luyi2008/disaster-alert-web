import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DeviceIdentity } from "./DeviceIdentity";

describe("DeviceIdentity", () => {
  it("shows the Bark app hint and Bark ID without form controls", () => {
    const { container } = render(
      <MemoryRouter>
        <DeviceIdentity barkId="ynJ5Ft4atkMkWeo2PAvFhF" />
      </MemoryRouter>,
    );
    expect(screen.getByText("通知 APP：Bark")).toBeInTheDocument();
    expect(screen.getByText("Bark ID：ynJ5Ft4atkMkWeo2PAvFhF")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "更换设备" })).toHaveAttribute("href", "/");
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });
});
