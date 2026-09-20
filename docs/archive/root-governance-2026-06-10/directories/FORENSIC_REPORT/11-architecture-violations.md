# Phase 11 — Architecture Violation Report

Investigation date: 2026-06-05 (second pass, post-remediation)

First-pass scan: 2026-06-05 (pre-remediation, HEAD before the five-workstream merge wave). Second pass re-verified every first-pass violation against HEAD `a8cd5fde` (branch `develop`, 2026-06-05 23:22 IST) — i.e. after merge commits `38879413` (letbuyy-remediation), `ee03071a` (WS1-designsystem), `18ddd1d5` (WS7-hardening), `59d46886` (WS9-settings), `fbc16178` (WS5-operations), `eda7d714` (WS10-devportal) and the three consolidation fixes `218a0905`/`98b7653c`/`a8cd5fde`.

## Method

- Read the declared rules first: root `AGENTS.md` (header still says generated 2026-05-25; database/topology sections hand-edited in commit `9f09cf45` "docs(governance): reconcile runtime topology honesty", 2026-06-05), `CLAUDE.md` (same commit), and `docs/governance/` (now 118 files; primary boundary authorities re-read in full: `runtime-boundaries.md`, `feature-flag-governance.md` (new)).
- Re-derived the workspace dependency graph from `pnpm-workspace.yaml` plus every `package.json` under `apps/`, `services/`, `packages/`.
- Re-ran the grep-based import scans from the first pass (app→app, package→runtime, deep relatives, `legacy/` references, deprecated aliases, `@supabase/supabase-js` in apps, `service_role`, secret patterns, CORS, auth bypass, localStorage auth, module-level mutable state, raw `error.message`, table-write ownership per workspace), plus targeted scans of the new surfaces (settings hub, `@letbuyy/ui`, developer portal, operations portal, internal gateway routes).
- Ran the repository's own governance suite: `node scripts/validate-governance.mjs` → **"Governance validation passed (129 validators)"** on 2026-06-05 (isolated workspace). `scripts/validators/` now contains 133 validator files. New validators verified by reading: `single-writer-ownership-validator.mjs`, `runtime-topology-validator.mjs`, `domain-boundary-validator.mjs` (expanded app-local DB/credential pattern bans).
- Read the consolidation-fix commits (`git show 218a0905/98b7653c/a8cd5fde`) to characterize merge damage and check for residue.
- Spot-read all files cited below. Excluded: `node_modules`, `.git`, `dist`, `.next`, `build`, `.dart_tool`, `.turbo`, `test-results`, `artifacts`, `coverage`.

Severity scale unchanged: **Critical** = breaks declared platform model or creates exploitable exposure; **High** = contradicts a written rule with concrete operational cost; **Medium** = drift/coupling with measurable cost; **Low** = hygiene.

---

## Changes since first pass

| First-pass ID | First-pass severity | Second-pass verdict | One-line basis |
|---|---|---|---|
| AV-C1 (stale DB constitution) | Critical | **RESOLVED (with residue → AV-M8)** | AGENTS.md DB section now matches `database/supabase/migrations/` exactly (18 files, contiguous 000+073–089, 233 tables); but the file was hand-edited, not regenerated — header date and several scan-derived counts are still stale |
| AV-C2 (three disagreeing runtime maps) | Critical | **RESOLVED** | CLAUDE.md, AGENTS.md:83-90, runtime-boundaries.md, and disk all now declare the same 21 roots (12 apps + 3 implemented services + 6 reserved); `runtime-topology-validator.mjs:23-28` enforces CLAUDE.md AND runtime-boundaries.md against the canonical list |
| AV-H1 (dual write ownership) | High | **RESOLVED** | webhook-service's only direct writes are to its own `payment_webhook_events` + webhook-delivery RPCs; orders/products/subscriptions/sites/billing_history/outbox_events mutations route through gateway internal endpoints over a service binding; `single-writer-ownership-validator.mjs` + a source-level regression test enforce it |
| AV-H2 (password verify in Next app) | High | **STILL-OPEN** | unchanged byte-for-byte at the decision points; now additionally *sanctioned* by `domain-boundary-validator.mjs:215,233,240` (identity-platform lib is whitelisted for `password_hash`) |
| AV-H3 (storefront.ts god file) | High | **STILL-OPEN (worse)** | storefront.ts grew 4,826 → **4,833** lines despite the internal-payment split (233 lines extracted, more added); active >1,500-line files grew 10 → **11** with two new entrants |
| AV-H4 (utils service-role edge) | High | **STILL-OPEN** | `getSupabaseAdmin()` unchanged; still declared by 8 apps, still 0 importers; still invisible to the new domain-boundary scan (pattern would not match an `@letbuyy/utils` import) |
| AV-H5 (root hygiene / artifacts) | High | **PARTIALLY RESOLVED → downgraded to Medium (AV-M9)** | root tracked .md files 73 → 11; `Audit/` + 62 process files archived to `docs/archive/root-residue/2026-06-05-foundation-hardening/` (72 files); `build/` now git-ignored; `.tsbuildinfo` gone; residue: 8 CODEX_* files still at root, 3 ledgers embedded *inside runtime source trees* (new) |
| AV-M1 (credentialed wildcard CORS) | Medium | **STILL-OPEN** | identical regex + `credentials: true`, now at `index.ts:391,398` |
| AV-M2 (per-isolate mutable state) | Medium | **STILL-OPEN** | all 4 module-level Maps remain (rateLimit, wasm cache, rest-shim counter, queue circuit breakers — breaker now at consumer line 170) |
| AV-M3 (raw error.message denylist) | Medium | **STILL-OPEN** | 121 → **122** raw sites across 19 files; sanitizer still maps only 3 codes; `employee.ts:60` AUTH_ERROR gap unchanged |
| AV-M4 (tenant-core→theme-engine; api-types fan-out) | Medium | **STILL-OPEN** | both package.json edges unchanged; api-types still 14 deps / 1 importer |
| AV-M5 (declared-unused deps) | Medium | **STILL-OPEN** | `@letbuyy/utils` ×8 apps unused; `@letbuyy/api-types` in marketing-site unused |
| AV-M6 (gateway↔webhook coupling) | Medium | **STILL-OPEN (now formalized & bidirectional)** | the single-writer fix *added* the reverse binding: webhook-service wrangler.toml now binds `API_GATEWAY_SERVICE` while gateway keeps `WEBHOOK_SERVICE` — an explicit two-worker cycle, still undocumented as a cycle in governance |
| AV-M7 (prod-dark feature flags) | Medium | **STILL-OPEN (now documented)** | flags unchanged (`wrangler.toml:217-219` false in prod, 34-36/113-115 true elsewhere); NEW `docs/governance/feature-flag-governance.md` documents all three with enable paths — drift converted to declared staged rollout |
| AV-L1 (`any` files) | Low | **STILL-OPEN** | 11 → **12** files (app-store.ts joined) |
| AV-L2 (placeholder runtimes) | Low | **STILL-OPEN (now consistent)** | same 7 placeholder roots + operator-app counter demo; AGENTS.md/CLAUDE.md/runtime-boundaries.md now all label them "reserved, not implemented" so the AGENTS.md:153 conflict is narrowed to operator-app (canonical manifest over a stock demo) |
| AV-L3 (employee.ts AUTH_ERROR) | Low | **STILL-OPEN** | `employee.ts:60` unchanged |
| AV-L4 (sessionless by-email lookup) | Low | **RESOLVED** | endpoint now gated by `requireStorefrontInternal` (internal app signature) at `storefront.ts:3871` |
| AV-L5 (governance-plane sprawl) | Low | **STILL-OPEN (grew)** | 117→118 docs, 132→133 validators, 66 config/runtime — 317 co-maintained artifacts |
| — | — | **NEW: AV-M8, AV-M9, AV-L6, AV-L7** | see Section 3 |

