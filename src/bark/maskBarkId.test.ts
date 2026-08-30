import { describe, expect, it } from "vitest";
import { maskBarkId } from "./maskBarkId";

describe("maskBarkId", () => {
  it("keeps Bark and the last three characters", () => {
    expect(maskBarkId("mDRtkLMRRcgrVNHM8xkS8W")).toBe("Bark · ••••S8W");
    expect(maskBarkId("ynJ5Ft4atkMkWeo2PAvFhF")).toBe("Bark · ••••FhF");
  });
});
