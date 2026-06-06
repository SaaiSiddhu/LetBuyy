# Phase 3 — Platform Application & Service Investigation

Investigation date: 2026-06-05 (second pass, post-remediation)

This report documents the *current observed state* of every application under `apps/` and `apps/mobile/`, and every service under `services/`, in the LetBuyy commerce monorepo. Every claim cites a file path and (where useful) line numbers or command output. Where something could not be found, it is written as "not found in repository". Prior-doc claims (root `CODEX_*`/`LETBUYY_*` ledgers, `FORENSIC_REPORT_OPERATIONS/`, `docs/`, `Audit/`, and prior `FORENSIC_REPORT/` content) were treated as unverified and independently checked against code; confirmed/contradicted notes appear inline.

This is a second-pass refresh of the first-pass report (scanned at `5346ced9`, 2026-06-05 17:58 IST). The repo has since advanced 68 commits (`63053d18..HEAD`) to `127a850e` (2026-06-05 23:22 IST), including remediation workstreams WS1 (ui), WS5 (operations portal), WS7 (scripts), WS9 (merchant settings hub), WS10 (developer portal), WS12, marketplace hardening (H5/H9/M5), and single-writer/gateway-events refactors of webhook-service + queue-workers. See "Changes since first pass" for the delta summary.

---

## Method

- Repository root (file tools): `/Users/saai_sidd/Git/Letbuyy_Store`; (bash) `/sessions/brave-sweet-gates/mnt/Letbuyy_Store`.
- Scans excluded: `node_modules`, `.git`, `.pnpm-store`, `.turbo`, `.dart_tool`, `build`, `test-results`, `artifacts`, `coverage`, `.next`.
- Baseline: first-pass report content of this file; deltas established via `git diff --stat 63053d18..HEAD -- <path>` per runtime, then verified by reading current source.
- Manifests read: changed `package.json`, `runtime.manifest.json`, `wrangler.toml`; unchanged runtimes confirmed byte-identical via `git diff` (0 lines for storefront-runtime, identity-platform, marketing-site, all `apps/mobile/*`, and all three `wrangler.toml` files).
- Route/page inventory re-counted with `find … -name page.tsx`/`-name route.ts`; handler counts with `grep -rhoE "\.(get|post|put|patch|delete)\('"`.
- Git HEAD at time of scan: `127a850e` dated `2026-06-05 23:22:01 +0530`; 68 commits since first-pass-era `63053d18` (`git rev-list --count`).
- Tooling note (same as first pass): the bash MCP intermittently returned "process already running" RPC errors; affected commands were re-run after a wait. The `Glob` file tool returned "No files found" for several valid paths in the secondary working directory; `find` via bash and `Grep`/`Read` against absolute paths were used as the source of truth.

### Cross-cutting facts observed (apply to all 9 Next.js apps unless noted)
- Framework: Next.js `16.1.6`, React `19.2.3`, TypeScript `^5` (App Router). Unchanged since first pass.
- `test` scripts: **10 of 12** `apps/*` + `services/*` `package.json` files still have `"test": "echo 'No tests yet' && exit 0"`. The two exceptions are now `services/webhook-service` and `services/queue-workers`, whose `test` is `node --test --experimental-strip-types test/*.test.mjs` with real test files (`services/webhook-service/test/{gateway-billing-transitions,gateway-events,gateway-order-transitions}.test.mjs`; `services/queue-workers/test/gateway-events.test.mjs`). First pass: 12/12 echoed.
- Each app still has a `proxy.ts` (not `middleware.ts`) exporting `proxy()` + `config.matcher`.
- No app imports `@supabase/supabase-js` or queries Supabase tables directly (unchanged; the empty placeholder dir `apps/app-marketplace/src/lib/supabase/` still exists with no files — `find apps/app-marketplace/src/lib -type d`).
- Default API base URLs: **split state.** `apps/app-marketplace/src/lib/api/client.ts:20-31` and `apps/theme-marketplace/src/lib/api/client.ts:14-25` now **fail fast** — they throw `'Marketplace API base URL is not configured… refusing to fall back to a hardcoded staging host.'` when `LETBUYY_API_URL`/`NEXT_PUBLIC_API_URL`/`API_URL` are unset. By contrast `apps/identity-platform/src/lib/api/client.ts:14` and `apps/platform-operations-portal/src/lib/api/client.ts:13` still default to `https://api.staging.letbuyy.store`, and 22 `staging.letbuyy.store` literals remain across `apps/merchant-control-plane/src`, `apps/storefront-runtime/src`, `apps/marketing-site/src` (grep count), incl. `merchant-control-plane/src/proxy.ts:29`, `…/api/auth/logout/route.ts:18,25,55`, and hardcoded marketing CTA hrefs `marketing-site/src/components/Navbar.tsx:22,25`. `theme-marketplace` still defaults `ACCOUNTS_URL` to `https://staging.letbuyy.store` (`src/hooks/useAuth.ts:6`, `src/components/layout/navbar.tsx:16`).
- `vercel.json`: 8 of 9 apps have one; `apps/developer-portal` **still has none** (verified `ls apps/developer-portal/vercel.json` → not found).
- Cross-app session remains the shared `lb_session` httpOnly cookie via `@letbuyy/auth-core` `verifyLetbuyySessionCookieValue('merchant', …)`.
- **CLAUDE.md Canonical Runtime Map updated** (commit `0c4a775e`, 2026-06-05 19:39 IST): it now lists all 9 web apps incl. `apps/developer-portal`, all 3 mobile apps, `services/{api-gateway, webhook-service, queue-workers}`, and the 6 reserved services marked "(reserved, not implemented)" (`CLAUDE.md:7-29`). This resolves both first-pass map mismatches.

---

## Per-app status table (second pass)

| Runtime | One-line status (2026-06-05, post-remediation) |
| --- | --- |
| apps/storefront-runtime | Unchanged since first pass (git diff `63053d18..HEAD` = 0); full shopper storefront, real payments at storefront checkout, staging-default base URLs remain. |
| apps/merchant-control-plane | WS9 rebuilt the entire `settings/*` hub on a `SettingsShell`/`SettingsPane` architecture; 61 pages / 62 API routes; 4 settings panes are explicit `BackendNeededPane` shells; `ats-score` StubPage remains; staging defaults remain. |
| apps/identity-platform | Unchanged (diff = 0); tests exist but `test` script still echoes; staging-default API base remains. |
| apps/marketing-site | Unchanged (diff = 0); CTAs still hardcode staging accounts hrefs. |
| apps/app-marketplace | Hardened: fail-fast base URL, `MarketplaceUnavailable` retryable error state on 4 pages, idempotency-key passthrough on install/uninstall, webhook signing secret no longer client-supplied, structured logger; checkout-free surface (installs only). |
| apps/theme-marketplace | Partially hardened: fail-fast base URL + `MarketplaceUnavailable` + 503 on catalog APIs + logger; **checkout is STILL a fake success `<Link>`** and coupon Apply is still inert. |
| apps/platform-console | Expanded to 16 pages (+`/revenue`, +`/marketplace-governance`); proxy now enforces MFA-verified console session at the edge; dev MFA bypass env still present; 50 `SkipBackendPanel`/`fetchConsoleApi` markers across 12 dashboard pages. |
| apps/platform-operations-portal | WS5 rework: old 6 TODO-stub pages removed/redirected; 17 pages now = 1 live review queue (server actions → audited ops API), 7 honest "blocked/[SKIP -- NEEDS BACKEND]" module screens, 4 redirects, 2 large real-data WS5 pages; **login/invite TODO stubs remain; still no app-side employee RBAC** (server-side ops RBAC exists at the gateway). |
| apps/developer-portal | WS10 grew it from ~900 to ~4,146 LOC and 5→9 pages, all backed by a 2,131-line **static** `developer-surface.ts` catalog; **still zero backend wiring** (no api-client dep, no fetch, no env), dashboard panels still `[SKIP - NEEDS BACKEND]`, still no `vercel.json`. |
| apps/mobile/merchant-app | Unchanged (diff = 0); same 9 TODOs incl. unintegrated Razorpay subscription flows. |
| apps/mobile/operator-app | Unchanged (diff = 0); still the unmodified Flutter counter demo (`lib/main.dart`, `title: 'Flutter Demo'`). |
| apps/mobile/shopper-app | Unchanged; still manifest-only (`AGENTS.md` + `runtime.manifest.json`). |
| services/api-gateway | Grew to ~36,720 LOC / 653 handlers / 34 route files; added single-writer execution adapters (payment/subscription), internal mutation routes `/internal/billing` + `/internal/events` + `/storefront/internal/payments/*` (extracted module), app-store H9 idempotency + M5 server-side webhook secrets + verified-install reviews; 7 test files but `test` script still echoes; email-send TODOs and AI 503 remain. |
| services/webhook-service | Refactored: order/billing state mutations now POSTed to gateway internal routes via service binding (`gateway-order-transitions.ts`, `gateway-billing-transitions.ts`, `gateway-events.ts`); only remaining direct write is its own `payment_webhook_events` table; real `node --test` script + 3 test files. |
| services/queue-workers | Refactored: domain-event emission now via gateway `/v1/internal/events/domain` (`gateway-events.ts`); no `outbox_events` writes remain; manifest `runtimeCategory` corrected to `"cloudflare-worker"`; real `node --test` script + 1 test file. |
| services/checkout-runtime, event-bus, notification-service, search-service, media-service, analytics-pipeline | Unchanged; manifest-only reserved placeholders, now explicitly labeled "(reserved, not implemented)" in CLAUDE.md. |

