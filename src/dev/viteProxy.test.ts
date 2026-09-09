import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

describe("vite captcha proxy", () => {
  it("routes /api/code and /api/send-code before the /api catch-all", () => {
    const source = readFileSync(join(repoRoot, "vite.config.ts"), "utf8");
    const codeIdx = source.indexOf('"/api/code"');
    const sendIdx = source.indexOf('"/api/send-code"');
    const catchIdx = source.indexOf('"/api":');
    expect(codeIdx).toBeGreaterThan(-1);
    expect(sendIdx).toBeGreaterThan(-1);
    expect(catchIdx).toBeGreaterThan(-1);
    expect(codeIdx).toBeLessThan(catchIdx);
    expect(sendIdx).toBeLessThan(catchIdx);
  });
});
