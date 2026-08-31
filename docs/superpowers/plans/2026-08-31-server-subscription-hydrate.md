# Server Subscription Hydrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop persisting unsubmitted subscription drafts in `localStorage`; hydrate the subscribe page and test page from `GET /api/subscriptions` with `Authorization: Bearer <Bark Key>`.

**Architecture:** Pure mapper + row picker live in `src/subscribe/draft.ts`. HTTP lives in `src/api.ts` as `fetchSavedSubscriptions`. Subscribe app loads bark-urls and saved subscriptions in parallel, maps into the in-memory draft, then runs the existing `loadSubscriptionOptions` merge. Test page uses the same fetch and mapper for preview. No `removeItem` of old draft keys.

**Tech Stack:** Vite, TypeScript, React (test page), imperative subscribe DOM, Vitest, `parseApiResponse` / `maybeExpireBarkSession`.

## Global Constraints

- Do not read or write `disaster_subscription_draft_v3` or `disaster_subscription_draft_v2`.
- Do not call `localStorage.removeItem` for those keys.
- Do not request `/api/admin/subscriptions`.
- `GET /api/subscriptions` uses `Authorization: Bearer <Key>` only (no `device_key` query).
- `GET /api/bark-urls` and `GET /api/subscription-options` stay on disaster-alert (`/api`); never call Bark notification hosts for config.
- No subscription: HTTP 200 and `success: false` → empty UI, no error toast.
- Failed subscriptions GET must not block creating a new subscription (bark-urls + options still gate save).
- `disaster_bark_key` session behavior is unchanged.
- Do not rewrite subscribe DOM to React.

**Spec:** `docs/superpowers/specs/2026-08-31-server-subscription-hydrate-design.md`

**File map:**

| File | Role |
| --- | --- |
| `src/subscribe/types.ts` | `SavedSubscription` types |
| `src/subscribe/draft.ts` | Empty draft, signature, `selectSavedSubscription`, `draftFromSavedSubscription`; delete localStorage helpers |
| `src/api.ts` | `fetchSavedSubscriptions`; delete `DRAFT_STORAGE_KEY` / `draftOmitsBarkKey` |
| `src/subscribe/runtime.ts` | `barkUrls: string[]`; remove `persistTimer` |
| `src/subscribe/subscribeApp.ts` | Hydrate, status-only persist, unsubscribe copy |
| `src/pages/TestPage.tsx` | Preview from GET |
| Tests listed per task | TDD |
| `docs/openapi.yaml`, `docs/architecture.md`, `docs/subscribe-frontend.md`, `docs/bark-key-session-prd.md` | Contract + architecture |

`GET /api/subscription-options` runs **after** the draft is mapped so the existing merge sees saved `alerts_by_category`. bark-urls and subscriptions stay parallel.

---

### Task 1: Mapper and row picker

**Files:**
- Modify: `src/subscribe/types.ts`
- Modify: `src/subscribe/draft.ts`
- Modify: `src/subscribe/subscribe.logic.test.ts`

**Interfaces:**
- Consumes: `createEmptyDraft`, `createTarget`, `AlertRuleDraft`, `SubscriptionDraft`
- Produces:
  - `SavedDestination`, `SavedSubscriptionTarget`, `SavedSubscription`
  - `selectSavedSubscription(subscriptions: SavedSubscription[] | undefined, deviceKey: string, barkUrls: string[]): SavedSubscription | null`
  - `draftFromSavedSubscription(row: SavedSubscription, barkUrls: string[]): SubscriptionDraft`
  - `canonicalDraft(draft: SubscriptionDraft): SubscriptionDraft` (rename of `draftForStorage`)
  - `draftSignature(draft: SubscriptionDraft): string`

- [ ] **Step 1: Write the failing tests**

Replace the `draft storage` describe in `src/subscribe/subscribe.logic.test.ts` with:

```typescript
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

describe("saved subscription mapping", () => {
  it("selects the row for the session key and prefers a whitelisted base_url", () => {
    const other: SavedSubscription = sampleRow({
      destination: { type: "bark", base_url: "https://other.example", device_key: KEY },
    });
    const preferred = sampleRow();
    const chosen = selectSavedSubscription(
      [other, preferred],
      KEY,
      ["https://bark.mangguo.cloud"],
    );
    expect(chosen?.destination?.base_url).toBe("https://bark.mangguo.cloud");
  });

  it("returns null when success payload has no matching key", () => {
    expect(selectSavedSubscription([sampleRow()], "otherKeyotherKeyother12", ["https://bark.mangguo.cloud"])).toBeNull();
    expect(selectSavedSubscription([], KEY, [])).toBeNull();
    expect(selectSavedSubscription(undefined, KEY, [])).toBeNull();
  });

  it("maps numeric points to 4-decimal strings and enables payload alerts only", () => {
    const draft = draftFromSavedSubscription(sampleRow(), ["https://bark.mangguo.cloud"]);
    expect(draft.targets).toHaveLength(1);
    expect(draft.targets[0].id).toEqual(expect.any(String));
    expect(draft.targets[0].point).toEqual({ latitude: "30.6377", longitude: "104.1119" });
    expect(draft.targets[0].region.city).toBe("成都市");
    expect(draft.alerts_by_category.earthquake_warning?.enabled).toBe(true);
    expect(draft.alerts_by_category.earthquake_report).toBeUndefined();
    expect(draft.bark_url).toBe("https://bark.mangguo.cloud");
  });

  it("falls back to the first whitelist URL when destination is not listed", () => {
    const draft = draftFromSavedSubscription(sampleRow(), ["https://api.day.app"]);
    expect(draft.bark_url).toBe("https://api.day.app");
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
```

Keep existing `escapeHtml`, http, and locations describes. Remove imports of `writeDraft`, `restoreDraftFromStorage`, `DRAFT_STORAGE_KEY`, `draftOmitsBarkKey`, `draftForStorage`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/subscribe/subscribe.logic.test.ts`

Expected: FAIL — `selectSavedSubscription` / `draftFromSavedSubscription` / `canonicalDraft` are not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `src/subscribe/types.ts` (after `AlertRuleDraft`):

```typescript
export type SavedDestination = {
  type?: string;
  base_url?: string;
  device_key?: string;
};

export type SavedSubscriptionTarget = {
  label?: string;
  point?: { latitude?: unknown; longitude?: unknown };
  region?: { province?: string; city?: string; district?: string };
};

export type SavedSubscription = {
  destination?: SavedDestination;
  targets?: SavedSubscriptionTarget[];
  alerts?: AlertRuleDraft[];
  created_at?: number;
  updated_at?: number;
};

export type SavedSubscriptionsData = {
  subscriptions?: SavedSubscription[];
};
```

Replace `src/subscribe/draft.ts` with:

```typescript
import { cloneTarget, createTarget, validCoordinate } from "./geo";
import type { AlertEntry, AlertRuleDraft, SavedSubscription, SubscriptionDraft } from "./types";

export function createEmptyDraft(): SubscriptionDraft {
  return {
    schema_version: 3,
    bark_url: "",
    targets: [],
    alerts_by_category: {},
  };
}

export function canonicalDraft(draft: SubscriptionDraft): SubscriptionDraft {
  return {
    schema_version: 3,
    bark_url: draft.bark_url,
    targets: draft.targets.map((target) => cloneTarget(target)),
    alerts_by_category: JSON.parse(JSON.stringify(draft.alerts_by_category)) as Record<string, AlertEntry>,
  };
}

export function draftSignature(draft: SubscriptionDraft): string {
  return JSON.stringify(canonicalDraft(draft));
}