---

## apps/storefront-runtime — Shopper storefront (tenant data plane)

- **Delta since first pass.** None — `git diff --stat 63053d18..HEAD -- apps/storefront-runtime` is empty. Everything below restates the verified first-pass state.
- **Purpose.** Manifest `runtimeClassification: "tenant-data-plane"`; "Shopper storefront, public catalog, cart, checkout, customer account, and theme presentation runtime" (`apps/storefront-runtime/runtime.manifest.json:9-13`). ~17,887 LOC.
- **Responsibilities (routes).** 23 pages, 21 API routes. Key pages: `/store/[subdomain]/page.tsx`, catch-all CMS pages, `/product/[productId]`, `/products`, `/shop`, `/cart`, `/checkout`, `/checkout/success`, `/checkout/paypal-return`, account suite, `/blog/[slug]`, legal pages, `/demo/urban-kicks`, `/preview`. API routes: `customer/*`, `orders/*`, `coupons/validate`, `reviews`, `store-lookup`, `themes`, `themes/install`, `seed`.
- **Subdomain routing.** `src/proxy.ts` rewrites `<sub>.letbuyy.store` → `/store/<sub>/...` (lines 22-49); per-subdomain theme-preview cookie (lines 54-65).
- **Dependencies (internal).** `@letbuyy/api-client, app-engine, auth-core, checkout-core, cms-core, commerce-core, extension-host, runtime-composition, shared-types, tenant-core, theme-engine, ui, utils` (`package.json`).
- **Consumers.** Live storefront target from merchant theme editor (`apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx:19`); CORS-allowlisted by api-gateway.
- **External integrations.** Razorpay (`window.Razorpay`), Stripe/PayPal/COD payment methods in `checkout-client.tsx`; Cloudflare Turnstile; image hosts in `next.config.ts:22-48`.
- **Runtime ownership.** Next SSR + `app/api/*` BFF; vercel.json region `bom1`.
- **Data ownership.** None directly; bundled urban-kicks demo dataset (`store-service.ts:54-56`).
- **Known issues.** `app/api/seed/route.ts` disabled (404 prod / 410 otherwise, lines 8-24). Demo store hardcoded.
- **Potential issues.** STILL-OPEN: default API base URL is staging; CSP `frame-ancestors` hardcodes admin/console + staging hosts (`next.config.ts:3-11`).
- **CLAUDE.md map.** MATCHES.

## apps/merchant-control-plane — Merchant dashboard (merchant control plane)

- **Delta since first pass.** WS9 settings-hub rework: 30 files changed (3,223 insertions / 4,095 deletions) entirely under `src/app/[store]/settings/` + `src/components/settings/` (`git diff --stat`). New: `SettingsShell.tsx` (258+ lines), `SettingsSearch.tsx`, `BackendNeededPane.tsx`, `AppsSettingsClient.tsx`, `settings/CODEX_WS9_LEDGER.md`. Net LOC ~33,719 (was ~34,536).
- **Purpose.** Unchanged manifest. Still 61 pages, 62 API routes (`find` counts).
- **Responsibilities (routes).** Page/route inventory unchanged in shape; the `settings/*` suite (18 `page.tsx` under `src/app/[store]/settings`) is rebuilt on a shared `SettingsPane`/`SettingsShell` architecture. Most settings panes are wired to the gateway via the BFF (e.g. `settings/general/page.tsx` is a client component saving name/description/currency/locale; `settings/payments/page.tsx` saves and verifies Razorpay credentials with success/warning toasts, lines 177-219; `settings/apps/page.tsx` lists installations via `apiClient.appStore.installations` and exposes a server-action `uninstallApp` with ownership re-verification, lines 18-39). Four panes are explicit backend-gap shells using `BackendNeededPane` (guidance title literally `'[SKIP - NEEDS BACKEND]'`, `src/components/settings/BackendNeededPane.tsx:34`): `settings/{business,custom-data,localization,security}/page.tsx` (grep `BackendNeededPane`). `settings/subscribe/checkout/SubscribeCheckoutClient.tsx` performs a **real Razorpay checkout** (loads `https://checkout.razorpay.com/v1/checkout.js`, creates order/subscription, lines 247-274).
- **Auth/routing.** Unchanged: `proxy.ts` gates `/[store]/*` on `lb_session`, redirect to accounts `/lookup` (lines 27-35).
- **Dependencies (internal).** Unchanged: `@letbuyy/api-client, auth-core, extension-host, shared-types, theme-engine, ui, utils`.
- **Consumers.** Unchanged (identity-platform admin URL redirect target; gateway CORS allowlist).
- **External integrations.** Razorpay client checkout in subscribe flow (above); payment config persisted via api-gateway.
- **Runtime ownership.** Next SSR + `app/api/*` BFF.
- **Data ownership.** None directly.
- **Known issues.** STILL-OPEN: `src/app/[store]/ats-score/page.tsx` remains the lone `StubPage` (lines 1-3). NEW: 4 settings panes are intentional `BackendNeededPane` shells (documented, not fabricated — `BackendNeededPane.tsx:67` "WS9 is limited to frontend settings architecture").
- **Potential issues.** STILL-OPEN: staging defaults throughout (`proxy.ts:29`, `api/auth/logout/route.ts:18,25,55`, `src/app/page.tsx`, `HeaderBar.tsx`).
- **CLAUDE.md map.** MATCHES.

## apps/identity-platform — Auth, onboarding, store selection (identity control plane)

- **Delta since first pass.** None — `git diff` empty. State restated:
- **Purpose.** "Merchant authentication, onboarding, password, OTP, OAuth callback, and store selection UI" (`runtime.manifest.json:9-13`). ~7,389 LOC; 10 pages, 19 route handlers.
- **Responsibilities.** Pages `/login, /signup, /lookup, /select, /onboarding, /forgot-password, /reset-password, /set-password, /check-email, /`; `/api/auth/*` (login, logout, signup, session, switch, lookup, accounts, stores, create-store, send-magic, send-reset, set-password, reset-password, verify, verify-otp, validate-subdomain), `/api/email/store-creation-{success,failure}`, OAuth `/auth/callback`.
- **Auth design.** Calls gateway internal auth endpoints with signed internal client (`src/lib/auth/session.ts`, `api/auth/login/route.ts:50-118`); IP rate-limit + CSRF + Turnstile on login (lines 23-46); Resend new-device email; cookie domain `.letbuyy.store`/.staging (`lib/auth/cookies.ts:27`).
- **Dependencies.** `@letbuyy/api-client, auth-core, ui, utils` + `@react-email/components`, `react-email`, `bcryptjs`, `jose`. Informational SQL schema at `src/lib/db/schema.sql`.
- **Consumers.** Universal login surface for every other app's proxy redirect.
- **External integrations.** Turnstile, Resend; feature flags `FEATURE_MAGIC_LINK/MULTI_ACCOUNT/PASSKEY/TURNSTILE`.
- **Runtime ownership.** Next SSR + BFF. Tests `src/__tests__/{auth-flow,rate-limit}.test.ts` still exist (verified `ls`) and are STILL not wired into the package `test` script.
- **Data ownership.** None directly.
- **Known issues.** None found (no TODO/FIXME).
- **Potential issues.** STILL-OPEN: default API base hardcoded to staging with `/v1` (`src/lib/api/client.ts:14`); tests unwired.
- **CLAUDE.md map.** MATCHES.

