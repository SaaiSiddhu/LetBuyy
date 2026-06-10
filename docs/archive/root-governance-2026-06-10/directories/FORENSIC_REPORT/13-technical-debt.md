# Phase 13 — Technical Debt Report

Investigation date: 2026-06-05 (second pass, post-remediation)

Baseline: the first-pass version of this report (same date, pre-merge HEAD). Second pass measured at HEAD `127a850e` (branch `develop`), i.e. after the five-workstream merge wave (`ea12a143` remediation, `f05557e1` WS1 design system, `e50eec28` WS7 hardening, `320bb31f` WS9 settings, `5df85dab` WS5 operations, `f0f70a04` WS10 developer portal) and the three consolidation fixes `eee2ca7e`/`4c97dafa`/`127a850e`.

## Method

- Re-inventoried `legacy/` and `docs/archive/`; re-grep-verified that nothing active references them.
- Re-counted TODO/FIXME/HACK/XXX markers per workspace and read each hit to discard false positives.
- Re-cross-checked the repo's debt ledgers — `tasks/todo.md` (content header 2026-03-01; last git touch 2026-05-31), `memory/lessons.md` (content header 2026-03-01; last git touch 2026-05-24), AGENTS.md "Current Risk Register" (hand-edited 2026-06-05 but risk section untouched) — against current source.
- Re-traced reachability of the first-pass abandoned features and the wiring of partially implemented systems; verified consumers of every new migration (079-089).
- Read the three consolidation-fix commits (`git show`) to characterize merge damage and check for residue (the task brief's specific question).
- Verified flag state per environment in `services/api-gateway/wrangler.toml` and certification mode in `config/runtime/live-production-certification.json`.

---

## Changes since first pass

| Debt item | First pass | Second pass | Verdict |
|---|---|---|---|
| `legacy/firebase` lines | 15,323 / 24 files | **15,323 / 24 files** | unchanged (frozen, isolated) |
| Migration files | 10, gaps 079-083/085-087, constitution claimed 65 | **18, contiguous 000+073–089**, constitution claims 18/233 correctly | RESOLVED (AGENTS.md citation fixed in `0c4a775e`; new shadow/reconciliation migrations add a new latent-debt class, §1.2) |
| Genuine active TODOs | 18 (apps 16 incl. 7 ops-portal, services 3) | **14** (mobile 9, ops-portal 2, gateway 3) | improved — 5 ops-portal page TODOs implemented by WS5; the 3 gateway email TODOs and all 9 mobile TODOs persist |
| Root tracked .md files | 73 | **11** (8 CODEX_* + AGENTS/CLAUDE/README) | mostly archived to `docs/archive/root-residue/…` (72 files); NEW: 3 ledgers embedded inside runtime source trees |
| Stale required-reading ledgers | tasks/todo.md + memory/lessons.md list resolved CRITICALs as open / dead paths | **unchanged** — todo.md Phase 0 boxes still unchecked (lines 19-44), lessons.md still cites `backend/supabase/...`, `apps/web/consumer/...` (13 dead-path references) | STILL-OPEN; AGENTS.md:369 still repeats the stale "Critical security tasks remain" claim |
| Files >1,500 lines (active) | 8–10 (max storefront.ts 4,826) | **11** (max storefront.ts **4,833**); webhook index dropped out (1,311), developer-surface.ts (2,131) and theme-execution.adapter.ts (1,527) entered | worse |
| Placeholder runtimes | 7 + operator-app counter demo | **same 7 + same counter demo**, but now consistently labeled "reserved" across CLAUDE.md/AGENTS.md/runtime-boundaries.md | unchanged code; documentation honest |
| Prod-dark feature flags | 3, undocumented | **3, unchanged**, now governed by new `docs/governance/feature-flag-governance.md` with enable paths | behavior unchanged; documentation debt paid |
| Declared-unused deps | `@letbuyy/utils` ×8 apps, api-types in marketing-site | **unchanged** | STILL-OPEN |
| Dual write ownership (Phase 11 AV-H1) | webhook-service re-implemented order/subscription state | **RESOLVED** — internal gateway endpoints + `single-writer-ownership-validator.mjs`; webhook index shrank 1,511→1,311 | paid down |
| AGENTS.md staleness | wholesale wrong DB section | DB/topology sections corrected by **hand edit**; gen header, console.log/any counts, package list, route counts, risk register stale | partially paid; residue = Phase 11 AV-M8 |
| Merge damage | n/a | three same-day consolidation fixes; characterized in §7; **no residue found** beyond the re-added root ledgers | new, contained |

---

## 1. Legacy systems

### 1.1 `legacy/firebase` — unchanged: quarantined predecessor backend, properly isolated, capability gap unported
- Re-measured: 24 TS/JS files, **15,323 lines** (`find`+`wc`, identical to first pass), plus `firestore.rules`, `storage.rules`, `.firebaserc`, `scripts/migrate-firebase.sh`.
- Isolation re-verified: grep `legacy/` across apps/services/packages/config/infrastructure/scripts → only `scripts/generate-repository-intelligence.mjs` (path scanner). AGENTS.md:100 satisfied.
- TODO markers inside legacy: 4 keyword hits (`subscriptionService.ts:279` plan-change, `walletService.ts:487` + `settlementService.ts:536` admin-role verification, `orderNotifications.ts:145` email sending) — first pass reported "6 TODOs" counting two `XXXX`-masking comment lines later classed as false positives; the substantive list is identical.
- The capability gap stands: wallet/commission/settlement/KYC/returns still have **no successor** in the active platform (re-grep: no wallet/settlement/commission route modules under `services/api-gateway/src/routes/` — current module list of 33 files confirms).

### 1.2 Migration history — citation debt RESOLVED; new shadow/dual-model debt INTRODUCED
- Active migrations: **18 files**, `database/supabase/migrations/000_baseline.sql` + a now-**contiguous** `073`–`089`. The first-pass gaps were filled by the merge wave: `079-083` "additive partition shadow" migrations for `worker_request_logs`/`runtime_telemetry_metrics`/`outbox_events`/`platform_queue_jobs`/`webhook_deliveries` (each header: "the replayable migration does not swap live tables", e.g. 081:1-2); `085-086` orders/products **dual-model reconciliation** ("The JSONB column stays for rollback/compatibility; order_items is the authoritative model" — 085:1-2, creating `dual_model_reconciliation_reports`); `087` theme template drafts (consumed: `theme-execution.adapter.ts:961,1007`); `088` inventory batch RPC (consumed: `product-execution.adapter.ts:633`); `089` queue-job quarantine RPC (consumed: `platform-queue-consumer.ts:835`).
- AGENTS.md citation fixed (commit `0c4a775e`): "Active replay chain: `000_baseline.sql` plus additive forward migrations `073_*.sql` through `089_*.sql`" (AGENTS.md:317), "Baseline public tables detected: 233" (:318, matches `grep -c "CREATE TABLE public\."` = 233), "Supabase migrations | 18" (:383). The 72 superseded migrations remain archived at `docs/archive/migrations-history/`. Verification SQL: 17 files at `database/supabase/verification/` (was 18).
- **New latent debt, two classes:** (a) the five `*_partitioned` shadow tables have **zero runtime consumers** (grep `outbox_events_partitioned|platform_queue_jobs_partitioned|worker_request_logs_partitioned` across services → 0) — schema carried ahead of an unscheduled cutover; (b) orders keep both the JSONB `items` column and the relational `order_items` model with a reconciliation-report table — a deliberate dual representation awaiting convergence. (c) cosmetic: `088_…sql:2` claims "087 remains reserved" while 087 exists beside it.

### 1.3 Superseded-but-still-wired naming/strata — unchanged
`apps/storefront-runtime/src/lib/store-service.ts` (743 lines) still carries every first-pass compatibility shim: `data.user_id || data.custom_user_id` fallbacks (lines 519, 670), `normalizeSiteType` legacy enum translation (507-512), the 25-entry legacy section-type alias map in `normalizeSectionType` (712-743), and legacy template-config array handling (558-609).

---

## 2. Abandoned features (code present, unreachable or non-functional)

| Item | Second-pass state | Evidence |
|---|---|---|
| `apps/mobile/operator-app` | **Unchanged** Flutter counter demo (`lib/main.dart:1-36`, "Flutter Demo", tutorial comments intact) behind a canonical manifest; runtime-boundaries.md:15 now at least calls it a "scaffold" | cited file |
| `apps/mobile/shopper-app` | **Unchanged** 2-file reserved root; now explicitly labeled "reserved" in all three governance authorities | directory listing; runtime-boundaries.md:16 |
| 6 reserved services | **Unchanged** 2 files each; reserved status + named active owners now consistent across CLAUDE.md / AGENTS.md:87 / runtime-boundaries.md:24-33 | directory listings |
| GraphQL API | Still **zero app consumers** (grep `graphql` in apps → only developer-portal *docs text*: page.tsx:15,59-61); `FEATURE_GRAPHQL = "false"` in prod (wrangler.toml:217). Changed: the generated api-client now ships a GraphQL SDK surface (12 references in `packages/typescript/api-client/src/index.ts`) and the dev portal documents the `CART_NOT_SUPPORTED` fail-loud behavior (commit `1dc50144`) — still backend-without-UI, now honestly labeled | cited files; feature-flag-governance.md:18 |
| Apple OAuth button | **Unchanged** decorative `coming-soon`/`aria-disabled` (`lookup/page.tsx:484-487`) | cited file |
| Google OAuth | **Unchanged**: handler hard-fails "not configured" (`lookup/page.tsx:361`); `/auth/callback` placeholder redirects `?error=oauth_unavailable` (`auth/callback/route.ts:7-10`, comment now says "while provider OAuth is owned by the gateway") | cited files |
| Helm/K8s manifests | **Unchanged** unconsumed: `infrastructure/deployment/helm/letbuyy-production/`, `kubernetes/{namespace,runtime-health-probes}.yaml`; grep `helm` in `.github/workflows/` → 0 | directory listing; grep |
| Demo tenant fixture | **Unchanged**: `urban-kicks` short-circuit at `store-service.ts:55-56, 73-74, 92-93, 116` before any API call; fixture `urban-kicks-demo.ts` 340 lines | cited files |

Reachability changes since first pass (formerly placeholder, now wired): the platform-operations-portal dashboard pages (`crm`, `merchant-health`, `support`, `operations`, `tickets`) now render real `IndexTable` screens fed by `loadEmployeeAnalytics`/the ops API client (13 files reference the client; e.g. `crm/page.tsx:1-14` → `EmployeeModuleScreen`); legacy paths `users/stores/marketing` are 5-line redirects into the new modules (`users/page.tsx:1-5` → `/crm`). The `apps/developer-portal` grew from 6 to 9 routed pages with a 2,131-line content surface and is now included in the production deploy workflows (commit `6b9c771a`: `.github/workflows/{deploy-production,production-deploy}.yml`).

---

## 3. Temporary workarounds — TODO/FIXME/HACK inventory

Raw grep hits across apps/services/packages/database/tests/scripts (ts/tsx/dart/mjs/sql): 21; after removing false positives (`+91 XXXXXXXXXX` placeholder now at `settings/subscribe/checkout/SubscribeCheckoutClient.tsx:422` — the file moved into the settings hub; the E.164 regex doc at `packages/shared-types/src/index.ts:34`; 5 self-referential scanner strings in `generate-repository-intelligence.mjs`): **14 genuine markers**, all `TODO` (0 FIXME/HACK/WORKAROUND), plus 4 frozen in legacy.

| Workspace | Count (was) | Items |
|---|---|---|
| apps/mobile/merchant-app | 9 (9) | unchanged set: `pricing_screen.dart:249` + `upgrade_screen.dart:324` Razorpay integration; `create_store_wizard.dart:279` onboarding save; `products_screen.dart:287/799/1076` export/edit-nav/hide; `orders_screen.dart:987` order-details nav; `settings_screen.dart:299` terms/privacy; `error_screen.dart:70` deep link |
| apps/platform-operations-portal | 2 (7) | only `(auth)/login/page.tsx:12` (employee allowlist login) and `(auth)/invite/page.tsx:14` (invite token validation) remain — the dashboard/users/stores/marketing/layout TODOs were implemented by WS5 |
| services/api-gateway | 3 (3) | unchanged: invite/notification emails never sent — `routes/employee.ts:287`, `routes/admin.ts:283`, `routes/contacts.ts:48` ("Send … via Resend") |
| everything else active | 0 (0) | grep |
| legacy (frozen) | 4 (6*) | §1.1; *first-pass count included 2 masking-comment false positives |

Non-annotated workarounds (read-verified, all persist): Vercel install-command Next-removal "workaround" (AGENTS.md:326); demo-tenant short-circuit (§2); legacy column/section-alias shims (§1.3); error-sanitizer 3-code denylist (Phase 11 AV-M3, 122 raw sites); NEW: the non-production internal-secret bypass in `routes/storefront/internal-payment-routes.ts:73` that sibling `internal-billing.ts` does not share (Phase 11 AV-L6); NEW: `domain-boundary-validator.mjs:209` freezing the app API route inventory at the literal `115` (currently true — find count = 115 — but a guaranteed future hand-edit on any route addition).

---

## 4. Architecture drift (declared vs real)

| # | First-pass row | Second-pass verdict | Evidence |
|---|---|---|---|
| D1 | AGENTS.md claimed 65 migrations / 228 tables / 065-file evidence / sequential rule violated | **RESOLVED**: AGENTS.md:316-322/363/383 corrected by `0c4a775e`; disk = 18 contiguous files / 233 baseline tables; sequence contiguous | §1.2; Phase 11 AV-C1 |
| D2 | Three disagreeing runtime inventories | **RESOLVED**: CLAUDE.md + AGENTS.md:83-90 + runtime-boundaries.md + disk all = 21 roots (12 apps, 3 implemented services, 6 reserved); `runtime-topology-validator.mjs:26-27` enforces both docs | Phase 11 AV-C2 |
| D3 | AGENTS.md package inventory missing payments/app-engine/extension-host/dart api_client | **STILL-OPEN**: AGENTS.md:30-56 unchanged; pnpm-workspace.yaml:8,10-11 still registers them | manifests |
| D4 | Stale ledgers presenting resolved CRITICALs as open | **STILL-OPEN and now triple-sourced**: `tasks/todo.md:19-44` Phase 0 boxes unchecked (secret rotation, webhook sigs, auth rate limiting — all long implemented); `memory/lessons.md` still cites 13 dead `backend/supabase`/`apps/web` paths (lines 11-59 sample); AGENTS.md:369 (untouched by the hand edit) still says "Critical security tasks remain in tasks/todo.md…". All three are required pre-edit reading (AGENTS.md:352) | cited lines; git log: lessons.md last touched 2026-05-24, todo.md 2026-05-31 — both pre-merge-wave |
| D5 | `all.env` historic-commit risk carried with no closure record | **STILL-OPEN**: AGENTS.md:370 + todo.md:19-32 unchanged; git history still shows zero trace (`git log --all -- all.env` empty at first pass; repo now 802 commits, root unchanged) | git history |
| D6 | "Placeholder app roots are forbidden" (AGENTS.md:154) vs 7 reserved roots | **Narrowed**: reserved regime now consistently declared in all three authorities; the prose conflict remains in AGENTS.md:154, and operator-app is still a canonical root wearing a counter demo | Phase 11 AV-L2 |
| D7 | Constitution not regenerated despite triggers | **MUTATED, not resolved**: it was *hand-edited* instead — header still claims generator output of 2026-05-25; console.log "45 files" (actual 2 logger sinks), `any` "51 files" (actual 12), "31 Hono route modules" (actual 33), "274 Next app route files" (actual 306), per-app scanned-file counts all stale | Phase 11 AV-M8 |
| D8 | First-pass corrections of the older 12-report | **STAND**: outbox cron (wrangler `*/5`/`*/1` lines 20/103/207 → `runScheduledDispatch` index.ts:546,697-698), search-queue consumers, magic-link — all re-confirmed wired; additionally queue dispatch now also has Cloudflare-queue triggers (commit `8d2bd764`, `enqueueScheduledDispatchTriggers` index.ts:350-355) | cited files |
| D9 (new) | runtime-boundaries.md vs wrangler reality | webhook↔gateway is now a **formalized bidirectional service-binding cycle** (`API_GATEWAY_SERVICE` in webhook wrangler:61/100; `WEBHOOK_SERVICE` in gateway wrangler:180/284) that no governance doc names as a cycle — the intended cost of single-writer, undocumented as an availability coupling | Phase 11 AV-M6 |

---

## 5. Incomplete features and partially implemented systems

### 5.1 Systems verified COMPLETE end-to-end (re-checked)
- **Event/outbox pipeline**: outbox writes now **centralized in the gateway** (`execution/event-execution.adapter.ts:59`, `outbox-execution.adapter.ts:109`; webhook-service emits via `/v1/internal/events` — commit `10d47da3`; regression test `__tests__/payments.test.ts:101` bans the table literal from webhook source) → cron preflight + dispatch (`index.ts:546-` …`697-698`) → queue triggers (`8d2bd764`) → `services/queue-workers` consumers with circuit breakers (consumer:170,219-241), storm controls + job quarantine via migration 089 RPC (consumer:835; commit `e3174249`).
- **Single-writer payment/billing path** (new since first pass): provider webhook → signature verify → `payment_webhook_events` idempotent upsert (webhook index.ts:76-86) → gateway internal endpoints over service binding (`/v1/storefront/internal/payments/*`, `/v1/internal/billing/subscriptions/*`) → `PaymentExecutionAdapter`/`SubscriptionExecutionAdapter` (one state machine). Validator-enforced.
- **Billing enforcement**: unchanged complete (plan resolution, frozen-store 403, product quota).

### 5.2 Backend without UI
| Feature | Backend | Missing front | Δ |
|---|---|---|---|
| GraphQL (admin + storefront) | schema 1,835 lines; routers mounted (index.ts:423-449); api-client GraphQL SDK generated | 0 app consumers; prod flag off (wrangler:217) | unchanged behavior; now documented as staged rollout (feature-flag-governance.md:18) and fail-loud on unsupported cart (`1dc50144`) |
| AI generation | full credit/usage/rating routes | `POST /ai/generate` still a hard stub: inserts `status:'failed'`, `provider:'none'`, returns 503 `AI_PROVIDER_UNCONFIGURED` (`ai.ts:121-148`) | unchanged |
| Invite/contact emails | endpoints persist | send still TODO (`employee.ts:287`, `admin.ts:283`, `contacts.ts:48`) | unchanged |
| Partitioned hot tables (new) | migrations 079-083 create `*_partitioned` shadows | zero runtime consumers; cutover unscheduled | new |

### 5.3 UI without backend
| Feature | UI | Missing back | Δ |
|---|---|---|---|
| Google/Apple OAuth | buttons rendered | callback placeholder; handler hard-errors | unchanged |
| Mobile Razorpay subscription/upgrade | screens shipped | "TODO: Integrate Razorpay" ×2 | unchanged |
| Mobile product export / edit-nav / hide; order-details nav | actions present | handlers TODO | unchanged |
| Operations-portal login/invite | `(auth)` pages routed | bodies are TODO comments — **no employee auth in front of a now-functional dashboard** (dashboard pages render real data via the ops API client; the auth gate that should protect them is the part still unimplemented in this app) | narrowed but sharper: was 7 placeholder pages, now 2 — and they are the access-control pages |
| Settings hub (new, WS9) | 18 settings pages under `[store]/settings/` | several panes are explicit capability-gap screens via `BackendNeededPane.tsx` (component exists for exactly this purpose) — honest scaffolding, not silent stubs | new surface |

### 5.4 Feature flags permanently off in production
Unchanged values: `[env.production.vars]` `FEATURE_GRAPHQL/FEATURE_EXTENSIONS/FEATURE_LIQUID = "false"` (wrangler.toml:217-219) vs `"true"` default/staging (34-36, 113-115); production checkout still takes the null-evaluation branch (`storefront.ts:2287-2317`). Changed: **documented** — `docs/governance/feature-flag-governance.md` (new) tabulates each flag's prod state, code surface, and enable path, and forbids describing them as production-live (lines 14-22). Debt reclassified from "undocumented fork" to "declared staged rollout with carried dark code".

### 5.5 Certification system in plan mode — unchanged
`config/runtime/live-production-certification.json:5` still `"certificationMode": "credential-gated-plan-ready"`. tasks/todo.md:212-236 SKIP entries unchanged (Docker, Razorpay test creds, production provider access). Execute-mode operational evidence remains 0.

---

## 6. Quantified debt snapshot

| Metric | First pass | Second pass | Source |
|---|---|---|---|
| Legacy lines carried (`legacy/firebase`, ts/js) | 15,323 / 24 files | **15,323 / 24 files** | wc |
| Genuine TODO markers, active platform | 18 | **14** (mobile 9, ops-portal 2, gateway 3); +4 frozen legacy | §3 |
| Files >1,500 lines (active source) | 8–10 | **11** — max `storefront.ts` 4,833 (+7) | Phase 11 AV-H3 census |
| Placeholder runtime roots | 7 + counter-demo | **7 + counter-demo** (now labeled reserved) | §2 |
| Declared-but-unused workspace deps | utils ×7-8 apps; api-types ×1 | **utils ×8 apps; api-types in marketing-site** — unchanged | Phase 11 AV-M5 |
| Migration files vs constitution | 10 vs "65" | **18 vs "18"** — reconciled; 5 unconsumed shadow tables + 1 dual-model carried | §1.2 |
| Root tracked top-level .md | 73 | **11**; 72 archived; **3 ledgers embedded in runtime source trees** (merchant settings route dir, developer-portal root, ui package) | git ls-files |
| Governance artifacts to co-maintain | 117+132+66 = 315 | **118 docs + 133 validators + 66 config = 317** (suite executes 129) | ls counts; suite output |
| Stale required-reading ledgers | 2 | **2** (todo.md, lessons.md) + AGENTS.md risk register repeating them | §4 D4 |
| Test files | 165 tests/ + 6 gateway; 0 package-src tests | **169 tests/ + 7 gateway `__tests__`; 0 package-src tests** | find |
| Production-dark feature flags | 3 undocumented | **3, documented** (feature-flag-governance.md) | §5.4 |
| Unimplemented declared capabilities | AI, OAuth, invite emails, mobile payments/export, ops-portal auth | same list **minus** ops-portal dashboards (built), **ops-portal auth still missing** | §5.2-5.3 |
| Execute-mode operational evidence | 0 (14 SKIPs) | **0 (14 SKIPs)** | §5.5 |
| Resolved-since-ledger CRITICALs still listed as open | ≥5 | **≥5, now in three documents** (todo.md, lessons.md, AGENTS.md:369) | §4 D4 |
| Raw `error.message` route sites | 121 | **122** across 19 files | grep |
| `console.log` files (prod source) | 0 | **2**, both designated eslint-exempt structured-logger sinks (`apps/{app,theme}-marketplace/src/lib/logger.ts`) — compliant by design | grep + read |
| Commits / tracked files | 727 / — | **802 / 3,043** (75-commit merge wave) | git |

---

## 7. Merge-wave damage and residue (consolidation commits `eee2ca7e`, `4c97dafa`, `127a850e`)

The three same-day "fix(consolidation)" commits are the recorded blast radius of merging five parallel workstreams into `develop`:

- **`eee2ca7e` "repair merged settings types"** — the damage class was *cross-workstream API rename collision*: the merged settings barrel (`apps/merchant-control-plane/src/components/settings/index.ts`) exported symbols that no longer existed post-merge (`settingsIndexGroups`, `getSettingsReadyItems`, `getSettingsItemHref`, `SettingsIndexGroup/Item/Status`); the fix re-pointed it at the surviving API (`SETTINGS_NAV_GROUPS/ITEMS`, `getSettingsItemByPath`) and added the missing `iconName`/`MaterialIconName` prop to `SettingsPane`, plus local row-type definitions in 3 ops-portal IndexTables whose shared types had been lost in the merge. **Residue check: clean** — repo-wide grep for every dead symbol name → 0 matches; the IndexTables now self-define row types and import only `@letbuyy/ui`.
- **`4c97dafa` "restore verification contracts"** — restored gateway `index.ts` wiring (+71/-17), an ops page (+26), and a 1-line test; but it also **re-added two process ledgers at root** (`CODEX_MASTER_EXECUTION_LEDGER.md` +472 lines, `CODEX_WS12_LEDGER.md` +147) hours after `0c4a775e` had swept 72 such files into `docs/archive/root-residue/` — the residue-producing process outlived its own cleanup. **Residue: the 8 root CODEX_* files** (Phase 11 AV-M9).
- **`127a850e` "align local stack scripts governance"** — pure relocation `scripts/dev/local-stack-{up,down}.mjs` → `scripts/utilities/` + 1 ledger line; a validator-placement fix. **Residue: none.**

Independent residue scan beyond what the fixes touched: typecheck-style symbol greps over the renamed settings API → clean; governance suite passes (129 validators) at HEAD; worktree clean apart from `.claude/` and in-flight forensic-report edits. The only merge artifacts that remain *in-tree* are organizational, not functional: the three workstream ledgers committed inside runtime source trees (`apps/merchant-control-plane/src/app/[store]/settings/CODEX_WS9_LEDGER.md`, `apps/developer-portal/CODEX_WS10_LEDGER.md`, `packages/typescript/ui/CODEX_WS1_LEDGER.md`) and the 8 root mission/ledger files.

New debt added by the merge wave (net of what it paid down): the two >1,500-line entrants (`developer-surface.ts` 2,131; `theme-execution.adapter.ts` 1,527) and the +177-line editor page; 5 unconsumed partition-shadow tables + the orders dual-model awaiting convergence (§1.2); the formalized gateway↔webhook availability cycle (§4 D9); the inconsistent internal-secret failure modes across the three new internal routers (Phase 11 AV-L6); the frozen `115` route-count literal in `domain-boundary-validator.mjs:209`; and the embedded ledgers. Paid down by the same wave: dual write ownership, runtime-inventory drift, the DB-section falsehood, root residue (73→11), 5 ops-portal placeholder pages, the sessionless by-email lookup, and the feature-flag documentation gap.

---

## Evidence Index

| # | Path | Lines / artifact |
|---|---|---|
| 1 | `/Users/saai_sidd/Git/Letbuyy_Store/legacy/firebase/functions/src/` | 24 files, 15,323 lines; TODOs at orderNotifications.ts:145, settlementService.ts:536, walletService.ts:487, subscriptionService.ts:279 |
| 2 | `/Users/saai_sidd/Git/Letbuyy_Store/database/supabase/migrations/` | 18 files: 000_baseline.sql + 073-089 contiguous; 081:1-2 (shadow header), 085:1-2 (dual-model header), 088:2 (stale 087 comment) |
| 3 | `/Users/saai_sidd/Git/Letbuyy_Store/docs/archive/migrations-history/` | 72 archived migrations (unchanged) |
| 4 | `/Users/saai_sidd/Git/Letbuyy_Store/database/supabase/verification/` | 17 files |
| 5 | shadow-table consumer scan | grep `*_partitioned` across services → 0 consumers; 087/088/089 consumers: theme-execution.adapter.ts:961,1007; product-execution.adapter.ts:633; platform-queue-consumer.ts:835 |
| 6 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/storefront-runtime/src/lib/store-service.ts` | 743 lines; 55-56, 73-74, 92-93, 116 (demo short-circuit), 507-512, 519, 558-609, 670, 712-743 (legacy shims) |
| 7 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/storefront-runtime/src/lib/demo/urban-kicks-demo.ts` | 340 lines |
| 8 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/mobile/operator-app/lib/main.dart` | 1-36 (counter demo, unchanged) |
| 9 | reserved roots | `apps/mobile/shopper-app/` 2 files; 6 services 2 files each; runtime-boundaries.md:15-16, 24-33 |
| 10 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/graphql/schema.ts` | 1,835 lines; gates at index.ts:423-449; api-client GraphQL SDK refs ×12 in `packages/typescript/api-client/src/index.ts` |
| 11 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/identity-platform/src/app/lookup/page.tsx` | 163, 361, 484-487 |
| 12 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/identity-platform/src/app/auth/callback/route.ts` | 5-10 |
| 13 | `/Users/saai_sidd/Git/Letbuyy_Store/infrastructure/deployment/helm/letbuyy-production/` + `kubernetes/` | unconsumed (grep `helm` in workflows → 0) |
| 14 | TODO inventory | 21 raw / 14 genuine active + 4 legacy; per-workspace table §3 |
| 15 | `/Users/saai_sidd/Git/Letbuyy_Store/tasks/todo.md` | 3 (header 2026-03-01; git mtime 2026-05-31), 19-44 (stale Phase 0), 212-236 (SKIPs), 242-260 (dev-machine validator failures) |
| 16 | `/Users/saai_sidd/Git/Letbuyy_Store/memory/lessons.md` | header 2026-03-01 (git mtime 2026-05-24); 13 `backend/supabase`/`apps/web` dead-path references (sample lines 11-59) |
| 17 | `/Users/saai_sidd/Git/Letbuyy_Store/AGENTS.md` | 1 (stale gen header), 13, 30-56 (stale package list), 72-73 (stale scan counts), 83-90, 100, 154, 316-322, 326, 352, 363, 369-371, 382-383 |
| 18 | `/Users/saai_sidd/Git/Letbuyy_Store/services/webhook-service/src/` | index.ts 1,311 lines (76-86, 96-103, 304, 361-402, 462-508, 584-614); gateway-order-transitions.ts; gateway-billing-transitions.ts; gateway-events.ts |
| 19 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/storefront.ts` | 4,833 lines; 2245-2353, 2287-2317, 3688/3766/3935/4284, 3869-3890 |
| 20 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/index.ts` | 350-355 (queue triggers), 423-449, 459-460 (internal routers), 546, 586, 697-698 (cron) |
| 21 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/wrangler.toml` | 20, 34-36, 103, 113-115, 180-181, 207, 217-219, 284-285 |
| 22 | `/Users/saai_sidd/Git/Letbuyy_Store/services/webhook-service/wrangler.toml` | 61-62, 100-101 (API_GATEWAY_SERVICE) |
| 23 | `/Users/saai_sidd/Git/Letbuyy_Store/services/queue-workers/src/platform-queue-consumer.ts` | 170, 219-241 (circuit breakers), 835 (quarantine RPC) |
| 24 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/ai.ts` | 121-148 (stub unchanged) |
| 25 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/{employee,admin,contacts}.ts` | 287 / 283 / 48 (email TODOs) |
| 26 | `/Users/saai_sidd/Git/Letbuyy_Store/config/runtime/live-production-certification.json` | 5, 14-25 (plan mode unchanged) |
| 27 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/mobile/merchant-app/lib/screens/` | 9 TODOs (paths in §3) |
| 28 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/platform-operations-portal/src/` | 29 ts/tsx, 17 pages; (auth)/login:12 + (auth)/invite:14 TODOs; 13 files using ops API client; redirect stubs e.g. users/page.tsx:1-5; crm/page.tsx:1-14 |
| 29 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/merchant-control-plane/src/app/[store]/settings/` | 18 pages; components/settings 7 files incl. BackendNeededPane.tsx; embedded CODEX_WS9_LEDGER.md; SubscribeCheckoutClient.tsx:422 (relocated phone placeholder) |
| 30 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/developer-portal/` | 9 pages; src/lib/developer-surface.ts 2,131 lines; CODEX_WS10_LEDGER.md; deploy inclusion commit 6b9c771a (.github/workflows/{deploy-production,production-deploy}.yml) |
| 31 | `/Users/saai_sidd/Git/Letbuyy_Store/docs/governance/feature-flag-governance.md` | 14-22 (flag table + enable paths) |
| 32 | `/Users/saai_sidd/Git/Letbuyy_Store/scripts/validators/` | 133 files; single-writer-ownership-validator.mjs; runtime-topology-validator.mjs:26-27; domain-boundary-validator.mjs:209 (route count 115), 215, 229-241; suite run → "passed (129 validators)" |
| 33 | consolidation commits | `git show eee2ca7e` (settings barrel + iconName + 3 IndexTable local types), `4c97dafa` (+619 ledger lines at root, gateway index +71, ops page +26, test +1), `127a850e` (scripts/dev→utilities move); dead-symbol residue grep → 0 |
| 34 | embedded ledgers | `git ls-files`: settings route dir CODEX_WS9_LEDGER.md; developer-portal CODEX_WS10_LEDGER.md; ui package CODEX_WS1_LEDGER.md; root = 8 CODEX_* + AGENTS/CLAUDE/README |
| 35 | `/Users/saai_sidd/Git/Letbuyy_Store/docs/archive/root-residue/2026-06-05-foundation-hardening/` | 72 archived files (incl. Audit/, 40+ CODEX_* missions/ledgers) |
| 36 | counts | tests/ 169 test files; gateway `__tests__` 7; package-src tests 0; app API routes (find route.ts under app/api) = 115; Next route files (page/layout/route/loading/error/not-found) = 306; governance docs 118; config/runtime 66; tracked files 3,043; commits 802 |
| 37 | git provenance | merge wave: ea12a143, f05557e1, e50eec28, 320bb31f, 5df85dab, f0f70a04; key fixes: 0c4a775e (docs reconcile + archive sweep), 9b5e0604/964c46d1 (webhook→gateway routing), 10d47da3 (outbox centralize), 86e65460 (internal payment split), 6f5284ed (dual-model), 5346ced9 (partition shadows), e3174249 (storm controls), d7821ff6 (template drafts), 1dc50144 (GraphQL fail-loud), 6b9c771a (devportal deploy) |
| 38 | `/Users/saai_sidd/Git/Letbuyy_Store/FORENSIC_REPORT/11-architecture-violations.md` | second-pass companion (violation verdicts cross-referenced) |
