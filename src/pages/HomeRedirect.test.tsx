import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeRedirect } from "./HomeRedirect";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<div>login</div>} />
        <Route path="/devices" element={<div>devices</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("HomeRedirect", () => {
  it("sends signed-in users to devices", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ user: { id: "u1" } }),
      { status: 200 },
    )));
    renderHome();
    expect(await screen.findByText("devices")).toBeInTheDocument();
  });

  it("sends signed-out users to login", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("null", { status: 200 })));
    renderHome();
    expect(await screen.findByText("login")).toBeInTheDocument();
  });
});
