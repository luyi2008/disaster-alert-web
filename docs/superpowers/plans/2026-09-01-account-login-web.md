# Account Login Web Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bark Key login on `disaster-alert-web` with BFF session cookie pages from spec §5, and point subscribe/test at BFF device routes (spec §10 step 3).

**Architecture:** Session is `GET /api/auth/get-session` with `credentials: "include"`. `/` redirects by session. `/login` does phone OTP and WeChat mock. `/devices` binds 22-character tokens. Subscribe and test live under `/devices/:id/...` and call `/api/devices/:id/*` without sending Bark tokens. Incident deep links stay public. Vite splits BFF vs Rust proxies.

**Tech Stack:** React 19, react-router-dom 7, Vite 8, Vitest, Testing Library, existing `tokens.css` / `entry.css` / `subscribe.css`.

**Spec:** `docs/superpowers/specs/2026-09-01-account-login-design.md` (copied from `luyi2008/disaster-alert`). BFF contracts from `luyi2008/disaster-alert-bff` README + route tests.

## Global Constraints

- Login identity is the BFF HttpOnly cookie. Do not write or read `disaster_bark_key` as login.
- Do not parse Bark test URLs. Token bind is 22 alphanumeric characters only.
- Do not request `/api/bark-urls`. Do not send `Authorization: Bearer <bark token>` from the browser.
- Browser subscribe body is `{ targets, alerts }` only. BFF fills `destination`.
- `:id` is the BFF device UUID. Other users' devices → treat as 404 and return to `/devices`.
- Cookie 401 on business pages → `/login`. Incident routes do not require session.
- Copy: 「设备 / Bark token」, not 「Bark Key 登录」.
- Top bar: logged-in state + current device name; 换设备 → `/devices`; 登出 → `/login`.
- Mock WeChat: ticket + 「模拟确认」. Mock OTP code `000000` when BFF `AUTH_MOCK=true`.
- Mainland phone: 11 digits matching `1[3-9]\d{9}` (optional `+86`). Invalid numbers do not send OTP.
- Keep subscribe workspace as imperative DOM; do not rewrite it to React.
- Credentials: every BFF `fetch` uses `credentials: "include"`.
- History catalog `GET /api/history` stays on Rust (public). Simulate goes through BFF.

## File map

| File | Role |
| --- | --- |
| `src/auth/phone.ts` | Mainland phone normalize |
| `src/auth/session.ts` | `getSession`, `signOut`, session types |
| `src/auth/RequireSession.tsx` | Gate business routes |
| `src/api.ts` | `bffFetch`, devices, device subscription, settings |
| `src/pages/LoginPage.tsx` | OTP + WeChat mock |
| `src/pages/HomeRedirect.tsx` | `/` → devices or login |
| `src/pages/DevicesPage.tsx` | List / bind / rename / unbind |
| `src/pages/SettingsPage.tsx` | Link phone / mock WeChat |
| `src/pages/SubscribePage.tsx` | `/devices/:id/subscribe` |
| `src/pages/TestPage.tsx` | `/devices/:id/subscribe/test` |
| `src/subscribe/subscribeApp.ts` | Device-id BFF subscribe/unsubscribe/hydrate |
| `src/subscribe/draft.ts` | Pick first saved row (no bark-url whitelist) |
| `src/components/DeviceIdentity.tsx` | Device name, switch device, logout |
| `src/App.tsx` | New routes |
| `vite.config.ts` | Proxy `/api/auth` `/api/devices` `/api/settings` → BFF 30012 |
| `src/simulate/client.ts` | Device simulate via BFF; history without Bearer |
| Docs listed in Task 8 | README / architecture / PRD |

BFF HTTP used by this plan (all cookie session unless noted):

- `POST /api/auth/phone-number/send-otp` `{ phoneNumber }`
- `POST /api/auth/phone-number/verify` `{ phoneNumber, code }`
- `GET /api/auth/get-session` → `{ user: { id, name, phoneNumber? } }` or `null`
- `POST /api/auth/sign-out`
- `POST /api/auth/mock/wechat/ticket` → `{ success, data: { ticketId } }`
- `POST /api/auth/mock/wechat/confirm` `{ ticketId }` (Set-Cookie)
- `GET /api/devices` → `{ success, data: { devices: [{ id, userId, name, createdAt, updatedAt }] } }`
- `POST /api/devices` `{ token }` 400/409/503 as BFF messages
- `PATCH /api/devices/:id` `{ name }`
- `DELETE /api/devices/:id`
- `POST /api/devices/:id/subscribe` `{ targets, alerts }`
- `DELETE /api/devices/:id/subscribe`
- `GET /api/devices/:id/subscription`
- `POST /api/devices/:id/simulate`
- `POST /api/settings/phone/send-otp` / `verify`
- `POST /api/settings/mock/wechat/confirm` `{ openid }`
- Still Rust: `/api/status`, `/api/subscription-options`, `/api/reverse-geocode`, `/api/incidents/...`, `/api/history`, `/health`

