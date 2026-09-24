# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`disaster-alert-web` is the **frontend only** for the disaster-alert subscription and notification-detail site (Chinese-language product). It does not collect disaster data, match alert rules, send Bark pushes, or store device/account credentials — those live in separate repos (`disaster-alert` API and `disaster-alert-bff`). This repo deploys and versions independently from them; API contract is tracked manually via `docs/openapi.yaml` (CI does not pull the server repos to verify it).

Read `docs/architecture.md` before making non-trivial changes — it documents current (not planned) architecture, data flow, and known risks in detail. `docs/subscribe-frontend.md` covers the subscribe-page module breakdown specifically.

## Commands

```bash
npm install
npm run dev       # vite dev server on :5173, proxies /api and /health to backends (see below)
npm run build      # tsc -b (typecheck) then vite build
npm test           # vitest run
npm run lint        # oxlint
npm run preview     # preview a production build
```

Run a single test file: `npx vitest run src/subscribe/alertLogic.test.ts` (or `npx vitest` for watch mode).

There is no separate typecheck script — `tsc -b` runs as part of `npm run build`.

### Local dev requires companion services

The dev server proxies API calls to sibling backend repos that must be running locally: `disaster-alert` API (default `127.0.0.1:30010`), `disaster-alert-bff` (default `127.0.0.1:30012`, can run with `AUTH_MOCK=true`), and the `mango-captcha` edge function (default `127.0.0.1:43141`). Without these, auth/devices/subscribe/captcha flows won't work in dev. Proxy targets are configurable via `VITE_DEV_API_ORIGIN`, `VITE_DEV_BFF_ORIGIN`, `VITE_CAPTCHA_ORIGIN` (see `vite.config.ts`).

Proxy routing: `/api/captcha` → captcha origin, `/api/auth` + `/api/devices` + `/api/settings` → BFF, everything else under `/api` + `/health` → API.

## Branch conventions for agents

- Never commit or push directly to `main`. Every change goes on its own task branch — normally the branch the invoking session/harness assigns you (e.g. `claude/<random-slug>`); use that branch exactly as given, don't rename or recreate it.
- **Naming, when you must pick a branch name yourself** (no branch was assigned): `<type>/<short-kebab-case-description>`, where `<type>` is one of `feat`, `fix`, `chore`, `docs`, `refactor`, `test` — the same prefixes already used in this repo's commit messages (`git log` history mixes plain and conventional-commit-style subjects, but branch/PR-worthy work has historically used these, e.g. `feat/account-login`). Keep the description short and specific to the task (`fix/history-loading-stuck`, not `fix/bug` or `fix/updates`). Don't reuse an old branch name for unrelated work.
- One branch = one task. Don't land unrelated fixes on a branch you were given for something else; if the ask changes mid-task, confirm before repurposing the branch.
- Push with `git push -u origin <branch-name>` to your own branch only. Never force-push a branch you didn't create in this task, and never rewrite history (`rebase -i`, `--amend`, force-push) on a branch someone else may also be working on.
- If the PR for your assigned branch has already been merged, don't keep stacking commits on that merged history — restart the branch from the current `main` (`git fetch origin main && git checkout -B <branch-name> origin/main`, keeping any unmerged commits by rebasing them onto the new base) and treat further work as a new PR.
- Don't open a pull request unless explicitly asked to. When asked, check for `.github/pull_request_template.md` (or similar) and follow its structure; this repo's deploy pipeline (`push` to `main`) is what actually ships to production, so merging is a deliberate, human-gated step, not something to do implicitly.
- CI only builds images on PRs (`push: false`, see Deployment below) — pushing to `main` triggers a real build-and-deploy, so treat merges to `main` as a production release, not routine housekeeping.

## Architecture

### Tech stack

React 19 (StrictMode) + react-router-dom 7 (`BrowserRouter`) + Vite 8 + TypeScript ~6.0 + shadcn/ui (new-york) on Radix + Tailwind v4 + sonner (toasts) + Leaflet 1.9 (maps) + Vitest/Testing Library/jsdom. No state management library. Path alias `@` → `./src`.

### Routes (`src/App.tsx`)

- `/` → `HomeRedirect` (session → `/devices`, else → `/login`)
- `/login` → phone OTP or WeChat mock login
- `/devices`, `/devices/add`, `/devices/:id/subscribe`, `/devices/:id/subscribe/test`, `/settings` — all wrapped in `RequireSession`
- `/incidents/:incidentId/notifications/:token` — **no auth required**, this is the Bark deep-link entry point and carries a notification credential in the path itself

### Auth model

Login identity is a BFF `HttpOnly` session cookie (`src/auth/session.ts`), **not** a locally-stored Bark key. Bark device tokens (22-char) are only submitted once when binding a device on `/devices`. 401 responses redirect to `/login`; a missing device redirects to `/devices`.

### Subscribe workspace (`/devices/:id/subscribe`) — the most complex module

`SubscribePage` owns session/device-ownership/terms-dialog and shell; `src/subscribe/SubscribeWorkspace.tsx` owns the shared draft state and hydrate/save/unsubscribe/reset-rules logic, passed down to `LocationPanel.tsx` (Leaflet map + up to 3 monitored locations) and `AlertRulesPanel.tsx` (disaster type/source/severity rules) via `setDraft`. Pure logic lives in `alertLogic.ts`, `draft.ts`, `geo.ts`, `http.ts`, `statusSources.ts`, `notify.ts` (sonner wrapper), `types.ts`.

This page used to be built by mounting imperative DOM (`innerHTML` + `mountSubscribeApp`) onto a static HTML shell; it has since been fully converted to React, but two things from that era remain and matter when editing this code:

