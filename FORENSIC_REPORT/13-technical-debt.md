# Phase 13 — Technical Debt Report

Investigation date: 2026-06-05

## Method

- Inventoried `legacy/` and `docs/archive/` in full; grep-verified whether anything active references them.
- Counted TODO/FIXME/HACK/XXX/WORKAROUND markers per workspace (`grep -rEn` over ts/tsx/dart/mjs/sql, excluding node_modules/build), then read each hit to discard regex false positives (e.g. `XXXXXXXXXX` phone placeholders).
- Cross-checked the repo's own debt ledgers — `tasks/todo.md` (rewritten 2026-03-01), `memory/lessons.md` (37 lessons, 2026-03-01), AGENTS.md "Current Risk Register" (generated 2026-05-25) — against current source to separate *paid-down* debt from *live* debt; stale ledger entries are themselves recorded as drift.
- Traced reachability of suspected abandoned features (routes, nav links, feature gates) and end-to-end wiring of partially implemented systems (outbox→cron→queues→consumers; billing→entitlement enforcement; OAuth UI→callback).
- Verified flag state in `services/api-gateway/wrangler.toml` per environment, and certification mode in `config/runtime/live-production-certification.json`.
- Drew on, and where source has moved on corrected, the earlier `FORENSIC_REPORT/12-technical-debt.md` (different scan date); corrections are explicitly marked.

---

## 1. Legacy systems

### 1.1 `legacy/firebase` — quarantined predecessor backend, properly isolated, capability gap unported
- 24 TS/JS files, **15,323 lines** (`find`/`wc` count), plus `firestore.rules`, `storage.rules`, `.firebaserc`, `scripts/migrate-firebase.sh`.
- Contains a full prior product's server: `sellerAuth.ts` (1,629 lines), `kycVerification.ts` (1,524), `adminAuth.ts` (1,333), `emailVerification.ts` (1,233), `returnService.ts` (1,097), `subscriptionService.ts` (984), `walletService.ts` (897), `settlementService.ts`, `commissionService.ts`, `razorpayService.ts`, etc.
- Firestore collections written there (`sellers` ×47, `users` ×30, `stores` ×26, `subscriptions` ×10, `wallet_transactions` ×5 …) target a **different database** (Firestore), so there is no dual-write with the live Supabase platform.
- Isolation verified: grep `legacy/firebase` across apps/services/packages/config/infrastructure/scripts → only `scripts/generate-repository-intelligence.mjs` (a path scanner) references it. AGENTS.md:99 ("Deprecated runtime code lives under `legacy/` and must not leak") is satisfied.
- Debt content: 6 TODOs remain inside legacy (`orderNotifications.ts:145` email sending, `settlementService.ts:536` / `walletService.ts:487` admin-role verification, `subscriptionService.ts:279` plan-change logic) — and the wallet/commission/settlement/KYC/returns *capabilities* it implemented have **no successor** in the active platform (grep: no wallet/settlement/commission route modules under `services/api-gateway/src/routes/`). The legacy directory is simultaneously dead code (15.3k lines carried) and the only record of dropped functionality.

### 1.2 Squashed migration history carried in two places
- Active migrations: 10 files (`database/supabase/migrations/`: `000_baseline.sql` pg_dump squash + 073-078, 084, 088, 089 — gaps 079-083, 085-087).
- The 72 superseded migrations live on under `docs/archive/migrations-history/` (72 files) — historical record per CLAUDE.md's archive policy, but the binding constitution still describes the pre-squash world (AGENTS.md:316-320, 381: "65 migrations", "228 tables", "migration 065_…sql") — see Phase 11 AV-C1. One-off verification SQL (18 files incl. `065_enterprise_sdlc_lifecycle.sql`) is retained in-tree at `database/supabase/verification/`.

### 1.3 Superseded-but-still-wired naming/strata
- `sites` (DB) vs `store` (URLs/UI) is a *declared* permanent mapping (AGENTS.md:10, 69), not drift — but legacy column fallbacks persist in live mapping code: `apps/storefront-runtime/src/lib/store-service.ts:519, 670` reads `data.user_id || data.custom_user_id`, `data.name || data.store_name`; `normalizeSiteType` (507-512) still translates legacy `ecommerce`/`landing_page` enum values; `normalizeSectionType` (713-743) carries a 25-entry legacy→current section-type alias map ("Normalize section type names (handle legacy 'hero' → 'heroBanner'…)"). Each is a live compatibility shim for data shapes the platform no longer writes.