Net: 2 Critical resolved, 1 High resolved, 1 High downgraded, 1 Low resolved; 4 new findings (2 Medium, 2 Low), all drift/hygiene class — no new Critical or High.

---

## 1. Declared rules (summary of what violations are measured against)

From `AGENTS.md` (sections re-read at HEAD `a8cd5fde`):
- Import direction and runtime segmentation: AGENTS.md:119-125 (apps never import apps; services never import apps; packages never import runtimes; no `legacy/*`/`infrastructure/*` imports).
- `services/api-gateway` is "the sole Commerce API backend… not app-local business logic or direct database clients" (AGENTS.md:62).
- Never expose service-role keys to client components (AGENTS.md:66); never store auth tokens in localStorage (AGENTS.md:67); payments must recalculate prices server-side with idempotency (AGENTS.md:68).
- Errors: "Unexpected errors must log internally and return sanitized `INTERNAL_ERROR` responses" (AGENTS.md:302).
- "Do not duplicate auth logic between Next handlers and the worker without documenting the canonical owner" (AGENTS.md:312); accounts app owns merchant login (AGENTS.md:308).
- Database governance (corrected in `9f09cf45`): "Active replay chain: `000_baseline.sql` plus additive forward migrations `073_*.sql` through `089_*.sql`" (AGENTS.md:317); "Baseline public tables detected: 233" (AGENTS.md:318); "Supabase migrations | 18" (AGENTS.md:383).
- Canonical Active Runtimes (corrected): 12 apps + 3 implemented services + 6 reserved roots (AGENTS.md:83-90).
- Deprecated aliases forbidden (AGENTS.md:89-90; CLAUDE.md "Deprecated Runtime Policy").

From `docs/governance/runtime-boundaries.md` (rewritten in `9f09cf45`): 12 app boundaries incl. `apps/developer-portal` (line 9) and `apps/mobile/shopper-app` now explicitly "reserved" (line 16); 3 service boundaries incl. `services/queue-workers` (line 22); 6 reserved service roots each with a named current active owner (lines 24-33); boundary enforcement list (lines 35-46).

From `CLAUDE.md` (rewritten in `9f09cf45`): canonical runtime map = 12 apps + 3 services + 6 services tagged "(reserved, not implemented)", plus an explicit Reserved-roots paragraph and the validation requirement.

From `docs/governance/feature-flag-governance.md` (new): the three gateway flags are "staged rollout controls… must not be described as production-live behavior while the production value is `false`" (lines 14-22).

---

## 2. Boundary rules checked and found CLEAN (re-verified second pass)

