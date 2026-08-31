import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TermsDialog } from "./TermsDialog";
import { BARK_KEY_STORAGE_KEY } from "../bark/session";

describe("TermsDialog", () => {
  it("hides when the instance has accepted terms", () => {
    const { container } = render(<TermsDialog open={false} />);
    expect(container.querySelector("#instance-terms-dialog")).toBeNull();
  });

  it("shows the instance terms copy when not accepted", () => {
    render(<TermsDialog open />);
    expect(screen.getByRole("dialog")).toHaveAttribute("id", "instance-terms-dialog");
    expect(screen.getByText(/INSTANCE_TERMS_ACCEPTED=true/)).toBeInTheDocument();
    expect(screen.getByText(/新增和覆盖订阅已在服务端禁用/)).toBeInTheDocument();
  });
});

describe("login identity storage", () => {
  it("keeps the Bark Key in its own session key", () => {
    expect(BARK_KEY_STORAGE_KEY).toBe("disaster_bark_key");
  });
});