---

## 2. Abandoned features (code present, unreachable or non-functional)

| Item | State | Evidence |
|---|---|---|
| `apps/mobile/operator-app` | **Unmodified Flutter counter demo** behind a canonical runtime manifest. `lib/main.dart:1-36` is the stock template ("Flutter Demo Home Page", tutorial comments intact); only `main.dart` + `test/widget_test.dart` exist as Dart source. CLAUDE.md and AGENTS.md:27 list it as a canonical mobile runtime for "production operations workflows". | `apps/mobile/operator-app/lib/main.dart` |
| `apps/mobile/shopper-app` | Reserved placeholder: 2 files total (AGENTS.md, runtime.manifest.json). Declared canonical in CLAUDE.md. | directory listing |
| 6 reserved services | `services/{analytics-pipeline, checkout-runtime, event-bus, media-service, notification-service, search-service}` are each 2 files (AGENTS.md + manifest). Their *workloads* are actually executed elsewhere (gateway cron + `services/queue-workers` consumers — §5.1), so the roots are aspirational topology, not missing function. | directory listings; `runtime-boundaries.md:22-28` |
| GraphQL API | 1,835-line schema (`services/api-gateway/src/graphql/schema.ts`) + admin/storefront routers mounted (`src/index.ts:42-43, 350-357`) — **zero frontend consumers** (grep `graphql` across `apps/` → 0 files) and `FEATURE_GRAPHQL = "false"` in production (`wrangler.toml:213`). Backend without UI, dark in prod. | cited files |
| Apple OAuth button | Rendered `coming-soon`, `aria-disabled`, onClick preventDefault — permanent decorative UI. | `apps/identity-platform/src/app/lookup/page.tsx:483-489` |
| Google OAuth | UI handler hard-fails with "Google sign-in is not configured" (`lookup/page.tsx:360-361`); `/auth/callback` is an explicit placeholder redirecting to `?error=oauth_unavailable` (`apps/identity-platform/src/app/auth/callback/route.ts:3-10`). UI promise without backend. | cited files |
| Helm/K8s deployment manifests | `infrastructure/deployment/helm/letbuyy-production/*`, `kubernetes/*` exist; live deployment is Wrangler/Vercel (`wrangler.toml` routes; `vercel.json`); no workflow consumes the charts (grep `helm` in `.github`/scripts → bootstrap scripts only reference Cloudflare). | directory listing |
| Demo tenant fixture | `urban-kicks` demo short-circuits real tenant resolution: `StoreService.getStoreBySubdomain` returns an in-code 340-line fixture before any API call (`apps/storefront-runtime/src/lib/store-service.ts:55-57, 73-74, 92-93, 116-117`; fixture `src/lib/demo/urban-kicks-demo.ts`, 340 lines). Reachable, but bypasses the production data path it demos. | cited files |

Reachability spot-check that came back **wired** (not abandoned): `apps/developer-portal` (6 routed pages, real `src/lib/reference.ts` content); `apps/platform-operations-portal` has 7 pages calling a real API client (`createPlatformOperationsApiClient` in 7 files) alongside its TODO placeholders (§3).

---

## 3. Temporary workarounds — TODO/FIXME/HACK inventory

Raw grep hits: 32; after removing false positives (`+91 XXXXXXXXXX` placeholder at `SubscribeCheckoutClient.tsx:404`, E.164 regex doc at `packages/shared-types/src/index.ts:34`, `XXXX`-masking comments in legacy KYC, and the 5 self-referential matches in `scripts/generate-repository-intelligence.mjs`): **24 genuine markers**, all `TODO` (0 FIXME, 0 HACK, 0 WORKAROUND keywords in active source).

