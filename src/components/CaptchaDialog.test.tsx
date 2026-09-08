import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CaptchaDialog } from "./CaptchaDialog";

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32"><text>42</text></svg>`;

describe("CaptchaDialog", () => {
  it("asks for six digits instead of sending when confirm is pressed early", () => {
    const onConfirm = vi.fn();
    render(
      <CaptchaDialog
        open
        svg={SAMPLE_SVG}
        challengeKey="tok-1"
        loading={false}
        submitting={false}
        error={null}
        onOpenChange={() => {}}
        onRefresh={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "确认并发送" }));
    expect(screen.getByText("请输入图形验证码")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onRefresh from 换一张 and onOpenChange from 取消", () => {
    const onRefresh = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CaptchaDialog
        open
        svg={SAMPLE_SVG}
        challengeKey="tok-1"
        loading={false}
        submitting={false}
        error={null}
        onOpenChange={onOpenChange}
        onRefresh={onRefresh}
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "换一张" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