## apps/marketing-site — Public marketing (public marketing plane)

- **Delta since first pass.** None — `git diff` empty. State restated:
- **Purpose.** "Public LetBuyy marketing, pricing, product narrative, and conversion routing". ~2,885 LOC; 4 pages, 0 API routes (`/`, `/pricing`, `/signup` redirect, `/create`).
- **Dependencies.** `@letbuyy/api-types, ui, utils` + gsap/framer-motion/lenis.
- **Known/Potential issues.** STILL-OPEN: CTAs hardcode staging accounts URLs as literal hrefs (`Navbar.tsx:22,25`, `CTASection.tsx:11`, `HeroSection.tsx:28`, `PricingSection.tsx:80`).
- **CLAUDE.md map.** MATCHES.

## apps/app-marketplace — App store (marketplace control plane)

- **Delta since first pass.** 15 files changed (1,099-insertions diff shared with services). New: `src/components/MarketplaceUnavailable.tsx`, `src/lib/logger.ts`; rewritten `src/lib/api/client.ts`, `src/lib/app-service.ts`; updated install/search/list routes and 5 pages. ~4,004 LOC now; still 11 pages, 8 API routes.
- **Purpose/Responsibilities.** Unchanged manifest and route inventory (storefront group `(store)`, auth group `(auth)`, `/api/apps*`, `/api/developers*`).
- **Verified remediation claims (all RESOLVED, with evidence):**
  - **Fail-fast base URL.** `src/lib/api/client.ts:20-31` throws when no `LETBUYY_API_URL`/`NEXT_PUBLIC_API_URL`/`API_URL` is set — "refusing to fall back to a hardcoded staging host". The first-pass staging default at `client.ts:16` is gone.
  - **MarketplaceUnavailable error state.** `src/components/MarketplaceUnavailable.tsx:5-9` ("Replaces the previous silent empty-catalog fallback (H5)") used by 4 pages: `src/app/page.tsx`, `(store)/search/page.tsx` (sets `errored` on `!res.ok`, lines 27-45), `(store)/categories/[slug]/page.tsx`, `(store)/collections/[slug]/page.tsx` (grep). `src/lib/app-service.ts:6-15` adds `MarketplaceUnavailableError` + discriminated `MarketplaceResult<T>`.
  - **Install/uninstall idempotency keys.** `src/app/api/apps/[id]/install/route.ts:18,43` reads `Idempotency-Key`/`X-Idempotency-Key` and forwards `{ idempotencyKey }` to `api.appStore.install/uninstall` (lines 27, 45).
  - **Server-side webhook signing secret.** Same route, line 26: "`webhook_secret` intentionally not forwarded: the gateway generates the signing secret server-side (M5)." Gateway side: `services/api-gateway/src/routes/app-store.ts:327` ("never accepted from the client body (M5)"), `:2061` `const defaultSigningSecret = crypto.randomUUID()`, returned show-once at `:2153-2154`.
  - **Review requires install.** Gateway `app-store.ts:820-834`: POST review checks for an active installation and returns 403 `'You must have an active installation of this app to review it'` ("verified-install reviews only — no drive-by ratings").
  - **Structured logger.** `src/lib/logger.ts` (33 LOC) used in install route error paths (`install/route.ts:30,48`).
- **Dependencies / Consumers / Integrations / Runtime / Data.** Unchanged otherwise (`@letbuyy/api-client, auth-core, shared-types, ui, utils`; marketplace tables owned by api-gateway).
- **Known issues.** STILL-OPEN: empty placeholder dir `src/lib/supabase/` still exists with no files (`find apps/app-marketplace/src/lib -type d`).
- **Potential issues.** RESOLVED: staging-default base URL (now fail-fast).
- **CLAUDE.md map.** MATCHES.

## apps/theme-marketplace — Theme store (marketplace control plane)

- **Delta since first pass.** 10 files changed. New: `src/components/marketplace-unavailable.tsx`, `src/lib/logger.ts`; rewritten `src/lib/api/client.ts`, `src/lib/theme-service.ts`; updated `/api/themes*`, home, `/themes`, `/themes/[slug]`. ~5,038 LOC; still 12 pages, 3 API routes.
- **Verified remediation:** fail-fast base URL (`src/lib/api/client.ts:14-25`, same error text as app-marketplace); `MarketplaceUnavailableError` + `MarketplaceResult<T>` in `src/lib/theme-service.ts:5-14`; `MarketplaceUnavailable` component rendered on `src/app/page.tsx` and `src/app/themes/page.tsx` (grep); `/api/themes` route returns explicit 503 `MARKETPLACE_UNAVAILABLE` instead of a silent empty catalog (`src/app/api/themes/route.ts:26-31`).
- **Checkout — STILL FAKE (verbatim re-verified).** `src/app/checkout/page.tsx:206-217`: the "Pay" control is still a plain `<Link href={\`/checkout/success?theme=${theme.slug}\`}>` whose `onClick` only fires an info toast ("Starting purchase"); the coupon "Apply" button at line 201 still has no handler. Payment-method radio (stripe/razorpay) remains decorative. No payment intent/charge is created anywhere in the app.
- **Dependencies / Consumers / Runtime / Data.** Unchanged (`@letbuyy/api-client, auth-core, shared-types, theme-engine, ui, utils`; theme tables owned by api-gateway; linked from merchant theme browsing).
- **Known issues.** STILL-OPEN: non-functional checkout + inert coupon (above).
- **Potential issues.** PARTIALLY RESOLVED: API base is now fail-fast, but `ACCOUNTS_URL` still defaults to `https://staging.letbuyy.store` (`src/hooks/useAuth.ts:6`, `src/components/layout/navbar.tsx:16`).
- **CLAUDE.md map.** MATCHES.

## apps/platform-console — Super-admin governance (platform governance control plane)

- **Delta since first pass.** 12 files changed. New pages `/revenue` and `/marketplace-governance`; new `src/components/_local-ui/console-workspace.tsx` (200 LOC, incl. `SkipBackendPanel` rendering literal `[SKIP -- NEEDS BACKEND]`, lines 167-179); rewritten analytics/dashboard/operations/stores/subscriptions/trust-safety pages; **proxy hardened**. ~3,668 LOC; 16 pages (was 14), 4 API routes.
- **Responsibilities.** `(auth)`: `/login`, `/mfa`. `(dashboard)`: `/`, `/dashboard`, `/analytics`, `/audit-logs`, `/employees`, `/marketplace-governance` (NEW), `/operations`, `/revenue` (NEW), `/settings`, `/stores`, `/subscriptions`, `/trust-safety`, `/users` (find list).
- **Auth design.** NEW: `src/proxy.ts` now enforces the console session at the edge — protected paths require a console session and `mfaVerified`, else redirect to `/login` or `/mfa`; users without even a merchant `lb_session` are sent to accounts `/lookup` (lines 24-71; matcher covers all dashboard paths incl. the two new ones). Email allowlist + TOTP MFA logic unchanged in `src/lib/console-auth-server.ts`; the dev MFA bypass via `PLATFORM_CONSOLE_DEV_MFA_CODE` (NODE_ENV-guarded) is STILL present (line 140).
- **Backend.** Pages read via `fetchConsoleApi` → gateway `/internal/console/*` with bearer `PLATFORM_CONSOLE_API_TOKEN`; e.g. the new `/revenue` page composes `/internal/console/summary` + `/internal/console/subscriptions` (`revenue/page.tsx:36-43`) and renders `ConsoleApiErrorPanel` on failure. Backend gaps are now uniformly declared: 50 `fetchConsoleApi`/`SkipBackendPanel` occurrences across 12 dashboard pages (grep count) instead of free-text `[SKIP - NEEDS BACKEND]` notes.
- **Dependencies / Consumers / Data.** Unchanged (`@letbuyy/api-client, auth-core, ui, utils` + zod; gateway `internal-console` router is its backend).
- **Known issues.** STILL-OPEN: dev-only MFA bypass env path (`console-auth-server.ts:140`).
- **Potential issues.** Unchanged: three env secrets required; `configured()` fails closed on placeholders.
- **CLAUDE.md map.** MATCHES.

