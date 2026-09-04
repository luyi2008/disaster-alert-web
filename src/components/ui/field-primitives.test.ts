import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...walkTsx(path));
      continue;
    }
    if (name.endsWith(".tsx") && !name.endsWith(".test.tsx")) out.push(path);
  }
  return out;
}

describe("field primitives", () => {
  it("keeps raw input and select inside src/components/ui", () => {
    const offenders: string[] = [];
    for (const path of walkTsx(srcDir)) {
      const rel = relative(srcDir, path).replaceAll("\\", "/");
      if (rel.startsWith("components/ui/")) continue;
      const source = readFileSync(path, "utf8");
      if (/<(input|select)\b/.test(source)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
