import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesDir = dirname(fileURLToPath(import.meta.url));

describe("shadcn token contract", () => {
  it("exposes zinc semantic tokens including --ring", () => {
    const tokens = readFileSync(join(stylesDir, "tokens.css"), "utf8");
    for (const name of [
      "--background",
      "--foreground",
      "--card",
      "--primary",
      "--muted",
      "--muted-foreground",
      "--accent",
      "--destructive",
      "--border",
      "--input",
      "--ring",
    ]) {
      expect(tokens).toContain(`${name}:`);
    }
    expect(tokens).not.toContain("--bg:");
    expect(tokens).not.toContain("--text:");
    expect(tokens).not.toContain("--line:");
    expect(tokens).not.toContain("--panel:");
  });

  it("maps Tailwind ring to var(--ring)", () => {
    const theme = readFileSync(join(stylesDir, "tailwind.css"), "utf8");
    expect(theme).toContain("--color-ring: var(--ring);");
    expect(theme).toContain("--color-background: var(--background);");
    expect(theme).not.toContain("--color-ring: var(--primary);");
  });
});
