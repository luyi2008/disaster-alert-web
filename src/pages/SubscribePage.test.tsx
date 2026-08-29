import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SubscribePage } from "./SubscribePage";

describe("SubscribePage", () => {
  it("redirects to the entry page without a validated bark key", () => {
    render(
      <MemoryRouter initialEntries={["/subscribe"]}>
        <Routes>
          <Route path="/" element={<div>entry</div>} />
          <Route path="/subscribe" element={<SubscribePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("entry")).toBeInTheDocument();
  });
});