| Rule | Result | Evidence |
|---|---|---|
| App→app source imports | 0 found | re-grep across apps/services/packages — no matches; new surfaces checked specifically: settings hub imports only `@letbuyy/ui` + `@letbuyy/shared-types`; developer-portal src imports only `@letbuyy/ui`; ops-portal `_local-ui` components are app-local composites |
| Package→runtime imports | 0 found | `@letbuyy/ui` (the WS1 growth area, now 20 files / 6,083 lines) imports only `react`/`lucide-react`; package.json deps are `@tailwindcss/vite` + `lucide-react` + react peer deps only |
| Deep relative imports crossing workspace roots | 0 found | re-grep — no matches |
| Active code importing `legacy/` | 0 found | only the intelligence generator references the path |
| Deprecated alias references in active source/config | 0 found | re-grep — docs/FORENSIC_REPORT history only |
| Direct `@supabase/supabase-js` imports in apps | 0 found | all DB access in services via `@letbuyy/infrastructure/supabase-adapter`; additionally `domain-boundary-validator.mjs:229-238` now *bans* direct DB/provider-SDK patterns in every `apps/*/src/{app/api,lib}` file |
| Auth tokens in localStorage | 0 found | unchanged theme/lang/wishlist usage only |
| Hardcoded live secrets | 0 found | repo-wide pattern grep — no matches |
| Auth bypass flags | 0 found | grep — no matches |
| `console.log` in production source | 2 files, both designated logger sinks | `apps/{app-marketplace,theme-marketplace}/src/lib/logger.ts:24` — eslint-exempted structured-JSON emitters that are "the ONLY module permitted to call console.*" (logger.ts:1-8); not stray debug output |
| Server-side price recalculation + idempotency | implemented | order create unchanged (`storefront.ts:2245-2353`, idempotency claim ~2266); internal confirm/failure paths route through `PaymentExecutionAdapter` with `providerEventId`/`idempotencyKey` (`routes/storefront/internal-payment-routes.ts:153-208`) |
| Webhook signature verification + event idempotency | implemented | `payment_webhook_events` upsert on `(provider,provider_event_id)` (`webhook-service/src/index.ts:76-86`), status patch 96-103 |
| Single-writer table ownership (NEW check) | enforced | `single-writer-ownership-validator.mjs:22-43` forbids webhook-service writes to orders/products/subscriptions/sites/billing_history/outbox_events and queue-workers writes to outbox_events, plus forbidden gateway-owned RPC names (53-62); `services/api-gateway/src/__tests__/payments.test.ts:101` asserts webhook source contains no `outbox_events` literal |
| Runtime inventory consistency (NEW check) | enforced | `runtime-topology-validator.mjs:23-28` asserts every canonical root has a manifest, appears in deployment topology, in CLAUDE.md, and in runtime-boundaries.md |

The repo passes its **own** 129-validator suite (run 2026-06-05, isolated workspace; note `tasks/todo.md:242-260` still records the Stale artifact validator failing on developer machines over local `node_modules`/`.turbo` — that ledger entry predates the merge wave and was not re-tested on a dev machine here).

---

## 3. Violations

### CRITICAL

*(none open at second pass)*

**AV-C1 — RESOLVED. Constitution described a database that no longer existed.**
Verified resolved by commit `9f09cf45`: AGENTS.md:316-322 now reads "Migration root: `database/supabase/migrations`. Active replay chain: `000_baseline.sql` plus additive forward migrations `073_*.sql` through `089_*.sql`. Baseline public tables detected: 233 `CREATE TABLE public.*` statements in `000_baseline.sql`. … Duplicate/non-standard migration numeric prefixes detected: none." AGENTS.md:363 now points operational-control evidence at "`database/supabase/migrations/000_baseline.sql` operational lifecycle tables" instead of the relocated `065_*.sql`. Disk reality matches exactly: `database/supabase/migrations/` = **18 files**, `000_baseline.sql` + a now-**contiguous** 073–089 (the first-pass gaps 079-083/085-087 were filled by the merge wave: 079-083 partition shadows, 085-086 dual-model reconciliation, 087 theme template drafts); `grep -c "CREATE TABLE public\." 000_baseline.sql` = 233. The "sequential" rule (AGENTS.md:322) is now satisfied. Residual staleness in the same file is recorded as AV-M8.