| Workspace | Count | Notable examples |
|---|---|---|
| apps/mobile/merchant-app | 9 | `screens/subscription/pricing_screen.dart:249` "TODO: Integrate with Razorpay subscription"; `screens/premium/upgrade_screen.dart:324` "TODO: Integrate Razorpay"; `screens/wizard/create_store_wizard.dart:279` "Wire up onboarding data save via API when endpoint is ready"; `products_screen.dart:287/799/1076` export/edit/hide unimplemented; `orders_screen.dart:987` order-details nav |
| apps/platform-operations-portal | 7 | `(auth)/login/page.tsx:12` "Employee login with email allowlist" not built; `(auth)/invite/page.tsx:14` "Validate invite token…"; `(dashboard)/layout.tsx:19` "role-based filtering"; users/stores/marketing/dashboard pages all placeholder comments (`users/page.tsx:16`, `stores/page.tsx:16`, `marketing/page.tsx:22`, `page.tsx:27`) |
| services/api-gateway | 3 | invite/notification emails not sent: `routes/employee.ts:287`, `routes/admin.ts:283` ("Send invite email via Resend"), `routes/contacts.ts:48` ("Send notification to store owner via Resend") |
| apps/merchant-control-plane | 0 genuine | (1 raw hit = phone placeholder) |
| packages | 0 genuine | (1 raw hit = regex doc) |
| legacy | 6 | see §1.1 (frozen with the legacy system) |
| scripts | 0 genuine | (5 raw hits = the scanner's own pattern strings) |
| everything else (storefront-runtime, identity-platform, marketplaces, marketing, console, developer-portal, webhook-service, queue-workers, database, tests) | 0 | grep |

Interpretation: the active-platform TODO count (18 outside legacy/scripts) is unusually low for the codebase size; per the repo's deletion discipline this measures *annotated* debt only. Non-annotated workarounds found by reading: the Vercel install-command app-local Next removal acknowledged as "a workaround" in AGENTS.md:324; the demo-tenant short-circuit (§2); the legacy column/section-alias shims (§1.3); the error-sanitizer denylist pattern (Phase 11 AV-M3).

---

## 4. Architecture drift (declared vs real)

| # | Declaration | Reality | Evidence |
|---|---|---|---|
| D1 | AGENTS.md:381 "Supabase migrations: 65"; :316 "Tables detected: 228"; :362 evidence "lives in migration 065_enterprise_sdlc_lifecycle.sql"; :320 "migrations must be sequential" | 10 migration files, squashed `000_baseline.sql`, gaps 079-083/085-087, 065 relocated to `verification/` | `database/supabase/migrations/`; Phase 11 AV-C1 |
| D2 | CLAUDE.md canonical map = 13 runtimes | Disk = 10 app roots + 9 service roots; `developer-portal` and `queue-workers` shipped and governed but absent from the map; 6 services + shopper-app are 2-file scaffolds | Phase 11 AV-C2 |
| D3 | AGENTS.md package inventory (lines 29-55) | Missing on the list but present and workspace-registered: `packages/payments` (7 adapter consumers), `packages/app-engine` (1,778 lines, consumed by storefront-runtime + gateway), `packages/extension-host`, `packages/dart/api_client` (1,392-line client) | `pnpm-workspace.yaml:9,12-13`; package.json census |
| D4 | AGENTS.md:71 "scan found 45 source files with console.log"; :72 "51 files using any"; tasks/todo.md Phase 0 "Webhook Signature Verification (CRITICAL)" unchecked; "Auth Rate Limiting (CRITICAL)" unchecked; "server-side price re-calculation" pending; lessons.md L21/22/24/26/27 | All since fixed: console.log = **0** files; `any` = **11** files; webhook signatures verified for all 4 providers (`webhook-service/src/index.ts:266-280` Razorpay HMAC + timing-safe; Stripe/PayPal/Cashfree provider adapters lines 2-10); gateway auth rate limits table (`routes/auth.ts:34-44`) + customer-auth rate limits (`storefront.ts:3685, 3932, 4280`); server-side totals (`payments.ts:674-677`); CORS allowlist (`index.ts:299-320`); security headers (`middleware/security.ts:20-48`) | cited files |
| | → The debt is now **the ledgers themselves**: `tasks/todo.md` (2026-03-01) still presents resolved CRITICAL security work as open, and `memory/lessons.md` cites pre-reorg paths (`backend/supabase/...`, `apps/web/consumer/...`) that no longer exist — both are required pre-edit reading per AGENTS.md:241/350, so every agent ingests stale risk data. | | |
| D5 | tasks/todo.md:19-31 + AGENTS.md:367-368 risk register: "all.env… historically committed", rotate 9 secrets, purge history | Current git history (727 commits, root commit `390811f1`) contains **zero** trace of `all.env` (`git log --all -- all.env` → empty); no tracked env files; no secrets found by pattern grep. Either history was already rewritten or the file predates this repo — but the constitution still carries the unrotated-secret risk as live with no closure record. | git history scan |
| D6 | AGENTS.md:153 "Placeholder app roots are forbidden" | 7 placeholder roots exist, sanctioned by `runtime-boundaries.md:22-28` as "reserved" — two governance documents in direct conflict, validators side with the latter | Phase 11 AV-L2 |
| D7 | AGENTS.md:368 "generator reports env files by name only"; AGENTS.md generated 2026-05-25 | Constitution has not been regenerated despite migration squash, package additions, console.log/`any` cleanups — the prescribed refresh trigger (AGENTS.md:1 "Regenerate after architecture, routing, schema, or deployment changes") has fired multiple times without regeneration | file header timestamp vs source state |
| D8 | Prior `FORENSIC_REPORT/12-technical-debt.md` rows now stale | "Outbox scheduling: adapter without trigger" — **wrong now**: cron `*/5`(staging)/`*/1`(prod) (`wrangler.toml:20, 203`) drives `scheduled()` → `runScheduledDispatch` → `OutboxExecutionAdapter.dispatchBatch` (`index.ts:471-511, 609-612`). "Search indexing: producer without consumer" — **wrong now**: `letbuyy-search-queue-*` has a wrangler consumer in `services/queue-workers/wrangler.toml` (`[[queues.consumers]] queue = "letbuyy-search-queue-staging"`, max_batch 25) handled by `platform-queue-consumer.ts`. "Magic-link login: implementation unevidenced" — **wrong now**: full implementation with rate limit + Turnstile + CSRF + Resend send (`apps/identity-platform/src/app/api/auth/send-magic/route.ts:14-95`). | cited files |

---

## 5. Incomplete features and partially implemented systems

### 5.1 Systems verified COMPLETE end-to-end (to scope the debt honestly)
- **Event/outbox pipeline**: outbox writes (gateway + webhook-service `outbox_events` upsert) → cron preflight over `outbox_events`/`platform_queue_jobs`/`webhook_deliveries` (`index.ts:214-239`) → batch dispatch (504-511) → Cloudflare Queues producers (5 bindings, `wrangler.toml:55-73`) → `services/queue-workers` consumers for events/analytics/search/notifications with circuit breakers and dead-letter handling (`queue-workers/wrangler.toml` consumers; `src/platform-queue-consumer.ts:167`). The "no event bus running" hypothesis is **false**; `services/event-bus` remains an empty reserved root while the function lives in gateway+queue-workers.
- **Billing enforcement**: plan resolution per request (`middleware/store-context.ts:117-134`), frozen-store 403 (102-115), product-quota enforcement at create (`product-execution.adapter.ts:334-352`), webhook-driven subscription lifecycle (`webhook-service/src/index.ts:581-702`). Billing models are enforced, not decorative.

### 5.2 Backend without UI
| Feature | Backend | Missing front | Evidence |
|---|---|---|---|
| GraphQL (admin + storefront) | schema 1,835 lines, routers mounted, REST shim | 0 app consumers; prod flag off | §2; grep |
| AI generation | full credit/usage/rating route set (`routes/ai.ts`, 205 lines) with quota checks | `POST /ai/generate` is a hard stub: inserts a `status:'failed'` usage row with `provider:'none'` and returns 503 `AI_PROVIDER_UNCONFIGURED` (`ai.ts:121-148`); credit purchase returns 503 `AI_CREDIT_PURCHASE_UNAVAILABLE` (198-201). DB schema + API shape exist; no provider integration | `services/api-gateway/src/routes/ai.ts` |
| Invite/contact emails | endpoints accept and persist | the email send is the TODO at `employee.ts:287`, `admin.ts:283`, `contacts.ts:48` — invites are created but never delivered | §3 |

### 5.3 UI without backend
| Feature | UI | Missing back | Evidence |
|---|---|---|---|
| Google/Apple OAuth | login buttons rendered | callback is a placeholder; handler hard-errors | §2 rows |
| Mobile Razorpay subscription/upgrade | pricing + upgrade screens shipped | "TODO: Integrate Razorpay" ×2 | §3 merchant-app rows |
| Mobile product export / edit-nav / hide | menu actions present | handlers TODO | `products_screen.dart:287/799/1076` |
| Operations-portal login/invite/users/stores/marketing | pages routed and styled | bodies are TODO comments; no allowlist auth, no role filtering | §3 portal rows |

### 5.4 Feature flags permanently off in production
`services/api-gateway/wrangler.toml` `[env.production.vars]`: `FEATURE_GRAPHQL = "false"`, `FEATURE_EXTENSIONS = "false"`, `FEATURE_LIQUID = "false"` (lines 213-215) — while staging runs all three "true" (111-113) and substantial code depends on them: extensions evaluated in checkout only when enabled (`storefront.ts:2285-2311`), Liquid bundle parsing in the storefront app (`store-service.ts:661-662`; `src/lib/theme-engine/liquid-hydration-islands.tsx`), app-store extension registry (`app-store.ts`, 2,721 lines; migration `076_app_extension_registry.sql`). Production checkout therefore takes the `null` evaluation branch (`storefront.ts:2311-2317`) — three staged subsystems ship dark to production every deploy.

### 5.5 Certification system in plan mode
`config/runtime/live-production-certification.json:5` `"certificationMode": "credential-gated-plan-ready"` with an `executeRequires` list of 10 unmet prerequisites (lines 14-25). Consistent with AGENTS.md:363 ("Plan mode means executable workflows and evidence contracts only") — but it quantifies that the entire operational-proof apparatus (Grafana dashboards, Prometheus rules, OTel collector under `infrastructure/observability/`; chaos/load suites under `chaos/`, `load/`, `infrastructure/scripts/`) has **no execute-mode evidence**: declared observability/failover/chaos posture is unproven against live infrastructure. tasks/todo.md:212-236 records 14 SKIP entries (Docker Compose, Razorpay test creds, production Supabase/Vercel/Cloudflare/monitoring access) blocking execute mode.

---

## 6. Quantified debt snapshot

| Metric | Value | Source |
|---|---|---|
| Legacy lines carried (`legacy/firebase`, ts/js) | 15,323 across 24 files | wc |
| Genuine TODO markers, active platform | 18 (apps 16, services 3 → 18 after legacy/scripts excluded; 24 incl. legacy) | §3 |
| Files >1,500 lines (active source) | 8 (+2 legacy) — max `storefront.ts` 4,826 | Phase 11 AV-H3 census |
| Placeholder runtime roots | 7 (6 services + shopper-app) + 1 counter-demo (operator-app) | §2 |
| Declared-but-unused workspace deps | `@letbuyy/utils` ×7 apps; `@letbuyy/api-types` in marketing-site | Phase 11 AV-M5 |
| Migration files vs constitution claim | 10 vs "65" (72 archived) | §1.2 |
| Root tracked top-level .md files | 73 | git ls-files |
| Governance artifacts to co-maintain | 117 governance docs + 132 validators + 66 config/runtime files | ls counts |
| Stale required-reading ledgers | 2 (`tasks/todo.md`, `memory/lessons.md`, both 2026-03-01) | §4 D4 |
| Test files | 165 under `tests/` + 6 gateway `__tests__`; **0** unit tests inside `packages/*/src` | find |
| Production-dark feature flags | 3 (GraphQL, Extensions, Liquid) | §5.4 |
| Unimplemented declared capabilities | AI provider, OAuth, invite emails, mobile payments/export, ops-portal auth | §5.2-5.3 |
| Execute-mode operational evidence | 0 (plan mode; 14 recorded SKIPs) | §5.5 |
| Resolved-since-ledger CRITICALs still listed as open | ≥5 (webhook sigs, auth rate limits, price recalc, CORS, security headers) | §4 D4 |

---

## Evidence Index

| # | Path | Lines / artifact |
|---|---|---|
| 1 | `/Users/saai_sidd/Git/Letbuyy_Store/legacy/firebase/functions/src/` | 24 files, 15,323 lines; TODOs at orderNotifications.ts:145, settlementService.ts:536, walletService.ts:487, subscriptionService.ts:279 |
| 2 | `/Users/saai_sidd/Git/Letbuyy_Store/database/supabase/migrations/` | 000_baseline.sql + 073-078, 084, 088, 089 |
| 3 | `/Users/saai_sidd/Git/Letbuyy_Store/docs/archive/migrations-history/` | 72 files |
| 4 | `/Users/saai_sidd/Git/Letbuyy_Store/database/supabase/verification/` | 18 files incl. 065_enterprise_sdlc_lifecycle.sql |
| 5 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/storefront-runtime/src/lib/store-service.ts` | 55-57, 73-74, 92-93, 116-117, 507-512, 519, 661-662, 670, 713-743 |
| 6 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/storefront-runtime/src/lib/demo/urban-kicks-demo.ts` | 340 lines |
| 7 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/mobile/operator-app/lib/main.dart` | 1-36 |
| 8 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/mobile/shopper-app/` | 2 files |
| 9 | `/Users/saai_sidd/Git/Letbuyy_Store/services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}/` | 2 files each |
| 10 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/graphql/schema.ts` | 1,835 lines; routers at src/index.ts:42-43, 350-357 |
| 11 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/identity-platform/src/app/lookup/page.tsx` | 163, 360-361, 483-489 |
| 12 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/identity-platform/src/app/auth/callback/route.ts` | 3-10 |
| 13 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/identity-platform/src/app/api/auth/send-magic/route.ts` | 14-95 |
| 14 | `/Users/saai_sidd/Git/Letbuyy_Store/infrastructure/deployment/helm/letbuyy-production/` + `kubernetes/` | unconsumed charts |
| 15 | TODO inventory grep | 32 raw / 24 genuine hits; per-workspace table §3 (paths inline) |
| 16 | `/Users/saai_sidd/Git/Letbuyy_Store/tasks/todo.md` | 3 (date), 19-44, 212-236 (SKIPs), 242-260 (validator failures) |
| 17 | `/Users/saai_sidd/Git/Letbuyy_Store/memory/lessons.md` | 3 (date), L5 (all.env), L21/22/24/26/27 (since fixed), legacy paths throughout |
| 18 | `/Users/saai_sidd/Git/Letbuyy_Store/AGENTS.md` | 1 (gen date 2026-05-25), 10, 27, 29-55, 69, 71-72, 99, 153, 241, 316-320, 324, 350, 362-363, 367-369, 381 |
| 19 | `/Users/saai_sidd/Git/Letbuyy_Store/services/webhook-service/src/index.ts` | 2-10 (provider adapters), 266-280 (Razorpay sig), 581-702 (subscriptions) |
| 20 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/auth.ts` | 34-44 |
| 21 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/storefront.ts` | 2285-2317 (extension gate), 3685, 3932, 4280 (customer rate limits) |
| 22 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/payments.ts` | 674-677 |
| 23 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/index.ts` | 214-239, 299-320, 471-511, 609-612 |
| 24 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/wrangler.toml` | 20, 55-73, 111-113, 203, 213-215 |
| 25 | `/Users/saai_sidd/Git/Letbuyy_Store/services/queue-workers/wrangler.toml` + `src/platform-queue-consumer.ts` | queue consumers; 167 (circuit breakers); 853 lines |
| 26 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/ai.ts` | 121-148, 198-201 |
| 27 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/{employee,admin,contacts}.ts` | 287 / 283 / 48 |
| 28 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/middleware/store-context.ts` | 102-158 |
| 29 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/execution/product-execution.adapter.ts` | 334-352 |
| 30 | `/Users/saai_sidd/Git/Letbuyy_Store/config/runtime/live-production-certification.json` | 5, 14-25 |
| 31 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/mobile/merchant-app/lib/screens/` | TODOs: pricing_screen.dart:249, upgrade_screen.dart:324, create_store_wizard.dart:279, products_screen.dart:287/799/1076, orders_screen.dart:987, settings_screen.dart:299, error_screen.dart:70 |
| 32 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/platform-operations-portal/src/app/` | TODOs in login/invite/layout/users/stores/marketing/dashboard pages (lines cited §3); 7 pages using `createPlatformOperationsApiClient` |
| 33 | git history | 727 commits; `git log --all -- all.env` empty; root commit 390811f1 |
| 34 | `/Users/saai_sidd/Git/Letbuyy_Store/FORENSIC_REPORT/12-technical-debt.md` | prior-scan rows corrected in §4 D8 |
| 35 | `/Users/saai_sidd/Git/Letbuyy_Store/pnpm-workspace.yaml` | 9, 12-13 |
| 36 | Counts | `tests/` 26 dirs / 165 test files; gateway `__tests__` 6; package src tests 0; root .md 73; governance 117; validators 132; config/runtime 66 |
