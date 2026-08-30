import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TermsDialog } from "./TermsDialog";
import { DRAFT_STORAGE_KEY, draftOmitsBarkKey } from "../api";
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

describe("subscription draft", () => {
  it("keeps login identity out of the draft blob", () => {
    expect(DRAFT_STORAGE_KEY).toBe("disaster_subscription_draft_v3");
    expect(BARK_KEY_STORAGE_KEY).toBe("disaster_bark_key");
    expect(draftOmitsBarkKey({ targets: [], alerts: [] })).toBe(true);
    expect(draftOmitsBarkKey({ barkKey: "abc" })).toBe(false);
  });
});