**AV-C2 — RESOLVED. Runtime inventories reconciled and validator-enforced.**
All three authorities now agree with disk: (a) `CLAUDE.md` lists 9 web apps incl. `apps/developer-portal`, 3 mobile apps, `services/{api-gateway,webhook-service,queue-workers}`, and 6 reserved services each tagged "(reserved, not implemented)" with an ownership paragraph; (b) `docs/governance/runtime-boundaries.md:5-33` lists the identical 12+3+6 set, names `queue-workers` an implemented runtime (line 22), marks `shopper-app` "reserved" (line 16), and names the current active owner for every reserved root (lines 28-33); (c) AGENTS.md:83-90 "Canonical Active Runtimes" lists the same 21 roots and AGENTS.md:13 states "21 canonical runtime roots"; (d) disk: `ls apps/` = 9 + `ls apps/mobile/` = 3, `ls services/` = 9 (3 implemented + 6 two-file scaffolds). Enforcement: `scripts/validators/governance-common.mjs:57-106` hard-codes the 21 `canonicalRuntimeRoots`; `runtime-topology-validator.mjs:26-27` fails the suite if CLAUDE.md or runtime-boundaries.md drops any root. Package-inventory drift (payments/app-engine/extension-host/dart api_client missing from AGENTS.md's package list) persists — folded into AV-M8.

### HIGH

**AV-H1 — RESOLVED. Single-writer ownership of orders/products/subscriptions/sites established via gateway internal endpoints + validator.**
Verified at HEAD: `services/webhook-service/src/index.ts` no longer contains any reference to `sites`, `subscriptions`, or `billing_history` (grep: 0 matches), no `.from('orders'|'products'...)` writes, and its only direct Supabase writes are `payment_webhook_events` upsert/patch (lines 76-86, 96-103) — the table the validator assigns to it — plus webhook-delivery lifecycle RPCs (`claim_webhook_deliveries`/`complete_webhook_delivery`/`fail_webhook_delivery`, lines 584-614). Order mutations route through `gateway-order-transitions.ts` → service binding `API_GATEWAY_SERVICE` → `POST /v1/storefront/internal/payments/{confirm,failure,event,reference}` with `X-Internal-API-Secret` (gateway-order-transitions.ts:27-34, 59-110); inventory release is delegated via the `releaseInventory` flag (webhook index.ts:402) instead of patching `products` stock. Billing mutations route through `gateway-billing-transitions.ts` → `/v1/internal/billing/subscriptions/{activate,sync,invoice}` (lines 56-103). Domain events route through `emitGatewayDomainEvent` → `/v1/internal/events` (commit `e518315e`). Gateway side: the internal payment routes live in the new `routes/storefront/internal-payment-routes.ts` (233 lines) and execute through `PaymentExecutionAdapter` — one state machine; internal billing in `routes/internal-billing.ts` (197 lines) through `SubscriptionExecutionAdapter`; routers mounted at `index.ts:459-460`. Enforcement: `single-writer-ownership-validator.mjs` (registered at `validate-governance.mjs:129`) plus the source-literal regression test `__tests__/payments.test.ts:101`. Two caveats recorded, not re-opened: (i) the internal-payment secret check has a non-production bypass when no secret is configured (`internal-payment-routes.ts:73` `if (!configuredSecret && c.env.ENVIRONMENT !== 'production') return true`) that `internal-billing.ts:49-53` does **not** replicate (fails closed) — an inconsistent internal-auth posture between sibling internal routers; (ii) the validator's RPC denylist (lines 53-62) is name-based, so a future renamed RPC would evade it. Neither restores dual-write today.

**AV-H2 — STILL-OPEN. Merchant password verification executes in the Next app, with `password_hash` shipped over the service boundary.**
Unchanged at every decision point: `apps/identity-platform/src/app/api/auth/login/route.ts:50-58` POSTs to `/auth/custom/users/by-email` and receives `password_hash` in the payload; `verifyPassword(password, user.password_hash)` runs in the Next handler at line 85. Gateway side unchanged: `services/api-gateway/src/routes/auth.ts:143-165` selects and returns `password_hash` from `users_custom`, gated by `requireAccountsInternal` (line 144). Device-logic duplication unchanged: `apps/identity-platform/src/lib/auth/device.ts:8-42` (fingerprint + parseDeviceName) duplicates gateway-side primitives while delegating persistence (lines 48-60). What changed is the governance posture: `domain-boundary-validator.mjs` now bans `password_hash` from app api/lib files (line 233/240) **except** files under `apps/identity-platform/src/lib/` which are classified "app-local-auth" (line 215) — i.e. the split is now codified as sanctioned ownership rather than fixed. The consequence stands: credential hash transits HTTP between two runtimes on every login. Remains High.

**AV-H3 — STILL-OPEN (degraded). God file: `services/api-gateway/src/routes/storefront.ts` = 4,833 lines, 56 route handlers; >1,500-line census grew to 11 files.**
Second-pass measurement: `wc -l` = **4,833** (first pass 4,826 — net +7 despite commit `f1b3253b` "split internal payment routes" extracting 233 lines into `routes/storefront/internal-payment-routes.ts`; concurrent merge-wave additions outpaced the extraction; the first-pass remediation target of ≤1,500 was not approached). Handler count 56 (`router.{get,post,put,patch,delete}` census). Customer auth remains inline (login at 3928, by-email at 3870 — now internal-gated, see AV-L4-resolved). Full active-source >1,500-line census (ts/tsx/dart, excluding legacy/tests):

| Lines | File | Δ vs first pass |
|---:|---|---|
| 4,833 | `services/api-gateway/src/routes/storefront.ts` | +7 |
| 2,797 | `services/api-gateway/src/routes/app-store.ts` | +76 |
| 2,244 | `apps/merchant-control-plane/.../themes/[themeId]/editor/page.tsx` | +177 (template-scoped drafts, `b64971fa`) |
| 2,131 | `apps/developer-portal/src/lib/developer-surface.ts` | **NEW** (WS10) |
| 2,100 | `packages/theme-engine/src/theme-bundle.ts` | 0 |
| 2,099 | `packages/shared-types/src/index.ts` | +9 |
| 1,835 | `services/api-gateway/src/graphql/schema.ts` | 0 |
| 1,778 | `packages/app-engine/src/index.ts` | 0 |
| 1,707 | `packages/typescript/api-client/src/index.ts` | +9 |
| 1,635 | `apps/mobile/merchant-app/.../create_store_wizard.dart` | 0 |
| 1,527 | `services/api-gateway/src/execution/theme-execution.adapter.ts` | **NEW** (grew past threshold; template drafts) |

`services/webhook-service/src/index.ts` dropped below the threshold (1,511 → 1,311) as a side effect of the AV-H1 rewiring. Net: 10 active files first pass → **11** second pass.

**AV-H4 — STILL-OPEN. `@letbuyy/utils` exports a service-role admin DB client into the app dependency graph.**
`packages/typescript/utils/src/supabase.ts:34-46` unchanged: `getSupabaseAdmin()` reads `SUPABASE_SERVICE_ROLE_KEY` and constructs a service client. Declared by **8 apps** (`apps/{app-marketplace,identity-platform,marketing-site,merchant-control-plane,platform-console,platform-operations-portal,storefront-runtime,theme-marketplace}/package.json`); imported by **0** source files (re-grep both quote styles — no matches). The new `domain-boundary-validator.mjs` ban (line 230) would still not catch an importing app file: the regex matches `@supabase/`, paths containing `/supabase`, the literal env-var/keyword tokens, or `.from(` — `import { getSupabaseAdmin } from '@letbuyy/utils'` plus a call contains none of those tokens unless the call site also queries. The latent capability therefore remains one import line away from app server code in 8 apps with no validator coverage. Remains High.

**AV-H5 — PARTIALLY RESOLVED; residue re-classified as AV-M9 (Medium).** First-pass content: root `build/` Flutter output, `tsconfig.tsbuildinfo`, 73 tracked root .md files, `Audit/` directory, dev-machine validator failures. Verified now: `build/` is **git-ignored** (`git check-ignore build` → ignored; Flutter output still on disk but untracked-ignored, compliant with AGENTS.md "must remain ignored, untracked"); `apps/developer-portal/tsconfig.tsbuildinfo` deleted; tracked root .md count **73 → 11**; `Audit/` and 62 other process files moved to `docs/archive/root-residue/2026-06-05-foundation-hardening/` (72 files) in commit `9f09cf45`; `git status` worktree clean except `.claude/` and in-flight FORENSIC_REPORT edits. See AV-M9 for what remains.

### MEDIUM

**AV-M1 — STILL-OPEN. Credentialed CORS for every wildcard tenant subdomain on the central API.**
Byte-identical logic, relocated: `services/api-gateway/src/index.ts:370-400` — wildcard regex `^https:\/\/[a-z0-9-]+\.letbuyy\.store$` at line 391, `credentials: true` at line 398. Still no governance doc records the wildcard-credentials decision (grep `Access-Control-Allow-Origin` / wildcard-CORS across `docs/governance/` — no policy hit).

**AV-M2 — STILL-OPEN. Per-isolate in-memory state on hot request paths.**
All four module-level mutable singletons remain: `middleware/rateLimit.ts:39-41` (`memoryStore`/`queryCostMemoryStore`, documented local-only fallback — compliant by design); `extensions/app-functions-runtime.ts:92` (`wasmModuleCache`); `graphql/rest-shim.ts:15` (`activeRestShimSubrequests`); `queue-workers/src/platform-queue-consumer.ts:170` (`queueCircuitBreakers` — moved from 167; still per-isolate, still resets on recycle). No new documentation for the latter three.

**AV-M3 — STILL-OPEN. Raw DB `error.message` at 122 route sites behind a 3-code denylist sanitizer.**
Recount: `message: error.message` = **122** occurrences across 19 route files (121 with `code: 'DB_ERROR'`; top: app-store.ts ×19, shipping-tax.ts ×12, blog.ts ×11, admin.ts ×10). Sanitizer unchanged: `middleware/security.ts:98-102` maps only `DB_ERROR`/`INTERNAL_ERROR`/`PAYMENT_PROVIDER_ERROR`; mounted at `index.ts:361`. The known miss persists: `routes/employee.ts:60` returns `code: 'AUTH_ERROR', message: error.message` (raw Supabase auth error) which the map does not rewrite (AV-L3). Net Δ since first pass: +1 site.

**AV-M4 — STILL-OPEN. `tenant-core` depends on `theme-engine`; `api-types` is a 14-edge facade with 1 importer.**
`packages/tenant-core/package.json:16-18` unchanged (`@letbuyy/theme-engine` dependency). `packages/typescript/api-types/package.json` still declares 14 internal `@letbuyy/*` deps; sole source importer remains `services/api-gateway/src/execution/schema-registry-execution.adapter.ts` (re-grep). `@letbuyy/shared-types` god-contract: `src/index.ts` now 2,099 lines and still the declared feature-flag evaluation authority (AGENTS.md:363; feature-flag-governance.md:7).

**AV-M5 — STILL-OPEN. Declared-but-unused workspace dependencies.**
`@letbuyy/utils`: declared by 8 apps, imported by 0 files. `@letbuyy/api-types`: declared by `apps/marketing-site/package.json` with 0 marketing-site importers. The validator pair still checks imports→declarations only, not declarations→imports.

**AV-M6 — STILL-OPEN, now formalized as an explicit bidirectional service-binding cycle.**
First pass found gateway→webhook coupling. The AV-H1 fix added the reverse edge: `services/webhook-service/wrangler.toml:61-62/100-101` binds `API_GATEWAY_SERVICE = letbuyy-api[-staging]`, while `services/api-gateway/wrangler.toml:180-181/284-285` keeps `WEBHOOK_SERVICE = letbuyy-webhook[-staging]`; gateway cron still dispatches into webhook (`index.ts:546, 586, 697-698`) and webhook now synchronously calls gateway internal endpoints for every payment/billing webhook side effect. The two deployed workers are mutually load-bearing at request time (a gateway outage now fails webhook processing, by design). No governance doc names or risk-assesses the cycle (grep `API_GATEWAY_SERVICE` in `docs/governance/` → only generic "service bindings are non-inheritable" lines). The cycle is the *intended cost* of single-writer; it is recorded here because the dependency direction (webhook depends on gateway availability for correctness) is a new operational invariant with no written owner.

**AV-M7 — STILL-OPEN behavior, governance gap RESOLVED. Production-dark feature flags.**
Flags unchanged: `services/api-gateway/wrangler.toml` `[env.production.vars]` `FEATURE_GRAPHQL/FEATURE_EXTENSIONS/FEATURE_LIQUID = "false"` (lines 217-219) vs `"true"` top-level (34-36) and staging (113-115). What changed: `docs/governance/feature-flag-governance.md` (new) now documents each flag's production state, active code surface, and explicit enable path, and rules that they "must not be described as production-live behavior" (lines 14-22); the developer portal now states the GraphQL cart limitation honestly (`apps/developer-portal/src/app/page.tsx:61`; commit `dfece260` makes unsupported cart fail loud). The architecture consequence stands — three staged subsystems ship dark in every production deploy — but it is now a declared, documented rollout control rather than undocumented drift. Severity held at Medium for the dead-weight/attack-surface cost; the *documentation* sub-finding is closed.

**AV-M8 — NEW. The corrected constitution was hand-patched, not regenerated: its self-described provenance is now false and several scan-derived numbers are stale again.**
AGENTS.md line 1 still reads "GENERATED BY scripts/generate-repository-intelligence.mjs ON 2026-05-25T03:24:32.634Z" although commit `9f09cf45` (2026-06-05) hand-edited topology/database sections — the file is no longer the generator's output, contradicting its own provenance banner and AGENTS.md:357's regeneration rule. Stale scan facts remaining inside it: AGENTS.md:72 "The scan found 45 source files with `console.log`" (actual: 2, both sanctioned logger sinks); :73 "51 files using `any`" (actual: 12); :13/:382 "31 Hono route modules" (actual: 33 — `internal-billing.ts`, `internal-events.ts` added after the doc edit) and "274 Next app route files" (actual census: 306 page/layout/route/loading/error/not-found files after WS5/WS9/WS10); the Repository Packages inventory (lines 30-56) still omits workspace-registered `packages/payments`, `packages/app-engine`, `packages/extension-host` (pnpm-workspace.yaml:8,10-11) and on-disk `packages/dart/api_client`; per-app "scanned files" counts are pre-merge (e.g. ops-portal "20 scanned files" vs 29 ts/tsx now); the Current Risk Register (lines 369-371) still asserts "Critical security tasks remain in tasks/todo.md: secret rotation, webhook verification parity, auth rate limiting, CSRF, and server-side price recalculation" — all verified implemented in the first pass and re-verified here. Same class as first-pass AV-C1 but bounded: the load-bearing sections (topology, DB, import rules) are correct; severity Medium.

**AV-M9 — NEW (residue of AV-H5). Process-ledger files now live *inside* runtime source trees, and 8 mission/ledger files remain at root.**
Tracked: `apps/merchant-control-plane/src/app/[store]/settings/CODEX_WS9_LEDGER.md` (a Codex execution ledger checked into a Next.js route segment directory), `apps/developer-portal/CODEX_WS10_LEDGER.md`, `packages/typescript/ui/CODEX_WS1_LEDGER.md` (git ls-files). Root still carries 8 `CODEX_*` mission/ledger/status files (down from 40+; `git ls-files` root .md = 11 incl. AGENTS/CLAUDE/README). Inert at runtime (Next ignores non-convention files) but they are exactly the "short-lived analysis" class AGENTS.md:197 directs to ignored paths, and two of them were *re-added* at root by consolidation commit `98b7653c` (CODEX_MASTER_EXECUTION_LEDGER.md +472 lines, CODEX_WS12_LEDGER.md +147) the same day the archive sweep ran — the residue-generation process is still active.

### LOW

**AV-L1 — STILL-OPEN. `any` usage in 12 files** (re-grep, excluding tests/stories): apps/theme-marketplace ×5 (unchanged set), services/api-gateway ×7 (`index.ts`, `routes/{storefront,orders,app-store,onboarding,admin,inventory}.ts` — app-store.ts is the addition; e.g. `storefront.ts:2272` `c.json(claim.responseBody as any, claim.statusCode as any)` ×5 occurrences). Packages: 0.

**AV-L2 — STILL-OPEN (conflict narrowed). Reserved/placeholder runtime roots.**
Same 7 two-file scaffolds (6 services + `apps/mobile/shopper-app`) — directory listings re-confirmed. The documentation conflict is materially reduced: all three authorities now label them reserved with named active owners (runtime-boundaries.md:24-33; CLAUDE.md reserved paragraph; AGENTS.md:87). AGENTS.md:154's "Placeholder app roots are forbidden" prose still technically collides with the reserved-roots regime. The sharper residue: `apps/mobile/operator-app` remains a **canonical** (non-reserved) runtime in all three docs while `lib/main.dart:1-36` is still the unmodified Flutter counter demo ("Flutter Demo", tutorial comments intact) — runtime-boundaries.md:15 softens it to "operator companion scaffold", but it is the only canonical runtime whose source is a stock template.

**AV-L3 — STILL-OPEN.** `services/api-gateway/src/routes/employee.ts:60` (`AUTH_ERROR` + raw `error.message`) — outside the sanitizer's code map (see AV-M3).

**AV-L4 — RESOLVED.** `GET /storefront/customer/by-email` is no longer sessionless-public: `storefront.ts:3870-3872` now calls `requireStorefrontInternal(c)` which enforces `verifyInternalAppRequest(c, 'storefront')` (signature check at storefront.ts:1615-1628) before the lookup; the merchant-side `/auth/custom/users/by-email` was already gated by `requireAccountsInternal` (auth.ts:144).

**AV-L5 — STILL-OPEN (grew). Governance-plane sprawl.** Now 118 governance docs + 133 validators + 66 config/runtime files = **317** co-maintained artifacts (first pass ~315). The suite reports 129 validators executed. Validators continue to assert document/config strings as well as source patterns; the new topology/single-writer validators are source-grounded (an improvement in kind), but every inventory change still requires multi-artifact co-edits — demonstrated in-tree by `domain-boundary-validator.mjs:209` freezing the app API route count at exactly 115 ("expected 115, found ${…}"), which will fail the suite on the next legitimate route addition until hand-updated.

**AV-L6 — NEW. Inconsistent internal-endpoint authentication posture between sibling internal routers.**
`routes/storefront/internal-payment-routes.ts:71-76`: missing `INTERNAL_API_SECRET` ⇒ **allow** when `ENVIRONMENT !== 'production'`; `routes/internal-billing.ts:49-53`: missing secret ⇒ **deny** always; `routes/internal-console.ts:43-54`: missing token ⇒ 503. Three internal surfaces, three failure-mode policies, no documented rule selecting one. Low because production behavior is fail-closed in all three; the divergence is a staging/local trust inconsistency.

**AV-L7 — NEW. Migration cross-reference comment already stale at birth.**
`database/supabase/migrations/088_inventory_available_batch.sql:2` states "087 remains reserved for Phase 6 theme template drafts" while `087_theme_template_drafts.sql` exists in the same directory and is consumed at runtime (`theme-execution.adapter.ts:961, 1007` reference it by filename). Cosmetic in-file drift inside the otherwise-contiguous chain.

---

## 4. Violation counts

| Severity | Open | Resolved this pass | New this pass | First-pass count |
|---|---:|---:|---:|---:|
| Critical | 0 | 2 (AV-C1, AV-C2) | 0 | 2 |
| High | 3 (AV-H2, AV-H3, AV-H4) | 1 (AV-H1) + 1 downgraded (AV-H5→AV-M9) | 0 | 5 |
| Medium | 9 (AV-M1…AV-M7 open; AV-M8, AV-M9 new) | 0 | 2 (AV-M8, AV-M9) | 7 |
| Low | 6 (AV-L1, AV-L2, AV-L3, AV-L5, AV-L6, AV-L7) | 1 (AV-L4) | 2 (AV-L6, AV-L7) | 5 |
| **Total open** | **18** | **4 resolved + 1 downgraded** | **4** | **19** |

Clean checks (Section 2): 14 declared rules verified compliant, including all hard import boundaries (re-verified against the new settings hub, ui package, developer portal, and operations portal surfaces), secrets, localStorage, price recalculation, idempotency, single-writer ownership, and runtime-inventory consistency.

Headline: both Criticals and the highest-leverage High (dual write ownership) are resolved with validator enforcement; the remaining Highs are the unchanged identity-platform password-hash boundary, the storefront god file (which grew), and the latent utils service-role edge. New findings are exclusively drift/hygiene (hand-patched constitution, embedded process ledgers, internal-auth inconsistency, one stale comment).

---

## Evidence Index

| # | Path | Lines / artifact |
|---|---|---|
| 1 | `/Users/saai_sidd/Git/Letbuyy_Store/AGENTS.md` | 1 (stale gen header), 13, 62, 66-68, 72-73, 83-90, 119-125, 154, 197, 302, 308, 312, 316-322, 357, 363, 369-371, 382-383 |
| 2 | `/Users/saai_sidd/Git/Letbuyy_Store/CLAUDE.md` | Canonical Runtime Map (12+3+6 reserved); Reserved-roots paragraph; Deprecated Runtime Policy |
| 3 | `/Users/saai_sidd/Git/Letbuyy_Store/docs/governance/runtime-boundaries.md` | 5-16, 20-33, 35-46 |
| 4 | `/Users/saai_sidd/Git/Letbuyy_Store/docs/governance/feature-flag-governance.md` | 7, 14-22, 26-32 |
| 5 | `/Users/saai_sidd/Git/Letbuyy_Store/database/supabase/migrations/` | 18 files: 000_baseline.sql + 073-089 contiguous; `grep -c "CREATE TABLE public\."` 000_baseline.sql = 233 |
| 6 | `/Users/saai_sidd/Git/Letbuyy_Store/scripts/validators/governance-common.mjs` | 57-70 (12 app roots), 91-101 (9 service roots), 103-106 |
| 7 | `/Users/saai_sidd/Git/Letbuyy_Store/scripts/validators/runtime-topology-validator.mjs` | 23-28 (manifest + topology + CLAUDE.md + runtime-boundaries.md assertions) |
| 8 | `/Users/saai_sidd/Git/Letbuyy_Store/scripts/validators/single-writer-ownership-validator.mjs` | 22-43 (ownership rules), 45-62 (helper + RPC denylists), 88-109 |
| 9 | `/Users/saai_sidd/Git/Letbuyy_Store/scripts/validators/domain-boundary-validator.mjs` | 209 (route count frozen at 115), 215, 229-241 (DB/credential/signature bans + identity-platform lib carve-out) |
| 10 | `/Users/saai_sidd/Git/Letbuyy_Store/scripts/validate-governance.mjs` | 129 ("single-writer-ownership-validator.mjs"); suite run 2026-06-05 → "Governance validation passed (129 validators)" |
| 11 | `/Users/saai_sidd/Git/Letbuyy_Store/services/webhook-service/src/index.ts` | 1,311 lines; 12/15 (imports), 18-29 (gateway transition imports), 52-53, 76-86, 96-103, 183-200, 304, 323, 361-402 (releaseInventory delegation), 462-508, 584-614, 815, 976-1002 |
| 12 | `/Users/saai_sidd/Git/Letbuyy_Store/services/webhook-service/src/gateway-order-transitions.ts` | 14-46 (service-binding mutation), 48-111 (confirm/failure/event endpoints) |
| 13 | `/Users/saai_sidd/Git/Letbuyy_Store/services/webhook-service/src/gateway-billing-transitions.ts` | 8-10, 56, 78, 103 (internal billing endpoints) |
| 14 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/storefront/internal-payment-routes.ts` | 233 lines; 71-76 (non-prod secret bypass), 106-232 (payable/reference/confirm/failure/event) |
| 15 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/internal-billing.ts` | 197 lines; 49-53 (fail-closed secret check) |
| 16 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/internal-console.ts` | 385 lines; 43-54 (console-token gate) |
| 17 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/index.ts` | 357-368 (middleware), 370-400 (CORS wildcard+credentials), 423-449 (GraphQL/extensions gates, auth rate limit), 459-460 (internal routers), 546, 586, 697-698 (cron→webhook) |
| 18 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/__tests__/payments.test.ts` | 101 (asserts webhook source has no `outbox_events`) |
| 19 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/storefront.ts` | 4,833 lines / 56 handlers; 33 + 1826 (internal-routes registration), 2245-2353 (order create), 2272 (`as any`), 2287 (FEATURE_EXTENSIONS gate), 3688/3766/3935/4284 (customer rate limits), 3869-3890 (by-email now internal-gated), 1615-1628 (requireStorefrontInternal), 3927-3928 (customer login) |
| 20 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/auth.ts` | 143-165 (by-email returns password_hash, accounts-internal-gated) |
| 21 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/identity-platform/src/app/api/auth/login/route.ts` | 50-58, 76-88 (verifyPassword in app), 91-94 |
| 22 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/identity-platform/src/lib/auth/device.ts` | 8-16, 22-42, 48-60 |
| 23 | `/Users/saai_sidd/Git/Letbuyy_Store/packages/typescript/utils/src/supabase.ts` | 34-46 (getSupabaseAdmin unchanged) |
| 24 | `@letbuyy/utils` declarations | 8 app package.json files (grep `"@letbuyy/utils"`); source importers: 0 (grep both quote styles) |
| 25 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/wrangler.toml` | 34-36, 113-115, 180-181, 217-219, 284-285 |
| 26 | `/Users/saai_sidd/Git/Letbuyy_Store/services/webhook-service/wrangler.toml` | 61-62, 100-101 (API_GATEWAY_SERVICE bindings) |
| 27 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/middleware/security.ts` | 98-102 (3-code map), 130-169 (sanitizer middleware) |
| 28 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/employee.ts` | 60 (AUTH_ERROR raw message) |
| 29 | raw `error.message` census | grep `message: error.message` services/api-gateway/src → 122 hits / 19 files; `code: 'DB_ERROR'` variant → 121 |
| 30 | module-state census | `middleware/rateLimit.ts:39-41`; `extensions/app-functions-runtime.ts:92`; `graphql/rest-shim.ts:15`; `queue-workers/src/platform-queue-consumer.ts:170` |
| 31 | `/Users/saai_sidd/Git/Letbuyy_Store/packages/tenant-core/package.json` | 16-18 (theme-engine dep) |
| 32 | `/Users/saai_sidd/Git/Letbuyy_Store/packages/typescript/api-types/package.json` | 14 `@letbuyy/*` deps; sole importer `services/api-gateway/src/execution/schema-registry-execution.adapter.ts` |
| 33 | `/Users/saai_sidd/Git/Letbuyy_Store/packages/typescript/ui/` | package.json 17-24 (deps clean); src = 20 files / 6,083 lines; outward imports react/lucide-react only; consumed by all 9 web apps + CODEX_WS1_LEDGER.md embedded |
| 34 | settings hub | `apps/merchant-control-plane/src/app/[store]/settings/` 18 page.tsx; components/settings 7 files; imports = `@letbuyy/ui` + `@letbuyy/shared-types` only; `CODEX_WS9_LEDGER.md` embedded in the route dir |
| 35 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/developer-portal/` | src 17 ts/tsx / 9 pages; imports `@letbuyy/ui` only; `src/lib/developer-surface.ts` 2,131 lines; `CODEX_WS10_LEDGER.md` at app root; page.tsx:61 (honest GraphQL cart note) |
| 36 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/platform-operations-portal/` | src 29 ts/tsx / 17 pages; `_local-ui/{employee-module-screen,ops-workspace}.tsx`; TODOs only at (auth)/login:12 and (auth)/invite:14 |
| 37 | root hygiene | tracked root .md = 11 (8 CODEX_* + AGENTS/CLAUDE/README); `docs/archive/root-residue/2026-06-05-foundation-hardening/` = 72 files; `git check-ignore build` → ignored; no `Audit/`; no tsbuildinfo |
| 38 | embedded ledgers | `git ls-files`: `apps/merchant-control-plane/src/app/[store]/settings/CODEX_WS9_LEDGER.md`, `apps/developer-portal/CODEX_WS10_LEDGER.md`, `packages/typescript/ui/CODEX_WS1_LEDGER.md` |
| 39 | `any` census | 12 files (theme-marketplace ×5; gateway index + storefront/orders/app-store/onboarding/admin/inventory); packages 0 |
| 40 | >1,500-line census | table in AV-H3 (find+wc over apps/services/packages ts/tsx/dart) |
| 41 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/mobile/operator-app/lib/main.dart` | 1-36 Flutter counter demo (unchanged) |
| 42 | reserved roots | `apps/mobile/shopper-app/` 2 files; `services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}/` 2 files each |
| 43 | consolidation fixes | `git show 218a0905` (settings barrel exported renamed symbols `SETTINGS_NAV_*` replacing dead `settingsIndexGroups` etc.; +local row types in 3 ops-portal IndexTables); `98b7653c` (re-added 2 root ledgers +619 lines, ops page +26, gateway index +71, 1-line test fix); `a8cd5fde` (moved `scripts/dev/local-stack-{up,down}.mjs` → `scripts/utilities/`); residue grep for old settings symbols → 0 |
| 44 | `/Users/saai_sidd/Git/Letbuyy_Store/pnpm-workspace.yaml` | 8, 10-11 (payments/app-engine/extension-host registered, absent from AGENTS.md package list) |
| 45 | counts | governance docs 118; validators (files) 133; suite-executed 129; config/runtime 66; tracked files 3,043; commits 802 (root unchanged) |
| 46 | `/Users/saai_sidd/Git/Letbuyy_Store/database/supabase/migrations/088_inventory_available_batch.sql` | 2 (stale "087 remains reserved" comment); consumer `product-execution.adapter.ts:633` |
| 47 | `/Users/saai_sidd/Git/Letbuyy_Store/tasks/todo.md` | 242-260 (dev-machine Stale-artifact failures, ledger unchanged) |
| 48 | governance suite run | `node scripts/validate-governance.mjs` → "Governance validation passed (129 validators)" (2026-06-05, isolated workspace) |
