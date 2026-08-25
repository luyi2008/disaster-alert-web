import { describe, expect, it } from "vitest";
import { escapeHtml } from "./html";
import { cleanApiMessage, httpFailureMessage, parseApiResponse, safeJson } from "./http";
import { createTarget, targetCoordinates, validateLocations } from "./geo";
import { createEmptyDraft, draftForStorage, restoreDraftFromStorage, writeDraft } from "./draft";
import { DRAFT_STORAGE_KEY, draftOmitsBarkKey } from "../api";

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

describe("draft storage", () => {
  it("omits bark keys from stored drafts", () => {
    const draft = createEmptyDraft();
    draft.bark_url = "https://bark.example";
    writeDraft(draft);
    const stored = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || "{}");
    expect(draftOmitsBarkKey(stored)).toBe(true);
    expect(draftForStorage(draft).bark_url).toBe("https://bark.example");
    expect(restoreDraftFromStorage().bark_url).toBe("https://bark.example");
  });
});