export function selectSavedSubscription(
  subscriptions: SavedSubscription[] | undefined,
  deviceKey: string,
  barkUrls: string[],
): SavedSubscription | null {
  const list = Array.isArray(subscriptions) ? subscriptions : [];
  const byKey = list.filter((row) => row.destination?.device_key === deviceKey);
  if (!byKey.length) {
    return null;
  }
  const allow = new Set(barkUrls);
  const preferred = byKey.filter((row) => (
    typeof row.destination?.base_url === "string" && allow.has(row.destination.base_url)
  ));
  return preferred[0] || byKey[0];
}

function formatCoord(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(4) : "";
}

export function draftFromSavedSubscription(row: SavedSubscription, barkUrls: string[]): SubscriptionDraft {
  const draft = createEmptyDraft();
  const base = row.destination?.base_url;
  draft.bark_url = typeof base === "string" && barkUrls.includes(base)
    ? base
    : (barkUrls[0] || "");
  const sourceTargets = Array.isArray(row.targets) ? row.targets : [];
  draft.targets = sourceTargets.slice(0, 3).map((target) => {
    const created = createTarget();
    const lat = Number(target.point?.latitude);
    const lon = Number(target.point?.longitude);
    const pointOk = validCoordinate(lat, lon);
    return {
      id: created.id,
      label: String(target.label || ""),
      point: {
        latitude: pointOk ? formatCoord(lat) : "",
        longitude: pointOk ? formatCoord(lon) : "",
      },
      region: {
        province: String(target.region?.province || ""),
        city: String(target.region?.city || ""),
        district: String(target.region?.district || ""),
      },
    };
  });
  const alerts = Array.isArray(row.alerts) ? row.alerts : [];
  draft.alerts_by_category = {};
  for (const alert of alerts) {
    if (!alert || typeof alert !== "object" || typeof alert.category !== "string" || !alert.category) {
      continue;
    }
    draft.alerts_by_category[alert.category] = {
      enabled: true,
      rule: JSON.parse(JSON.stringify(alert)) as AlertRuleDraft,
    };
  }
  return draft;
}
```

Do not import `DRAFT_STORAGE_KEY`. Do not touch localStorage.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/subscribe/subscribe.logic.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/subscribe/types.ts src/subscribe/draft.ts src/subscribe/subscribe.logic.test.ts
git commit -m "feat: map GET /api/subscriptions rows into in-memory drafts"
```

---

### Task 2: Fetch helper and drop storage key exports

**Files:**
- Modify: `src/api.ts`
- Modify: `src/components/TermsDialog.test.tsx`
- Test: add fetch tests in `src/subscribe/subscribe.logic.test.ts` **or** a small `src/api.subscriptions.test.ts` (prefer `src/api.subscriptions.test.ts` so fetch mocking stays isolated)

**Interfaces:**
- Consumes: `apiUrl`, `parseApiResponse`, `SavedSubscriptionsData`
- Produces: `fetchSavedSubscriptions(barkKey: string): Promise<{ status: number; body: ApiEnvelope<SavedSubscriptionsData> }>`

- [ ] **Step 1: Write the failing test**

Create `src/api.subscriptions.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSavedSubscriptions } from "./api";

const KEY = "ynJ5Ft4atkMkWeo2PAvFhF";

describe("fetchSavedSubscriptions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GETs /api/subscriptions with a Bearer header and keeps success: false", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ success: false, message: "没有订阅" }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchSavedSubscriptions(KEY);
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/subscriptions");
    expect(String(url)).not.toContain("device_key=");
    expect(new Headers((init as RequestInit).headers).get("Authorization")).toBe(`Bearer ${KEY}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api.subscriptions.test.ts`

Expected: FAIL — `fetchSavedSubscriptions` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/api.ts`:

- Import `parseApiResponse` from `./subscribe/http` and `SavedSubscriptionsData` from `./subscribe/types`.
- Delete `DRAFT_STORAGE_KEY` and `draftOmitsBarkKey`.
- Add:

```typescript
export async function fetchSavedSubscriptions(
  barkKey: string,
): Promise<{ status: number; body: ApiEnvelope<SavedSubscriptionsData> }> {
  const response = await fetch(apiUrl("/api/subscriptions"), {
    headers: { Authorization: `Bearer ${barkKey}` },
  });
  const body = await parseApiResponse(response) as ApiEnvelope<SavedSubscriptionsData>;
  return { status: response.status, body };
}
```

In `src/components/TermsDialog.test.tsx`, replace the `subscription draft` describe with:

```typescript
describe("login identity storage", () => {
  it("keeps the Bark Key in its own session key", () => {
    expect(BARK_KEY_STORAGE_KEY).toBe("disaster_bark_key");
  });
});
```

Remove `DRAFT_STORAGE_KEY` / `draftOmitsBarkKey` imports.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/api.subscriptions.test.ts src/components/TermsDialog.test.tsx src/subscribe/subscribe.logic.test.ts`

Expected: PASS. If other files still import `DRAFT_STORAGE_KEY`, they fail at load — fix those imports only by deleting the draft-key usage (later tasks own subscribeApp/TestPage, but tests that import the key will break the suite). Temporarily leave subscribeApp tests compiling: if `DRAFT_STORAGE_KEY` import breaks `subscribeApp.test.ts` / `TestPage.test.tsx`, comment those `localStorage.setItem(DRAFT_STORAGE_KEY, ...)` blocks out in the **same commit** by removing the seed (submit tests will fail until Task 3 hydrates — **do not** leave the repo untestable).

If `subscribeApp.test.ts` still needs a target for POST, skip changing it until Task 3 except the import: change `import { DRAFT_STORAGE_KEY }` to stop using it and **expect submit without a server row to not include leftover localStorage targets** (those tests currently depend on storage). In Task 2 commit, update `subscribeApp.test.ts` and `TestPage.test.tsx` imports so `npx vitest run` still typechecks: delete `DRAFT_STORAGE_KEY` import and the `localStorage.setItem` draft blobs. Tests that required seeded targets will fail until Task 3 — that is the red they need, **or** fold Task 2+3 if the suite cannot stay green.

**Do this instead so each task stays green:** keep `DRAFT_STORAGE_KEY` as a deprecated unused export until Task 3/4 delete it, **or** update subscribe/test page tests in Task 3/4 **before** deleting the export. **Chosen approach:** delete the export in Task 2 and immediately update the two test files to stop referencing it; accept that submit-with-targets cases fail until Task 3 adds `GET /api/subscriptions` mocks (run only `src/api.subscriptions.test.ts src/components/TermsDialog.test.tsx src/subscribe/subscribe.logic.test.ts` in this task’s verify step).

- [ ] **Step 5: Commit**

```bash
git add src/api.ts src/api.subscriptions.test.ts src/components/TermsDialog.test.tsx
git commit -m "feat: fetch GET /api/subscriptions with Bearer auth"
```

---

### Task 3: Hydrate subscribe app from the server

**Files:**
- Modify: `src/subscribe/runtime.ts`
- Modify: `src/subscribe/subscribeApp.ts`
- Modify: `src/subscribe/subscribeApp.test.ts`

**Interfaces:**
- Consumes: `fetchSavedSubscriptions`, `selectSavedSubscription`, `draftFromSavedSubscription`, `draftSignature`, `maybeExpireBarkSession(..., "bearer")`
- Produces: in-memory hydrate; `persistDraft` = `updateDraftStatus` only; `ctx.barkUrls: string[]`

- [ ] **Step 1: Write / update failing tests in `subscribeApp.test.ts`**

1. Remove `DRAFT_STORAGE_KEY` import and all `localStorage.setItem` draft blobs.
2. Extend `stubSubscribeFetches` (and the custom fetch stubs in the 502 tests) so `url.includes("/api/subscriptions")` returns:

```typescript
return jsonResponse({
  subscriptions: [{
    destination: { type: "bark", base_url: FIRST_URL, device_key: KEY },
    targets: [{
      label: "home",
      point: { latitude: 35, longitude: 139 },
      region: { province: "", city: "", district: "" },
    }],
    alerts: [],
  }],
});
```

For a **no subscription** case (new test):

```typescript
it("does not treat 200 success:false as a load error", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/subscriptions")) {
      return new Response(JSON.stringify({ success: false, message: "没有订阅" }), { status: 200 });
    }
    if (url.includes("/api/bark-urls")) return jsonResponse({ bark_urls: [FIRST_URL] });
    if (url.includes("/api/subscription-options")) return jsonResponse({ categories: [simpleCategory] });
    if (url.includes("/api/status")) return jsonResponse({ instance_terms_accepted: true, total_subscriptions: 0 });
    return jsonResponse({});
  }));
  const host = document.createElement("div");
  fillHost(host);
  document.body.append(host);
  const app = mountSubscribeApp(host, { api: "", instanceTermsAccepted: true, deviceKey: KEY });
  const submit = host.querySelector("#submit") as HTMLButtonElement;
  await vi.waitFor(() => expect(submit.disabled).toBe(false));
  expect(host.textContent).not.toContain("无法加载已保存的订阅");
  app.teardown();
});
```

3. Existing submit test: after hydrate, `requestSubmit` body `targets[0].point` is `{ latitude: 35, longitude: 139 }` (numbers) and `destination.base_url` is `FIRST_URL`. Assert the subscriptions request used `Authorization: Bearer ${KEY}` and the URL has no `device_key=`.

4. 401 on subscriptions: mock 401, `/check` unregistered, expect `onInvalidBarkKey`.

- [ ] **Step 2: Run `npx vitest run src/subscribe/subscribeApp.test.ts`**

Expected: FAIL — app still reads localStorage / never GETs `/api/subscriptions`.

- [ ] **Step 3: Implement**

`runtime.ts`: add `barkUrls: string[]` (init `[]`). Remove `persistTimer`.

`subscribeApp.ts`:

- Import `fetchSavedSubscriptions` from `../api`, `selectSavedSubscription`, `draftFromSavedSubscription`, `draftSignature` from `./draft`. Remove `restoreDraftFromStorage`, `writeDraft`, `incompleteTarget`, `cloneTarget`.
- `persistDraft` only calls `updateDraftStatus()`. Delete `flushDraft` and persist timer cleanup.
- `loadBarkUrls`: store full list in `ctx.barkUrls`, set `ctx.barkUrl` and `ctx.subscriptionDraft.bark_url` to the first URL (same as now if no saved row).
- `initializeConfiguration`:

```typescript
function applySavedSubscription(
  status: number,
  body: { success: boolean; message: string; data?: { subscriptions?: import("./types").SavedSubscription[] } },
): "expired" | "ok" {
  return "ok"; // real body below
}