---

### Task 1: Phone helper and session client

**Files:**
- Create: `src/auth/phone.ts`
- Create: `src/auth/phone.test.ts`
- Create: `src/auth/session.ts`
- Create: `src/auth/session.test.ts`
- Modify: `src/api.ts`

**Interfaces:**
- Produces:
  - `normalizeMainlandPhone(raw: string): string | null`
  - `type AuthUser = { id: string; name?: string | null; phoneNumber?: string | null }`
  - `type AuthSession = { user: AuthUser } | null`
  - `getSession(): Promise<AuthSession>`
  - `signOut(): Promise<void>`
  - `bffJson<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }>` with `credentials: "include"`

- [ ] **Step 1: Write failing tests**

`src/auth/phone.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { normalizeMainlandPhone } from "./phone";

describe("normalizeMainlandPhone", () => {
  it("accepts 11-digit mainland numbers", () => {
    expect(normalizeMainlandPhone("13812345678")).toBe("+8613812345678");
    expect(normalizeMainlandPhone("+8613812345678")).toBe("+8613812345678");
  });

  it("rejects invalid numbers", () => {
    expect(normalizeMainlandPhone("138")).toBeNull();
    expect(normalizeMainlandPhone("12345678901")).toBeNull();
  });
});
```

`src/auth/session.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSession, signOut } from "./session";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getSession", () => {
  it("returns the user when Better Auth has a session", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain("/api/auth/get-session");
      expect(init?.credentials).toBe("include");
      return new Response(JSON.stringify({ user: { id: "u1", name: "微信用户" } }), { status: 200 });
    }));
    await expect(getSession()).resolves.toEqual({ user: { id: "u1", name: "微信用户" } });
  });

  it("returns null when the body has no user", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("null", { status: 200 })));
    await expect(getSession()).resolves.toBeNull();
  });
});

describe("signOut", () => {
  it("POSTs /api/auth/sign-out with credentials", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await signOut();
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/api/auth/sign-out");
    expect(fetchMock.mock.calls[0]![1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[0]![1]?.credentials).toBe("include");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL** (modules missing)

Run: `npx vitest run src/auth/phone.test.ts src/auth/session.test.ts`

- [ ] **Step 3: Implement**

`src/auth/phone.ts`:

```typescript
const MAINLAND = /^(?:\+86)?(1[3-9]\d{9})$/;

export function normalizeMainlandPhone(raw: string): string | null {
  const match = MAINLAND.exec(raw.trim());
  return match ? `+86${match[1]}` : null;
}
```

`src/auth/session.ts`:

```typescript
import { apiUrl } from "../api";

export type AuthUser = {
  id: string;
  name?: string | null;
  phoneNumber?: string | null;
};

export type AuthSession = { user: AuthUser } | null;

export async function bffFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), { ...init, credentials: "include" });
}

export async function getSession(): Promise<AuthSession> {
  const response = await bffFetch("/api/auth/get-session");
  if (!response.ok) {
    return null;
  }
  const body = await response.json() as { user?: AuthUser } | null;
  if (!body || typeof body !== "object" || !body.user || typeof body.user.id !== "string") {
    return null;
  }
  return { user: body.user };
}