## apps/platform-operations-portal — Employee operations (platform operations control plane)

- **Delta since first pass.** WS5: 22 files changed (722 insertions / 1,369 deletions). The first-pass "real data" pages (crm 344 LOC, merchant-health 412, support 395) were **collapsed to 5-14 LOC each**; 5 new top-level pages added (`/tickets`, `/retention`, `/campaigns`, `/communications`, `/onboarding`); new `src/components/_local-ui/{employee-module-screen,ops-workspace}.tsx` and `src/lib/api/employee-modules.ts`. ~2,430 LOC (was ~3,077); 17 pages (was 13), still 0 API routes.
- **Responsibilities (current shape, verified per file):**
  - **Live (1):** `(dashboard)/operations/page.tsx` (204 LOC) — Marketplace Review Queue. Lists pending app/theme submissions via `api.operations.marketplaceReviews({status:'pending'})` and submits decisions through a Next **server action** `submitMarketplaceReviewDecision` → `api.operations.decideMarketplaceReview` (lines 14-32, 68-78). Server-side authorization: the gateway mounts this under `/operations/*` which requires `requireRoleCategory('ops')` + `requireSuperAdmin` (`services/api-gateway/src/routes/operations.ts:7,58,300,320`).
  - **Honest blocked module screens (7):** `/crm`, `/tickets`, `/merchant-health`, `/retention`, `/campaigns`, `/communications`, `/onboarding` each render `EmployeeModuleScreen` (`src/components/_local-ui/employee-module-screen.tsx`) fed only by `loadEmployeeAnalytics()` → gateway `/employees/analytics` totals (`src/lib/api/employee-modules.ts:23-31`); `/tickets` additionally probes `/employees/tickets` (lines 33-41; gateway route exists at `services/api-gateway/src/routes/employee.ts:296-320`). Every screen shows "blocked" (or "partial" for merchant-health) readiness and a `SkipBackendPanel` literally labelled `[SKIP -- NEEDS BACKEND]` (`ops-workspace.tsx:165`) naming the missing contract (e.g. `/v1/employees/crm`).
  - **Redirects (4):** `/stores` → `/merchant-health`, `/users` → `/crm`, `/support` → `/tickets`, `/marketing` → `/campaigns` (each a 5-LOC `redirect()` page).
  - **WS5 large real-data pages (2):** `/operations/communications` (334 LOC — reads session stores + `/notifications` + `/notifications/preferences`, with a "Communications backend required" warning banner and disabled Send/Schedule buttons, lines 128-261) and `/operations/onboarding`.
  - **Dashboard:** `(dashboard)/page.tsx` (56 LOC) — the first-pass hardcoded-`0` metric cards + "TODO: Recent activity feed" are GONE; it now renders live `/employees/analytics` totals + a module grid with explicit live/partial/blocked statuses (lines 12-42).
- **TODO stubs — partial resolution.** RESOLVED: the 6 dashboard-area TODO comments from first pass (`stores`, `users`, `marketing`, dashboard metrics/activity, layout role-filtering) no longer exist. STILL-OPEN: exactly 2 TODOs remain, both in auth — `(auth)/invite/page.tsx:14` "TODO: Validate invite token, show role, create password" and `(auth)/login/page.tsx:12` "TODO: Employee login with email allowlist…" (grep). Both forms have no submit handlers.
- **RBAC — did it gain RBAC?** App-side: **No.** `src/proxy.ts` still gates only on a valid merchant `lb_session` (lines 24-46; matcher extended to the new paths, lines 49-67) and `(dashboard)/layout.tsx` shows the full nav to any session holder (no role check; the old "TODO: role-based filtering" comment was simply removed, lines 17-27). Server-side: **Yes, for the only mutating workflow** — review decisions hit `/v1/operations/*` which the gateway protects with `requireRoleCategory('ops')` + `requireSuperAdmin` (`operations.ts:58`); read-only `/employees/analytics` is reachable by any authenticated session. Net: a non-employee merchant session can render the portal shell and analytics totals but cannot decide reviews.
- **Backend client.** `src/lib/api/client.ts` unchanged in mechanism (internal-session-signed api-client) and **still defaults to** `https://api.staging.letbuyy.store` (line 13).
- **Known issues.** Three orphaned components: `crm/CrmContactIndexTable.tsx`, `support/TicketIndexTable.tsx`, `merchant-health/MerchantHealthIndexTable.tsx` export tables that no page imports anymore (grep shows only their own definitions) — dead code left by the WS5 page collapse.
- **CLAUDE.md map.** MATCHES.

## apps/developer-portal — Developer docs/dashboard shell (developer ecosystem plane)

- **Delta since first pass.** WS10: grew from ~900 to ~4,146 LOC and 5 → 9 pages. New pages: `/api-reference`, `/oauth`, `/sdks`, `/webhooks` (plus existing `/`, `/docs`, `/api`, `/sdk`, `/dashboard`); new `error.tsx`/`loading.tsx`/`not-found.tsx`; new `src/components/_local-ui/developer-docs.tsx` (552 LOC) and `src/lib/developer-surface.ts` (2,131 LOC); `CODEX_WS10_LEDGER.md` checked in at app root.
- **Is it still a shell? Yes — documentation got real, backend wiring did not.** Evidence:
  - `package.json:12-17` dependencies are still only `@letbuyy/ui` + next/react — **no `@letbuyy/api-client`, no auth-core**.
  - `src/lib/developer-surface.ts` is a purely static typed data module (interfaces `EndpointDoc`/`GuideStep`/`ContractCard`/`GatewayRouteGroup`… lines 1-60); grep for `fetch(`/`process.env`/`use client` in it returns only documentation *strings about* the gateway's `bridge/fetch` endpoint, no executable fetch.
  - Dashboard panels still literally read `[SKIP - NEEDS BACKEND]` for API keys / Analytics / Earnings (`src/app/dashboard/page.tsx:39-41`); `src/lib/reference.ts` keeps `"SKIP - NEEDS BACKEND"` as a status enum value (lines 11, 296, 329, 339).
  - Still **no `vercel.json`** (only app without one) and `test` still echoes.
- **Purpose.** Manifest unchanged ("Developer documentation, API reference, OAuth and webhook guides, SDK quick-starts, and partner dashboard shell").
- **Consumers / Integrations / Data.** Unchanged: linked from app-marketplace footer; no inbound API calls; no env vars; no data ownership.
- **CLAUDE.md map.** RESOLVED — `apps/developer-portal` is now listed in the Canonical Runtime Map (`CLAUDE.md:11`), fixing the first-pass omission.

---

## apps/mobile/merchant-app — Flutter merchant builder (mobile merchant control plane)

- **Delta since first pass.** None — `git diff --stat 63053d18..HEAD -- apps/mobile` is empty. State restated:
- **Purpose.** "Native merchant operations, dashboard, builder, products, themes, preview, and store management surfaces"; pubspec `name: letbuyy_store` v`1.0.0+1`; ~35,190 LOC Dart, 112 files, 25 screens, 12 services.
- **Integrations.** `AppConfig.apiBaseUrl` defaults to **production** `https://api.letbuyy.store/v1` (`lib/config/app_config.dart:5-22`); Razorpay key id via dart-define; `lb_session` token; dart-define contracts with `SKIP_NEEDS_HUMAN_*` placeholders.
- **Known issues (TODOs, all STILL-OPEN).** `products_screen.dart:287,799,1076`; `orders_screen.dart:987`; `create_store_wizard.dart:279`; `pricing_screen.dart:249` & `upgrade_screen.dart:324` ("TODO: Integrate Razorpay"); `settings_screen.dart:299`; `auth/error_screen.dart:70`.
- **Potential issues.** Razorpay subscription unintegrated; unused declared Supabase env in dart-defines.
- **CLAUDE.md map.** MATCHES.

## apps/mobile/operator-app — Flutter operator scaffold (mobile platform operations)

- **Delta since first pass.** None. Re-verified: `lib/` contains exactly 1 `.dart` file (`find … | wc -l` = 1) and `lib/main.dart` is still the unmodified Flutter counter starter (`MaterialApp(title: 'Flutter Demo' …)`, "TRY THIS: Try running your application…" comment block, lines 1-20 read directly). Dependencies still only `flutter` + `cupertino_icons`.
- **Known issues.** STILL-OPEN: functionally empty; ships `'Flutter Demo'` if built.
- **CLAUDE.md map.** MATCHES.