function initializeConfiguration(): Promise<void> {
  const generation = ++ctx.initializationGeneration;
  ctx.configurationReady = false;
  setSubscriptionRequestInFlight(false);
  return Promise.all([
    loadBarkUrls(generation),
    fetchSavedSubscriptions(ctx.deviceKey),
  ]).then(async ([, saved]) => {
    if (generation !== ctx.initializationGeneration) return;
    if (await maybeExpireBarkSession(ctx.deviceKey, saved.status, "bearer")) {
      options.onInvalidBarkKey?.();
      return;
    }
    if (saved.status === 200 && saved.body.success) {
      const row = selectSavedSubscription(
        saved.body.data?.subscriptions,
        ctx.deviceKey,
        ctx.barkUrls,
      );
      if (row) {
        const mapped = draftFromSavedSubscription(row, ctx.barkUrls);
        ctx.subscriptionDraft = mapped;
        if (mapped.bark_url) ctx.barkUrl = mapped.bark_url;
      }
    } else if (saved.status !== 200) {
      toast.show(saved.body.message || "无法加载已保存的订阅", "error");
    }
    await alerts.loadSubscriptionOptions(ctx.subscriptionDraft, generation);
    if (generation !== ctx.initializationGeneration) return;
    ctx.configurationReady = true;
    setSubscriptionRequestInFlight(false);
    locations.renderLocations();
    locations.fitTargetMarkers();
    if (ctx.lastSubmittedSignature === "" && ctx.subscriptionDraft.targets.length) {
      ctx.lastSubmittedSignature = draftSignature(ctx.subscriptionDraft);
      ctx.lastSubmittedIdentity = currentDestinationIdentity();
    }
    updateDraftStatus();
    toast.dismissPersistentToasts();
  }).catch((error: { message?: string }) => {
    if (generation !== ctx.initializationGeneration) return;
    ctx.configurationReady = false;
    setSubscriptionRequestInFlight(false);
    toast.show(error.message || "无法加载订阅配置", "error");
  });
}
```

Only set `lastSubmittedSignature` when a row was applied (targets or alerts from server). Empty `success: false` leaves signature `""`.

- Remove mount-time `restoreDraftFromStorage` / incomplete editing. After `bindLocations`, `renderLocations()` / `renderLocationEditor()` then `initializeConfiguration()` (locations re-render after hydrate as above).
- Unsubscribe confirm: `"确定删除该 Bark 服务与 Key 对应的服务端订阅？"`. Success toast: `"已删除服务端订阅"`.

`200` + `success: false` must not toast.

- [ ] **Step 4: Run** `npx vitest run src/subscribe/subscribeApp.test.ts src/subscribe/subscribe.logic.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/subscribe/runtime.ts src/subscribe/subscribeApp.ts src/subscribe/subscribeApp.test.ts
git commit -m "feat: hydrate subscribe form from GET /api/subscriptions"
```

---

### Task 4: Test page preview from the same GET

**Files:**
- Modify: `src/pages/TestPage.tsx`
- Modify: `src/pages/TestPage.test.tsx`
- Modify: `src/simulate/subscriptionPreview.ts` only if `formatDraftUpdatedAt` stays (keep it; pass `updated_at`)

**Interfaces:**
- Consumes: `fetchSavedSubscriptions`, `selectSavedSubscription`, `draftFromSavedSubscription`
- Produces: Test page preview of server targets/rules; empty copy without “本浏览器草稿”

- [ ] **Step 1: Failing tests**

In `TestPage.test.tsx`:

- Remove `DRAFT_STORAGE_KEY` import and localStorage draft fixture.
- In `stubApis`, handle `/api/subscriptions` (default: sample Shanghai row + warning alert, `updated_at: 1_700_000_000_000`).
- `"previews draft subscription fields..."` → expect `GET` with Bearer, chips `上海家中 · 上海市 · 浦东新区`, no “本浏览器还没有订阅草稿”.
- New test: subscriptions `200` `{ success: false }` → `尚未选择地点`, `尚未配置规则`, text matching `/请先.*订阅页保存/` (final copy: `模拟接口只认本实例已保存的订阅，请先回到订阅页保存。` — drop the “本浏览器还没有订阅草稿。” sentence).

- [ ] **Step 2: Run** `npx vitest run src/pages/TestPage.test.tsx`

Expected: FAIL — still empty / still reading storage.

- [ ] **Step 3: Implement `TestPage.tsx`**

- Remove `restoreDraftFromStorage` / `readDraftUpdatedAt`.
- State: `draft` starts as `createEmptyDraft()`, `draftUpdatedAt: number | null`.
- In the existing `useEffect` with `fetchBarkUrls` + `fetchSubscriptionOptions`, also `fetchSavedSubscriptions(barkKey)`.
- On 401: `maybeExpireBarkSession(barkKey, status, "bearer")` then `navigate("/", { replace: true })` (same as simulate).
- On 200 success true: `selectSavedSubscription` + `draftFromSavedSubscription`; `setDraft`; `setDraftUpdatedAt(row.updated_at ?? null)`; `setBarkUrl` prefer mapped `bark_url` then `urls[0]`.
- On 200 success false: leave empty draft; no `setLoadError`.
- On other errors: `setLoadError` for preview; still set levels from options if that fetch succeeded.
- Replace empty note: only `模拟接口只认本实例已保存的订阅，请先回到订阅页保存。` when `!hasDraftContent`.
- Footer still `上次更新 {formatDraftUpdatedAt(draftUpdatedAt)}`.

- [ ] **Step 4: Run** `npx vitest run src/pages/TestPage.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/TestPage.tsx src/pages/TestPage.test.tsx
git commit -m "feat: preview saved subscription on the test page from GET /api/subscriptions"
```

---

### Task 5: Docs and leftover references

**Files:**
- Modify: `docs/openapi.yaml`
- Modify: `docs/architecture.md` (diagram `draft.ts localStorage`, §4.4, localStorage security row, test list)
- Modify: `docs/subscribe-frontend.md` (`draft.ts` row, persistTimer teardown line)
- Modify: `docs/bark-key-session-prd.md` (storage table)

**Interfaces:** none (docs only)

- [ ] **Step 1: OpenAPI**

Insert after `/api/unsubscribe` in `docs/openapi.yaml`:

```yaml
  /api/subscriptions:
    get:
      tags: [Subscriptions]
      operationId: listSubscriptions
      summary: 读取当前 Bark Key 的已保存订阅
      description: |
        使用 `Authorization: Bearer` 识别设备。不要把 Key 放在 query 中。
        无订阅时仍返回 HTTP 200 且 `success: false`。
      security:
        - barkBearer: []
      responses:
        "200":
          description: |
            `success: true` 时 `data.subscriptions` 为订阅数组；
            `success: false` 表示该 Key 没有订阅。
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ListSubscriptionsApiResponse"
        "401":
          description: 缺少或无效的 Bearer Bark Key
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "500":
          $ref: "#/components/responses/InternalServerError"
