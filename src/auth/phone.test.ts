import { describe, expect, it } from "vitest";
import { formatNationalNumber, validateNationalNumber } from "./phone";

describe("phone validation", () => {
  it("accepts a mainland mobile number", () => {
    expect(validateNationalNumber("86", "138 0013 8000")).toBeNull();
  });

  it("rejects a short or landline-like CN number", () => {
    expect(validateNationalNumber("86", "12345")).toBe("Please enter a valid phone number.");
    expect(validateNationalNumber("86", "021 1234 5678")).toBe("Please enter a valid phone number.");
  });

  it("formats CN numbers in groups", () => {
    expect(formatNationalNumber("86", "13800138000")).toBe("138 0013 8000");
  });
});