export async function signOut(): Promise<void> {
  await bffFetch("/api/auth/sign-out", { method: "POST" });
}
```

Keep `apiUrl` in `src/api.ts`. Do not add `bffFetch` to `api.ts` if it lives in `session.ts`.

- [ ] **Step 4: Tests pass**

Run: `npx vitest run src/auth/phone.test.ts src/auth/session.test.ts`

- [ ] **Step 5: Commit** `Add BFF session and mainland phone helpers.`

---

### Task 2: Device and subscribe BFF client

**Files:**
- Modify: `src/api.ts`
- Modify: `src/api.subscriptions.test.ts`
- Create: `src/api.devices.test.ts`

**Interfaces:**
- Produces:

```typescript
export type DeviceRecord = {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export async function fetchDevices(): Promise<{ status: number; body: ApiEnvelope<{ devices: DeviceRecord[] }> }>;
export async function bindDevice(token: string): Promise<{ status: number; body: ApiEnvelope<{ device: DeviceRecord }> }>;
export async function renameDevice(id: string, name: string): Promise<{ status: number; body: ApiEnvelope<{ device: DeviceRecord }> }>;
export async function deleteDevice(id: string): Promise<{ status: number; body: ApiEnvelope<unknown> }>;
export async function fetchDeviceSubscription(deviceId: string): Promise<{ status: number; body: ApiEnvelope<SavedSubscriptionsData> }>;
export async function saveDeviceSubscription(deviceId: string, payload: { targets: unknown; alerts: unknown }): Promise<{ status: number; body: ApiEnvelope<{ saved?: boolean }> }>;
export async function deleteDeviceSubscription(deviceId: string): Promise<{ status: number; body: ApiEnvelope<unknown> }>;
```

Delete `fetchSavedSubscriptions(barkKey)`. All listed functions use `credentials: "include"` and no Authorization header.

- [ ] **Step 1: Replace `src/api.subscriptions.test.ts` with device subscription tests** asserting:
  - `fetchDeviceSubscription("dev-1")` GETs `/api/devices/dev-1/subscription`
  - no `Authorization` header
  - `credentials === "include"`
  - `saveDeviceSubscription` POSTs `{ targets, alerts }` with no `destination`

- [ ] **Step 2: Run — FAIL on missing exports**

- [ ] **Step 3: Implement the functions in `src/api.ts` using `parseApiResponse` and `bffFetch` from `src/auth/session.ts`.**

- [ ] **Step 4: Tests pass. Commit** `Talk to BFF device and subscription routes.`

---

### Task 3: Login, home redirect, require session

**Files:**
- Create: `src/pages/LoginPage.tsx`
- Create: `src/pages/LoginPage.test.tsx`
- Create: `src/pages/HomeRedirect.tsx`
- Create: `src/pages/HomeRedirect.test.tsx`
- Create: `src/auth/RequireSession.tsx`
- Create: `src/auth/RequireSession.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/entry.css` (reuse login layout)

**Interfaces:**
- `LoginPage` after OTP verify or WeChat confirm → `navigate("/devices")`
- `HomeRedirect` uses `getSession()`; user → `/devices`; else `/login`
- `RequireSession` children only when session exists; otherwise `<Navigate to="/login" replace />`

Login UI:

- Heading: `登录灾害预警`
- Phone field label `手机号`, OTP field `验证码`, buttons `发送验证码` then `登录`
- Invalid phone: status `请输入 11 位大陆手机号`; do not fetch send-otp
- WeChat mock block: on mount `POST /api/auth/mock/wechat/ticket`; show `ticketId`; button `模拟确认`

- [ ] **Step 1: Tests**
  - Invalid phone does not call fetch
  - Valid phone posts send-otp then verify with `000000` navigates to `/devices`
  - Mock confirm posts ticket confirm then navigates
  - Home with user goes to `/devices`; without user to `/login`
  - RequireSession without user shows login outlet

- [ ] **Step 2–4:** TDD implement, pass, commit `Add login, home redirect, and session gate.`

---

### Task 4: Devices and settings pages

**Files:**
- Create: `src/pages/DevicesPage.tsx`
- Create: `src/pages/DevicesPage.test.tsx`
- Create: `src/pages/SettingsPage.tsx`
- Create: `src/pages/SettingsPage.test.tsx`
- Create: `src/styles/account.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Devices: token input (no URL parsing). Bind uses `localValidateBarkKey`. Empty list copy: `还没有设备。输入 Bark token 添加后才能配置订阅。`
- Each row: name, rename, 配置订阅 → `/devices/:id/subscribe`, 解绑
- Settings: send/verify phone; mock WeChat `{ openid }`
- 401 → login; 409 message `已在其他账号使用`

- [ ] Tests: bind 22-char token POSTs `{ token }` only; 21-char does not POST; list omits token strings; settings 409 shows 其他账号.
- [ ] Commit `Add device list and account settings pages.`

---

### Task 5: Subscribe and test on device id via BFF

**Files:**
- Modify: `src/subscribe/types.ts` (`deviceId` on mount options; `onUnauthorized`)
- Modify: `src/subscribe/draft.ts` (`selectSavedSubscription(subscriptions)` returns first row)
- Modify: `src/subscribe/subscribe.logic.test.ts`
- Modify: `src/subscribe/subscribeApp.ts`
- Modify: `src/subscribe/subscribeApp.test.ts`
- Modify: `src/pages/SubscribePage.tsx` + tests
- Modify: `src/pages/TestPage.tsx` + tests
- Modify: `src/simulate/client.ts` + tests that call simulate
- Modify: `src/components/DeviceIdentity.tsx` + tests
- Modify: `src/App.tsx`

**Interfaces:**
- Routes: `/devices/:id/subscribe`, `/devices/:id/subscribe/test`
- Old `/subscribe` and `/subscribe/test` → `/login` or `/devices` via redirect to `/devices`
- `mountSubscribeApp(host, { deviceId, deviceName, ... })`
- Hydrate `GET /api/devices/:id/subscription`
- Submit `POST /api/devices/:id/subscribe` body without `destination` and without `device_key`
- Unsubscribe `DELETE /api/devices/:id/subscribe`
- 401 → `onUnauthorized` → `/login`; 404 → `/devices`
- No `maybeExpireBarkSession`, no `/bark-check`, no `fetchBarkUrls`
- Test simulate: `POST /api/devices/:id/simulate?...` credentials include
- History: `GET /api/history?source=major` with credentials omitted / no Bearer
- DeviceIdentity: show `deviceName`; 换设备 → `/devices`; 登出 calls `signOut` then `/login`; 测试 → `/devices/:id/subscribe/test`

- [ ] Update subscribeApp test: POST body has no `destination`; URL is `/api/devices/${id}/subscribe`; credentials include.
- [ ] SubscribePage without session → login; with session but missing device 404 → devices.
- [ ] Commit `Route subscribe and test through BFF device ids.`

---

### Task 6: Remove Bark Key login session

**Files:**
- Delete or stop using: `src/pages/BarkKeyPage.tsx`, `src/bark/session.ts` login cache, `src/bark/checkDeviceKey.ts` from app paths, `src/subscribe/barkKeyState.ts`
- Modify remaining tests that import `disaster_bark_key`
- Modify `vite.config.ts` (see Task 7 overlap — do proxy here if not yet)

Keep `localValidateBarkKey` for token bind. `extractBarkKey` may remain unused; delete if unused after build.

- [ ] `TermsDialog` test must not require `BARK_KEY_STORAGE_KEY`.
- [ ] Grep: no `disaster_bark_key`, no `/bark-check` in `src/` except possible leftover tests you delete.
- [ ] Commit `Stop treating Bark tokens as the site login.`

---

### Task 7: Vite proxy split

**Files:**
- Modify: `vite.config.ts`
- Modify: `.env.example` if present / README later

```typescript
const apiOrigin = process.env.VITE_DEV_API_ORIGIN ?? "http://127.0.0.1:30010";
const bffOrigin = process.env.VITE_DEV_BFF_ORIGIN ?? "http://127.0.0.1:30012";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/auth": { target: bffOrigin, changeOrigin: true },
      "/api/devices": { target: bffOrigin, changeOrigin: true },
      "/api/settings": { target: bffOrigin, changeOrigin: true },
      "/api": { target: apiOrigin, changeOrigin: true },
      "/health": { target: apiOrigin, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
```

Remove `/bark-check`. No production nginx change in this repo (host reverse proxy is spec §10 step 4).

- [ ] Commit `Proxy auth and device APIs to the BFF in development.`

---

### Task 8: Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md` (routes, proxy, no Bark Key session)
- Modify: `docs/bark-key-session-prd.md` (status: superseded by account login spec)
- Modify: `docs/subscribe-frontend.md`
- Modify: `docs/openapi.yaml` note that browser write paths go through BFF (short description on subscribe)

- [ ] Commit `Document account login routes and BFF traffic.`

---

## Spec coverage

| Spec | Task |
| --- | --- |
| §5 `/login` OTP + WeChat mock | 3 |
| §5 `/` redirect | 3 |
| §5 `/devices` bind/rename/unbind | 4 |
| §5 `/devices/:id/subscribe` | 5 |
| §5 `/devices/:id/subscribe/test` | 5 |
| §5 `/settings` | 4 |
| §5 incidents no login | 3 (RequireSession not wrapping incident) |
| §5 top bar device name, 换设备, 登出 | 5 |
| §10.3 subscribe via BFF | 2, 5 |
| §10.3 remove Bark Key session | 6 |
| Non-goal: no test-link parse | 4 |
| No `/api/bark-urls` | 5, 6 |

## Type consistency

- Device primary key: `deviceId: string` (UUID)
- Session user: `AuthUser.id`
- Subscribe mount: `deviceId`, not `deviceKey` for HTTP
- `selectSavedSubscription(rows)` → first `SavedSubscription` or `null` (Rust still may echo `device_key` in JSON; UI must not display it)