```

Add schema `ListSubscriptionsApiResponse` with `success`, `message`, optional `data.subscriptions` array items containing `destination` (`BarkDestination` but `device_key` not writeOnly for this read model — duplicate a `BarkDestinationView` with readable `device_key` if `writeOnly` would strip it from the snapshot). Prefer a `SavedSubscription` schema: `destination` (type, base_url, device_key), `targets` (`MonitoringTarget`), `alerts` (`AlertRule`), `created_at`, `updated_at`.

Do not document `/api/admin/subscriptions` in this change.

- [ ] **Step 2: Prose docs**

Replace architecture §4.4 localStorage draft with server hydrate + in-memory edits; mention leftover v3 keys are ignored, not deleted. Update mermaid `draft.ts` label. `subscribe-frontend.md`: `draft.ts` maps server rows; teardown no `persistTimer`. PRD table: only `disaster_bark_key`.

Grep the repo for `disaster_subscription_draft`, `DRAFT_STORAGE_KEY`, `writeDraft`, `restoreDraftFromStorage`, `draftForStorage`, `draftOmitsBarkKey`, `persistTimer`, `本浏览器还没有订阅草稿`, `浏览器配置草稿` and fix stragglers.

- [ ] **Step 3: Run full verification**

Run: `npx vitest run && npx oxlint && npm run build`

Expected: tests pass, lint clean enough for touched files, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add docs src
git commit -m "docs: describe GET /api/subscriptions hydrate and drop local draft storage"
```

---

## Self-review

1. **Spec coverage:** Mapper, Bearer GET, 200 `success: false`, no admin URL, no `removeItem`, subscribe + test pages, persist in memory only, unsubscribe copy, 401 bearer, failed GET does not block save, docs — all have tasks. Options fetch after map (not three-way parallel) is called out so merge stays correct.
2. **Placeholders:** None intended; OpenAPI schema names are specified.
3. **Types:** `SavedSubscription` / `fetchSavedSubscriptions` / `selectSavedSubscription` / `draftFromSavedSubscription` / `canonicalDraft` used consistently.
