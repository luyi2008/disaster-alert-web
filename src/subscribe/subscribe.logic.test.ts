import { describe, expect, it } from "vitest";
import { escapeHtml } from "./html";
import { cleanApiMessage, httpFailureMessage, parseApiResponse, safeJson } from "./http";
import { createTarget, targetCoordinates, validateLocations } from "./geo";
import { createEmptyDraft, canonicalDraft, draftFromSavedSubscription, draftSignature, selectSavedSubscription } from "./draft";
import type { SavedSubscription } from "./types";

const KEY = "ynJ5Ft4atkMkWeo2PAvFhF";

function sampleRow(overrides: Partial<SavedSubscription> = {}): SavedSubscription {
  return {
    destination: {
      type: "bark",
      base_url: "https://bark.mangguo.cloud",
      device_key: KEY,
    },
    targets: [{
      label: "天曜11号",
      point: { latitude: 30.6377, longitude: 104.1119 },
      region: { province: "四川省", city: "成都市", district: "锦江区" },
    }],
    alerts: [{
      category: "earthquake_warning",
      sources: { mode: "all" },
      estimated_intensity_bands: [{ min: 3, max: 7, interruption_level: "critical" }],
    }],
    updated_at: 1_788_160_120_826,
    ...overrides,
  };
}

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    expect(escapeHtml(`<script a="1" b='2'>`)).toBe("&lt;script a=&quot;1&quot; b=&#39;2&#39;&gt;");
  });
});

describe("http helpers", () => {
  it("rejects HTML error bodies", () => {
    expect(cleanApiMessage("<!doctype html><html>fail</html>")).toBe("");
  });

  it("maps gateway failures", () => {
    expect(httpFailureMessage({ ok: false, status: 502 } as Response)).toContain("暂时不可用");
  });

  it("parses json envelopes", async () => {
    const res = new Response(JSON.stringify({ success: true, message: "ok", data: { n: 1 } }), { status: 200 });
    await expect(parseApiResponse(res)).resolves.toMatchObject({ success: true, data: { n: 1 } });
  });

  it("returns null for invalid json", () => {
    expect(safeJson("{")).toBeNull();
  });
});

describe("locations", () => {
  it("rejects missing and duplicate coordinates", () => {
    const empty = createTarget();
    expect(validateLocations([empty])).toContain("尚未选择有效位置");
    const a = createTarget();
    a.point = { latitude: "35.0000", longitude: "139.0000" };
    const b = createTarget();
    b.point = { latitude: "35.0000", longitude: "139.0000" };
    expect(validateLocations([a, b])).toContain("坐标重复");
    expect(targetCoordinates(a)).toEqual({ latitude: 35, longitude: 139 });
  });
});

describe("saved subscription mapping", () => {
  it("selects the first saved row", () => {
    const first = sampleRow({
      destination: { type: "bark", base_url: "https://other.example", device_key: KEY },
    });
    const second = sampleRow();
    expect(selectSavedSubscription([first, second])?.destination?.base_url).toBe("https://other.example");
  });

  it("returns null when there are no rows", () => {
    expect(selectSavedSubscription([])).toBeNull();
    expect(selectSavedSubscription(undefined)).toBeNull();
  });

  it("maps numeric points to 4-decimal strings and enables payload alerts only", () => {
    const draft = draftFromSavedSubscription(sampleRow());
    expect(draft.targets).toHaveLength(1);
    expect(draft.targets[0].id).toEqual(expect.any(String));
    expect(draft.targets[0].point).toEqual({ latitude: "30.6377", longitude: "104.1119" });
    expect(draft.targets[0].region.city).toBe("成都市");
    expect(draft.alerts_by_category.earthquake_warning?.enabled).toBe(true);
    expect(draft.alerts_by_category.earthquake_report).toBeUndefined();
    expect(draft.bark_url).toBe("https://bark.mangguo.cloud");
  });

  it("keeps the destination base_url from the saved row", () => {
    const draft = draftFromSavedSubscription(sampleRow());
    expect(draft.bark_url).toBe("https://bark.mangguo.cloud");
  });

  it("canonicalizes the in-memory draft without a storage blob", () => {
    const draft = createEmptyDraft();
    draft.bark_url = "https://bark.example";
    const snapshot = canonicalDraft(draft);
    expect(snapshot.bark_url).toBe("https://bark.example");
    expect(snapshot).not.toHaveProperty("barkKey");
    expect(draftSignature(draft)).toBe(JSON.stringify(snapshot));
  });
});
