import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesDir = dirname(fileURLToPath(import.meta.url));

describe("stylesheet isolation", () => {
  it("does not emit an unlayered global a { color } rule that paints shadcn link-buttons black", () => {
    const files = readdirSync(stylesDir).filter((name) => name.endsWith(".css"));
    const offenders: string[] = [];
    for (const name of files) {
      const css = readFileSync(join(stylesDir, name), "utf8");
      const withoutLayers = css.replace(/@layer[\s\w-]*\{[\s\S]*?\n\}/g, "");
      if (/(?:^|})\s*a\s*\{[^}]*\bcolor\s*:/m.test(withoutLayers)) {
        offenders.push(name);
      }
    }
    expect(offenders).toEqual([]);
  });
});