## apps/mobile/shopper-app — Reserved shopper mobile runtime (mobile customer)

- **Delta since first pass.** None. `ls apps/mobile/shopper-app/` → `AGENTS.md`, `runtime.manifest.json` only. Not buildable; reserved manifest-only placeholder.
- **CLAUDE.md map.** MATCHES (and now explicitly listed).

---

## services/api-gateway — Hono /v1 API (Cloudflare Worker; backend API control plane)

- **Delta since first pass.** 12+ files changed (2,333 insertions across gateway + console diff). New: `src/routes/internal-billing.ts` (197 LOC), `src/routes/internal-events.ts` (61 LOC), `src/routes/storefront/internal-payment-routes.ts` (233 LOC, extracted from storefront.ts), `src/execution/payment-execution.adapter.ts` (172), `src/execution/subscription-execution.adapter.ts` (203), `src/execution/cloudflare-queue-triggers.ts` (137) + test. Now ~36,720 LOC (`find … -not __tests__ | cat | wc -l`), 653 handlers (same grep pattern as first pass; was 686 — the extraction moved/merged storefront handlers), 34 route `.ts` files (33 in `src/routes/` + 1 in `src/routes/storefront/`). 13 execution adapters total under `src/execution/`.
- **Purpose / mounts.** Manifest unchanged. `src/index.ts` (now 700 LOC) mounts: public pre-auth `/auth`, `/contacts`, `/storefront(+graphql)`, `/themes`, `/app-store`, `/internal/console`, **NEW `/internal/billing` (line 459)**, **NEW `/internal/events` (line 460)**; protected (authMiddleware + csrf, lines 463-464) `/stores … /operations` + admin GraphQL, as before. The two new internal routers are mounted pre-auth but each verifies `X-Internal-API-Secret === env.INTERNAL_API_SECRET` and 403s otherwise (`internal-events.ts:20-29`, `internal-billing.ts:49-53`).
- **NEW internal mutation surface (single-writer endpoints for sibling workers):**
  - `POST /v1/internal/events/domain` — zod-validated domain-event emit via `EventExecutionAdapter` (`internal-events.ts:9-59`). Consumed by webhook-service + queue-workers.
  - `POST /v1/internal/billing/subscriptions/activate` (+ companions) — subscription activation via `SubscriptionExecutionAdapter` + `@letbuyy/billing-core` (`internal-billing.ts`).
  - `POST /v1/storefront/internal/payments/{reference,confirm,failure,event}` — order payment-state transitions via `PaymentExecutionAdapter` (`storefront/internal-payment-routes.ts:128-211`), registered into the storefront router (`storefront.ts:33`).
- **App-store hardening (verified, see app-marketplace section):** H9 install/uninstall idempotency through `IdempotencyExecutionAdapter` with claim/complete/fail-release semantics (`app-store.ts:1978-1996, 2158-2168, 2197-2215, 2310-2319`); M5 server-generated show-once webhook signing secret (`:327, :2061, :2153-2154`); verified-install reviews (`:820-834`).
- **payments.ts refactor.** Now 798 LOC (was larger) and delegates DB state changes to `PaymentExecutionAdapter`/`IdempotencyExecutionAdapter`/`EventExecutionAdapter`/`SubscriptionExecutionAdapter` (`payments.ts:9-12`); the execution adapters carry an explicit `runtimeBridge` declaring forbidden responsibilities (e.g. `payment-execution.adapter.ts:50-59`).
- **Scheduled work / DO / GraphQL / queues.** Crons, Durable Object, GraphQL gates, 5 queue producers — unchanged (`wrangler.toml` byte-identical since `63053d18`). NEW `cloudflare-queue-triggers.ts` plans queue messages for scheduled-dispatch telemetry across the 5 queue bindings (lines 1-60).
- **Dependencies / Consumers / External integrations / Data ownership / Auth model.** Unchanged from first pass (broadest workspace deps; every app + both implemented sibling workers consume it; Supabase primary writer ~127 tables; Hyperdrive/R2/KV/D1/DO/Analytics Engine/Queues; Razorpay/Stripe/PayPal/Cashfree/Resend/Upstash/Turnstile; `authMiddleware` 3-mode; `/operations/*` ops+super-admin gated; `/internal/console/*` token-gated).
- **Known issues.** STILL-OPEN (all three TODO email stubs verbatim): `routes/employee.ts:287`, `routes/admin.ts:283` "TODO: Send invite email via Resend"; `routes/contacts.ts:48` "TODO: Send notification to store owner via Resend". STILL-OPEN: `/ai/generate` returns 503 `AI_PROVIDER_UNCONFIGURED` (`routes/ai.ts:146`); no LLM SDK present.
- **Potential issues.** STILL-OPEN: `Env` still declares `UPSTASH_REDIS_REST_URL/TOKEN` as required (`index.ts:128-129`) while the rate limiter treats Redis as optional. STILL-OPEN: package `test` echoes "No tests yet" while now **7** test files exist under `src/__tests__/` (was 6; + `cloudflare-queue-triggers.test.ts`) — still not invoked by the package script.
- **CLAUDE.md map.** MATCHES.

## services/webhook-service — Payment provider webhooks (Cloudflare Worker; backend webhook plane)

- **Delta since first pass.** Major refactor: `src/index.ts` shrank 1,511 → 1,311 LOC; 3 new modules `gateway-events.ts` (50), `gateway-order-transitions.ts` (111), `gateway-billing-transitions.ts` (117); `package.json` `test` now `node --test --experimental-strip-types test/*.test.mjs` with 3 real test files (`test/gateway-{billing-transitions,events,order-transitions}.test.mjs`; e.g. `gateway-order-transitions.test.mjs` asserts the worker POSTs signed confirmations to the gateway binding using a captured fake `API_GATEWAY_SERVICE`, lines 1-30). Total src LOC 1,716.
- **Direct gateway-table writes — REMOVED (verified).** Grep for `upsertSupabaseRows(`/`patchSupabaseRows(` over `src/` returns only two call sites, **both targeting `payment_webhook_events`** (its own idempotency/processing table, `index.ts:76,96`). Order reads remain (`selectRows … "orders"`, `index.ts:303`), but order/subscription **mutations** now go through the gateway service binding:
  - `markOrderPaid` → `confirmGatewayOrderPayment` → `POST /v1/storefront/internal/payments/confirm` (`index.ts:312-345`; `gateway-order-transitions.ts:48-60`), then `emitGatewayDomainEvent` → `POST /v1/internal/events/domain` (`gateway-events.ts:31`).
  - `markOrderFailed` → `recordGatewayOrderPaymentFailure` → `/v1/storefront/internal/payments/failure` (`index.ts:347-371`).
  - Subscription activation → `activateGatewayStoreSubscription` → `POST /v1/internal/billing/subscriptions/activate` (`gateway-billing-transitions.ts:42-60`).
  All three helpers hard-require `API_GATEWAY_SERVICE` binding + `INTERNAL_API_SECRET` and throw otherwise (`gateway-events.ts:23-29` etc.); auth is the `X-Internal-API-Secret` header verified gateway-side.
- **Responsibilities (routes).** Unchanged set: `GET /health`, `POST /app-lifecycle/dispatch`, `POST /webhook-deliveries/dispatch`, provider callbacks `POST /razorpay|/stripe|/paypal|/cashfree` with signature verification and idempotent `payment_webhook_events` upserts. Outbound HMAC signer `src/app-lifecycle-dispatch.ts` unchanged (127 LOC).
- **Dependencies / Consumers / Integrations / Runtime.** Unchanged (`@letbuyy/auth-core, infrastructure` + hono; called by gateway cron via `WEBHOOK_SERVICE` binding; binds back `API_GATEWAY_SERVICE`; `wrangler.toml` byte-identical).
- **Data ownership.** Narrowed: writes only `payment_webhook_events`; order/subscription state is now mutated exclusively by api-gateway (single-writer).
- **Known issues.** None found (no TODO/FIXME).
- **Potential issues.** RESOLVED: "test script echoes / no test files" — now a real `node --test` script with 3 suites. NOTE: tests are pure unit tests of the gateway-client helpers (fake bindings), not provider-signature integration tests.
- **CLAUDE.md map.** MATCHES (listed).

## services/queue-workers — Cloudflare Queue consumers (Cloudflare Worker; async worker plane)

