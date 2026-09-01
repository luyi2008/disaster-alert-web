import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequireSession } from "./RequireSession";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RequireSession", () => {
  it("renders children when a session exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ user: { id: "u1" } }),
      { status: 200 },
    )));
    render(
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes>
          <Route path="/login" element={<div>login</div>} />
          <Route path="/devices" element={<RequireSession><div>gated</div></RequireSession>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("gated")).toBeInTheDocument();
  });

  it("redirects to login without a session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("null", { status: 200 })));
    render(
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes>
          <Route path="/login" element={<div>login</div>} />
          <Route path="/devices" element={<RequireSession><div>gated</div></RequireSession>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("login")).toBeInTheDocument();
  });
});
