import { describe, expect, it } from "vitest";
import { extractBarkKey } from "./extractBarkKey";

const KEY = "ynJ5Ft4atkMkWeo2PAvFhF";

describe("extractBarkKey", () => {
  it("returns a raw 22-character key", () => {
    expect(extractBarkKey(KEY)).toBe(KEY);
    expect(extractBarkKey(`  ${KEY}  `)).toBe(KEY);
  });

  it("extracts the key from a standard test URL", () => {
    expect(extractBarkKey(`https://bark.mangguo.cloud/${KEY}/这是一条测试推送`)).toBe(KEY);
  });

  it("extracts the key from title/body and title/subtitle/body URLs", () => {
    expect(extractBarkKey(`https://api.day.app/${KEY}/标题/正文`)).toBe(KEY);
    expect(extractBarkKey(`https://api.day.app/${KEY}/标题/副标题/正文`)).toBe(KEY);
  });

  it("skips reserved path segments such as push", () => {
    expect(extractBarkKey(`https://bark.mangguo.cloud/push/${KEY}`)).toBe(KEY);
    expect(extractBarkKey(`https://bark.mangguo.cloud/bark/${KEY}/hello`)).toBe(KEY);
  });

  it("returns null for empty, short, long, or non-alphanumeric values", () => {
    expect(extractBarkKey("")).toBeNull();
    expect(extractBarkKey("   ")).toBeNull();
    expect(extractBarkKey("not-a-url")).toBeNull();
    expect(extractBarkKey("shortkey")).toBeNull();
    expect(extractBarkKey(`${KEY}xxxx`)).toBeNull();
    expect(extractBarkKey("https://bark.mangguo.cloud/short/hello")).toBeNull();
  });
});