- **Delta since first pass.** `runtime.manifest.json` **corrected**: `runtimeCategory` is now `"cloudflare-worker"` (was `"reserved-service"`) and businessAuthority now reads "Implemented Cloudflare Queue worker runtime…" (git diff of the manifest) — resolving the first-pass manifest/topology contradiction. New `src/gateway-events.ts` (52 LOC); `platform-queue-consumer.ts` now 847 LOC; `package.json` `test` is `node --test …` with `test/gateway-events.test.mjs`. Total src LOC 1,202.
- **Domain-event writes — moved to gateway (verified).** Grep for `outbox_events` in `src/` returns **no matches** (first pass: queue-workers wrote `outbox_events` directly). The consumer's `emitDomainEvent` now validates payload contracts then calls `emitGatewayDomainEvent` → `POST /v1/internal/events/domain` with `X-Internal-API-Secret` (`platform-queue-consumer.ts:703-738`; `gateway-events.ts:21-52`).
- **Remaining direct Supabase access (consumer-owned projections + reads).** `.from()` over `src/`: writes to `search_documents` (3 upserts), `notifications` (insert), `analytics_event_stream`, `partner_payout_ledger_entries` (idempotent upsert on `source_event_id`, lines 644-675), `distributed_queue_messages`/`runtime_telemetry_metrics` (index.ts); reads of `products`, `orders`, `order_items`, `sites`, `marketplace_apps`, `app_developers`.
- **Responsibilities / Queue topology / Dependencies / Consumers.** Otherwise unchanged: `queue(batch, env)` handler (index.ts, 303 LOC) normalizes/persists/quarantines and delegates to `consumePlatformQueuesForCloudflareQueue`; consumes the 7 production queues per byte-identical `wrangler.toml`; deps `@letbuyy/event-core, infrastructure, notification-core, orchestration, runtime-composition`; binds `API_GATEWAY_SERVICE`.
- **Known issues.** None found (no TODO/FIXME).
- **Potential issues.** RESOLVED: manifest-category contradiction; RESOLVED: no-tests script.
- **CLAUDE.md map.** RESOLVED — now listed in the Canonical Runtime Map (`CLAUDE.md:21`).

## services/checkout-runtime — Reserved (manifest only)

- **Delta since first pass.** None to the directory (still only `AGENTS.md` + `runtime.manifest.json`; no `src`/`package.json`/`wrangler.toml`). CLAUDE.md now explicitly lists it as "(reserved, not implemented)" (`CLAUDE.md:22`).
- **State.** Server-side checkout/totals logic continues to live in api-gateway (now partly in `routes/storefront/internal-payment-routes.ts` + `execution/payment-execution.adapter.ts`), not here.

## services/event-bus — Reserved (manifest only)

- **Delta since first pass.** None to the directory. CLAUDE.md lists it "(reserved, not implemented)" (`CLAUDE.md:26`). Event transport remains Cloudflare Queues + the gateway-owned `outbox_events` store — with the second-pass change that sibling workers now *request* event emission via `/v1/internal/events/domain` instead of writing the store directly.

## services/notification-service — Reserved (manifest only)

- **Delta since first pass.** None to the directory. CLAUDE.md lists it "(reserved, not implemented)" (`CLAUDE.md:25`). Notification logic remains in `@letbuyy/notification-core` (queue-workers writes `notifications`) and Resend calls in api-gateway/identity-platform.

## services/search-service — Reserved (manifest only)

- **Delta since first pass.** None to the directory. CLAUDE.md lists it "(reserved, not implemented)" (`CLAUDE.md:23`). Search remains `search_documents` projections written by queue-workers, read by api-gateway.

## services/media-service — Reserved (manifest only)

- **Delta since first pass.** None to the directory. CLAUDE.md lists it "(reserved, not implemented)" (`CLAUDE.md:24`). Media remains api-gateway `/upload` + `/media` + R2.

## services/analytics-pipeline — Reserved (manifest only)

- **Delta since first pass.** None to the directory. CLAUDE.md lists it "(reserved, not implemented)" (`CLAUDE.md:27`). Analytics remains `analytics_event_stream` + queue-workers rollups + gateway `/analytics` routes.

---

## Changes since first pass

Window: `63053d18..127a850e` (68 commits, all dated 2026-06-05 IST). Merge commits at HEAD include `stream/WS5-operations` and `stream/WS10-devportal`. Per-runtime verified deltas:

1. **CLAUDE.md Canonical Runtime Map fixed (RESOLVED).** Commit `0c4a775e` added `apps/developer-portal`, `services/queue-workers`, and all 6 reserved services with "(reserved, not implemented)" labels, plus the capability-owner sentence (`CLAUDE.md:11,21-29`). Both first-pass map mismatches are closed.
2. **Test scripts: 12/12 → 10/12 echo.** `services/webhook-service` and `services/queue-workers` now run `node --test --experimental-strip-types test/*.test.mjs` against 3 + 1 real test files. All 9 apps + api-gateway still echo "No tests yet" (api-gateway now has 7 unwired test files; identity-platform still 2 unwired).
3. **Single-writer enforcement (webhook-service, queue-workers → api-gateway).** webhook-service no longer patches `orders`/subscription tables — mutations go through new internal-secret-gated gateway routes (`/v1/storefront/internal/payments/*`, `/v1/internal/billing/subscriptions/*`, `/v1/internal/events/domain`); its only remaining direct write is `payment_webhook_events`. queue-workers no longer writes `outbox_events`; it emits domain events via the gateway. Gateway grew matching execution adapters (`payment-execution`, `subscription-execution`) + 2 internal routers + an extracted `storefront/internal-payment-routes.ts`.
4. **app-marketplace hardening landed (all 5 claims verified).** Fail-fast base URL (no staging default), `MarketplaceUnavailable` retryable error state replacing silent empty catalogs (H5), Idempotency-Key passthrough + gateway H9 claim/complete/fail-release on install/uninstall, M5 server-generated show-once webhook signing secret (client value never accepted), verified-install-only reviews (gateway 403).
5. **theme-marketplace half-hardened.** Same fail-fast client + `MarketplaceUnavailable` + 503 catalog APIs + logger — but the checkout "Pay" control is still a no-payment `<Link>` to `/checkout/success` and the coupon Apply button is still inert (`checkout/page.tsx:201,206-217` — unchanged lines).
6. **platform-operations-portal (WS5) restructured, not completed.** The 6 first-pass TODO-stub dashboard pages are gone (replaced by 1 live marketplace-review queue with server-action decisions, 7 explicit `[SKIP -- NEEDS BACKEND]` module screens, 4 redirects); the dashboard now shows live `/employees/analytics` data. Still open: `(auth)/login` + `(auth)/invite` TODO forms with no handlers; no app-side employee RBAC (proxy = any merchant `lb_session`; nav unfiltered) — only the gateway's `/operations/*` ops/super-admin check protects mutations. New dead code: 3 orphaned `*IndexTable.tsx` components.
7. **developer-portal (WS10): bigger shell, same shell.** 5 → 9 pages, ~900 → ~4,146 LOC of static, source-cited API documentation (`developer-surface.ts`, 2,131 LOC of typed string data). No api-client, no fetch, no env, dashboard panels still `[SKIP - NEEDS BACKEND]`, still no `vercel.json`.
8. **merchant-control-plane (WS9): settings hub rebuilt.** 18 settings pages on a shared `SettingsShell`/`SettingsPane`/`SettingsSearch` architecture; most panes save through the BFF (general, payments-with-verification, apps-with-uninstall-server-action, plan/taxes/shipping/users rewritten); 4 panes (`business`, `custom-data`, `localization`, `security`) are declared `BackendNeededPane` shells; subscribe checkout uses real Razorpay JS. `ats-score` StubPage unchanged.
9. **platform-console: edge-enforced MFA + 2 new pages.** `proxy.ts` now blocks all dashboard paths without an MFA-verified console session (first pass relied on per-page `requireConsoleSession`); added `/revenue` and `/marketplace-governance` composing existing `/internal/console/*` contracts; backend gaps standardized into `SkipBackendPanel` components (50 markers / 12 pages). Dev MFA bypass env path remains.
10. **Unchanged runtimes.** storefront-runtime, identity-platform, marketing-site, merchant-app, operator-app, shopper-app, all 3 `wrangler.toml`, and the 6 reserved service dirs have zero diffs in the window. Staging-default URLs persist everywhere except the two marketplace API clients.

