import { describe, expect, it } from "vitest";
import { applyTheme, isThemePreference, persistThemePreference, readThemePreference, resolveTheme } from "./theme";

describe("theme", () => {
  it("accepts stored preferences", () => {
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
  });

  it("resolves system from matchMedia", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("system")).toBe("light");
  });

  it("applies and persists the dark class", () => {
    persistThemePreference("dark");
    expect(readThemePreference()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    persistThemePreference("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(applyTheme("system")).toBe("light");
    window.localStorage.removeItem("disaster-theme");
    document.documentElement.classList.remove("dark", "light");
  });
});
