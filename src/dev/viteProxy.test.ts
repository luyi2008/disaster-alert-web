import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

describe("vite captcha proxy", () => {
  it("routes /api/captcha before the /api catch-all", () => {
    const source = readFileSync(join(repoRoot, "vite.config.ts"), "utf8");
    const captchaIdx = source.indexOf('"/api/captcha"');
    const catchIdx = source.indexOf('"/api":');
    expect(captchaIdx).toBeGreaterThan(-1);
    expect(source).not.toContain('"/api/code"');
    expect(source).not.toContain('"/api/send-code"');
    expect(catchIdx).toBeGreaterThan(-1);
    expect(captchaIdx).toBeLessThan(catchIdx);
    expect(source).toContain('envPrefix: ["VITE_", "CAPTCHA_"]');
  });

  it("loads production CAPTCHA_ORIGIN from .env.production", () => {
    const envFile = readFileSync(join(repoRoot, ".env.production"), "utf8");
    expect(envFile).toMatch(/^CAPTCHA_ORIGIN=https:\/\/captcha\.mangguo\.cloud$/m);
    expect(envFile).not.toContain("CAPTCHA_BASE");
  });
});
