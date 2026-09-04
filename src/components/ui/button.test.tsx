import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  it("uses a pointer cursor so clickable controls do not look like static text", () => {
    expect(buttonVariants()).toContain("cursor-pointer");
    render(<Button>登录</Button>);
    expect(screen.getByRole("button", { name: "登录" })).toHaveClass("cursor-pointer");
  });
});
