import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { writeAccount } from "../auth/session";
import { readDevices, seedDevices, writeDevices } from "../devices/store";
import { AddDevicePage } from "./AddDevicePage";

const TOKEN = "ynJ5Ft4atkMkWeo2PAvFhF";
const NEW_TOKEN = "AbCdEfGhIjKlMnOpQrStUv";

afterEach(() => {
  localStorage.clear();
});

function renderAdd() {
  writeAccount({ method: "phone", label: "+8613800138000", phone: "+8613800138000" });
  writeDevices(seedDevices());
  return render(
    <MemoryRouter initialEntries={["/devices/add"]}>
      <Routes>
        <Route path="/devices/add" element={<AddDevicePage />} />
        <Route path="/devices" element={<div>devices home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AddDevicePage", () => {
  it("requires a token", () => {
    renderAdd();
    fireEvent.click(screen.getByRole("button", { name: "Add device" }));
    expect(screen.getByText("Enter a device token.")).toBeInTheDocument();
  });

  it("rejects an invalid token", () => {
    renderAdd();
    fireEvent.change(screen.getByPlaceholderText("Paste the device token"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Add device" }));
    expect(screen.getByText("Enter a valid device token.")).toBeInTheDocument();
  });

  it("adds a device with an optional name", async () => {
    renderAdd();
    fireEvent.change(screen.getByPlaceholderText("Paste the device token"), { target: { value: NEW_TOKEN } });
    fireEvent.change(screen.getByPlaceholderText("e.g. Kitchen iPhone"), { target: { value: "Kitchen iPhone" } });
    fireEvent.click(screen.getByRole("button", { name: "Add device" }));
    expect(await screen.findByText("devices home")).toBeInTheDocument();
    expect(readDevices()[0]?.name).toBe("Kitchen iPhone");
    expect(readDevices()[0]?.barkKey).toBe(NEW_TOKEN);
  });

  it("rejects a token that is already added", () => {
    renderAdd();
    fireEvent.change(screen.getByPlaceholderText("Paste the device token"), { target: { value: TOKEN } });
    fireEvent.click(screen.getByRole("button", { name: "Add device" }));
    expect(screen.getByText("This token is already added.")).toBeInTheDocument();
  });
});
