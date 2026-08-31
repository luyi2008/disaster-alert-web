# Design: hydrate subscription from the server, drop local unsubmitted drafts

Date: 2026-08-31  
Repo: `disaster-alert-web`  
Related backend: `disaster-alert` (`https://disaster.mangguo.cloud/api`)

## Problem

The subscribe UI persists unsubmitted locations, rules, and Bark URL in `localStorage` under `disaster_subscription_draft_v3` (read path also accepts `disaster_subscription_draft_v2`). Refresh restores that blob, including incomplete location edits. The test page (`/subscribe/test`) previews the same blob.

That local draft is not wanted. Opening the subscribe or test page should show the **saved** subscription for the current Bark Key, or an empty form if none exists.

## Goals

- Stop reading and writing `disaster_subscription_draft_v3` / `disaster_subscription_draft_v2`.
- Do **not** call `localStorage.removeItem` for those keys (leave any leftover blob untouched).
- Hydrate the in-memory form from `GET /api/subscriptions` with `Authorization: Bearer <Bark Key>`.
- Use the same fetch and the same mapper on the subscribe page and the test page.
- Keep `disaster_bark_key` as the login session key.

## Non-goals

- Do not call or change `GET /api/admin/subscriptions` (query `device_key` stays admin-only).
- Do not implement the backend; this repo only consumes `GET /api/subscriptions` and documents it in `docs/openapi.yaml`.
- Do not persist unsubmitted edits anywhere (memory only until refresh).
- Do not rewrite the subscribe page from imperative DOM to React.

## Backend contract (this frontend)

All three GETs go to the disaster-alert API (this origin’s `/api` proxy), **not** to hosts listed in `bark-urls`.

| Request | Role |
| --- | --- |
| `GET /api/bark-urls` | Whitelist of Bark **notification** `base_url` values. Unchanged. |
| `GET /api/subscription-options` | Disaster categories, sources, default rules. Unchanged. Not related to Bark servers. |
| `GET /api/subscriptions` | Saved subscription for the Bearer Key. New for this frontend. |

**`GET /api/subscriptions`**

- Header: `Authorization: Bearer <Bark Key>` (same as `/api/simulate` and `/api/history`).
- Do not put the Key in the query string.

**Has subscription:** HTTP 200, `success: true`, `data.subscriptions` is an array. Each item matches the existing admin detail shape, for example:

- `destination`: `{ type, base_url, device_key }`
- `targets[]`: `{ label, point: { latitude, longitude } (numbers), region: { province, city, district } }`
- `alerts[]`: enabled rules only (same fields as `POST /api/subscribe`)
- `created_at`, `updated_at` (epoch ms)

**No subscription:** HTTP 200, `success: false`. Treat as empty. Do not toast an error.

**Unauthorized:** HTTP 401. Run existing `maybeExpireBarkSession`; if `/check` says unregistered, clear session and return to `/`.

## Choosing one row from `subscriptions[]`

1. Keep items whose `destination.device_key` equals the current session Key.
2. If more than one remains, prefer `destination.base_url` that appears in the `bark-urls` list.
3. If still more than one, use the first remaining item.

Typical case: one row per Key.

If `success: true` but the list is empty or no row matches the Key → same as no subscription (empty UI, no error toast).

## Mapping: server row → `SubscriptionDraft`

Single mapper used by subscribe and test pages.

- Start from `createEmptyDraft()`.
- `targets`: copy `label` and `region` strings; convert `point` numbers to `toFixed(4)` strings (same precision as the map editor). Assign a new local `id` (server targets have no id).
- `alerts`: for each payload rule, `alerts_by_category[category] = { enabled: true, rule }`. Categories absent from the payload are **not** pre-disabled here; `loadSubscriptionOptions` keeps filling missing categories from `GET /api/subscription-options` (existing merge).
- Do not restore `legacy_alerts` / `legacy_disabled_alerts` from local JSON (those existed only for old localStorage blobs).
- `bark_url` on the draft: if `destination.base_url` is in the `bark-urls` list, use it; otherwise use the first whitelist URL (submit path already uses a whitelist URL).

## Subscribe page data flow

1. Mount with `createEmptyDraft()` in memory. Do not read localStorage drafts.
2. Request in parallel: `GET /api/bark-urls`, `GET /api/subscription-options`, `GET /api/subscriptions` (Bearer).
3. **Ready to save** still requires bark-urls + subscription-options (unchanged). A failed subscriptions GET must not block creating a new subscription.
4. On a selected server row: map into `ctx.subscriptionDraft`, then run the existing options merge. Set `lastSubmittedSignature` (and destination identity) so the status line is not “unsubmitted changes” on a fresh hydrate.
5. User edits stay in memory. `persistDraft` only updates `#draft-status`. No debounce write to disk. Refresh repeats steps 1–4.
6. Unsubscribe: delete server row only. Keep in-memory locations/rules so the user can save again. Drop copy that says the browser draft is kept. After refresh, `success: false` yields an empty form.

Incomplete location restore from storage goes away (no local blob).

## Test page

- Same `GET /api/subscriptions` + mapper for location chips and rule cards.
- Still request `bark-urls` and `subscription-options` as today (Bark host label, notify-level list).
- “上次更新” uses the selected row’s `updated_at`. If none, keep the existing “尚无” style empty timestamp.
- Empty copy: no “本浏览器草稿”. Point the user to save on the subscribe page first. Simulate/history behavior unchanged (they already use the server subscription + Bearer).

## Error handling (subscriptions GET only)

| Result | Subscribe page | Test page |
| --- | --- | --- |
| 200 + `success: true` + chosen row | Hydrate; mark signature submitted | Show targets/rules; timestamp from `updated_at` |
| 200 + `success: false` | Empty + options defaults; no error toast | Empty preview; no error toast |
| 200 + true but nothing to choose | Same as `success: false` | Same |
| 401 | `maybeExpireBarkSession` | Same |
| Other 4xx/5xx or network error | Toast (API `message` or “无法加载已保存的订阅”); empty draft; user can still fill and POST subscribe if options/urls loaded | Preview error/empty; simulate buttons still follow their own 401/404 rules |

Never request `/api/admin/subscriptions` from this app.

## Tests

- Mapper unit tests: numbers → `toFixed(4)` strings; generated ids; alerts → `alerts_by_category` with `enabled: true` only for payload categories; `success: false` / empty list → empty draft.
- `subscribeApp`: mock `GET /api/subscriptions` with targets; submit body includes those targets. Do not seed `localStorage` with a draft key. 401 cases stay.
- `TestPage`: mock the same GET for preview; no-subscription shows empty locations/rules and save-first copy.
- Remove assertions that the draft storage key is `disaster_subscription_draft_v3` or that a local draft blob omits `barkKey`. Session tests for `disaster_bark_key` stay.

## Docs

- `docs/openapi.yaml`: add `GET /api/subscriptions` (Bearer, 200 with `success: false` for no row).
- `docs/architecture.md` §4.4: replace localStorage draft persistence with server hydrate + in-memory edits.
- `docs/subscribe-frontend.md`: `draft.ts` is in-memory + mapper, not localStorage.
- `docs/bark-key-session-prd.md` storage table: drop the `disaster_subscription_draft_v3` row; login key unchanged.

## Out of scope leftovers

Browsers may still hold an old `disaster_subscription_draft_v3` value. This app ignores it and does not delete it.
