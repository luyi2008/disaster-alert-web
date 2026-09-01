import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TermsDialog } from "./TermsDialog";

describe("TermsDialog", () => {
  it("hides when the instance has accepted terms", () => {
    const { container } = render(<TermsDialog open={false} />);
    expect(container.querySelector("#instance-terms-dialog")).toBeNull();
  });

  it("shows the instance terms copy when not accepted", () => {
    render(<TermsDialog open />);
    expect(screen.getByRole("dialog")).toHaveAttribute("id", "instance-terms-dialog");
    expect(screen.getByText(/INSTANCE_TERMS_ACCEPTED=true/)).toBeInTheDocument();
    expect(screen.getByText(/新增和保存订阅已在服务端禁用/)).toBeInTheDocument();
  });
});

