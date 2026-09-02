import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { readAccount } from "../auth/session";
import { LoginPage } from "./LoginPage";

afterEach(() => {
  localStorage.clear();
});

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/devices" element={<div>devices home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  it("validates the phone number before sending a code", () => {
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("138 0013 8000"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
    expect(screen.getByText("Please enter a valid phone number.")).toBeInTheDocument();
    expect(screen.queryByText("Confirm you are human")).toBeNull();
  });

  it("keeps a reserved error slot under the phone field before validation", () => {
    const { container } = renderLogin();
    const phoneField = screen.getByLabelText("手机号").closest(".ds-field");
    const message = phoneField?.querySelector(".ds-field-message");
    expect(message).not.toBeNull();
    expect(message).toBeEmptyDOMElement();
    expect(container.querySelector(".login-stack .ds-field .ds-field-message")).toBe(message);
  });

  it("asks for captcha, then sends a code and signs in", async () => {
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("138 0013 8000"), { target: { value: "13800138000" } });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
    expect(screen.getByText("Confirm you are human")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm you are human" }));
    expect(await screen.findByRole("button", { name: /\d+s/ }, { timeout: 4000 })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("请输入验证码"), { target: { value: "248193" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByText("devices home")).toBeInTheDocument();
    expect(readAccount()?.phone).toBe("+8613800138000");
  });
});