### Top findings (second pass)

| # | Severity | Status | Finding (evidence) |
| --- | --- | --- | --- |
| 1 | Critical | STILL-OPEN | theme-marketplace checkout takes no payment: "Pay" is `<Link href="/checkout/success?...">` + toast; coupon Apply has no handler (`apps/theme-marketplace/src/app/checkout/page.tsx:201,206-217`). |
| 2 | High | STILL-OPEN | platform-operations-portal has no app-side employee RBAC/allowlist: any valid merchant `lb_session` passes `src/proxy.ts:24-46` and sees the full nav (`(dashboard)/layout.tsx:17-27`); only the review-decision mutation is gateway-gated (`services/api-gateway/src/routes/operations.ts:58`). Login/invite remain TODO no-op forms (`(auth)/login/page.tsx:12`, `(auth)/invite/page.tsx:14`). |
| 3 | High | STILL-OPEN | Staging-default/hardcoded environment coupling persists outside the marketplaces: 22 `staging.letbuyy.store` literals in merchant-control-plane/storefront-runtime/marketing-site (incl. literal CTA hrefs `marketing-site/src/components/Navbar.tsx:22,25`), plus staging API defaults in `identity-platform/src/lib/api/client.ts:14` and `platform-operations-portal/src/lib/api/client.ts:13`, and `ACCOUNTS_URL` staging default in theme-marketplace (`useAuth.ts:6`). |
| 4 | High | RESOLVED | webhook-service/queue-workers no longer write gateway-owned state directly: order/billing/domain-event mutations now POST to internal-secret-gated gateway routes (`services/webhook-service/src/gateway-{order,billing}-transitions.ts`, `…/gateway-events.ts`; `services/queue-workers/src/gateway-events.ts`; zero `outbox_events` refs in queue-workers; only `payment_webhook_events` written by webhook-service). |
| 5 | High | RESOLVED | app-marketplace remediation verified end-to-end: fail-fast base URLs (`src/lib/api/client.ts:25-29`), `MarketplaceUnavailable` (H5) on 4 pages, install/uninstall Idempotency-Key + gateway H9 lifecycle (`app-store.ts:1978-2168`), M5 server-side show-once webhook signing secret (`app-store.ts:2061,2153`), verified-install reviews (`app-store.ts:820-834`). |
| 6 | Medium | STILL-OPEN | developer-portal remains a zero-backend shell after WS10: no `@letbuyy/api-client` dependency (`package.json:12-17`), static 2,131-LOC `developer-surface.ts`, dashboard `[SKIP - NEEDS BACKEND]` (`dashboard/page.tsx:39-41`), no `vercel.json`. |
| 7 | Medium | STILL-OPEN | Tests not wired: 10/12 runtime `test` scripts still echo "No tests yet" while api-gateway has 7 real test files and identity-platform 2 — none invoked by their package scripts. (Improved from 12/12; webhook-service + queue-workers now run real `node --test` suites.) |
| 8 | Medium | STILL-OPEN | Mobile gaps unchanged: operator-app is the stock Flutter counter demo (`lib/main.dart`, 1 dart file, `title: 'Flutter Demo'`); shopper-app is manifest-only; merchant-app keeps 9 TODOs incl. unintegrated Razorpay subscriptions (`pricing_screen.dart:249`, `upgrade_screen.dart:324`). |
| 9 | Medium | NEW | WS5 page collapse left dead code + thin replacements: `CrmContactIndexTable.tsx`, `TicketIndexTable.tsx`, `MerchantHealthIndexTable.tsx` are exported but never imported (grep), and 7 of 17 ops-portal pages plus 4 merchant settings panes and 12 console pages are explicit `[SKIP -- NEEDS BACKEND]` declarations — honest, but the operational surface is mostly placeholders pending `/v1/employees/*` contracts. |
| 10 | Low | RESOLVED | Governance-map drift closed: CLAUDE.md now enumerates developer-portal, queue-workers, and the 6 reserved services (`CLAUDE.md:11,21-29`); queue-workers' manifest `runtimeCategory` corrected to `"cloudflare-worker"` (manifest diff), eliminating the topology/manifest contradiction. |

Other still-open first-pass items re-verified this pass: gateway email-send TODO stubs (`employee.ts:287`, `admin.ts:283`, `contacts.ts:48`); `/ai/generate` 503 `AI_PROVIDER_UNCONFIGURED` (`ai.ts:146`); platform-console dev MFA bypass (`console-auth-server.ts:140`, NODE_ENV-guarded); `Env` requires Upstash vars the limiter treats as optional (`index.ts:128-129`); merchant `ats-score` StubPage; empty `apps/app-marketplace/src/lib/supabase/` dir; storefront seed route disabled by design.

---

## Cross-runtime observations (factual, updated)

1. **CLAUDE.md Canonical Runtime Map vs. filesystem.** Now consistent: CLAUDE.md lists all 9 web apps, 3 mobile apps, 3 implemented services, and 6 reserved services with explicit "(reserved, not implemented)" labels (`CLAUDE.md:7-29`). First-pass mismatches (developer-portal and queue-workers omitted) are resolved.
2. **Deprecated aliases.** Still no active code references to `apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/mobile/operator-team-app`, or `apps/storefront-runtime/consumer-storefront`; the only literals remain the deny-list in `scripts/validators/governance-common.mjs` and the CLAUDE.md policy section itself.
3. **Implemented vs. reserved services.** Unchanged ratio (3 implemented Workers, 6 manifest-only), but the queue-workers manifest category contradiction is fixed and CLAUDE.md now documents the capability owners of reserved scopes as api-gateway and/or queue-workers.
4. **Functionality centralization — now enforced, not just observed.** Capabilities the reserved services nominally own are still implemented in api-gateway + queue-workers + Supabase, and the second pass *strengthened* the gateway's single-writer position: sibling workers mutate orders/billing/events only through `X-Internal-API-Secret`-gated gateway endpoints.
5. **Default-environment coupling.** Split outcome: marketplaces fail fast without an explicit API base; identity-platform, operations-portal, merchant-control-plane, storefront-runtime, marketing-site, and theme-marketplace ACCOUNTS_URL still default/hardcode staging hosts. Mobile dart-define defaults remain production.
6. **Tests.** 10/12 runtime `test` scripts echo "No tests yet" (was 12/12). Real, script-wired suites exist only in webhook-service (3 files) and queue-workers (1 file); api-gateway's 7 and identity-platform's 2 test files remain unwired. Root governance `tests/*.test.mjs` continue to run from the root `package.json`.
7. **"[SKIP …]" as a convention.** The remediation streams standardized explicit backend-gap markers instead of fabricating data: ops-portal `SkipBackendPanel` (`[SKIP -- NEEDS BACKEND]`, `ops-workspace.tsx:165`), console `SkipBackendPanel` (`console-workspace.tsx:179`), merchant `BackendNeededPane` (`'[SKIP - NEEDS BACKEND]'`, `BackendNeededPane.tsx:34`), developer-portal `[SKIP - NEEDS BACKEND]` statuses (`reference.ts:11`, `dashboard/page.tsx:39-41`). These are intentional documented gaps, not accidental stubs — but they quantify how much of the governance/ops/developer surface still lacks backend contracts.

---

## Evidence Index (every cited path)

Root / config:
- `/Users/saai_sidd/Git/Letbuyy_Store/CLAUDE.md` (lines 7-29; diff `63053d18..HEAD`, commit `0c4a775e`)
- `/Users/saai_sidd/Git/Letbuyy_Store/pnpm-workspace.yaml`
- `/Users/saai_sidd/Git/Letbuyy_Store/package.json`
- `/Users/saai_sidd/Git/Letbuyy_Store/scripts/validators/governance-common.mjs`
- Root ledgers present (claims cross-checked, not relied on): `CODEX_MASTER_EXECUTION_LEDGER.md`, `CODEX_WS5_LEDGER.md`, `CODEX_WS7_LEDGER.md`, `CODEX_WS12_LEDGER.md`, `CODEX_FOUNDATION_*`, `FORENSIC_REPORT_OPERATIONS/`
- Git: `git rev-list --count 63053d18..HEAD` = 68; HEAD `127a850e` 2026-06-05 23:22:01 +0530; `git diff --stat 63053d18..HEAD -- <runtime>` per section