- **Leaflet is still imperative.** `LocationPanel` creates the map in a `useEffect` and calls `map.remove()` on cleanup; click handlers read from refs (`readyRef`/`uiRef`/`draftRef`) rather than closures, because StrictMode's double-mount makes stale closures a real bug, not a theoretical one.
- **Generation/revision guards prevent stale async writes.** `SubscribeWorkspace` tracks a `cancelled` flag + incrementing `generation` when loading config, so a late response after unmount/reload can't call `setState`. Reverse-geocoding in `LocationPanel` similarly stamps each request with the `coordinateRevision`/`regionRevision` at dispatch time and discards the result if either changed before it resolves (coordinates moved again, or the user hand-edited province/city/district in the meantime). When touching any async data-loading path in this module, preserve this pattern.

Coordinates are stored as `toFixed(4)` **strings** (not numbers) to preserve user input verbatim and avoid float-display jitter.

Submission is **overwrite, not incremental**: `POST /api/subscription/:device_key/subscribe` replaces the whole subscription (`{ targets, alerts }` only, no `destination`). Unsaved edits live only in page memory — no localStorage draft persistence (a previous `disaster_subscription_draft_v3`/`v2` localStorage key exists in some browsers from an old build but is intentionally never read or migrated). Server response failure modes are deliberately distinguished: HTTP 502 → actionable "check your Bark key" error; `data.saved !== true` (subscription persisted, but the Bark confirmation push failed and will retry) → `warning` toast, not `error`, so users aren't told to retry a submission that already succeeded.

### Incident detail page (`/incidents/:incidentId/notifications/:token`)

Standard React, shares no code with the subscribe workspace except `src/api.ts`. `useIncidentDetail` (`src/pages/useIncidentDetail.ts`) collapses HTTP status into five states: `loading`/`ready`/`not_found`/`unavailable`/`error`, distinguishing retryable from non-retryable (404 is never retryable — a dead/wrong link, not a transient failure).

**Privacy-sensitive**: the URL path itself contains the notification credential. On mount this page dynamically injects `<meta name="robots" content="noindex,nofollow,noarchive">` and forces `referrer=no-referrer`, as defense-in-depth alongside nginx response headers (`X-Robots-Tag`, `Referrer-Policy: no-referrer`). Never log or echo full `/incidents/...` URLs (including in error messages, analytics, etc.).

### Backend contract

All API responses share the envelope `{ success: boolean, message: string, data?: T }`. `src/subscribe/http.ts`'s `parseApiResponse` is the single place that normalizes failures: non-JSON responses degrade to a failure envelope instead of throwing, `cleanApiMessage` strips HTML-looking messages (so a gateway error page never gets shown verbatim), and `httpFailureMessage` maps status codes to Chinese user-facing copy.

`GET /api/subscription/subscription-options` is a key architectural choice: disaster types, source groups, and default rules are served by the backend, not hardcoded in the frontend — the frontend only renders and does client-side numeric-range validation (e.g. `min_magnitude` 0–10). Don't hardcode disaster-type/source lists in new code; fetch and render what the backend provides.

Contract snapshot: `docs/openapi.yaml`, maintained by hand — update it when you change how the frontend calls the API.

### Build-time vs runtime config

`VITE_API_BASE` and `CAPTCHA_ORIGIN` are baked in at **build time** (Vite), not runtime — the same built image cannot switch API/captcha origins later. Empty `VITE_API_BASE` means same-origin (reverse-proxied); set it only for cross-origin API deployments. `CAPTCHA_ORIGIN` in `.env.production` points directly at the mango-captcha edge origin in production, bypassing the site's own reverse proxy.

### Testing conventions

Tests target invariants, not snapshots — see the test files listed in `docs/architecture.md` §9 for what each page/module's suite actually covers (hydrate/save/401 flows, dialog confirm/cancel behavior, unmount cleanup calling `map.remove()`, etc.). Leaflet is `vi.mock`-ed in tests; jsdom doesn't need a real map implementation. Vitest config (jsdom env, globals, setup file) lives in `vite.config.ts`, not a separate vitest config file.

### Known gaps (see `docs/architecture.md` §11 for full list with rationale)

TypeScript `strict` is not enabled (no `strictNullChecks`/`noImplicitAny`). No route-level code splitting (Leaflet ships in the main bundle). No React error boundary. No CSP header in nginx. Don't assume any of these exist when reasoning about safety of a change.

## Deployment (only relevant if asked to touch CI/Docker)

Two-stage Docker build (`.docker/Dockerfile`): `node:22-bookworm` builds, `nginx:1.27-alpine` serves `dist/` — the runtime image has no Node/source. Container nginx always listens on `0.0.0.0:30011` (fixed in `.docker/nginx.conf`); `compose.yaml` stays at repo root even though build context/config live under `.docker/`. `/`, `/subscribe`, and `/incidents/` all fall back to `index.html` (`try_files`) so SPA deep links survive a refresh — required for Bark deep links to work.

PRs only build the image (`push: false`); pushing to `main` or a manual `workflow_dispatch` builds, pushes to `ghcr.io/<owner>/<repo>` (`:latest` + commit SHA tags — **not** Docker Hub), then deploys via SSH with `docker compose ... --no-build` using `GITHUB_TOKEN` for registry auth (no long-lived deploy credentials). `DEPLOY_PATH` must not be shared with the `disaster-alert` API repo's deploy directory.

## Environment/tooling notes

- No screen recordings or video artifacts when verifying UI changes (see `.cursor/rules/no-walkthrough-videos.mdc`) — use screenshots, automated tests, and logs instead.
- oxlint is configured with `react`, `typescript`, and `oxc` plugins (`.oxlintrc.json`); `react/rules-of-hooks` is an error, not a warning.
