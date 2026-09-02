import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { writeAccount } from "../auth/session";
import { seedDevices, writeDevices } from "../devices/store";
import { DevicesPage } from "./DevicesPage";

afterEach(() => {
  localStorage.clear();
});

describe("DevicesPage", () => {
  it("lists seeded devices after sign-in", async () => {
    writeAccount({ method: "phone", label: "+8613800138000", phone: "+8613800138000" });
    writeDevices(seedDevices());
    render(
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes>
          <Route path="/devices" element={<DevicesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("iPhone 15 Pro")).toBeInTheDocument());
    expect(screen.getByText("Pixel 8")).toBeInTheDocument();
    expect(screen.getAllByText("Notification Subscription").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Test Notification").length).toBeGreaterThan(0);
  });
});