apps/storefront-runtime (unchanged; first-pass citations remain valid):
- `runtime.manifest.json`, `package.json`, `vercel.json`, `next.config.ts`, `src/proxy.ts`
- `src/app/api/seed/route.ts`, `src/app/store/[subdomain]/checkout/checkout-client.tsx`
- `src/lib/store-service.ts`, `src/lib/seo.ts`

apps/merchant-control-plane:
- `runtime.manifest.json`, `package.json`, `src/proxy.ts`
- `src/app/[store]/settings/` (18 page.tsx; `general/page.tsx`, `payments/page.tsx:177-219`, `apps/page.tsx:18-39`, `apps/AppsSettingsClient.tsx`)
- `src/app/[store]/settings/subscribe/checkout/SubscribeCheckoutClient.tsx:247-274`
- `src/components/settings/{SettingsShell.tsx,SettingsPane.tsx,SettingsSearch.tsx,BackendNeededPane.tsx (:34,:67),SettingsIndex.tsx,settings-navigation.ts}`
- `src/app/[store]/settings/CODEX_WS9_LEDGER.md`
- `src/app/[store]/ats-score/page.tsx:1-3`, `src/app/api/auth/logout/route.ts:18,25,55`

apps/identity-platform (unchanged):
- `runtime.manifest.json`, `package.json`, `src/proxy.ts`, `src/lib/api/client.ts:14`
- `src/app/api/auth/login/route.ts`, `src/lib/auth/{session.ts,cookies.ts}`, `src/lib/db/schema.sql`
- `src/__tests__/{auth-flow.test.ts,rate-limit.test.ts}` (re-verified via `ls`)

apps/marketing-site (unchanged):
- `src/components/{Navbar.tsx (:22,:25),CTASection.tsx,HeroSection.tsx,PricingSection.tsx}`, `src/app/{signup,create}/page.tsx`

apps/app-marketplace:
- `package.json`, `src/lib/api/client.ts:20-31,75-87`, `src/lib/app-service.ts:6-39`
- `src/components/MarketplaceUnavailable.tsx:5-9`, `src/lib/logger.ts`
- `src/app/api/apps/[id]/install/route.ts:18,26-27,43-45`
- `src/app/page.tsx`, `src/app/(store)/{search/page.tsx (:27-45),categories/[slug]/page.tsx,collections/[slug]/page.tsx}`
- `src/lib/supabase/` (still empty; `find … -type d`)

apps/theme-marketplace:
- `src/lib/api/client.ts:14-25`, `src/lib/theme-service.ts:5-14`, `src/lib/logger.ts`
- `src/components/marketplace-unavailable.tsx:5-9`, `src/app/api/themes/route.ts:26-31`
- `src/app/checkout/page.tsx:190-222 (esp. :201,:206-217)`
- `src/hooks/useAuth.ts:6`, `src/components/layout/navbar.tsx:16`

apps/platform-console:
- `src/proxy.ts:5-92`, `src/lib/console-auth-server.ts:140`, `src/lib/console-api.ts`
- `src/app/(dashboard)/{revenue/page.tsx (:36-43),marketplace-governance/page.tsx,dashboard,analytics,operations,stores,subscriptions,trust-safety}/page.tsx`
- `src/components/_local-ui/console-workspace.tsx:167-179`, `src/components/ConsoleDataTable.tsx`

apps/platform-operations-portal:
- `src/proxy.ts:4-67`, `src/lib/api/client.ts:13,28-68`, `src/lib/api/employee-modules.ts:23-41`
- `src/app/(dashboard)/page.tsx:12-42`, `(dashboard)/layout.tsx:17-27`
- `(dashboard)/operations/page.tsx:14-32,68-78,199-201`
- `(dashboard)/{crm,tickets,merchant-health,retention,campaigns,communications,onboarding}/page.tsx` (EmployeeModuleScreen)
- `(dashboard)/{stores,users,support,marketing}/page.tsx` (redirects)
- `(dashboard)/operations/communications/page.tsx:128-261,271-294`, `(dashboard)/operations/onboarding/page.tsx`
- `src/components/_local-ui/{employee-module-screen.tsx,ops-workspace.tsx (:165)}`
- `(auth)/login/page.tsx:12`, `(auth)/invite/page.tsx:14`
- Orphans: `(dashboard)/crm/CrmContactIndexTable.tsx`, `(dashboard)/support/TicketIndexTable.tsx`, `(dashboard)/merchant-health/MerchantHealthIndexTable.tsx`

apps/developer-portal:
- `package.json:5-17`, `CODEX_WS10_LEDGER.md`
- `src/app/{page,docs/page,api/page,sdk/page,dashboard/page (:39-41),api-reference/page,oauth/page,sdks/page,webhooks/page}.tsx`, `src/app/{error,loading,not-found}.tsx`
- `src/lib/developer-surface.ts:1-60` (static), `src/lib/reference.ts:11,296,329,339`
- (no `vercel.json` — verified absent)

apps/mobile/merchant-app (unchanged):
- `runtime.manifest.json`, `pubspec.yaml`, `lib/config/app_config.dart:5-24`
- `lib/screens/**` TODO sites (`products_screen.dart:287,799,1076`; `orders_screen.dart:987`; `create_store_wizard.dart:279`; `pricing_screen.dart:249`; `upgrade_screen.dart:324`; `settings_screen.dart:299`; `auth/error_screen.dart:70`)
- `dart-defines/{README.md,staging.json,production.json}`

apps/mobile/operator-app (unchanged):
- `runtime.manifest.json`, `pubspec.yaml`, `lib/main.dart:1-20` (Flutter Demo; 1 dart file)

apps/mobile/shopper-app (unchanged):
- `runtime.manifest.json` (+ `AGENTS.md`; directory re-listed)

services/api-gateway:
- `runtime.manifest.json`, `package.json`, `wrangler.toml` (byte-identical)
- `src/index.ts:42-43,120-130,437-479 (esp. :459-460,:463-464)`
- `src/routes/internal-events.ts:9-59`, `src/routes/internal-billing.ts:13-70`
- `src/routes/storefront/internal-payment-routes.ts:128-211`, `src/routes/storefront.ts:33`
- `src/routes/app-store.ts:107,168,327,774-875 (:820-834),1402-1565,1677-1698,1978-2169 (:2061,:2153-2154),2197-2319,2405-2738`
- `src/routes/payments.ts:1-70`, `src/routes/operations.ts:7,58,300,320`, `src/routes/employee.ts:1-80,287,296-320`, `src/routes/admin.ts:283`, `src/routes/contacts.ts:48`, `src/routes/ai.ts:146`
- `src/execution/{payment-execution.adapter.ts (:50-59),subscription-execution.adapter.ts,cloudflare-queue-triggers.ts (:1-60),idempotency-execution.adapter.ts,event-execution.adapter.ts}` (13 adapters total, `ls`)
- `src/__tests__/` (7 files incl. `cloudflare-queue-triggers.test.ts`)

services/webhook-service:
- `package.json` (`test` script), `runtime.manifest.json`, `wrangler.toml` (byte-identical)
- `src/index.ts:76,96,280-345 (:303,:312-345),347-379` (1,311 LOC)
- `src/gateway-events.ts:19-50`, `src/gateway-order-transitions.ts:14-60`, `src/gateway-billing-transitions.ts:8-60`
- `src/app-lifecycle-dispatch.ts`
- `test/{gateway-billing-transitions,gateway-events,gateway-order-transitions}.test.mjs` (e.g. order-transitions :1-30)

services/queue-workers:
- `package.json` (`test` script), `runtime.manifest.json` (diff: `runtimeCategory` → `cloudflare-worker`), `wrangler.toml` (byte-identical)
- `src/index.ts` (303 LOC), `src/gateway-events.ts:21-52`
- `src/platform-queue-consumer.ts:18,448-790 (:644-675,:703-738,:728)` (847 LOC; zero `outbox_events` matches)
- `test/gateway-events.test.mjs`

services (reserved, manifest-only — directories unchanged):
- `services/checkout-runtime/runtime.manifest.json`
- `services/event-bus/runtime.manifest.json`
- `services/notification-service/runtime.manifest.json`
- `services/search-service/runtime.manifest.json`
- `services/media-service/runtime.manifest.json`
- `services/analytics-pipeline/runtime.manifest.json`
