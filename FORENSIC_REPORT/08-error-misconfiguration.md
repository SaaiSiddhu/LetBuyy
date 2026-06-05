# Phase 8 — Error & Misconfiguration Audit

Investigation date: 2026-06-05

> Forensic scope: hunt for broken imports, missing registrations/configurations/env vars,
> missing event subscribers/emitters, missing webhook topics, unenforced flags, and missing
> dependency wiring on the LetBuyy platform. Every finding cites file/line or command output.
> Impact statements are factual (what is observably true), not predictive. Items that could
> not be proven are marked "not found in repository".

---

## Method

Read-only; no repository files modified except the two permitted report files. Commands run:

1. `node scripts/validate-governance.mjs` (full suite) — run multiple times; output included below as evidence (E-GOV).
2. `node scripts/validators/execution-layer-validator.mjs` — isolated, 8 repeat runs.
3. `node scripts/validators/{dependency-manifest,undeclared-import,package-export,dependency-graph,circular-import,environment,typescript-governance}-validator.mjs`.
4. Targeted TypeScript checks with the workspace `typescript@5.9.3` at repo root:
   - `cd services/api-gateway && ../../node_modules/.bin/tsc --noEmit` → **exit 0**.
   - `cd services/webhook-service && ../../node_modules/.bin/tsc --noEmit` → **exit 2** (errors; see C-1 caveat).
   - `cd services/queue-workers && ../../node_modules/.bin/tsc --noEmit` → **exit 2** (errors; see C-1 caveat).
5. Env-var extraction: `grep -rhoE "process\.env\.[A-Z_…]"` across `apps/`, `services/`, `packages/`, `scripts/`; Dart `fromEnvironment`/`Platform.environment` across `apps/mobile`, `packages/dart`; compared against `config/env/templates/*` and `wrangler.toml [vars]`.
6. RPC call-vs-define: extracted 48 `.rpc('…')` call names, compared to 97 `CREATE FUNCTION` defs in `database/supabase/migrations`.
7. Event emitter-vs-subscriber: `eventType:` / `event_type:` emit sites vs `DOMAIN_EVENT_CONTRACTS` in `packages/event-core/src/index.ts`.
8. Per-table writer enumeration for shared-ownership detection.

**Dependency-install caveat:** No workspace has local `node_modules` (verified: `apps/*`,
`services/*`, `packages/*` have no `node_modules`; only the repo root does, containing just
`tsc`, `tsserver`, `turbo`, `playwright`). `@letbuyy/*` workspace packages and external deps
(`@supabase/*`, `@types/node`, `hono` subpaths) are therefore **not resolvable** from
sub-workspace `tsc` runs unless the tsconfig provides explicit `paths`. The api-gateway
tsconfig supplies full `@letbuyy/*` and `hono/*` path mappings (and passes clean); the
webhook-service and queue-workers tsconfigs supply only `@letbuyy/infrastructure/*`, so their
`tsc` errors below are **tooling/resolution artifacts of the un-installed monorepo**, not
necessarily product bugs. They are reported as Medium with that caveat, not as Critical.

**Live-repo caveat:** `services/api-gateway/src/routes/analytics.ts` (mtime 12:14:56) and
`services/api-gateway/src/routes/storefront.ts` (mtime 12:34:09) were modified by a concurrent
process during this audit. The first `validate-governance.mjs` invocation failed on those two
files; later invocations passed. See F-GOV-1.

---

# Critical severity

### C-GOV-1 — Governance suite produced a non-deterministic FAILURE on api-gateway routes (execution-layer authority)
- **Location:** `services/api-gateway/src/routes/analytics.ts`, `services/api-gateway/src/routes/storefront.ts`; validator `scripts/validators/execution-layer-validator.mjs:200-221`.
- **Evidence:** First run of `node scripts/validate-governance.mjs` (repo bash) terminated **exit 1** with:
  ```
  Execution layer validator failed:
  - Apps/services may not define workflow, orchestration, aggregation, projection, or pipeline authority: services/api-gateway/src/routes/analytics.ts
  - Apps/services may not define workflow, orchestration, aggregation, projection, or pipeline authority: services/api-gateway/src/routes/storefront.ts
  ```
  Subsequent runs (and 8 isolated runs of `execution-layer-validator.mjs`) returned **exit 0** / "passed (64 execution foundation files checked; 11 execution adapters enforced)". The two files carry mtimes of 12:14:56 and 12:34:09 — i.e. they were edited *during* the audit by a concurrent process.
- **Observed impact:** The repository was in a governance-failing state at the moment of first capture. The forbidden-pattern set the validator matched is `defineExecutionPipelines(`, `defineApplicationWorkflows(`, `class *Workflow*`, `class *Orchestr*`, `interface *Workflow*`, `interface *Aggregation*`, `function *(Workflow|Orchestrat|Aggregation|Projection|Pipeline)*(` (`execution-layer-validator.mjs:200-208`). A CI run hitting the pre-edit state would have failed the merge gate per AGENTS.md §CI/CD ("CI must fail on … "). This is a reproducibility/stability defect in the working tree: governance pass/fail depended on in-flight edits.

### C-A1 — Theme/payout events emitted with no registered domain-event contract
- **Location:** emitters — `services/api-gateway/src/routes/themes.ts:756` (`theme.purchase.payment_order_created`), `:845` (`theme.purchase.completed`); `services/api-gateway/src/execution/theme-execution.adapter.ts:1039` (`theme.draft.saved`), `:1101` (`theme.draft.discarded`); contract registry — `packages/event-core/src/index.ts:202-388`.
- **Evidence:** `DOMAIN_EVENT_CONTRACTS` keys (24 total) do **not** include any `theme.purchase.*` or `theme.draft.*` type (grep of those literals in `event-core/src/index.ts` → no matches). `getDomainEventContract()` (`event-core/src/index.ts:414-418`) returns `null` for unknown types.
- **Observed impact:** For these events, `EventExecutionAdapter.emitDomainEvent` skips contract payload validation (`event-execution.adapter.ts:54-56` uses raw payload when `contract` is null) and `queueNamesForEvent` falls through to the string-prefix heuristic (`orchestration/src/event-runtime.ts:191-197`), which routes `theme.*` to `search-indexing` + `analytics` only — **never to `webhook-service`** (no `webhook-service` consumer is assigned without a contract). Partners subscribed to theme lifecycle receive nothing for these specific events. Payload shape is unvalidated.

---

# High severity

### H-A1 — Cloudflare Queue producers largely unused while consumers are fully provisioned (NOTIFICATION/SEARCH/RUNTIME)
- **Location:** producers `services/api-gateway/wrangler.toml:55-73,234-252` + `Env` `index.ts:85-89`; consumers `services/queue-workers/wrangler.toml:36-95,232-291`; only `send` call sites `services/api-gateway/src/routes/storefront.ts:498` (ANALYTICS) and `services/api-gateway/src/index.ts:530,578` (EVENT).
- **Evidence:** grep of `queue.send(` / `createCloudflareQueueProducer` across `services/api-gateway/src` returns producers only for `ANALYTICS_QUEUE` (product-view sampling) and `EVENT_QUEUE` (scheduled-dispatch completion/failure events). No source sends to `NOTIFICATION_QUEUE`, `SEARCH_QUEUE`, or `RUNTIME_QUEUE`. queue-workers declares consumers for all of `letbuyy-events`, `letbuyy-analytics-queue`, `letbuyy-search-queue`, `letbuyy-notifications-queue`, `letbuyy-<env>-queue` + DLQs.
- **Observed impact:** Three production queues (`SEARCH_QUEUE`, `NOTIFICATION_QUEUE`, `RUNTIME_QUEUE`) have provisioned, billed consumer workers but no Cloudflare-Queue producer in code. Search indexing / notifications are instead driven through the **DB `platform_queue_jobs`** path (drained by both the cron and the queue-workers Cloudflare consumer), so the named Cloudflare queues for those concerns are effectively dead infrastructure relative to the producer side.

### H-A2 — Dual ownership of `platform_queue_jobs` drain (api-gateway cron + queue-workers)
- **Location:** `services/api-gateway/src/index.ts:525` (`queue.consumeQueues([...])`), `services/api-gateway/src/execution/queue-execution.adapter.ts:216-229`; `services/queue-workers/src/platform-queue-consumer.ts:388-401`.
- **Evidence:** Both code paths invoke RPC `claim_platform_queue_jobs` and then write the same downstream tables (`analytics_event_stream`, `notifications`, search projections). Writer enumeration confirms `analytics_event_stream` and `notifications` each have ≥2 distinct service writers.
- **Observed impact:** Two independent runtimes compete to drain the same queue table and both write the same projection/notification rows. Correctness depends entirely on the `claim_platform_queue_jobs` RPC's row-locking semantics; no governance doc or manifest reserves a single owner. Idempotency keys (`onConflict`) mitigate duplicate rows but duplicate **processing** (e.g. rollups, payout side-effects in `platform-queue-consumer.ts`) is governed only by the claim lock.

### H-A3 — Contracts without producers: `payout.released`, `payout.failed`
- **Location:** contracts `packages/event-core/src/index.ts:371-388`; emit search across `services/` → none.
- **Evidence:** grep `'payout.released'` / `'payout.failed'` in `services/` returns no emit site (only `payout.ledger_entry.created` is emitted, `queue-execution.adapter.ts:495`). Both have full `DOMAIN_EVENT_CONTRACTS` entries with `consumers: ['analytics','notifications','webhook-service']`.
- **Observed impact:** Registered, schema'd events that are never produced. Downstream notification templates exist for them (`packages/notification-core/src/index.ts:183-184`) but can never fire. Dead consumer code; partners subscribing to payout completion/failure get nothing.

### H-C1 — api-gateway test suite exists but is never executed by its package script
- **Location:** `services/api-gateway/src/__tests__/` (6 files: `observability`, `payments`, `products`, `security`, `store-publish`, `tenant-isolation`); `services/api-gateway/package.json` `"test": "echo 'No tests yet' && exit 0"`.
- **Evidence:** Tests use `import { test } from 'node:test'` (`__tests__/products.test.ts:5`). The package `test` script is a hardcoded no-op. `webhook-service` and `queue-workers` `package.json` also use `"echo 'No tests yet' && exit 0"`.
- **Observed impact:** Six real test files — including `tenant-isolation.test.ts`, `security.test.ts`, and `payments.test.ts` (which the prior integration doc cites for idempotency assertions) — do not run under `pnpm test` / `turbo test` for these workspaces. Regression coverage that appears present is not wired into the build.

---

# Medium severity

### M-C1 — webhook-service & queue-workers fail `tsc --noEmit` (un-installed monorepo resolution)
- **Location:** `services/webhook-service/tsconfig.json:12-16`, `services/queue-workers/tsconfig.json:12-16`.
- **Evidence (webhook-service, first 8 lines):**
  ```
  ../../packages/infrastructure/cashfree-adapter/index.ts(12,8): error TS2307: Cannot find module '@letbuyy/payments' or its corresponding type declarations.
  ../../packages/infrastructure/paypal-adapter/index.ts(57,20): error TS2591: Cannot find name 'process'. … install @types/node …
  ```
  **(queue-workers):**
  ```
  ../../packages/infrastructure/supabase-adapter/index.ts(7,8): error TS2307: Cannot find module '@supabase/supabase-js' …
  src/platform-queue-consumer.ts(1,114): error TS2307: Cannot find module '@letbuyy/event-core' …
  src/platform-queue-consumer.ts(2,40): error TS2307: Cannot find module '@letbuyy/orchestration' …
  ```
- **Root cause (verified):** Their tsconfigs only map `@letbuyy/infrastructure/*` → no `paths` for `@letbuyy/event-core`, `@letbuyy/orchestration`, `@letbuyy/runtime-composition`, `@letbuyy/notification-core` (all declared deps in `queue-workers/package.json:14-19`). The api-gateway tsconfig, which maps **all** `@letbuyy/*` packages, passes clean. External modules (`@supabase/*`, `@types/node`) are unresolved because no `node_modules` is installed anywhere.
- **Observed impact:** Standalone `tsc --noEmit` (the literal `typecheck`/`build` script for both workers) cannot resolve workspace siblings without an install or richer `paths`. In an installed environment with `node-linker=isolated` this may resolve, but the tsconfig asymmetry vs api-gateway is real and means these two services are not type-checkable in isolation the way api-gateway is. `@letbuyy/payments` is a declared dependency of `@letbuyy/infrastructure` (`packages/infrastructure/package.json:34`) yet has no `paths` entry in the consuming worker tsconfigs.

### M-A1 — `FEATURE_LIQUID` declared and typed but never enforced
- **Location:** `services/api-gateway/src/index.ts:101` (Env), `services/api-gateway/src/middleware/featureFlags.ts:4` (`GatewayFeatureFlag` union).
- **Evidence:** `featureGate(...)` is only instantiated for `FEATURE_GRAPHQL` (`index.ts:353`) and `FEATURE_EXTENSIONS` (`index.ts:358`). No `featureGate('FEATURE_LIQUID', …)` and no `c.env.FEATURE_LIQUID` read in any route. It is set to `"true"`/`"false"` per env in both `wrangler.toml` files.
- **Observed impact:** A flag that is configured and toggled per environment (staging `true`, production `false`) has no effect — Liquid rendering is neither gated on nor off by it. Operators toggling `FEATURE_LIQUID` change nothing.

### M-A2 — webhook-service ↔ api-gateway reverse binding declared but no caller
- **Location:** `services/webhook-service/wrangler.toml:60-62,99-101` (`API_GATEWAY_SERVICE`).
- **Evidence:** grep `API_GATEWAY_SERVICE` in `services/webhook-service/src` → no matches; the binding is not present in the webhook-service `Env` interface (`src/index.ts:25-48`).
- **Observed impact:** A service binding is provisioned in both staging and production wrangler config that no code invokes. Dead binding; widens the worker's capability surface without use.

### M-E1 — Mobile dart-define keys used but absent from the mobile env template
- **Location:** used: `apps/mobile/merchant-app/lib/config/app_config.dart:12,18` (`IDENTITY_BASE_URL`, `STOREFRONT_BASE_URL`); `packages/dart/core/lib/src/config/gemini_config.dart:3-11` (`GEMINI_API_KEY`, `GEMINI_BASE_URL`, `GEMINI_MODEL`). Template: `config/env/templates/mobile.dart-defines.example`.
- **Evidence:** Multiline-aware grep of `fromEnvironment('KEY')` across `apps/mobile` + `packages/dart` yields exactly: `API_BASE_URL`, `GEMINI_API_KEY`, `GEMINI_BASE_URL`, `GEMINI_MODEL`, `IDENTITY_BASE_URL`, `RAZORPAY_KEY_ID`, `STOREFRONT_BASE_URL`. The template lists only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `API_BASE_URL`, `RAZORPAY_KEY_ID`, `ENVIRONMENT`.
- **Observed impact:**
  - **Used-but-undefined-in-template:** `IDENTITY_BASE_URL`, `STOREFRONT_BASE_URL`, `GEMINI_API_KEY`, `GEMINI_BASE_URL`, `GEMINI_MODEL`. `GEMINI_API_KEY` has no default (`String.fromEnvironment('GEMINI_API_KEY')` → empty string when unset) — any Gemini call ships with an empty key unless CI injects it, and the template gives no signal it must be injected.
  - **Defined-but-unconsumed-via-fromEnvironment:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ENVIRONMENT` are in the template but not read through `fromEnvironment` (Supabase is reached via the gateway, not a direct client in mobile).

### M-E2 — Worker fallback DB URL vars (`DATABASE_URL`, `SUPABASE_DB_URL`) used but not in worker template
- **Location:** consumed at `packages/infrastructure/pooled-sql-adapter/index.ts:29` (`env.HYPERDRIVE?.connectionString || env.DATABASE_URL || env.SUPABASE_DB_URL`); gateway `Env` `index.ts:56-57`.
- **Evidence:** `config/env/templates/worker.env.example` defines neither `DATABASE_URL` nor `SUPABASE_DB_URL` (only the `HYPERDRIVE` binding is configured via wrangler `:161-168,263-271`). The pooled-SQL path (used by storefront reads, `routes/storefront.ts:944,954,969,988`) falls back to these when Hyperdrive is absent.
- **Observed impact:** If Hyperdrive is unbound in any environment, `getPooledSql` returns `null` (`pooled-sql-adapter/index.ts:39`) because the documented template never tells an operator to set the fallback URL. Pooled storefront reads silently degrade with no env-template guidance.

### M-A3 — `STOREFRONT_VIEW_SAMPLE_RATE` / `REQUEST_LOG_SAMPLE_RATE` etc. are vars-only (no schema validation)
- **Location:** `services/api-gateway/wrangler.toml:38-44` defines `STOREFRONT_VIEW_SAMPLE_RATE`, `ANALYTICS_PROJECTION_READS`, `PRODUCT_VARIANT_DIFF`, `CHECKOUT_POSTCOMMIT_DEFERRAL`, `REQUEST_LOG_SAMPLE_RATE`, `STOREFRONT_POOLED_SQL`, `STOREFRONT_SEARCH_PROJECTION`, `STOREFRONT_CACHE`.
- **Evidence:** These are consumed as raw strings (e.g. `analytics.ts:20-21` `(env.ANALYTICS_PROJECTION_READS || 'on').trim().toLowerCase()`). `config/env/schemas/worker.schema.json` is the declared schema but these operational toggles are wrangler-vars, not in the secret/template files.
- **Observed impact:** Behavior-altering runtime toggles live only in `wrangler.toml`; an invalid value (e.g. `STOREFRONT_VIEW_SAMPLE_RATE=abc`) is coerced by `Number(...)` → sampling silently disabled (`storefront.ts:490-491`). No validation surfaces a bad value.

---

# Low severity

### L-A1 — Six `services/*` runtime roots are declaration-only (no source)
- **Location:** `services/analytics-pipeline`, `services/checkout-runtime`, `services/event-bus`, `services/media-service`, `services/notification-service`, `services/search-service` — each contains only `AGENTS.md` + `runtime.manifest.json`.
- **Evidence:** directory listings (no `src/`). They are listed as env owners in `config/env/ownership/runtime-env-ownership.json:30-39`. `services/event-bus/runtime.manifest.json:105` openly states it "Delegates production queue provider execution to services/api-gateway producers and services/queue-workers consumers."
- **Observed impact:** Topology, manifests, and env-ownership reference services that ship no code; their named responsibilities (event transport, search, notifications, media, checkout-runtime, analytics-pipeline) are realized inside `api-gateway`/`queue-workers`. Naming-vs-realization mismatch; no functional break (they are governed as "reserved").

### L-A2 — Heterogeneous internal-auth schemes across the gateway boundary
- **Location:** HMAC session (`apps/*/lib/api/client.ts` via `createLetbuyyInternalSessionHeaders`); HMAC app-attestation `X-LetBuyy-Internal-App` (`apps/storefront-runtime/src/lib/api/client.ts:102-116`; verify `services/api-gateway/src/lib/internal-auth.ts:27-37`); raw secret `X-Internal-API-Secret` (`storefront/src/lib/api/client.ts:147`; verify `routes/storefront.ts:1691-1696`); static bearer `PLATFORM_CONSOLE_API_TOKEN` (`routes/internal-console.ts:44-56`); worker→worker `X-LetBuyy-Internal-Secret` (`webhook-service/src/index.ts:726-732`).
- **Evidence:** Five distinct internal trust mechanisms, three of which (`internal-auth`, app-attestation, raw secret) all key off the same `INTERNAL_API_SECRET`/`AUTH_SECRET` material (`getLetbuyyInternalAuthSecret`).
- **Observed impact:** No single internal-auth contract; `routes/storefront.ts:1693` additionally trusts requests with **no** secret when `ENVIRONMENT !== 'production'` (`if (!configuredSecret && c.env.ENVIRONMENT !== 'production') return true`). In any non-production worker without `INTERNAL_API_SECRET` set, internal-only storefront endpoints are open. Factual; production is guarded.

### L-A3 — Theme-editor preview `postMessage` falls back to wildcard origin
- **Location:** `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx:25-33` (`getParentTargetOrigin` returns `'*'` when `document.referrer` is empty), `:44` (`selectSection` posts with `window.location.origin`).
- **Evidence:** Parent (`CenterPanel.tsx:44-50`) posts to `new URL(previewUrl).origin`, but the child's outbound `ready`/`section-select` messages use `'*'` when referrer is unavailable.
- **Observed impact:** The storefront→editor channel can broadcast section-selection metadata to any origin when the iframe lacks a referrer. Low-sensitivity payload (section ids), but an asymmetric/loose origin contract relative to the inbound direction.

### L-A4 — `apps/developer-portal` has no API client and reads no env vars
- **Location:** `apps/developer-portal/src/` (7 source files); env scan returned empty for this app.
- **Evidence:** per-app `process.env.*` grep for `developer-portal` → no output; no `lib/api/client.ts`.
- **Observed impact:** The developer-portal app is static (reference content only). It is a canonical runtime in `runtime-topology` but integrates with nothing. No break; documents a non-wired runtime.

### L-A5 — Theme-marketplace `auth/callback` route is a pure redirect placeholder
- **Location:** `apps/theme-marketplace/src/app/auth/callback/route.ts`.
- **Evidence:** The handler only redirects to `${NEXT_PUBLIC_ACCOUNTS_URL}/lookup?return_to=…`; no token exchange.
- **Observed impact:** OAuth callback for theme-marketplace performs no credential handling — auth is fully delegated to identity-platform. Intentional but an empty endpoint where a callback handler is implied.

---

## Cross-checks that PASSED (negative findings)

- **RPC integrity:** all 48 distinct `.rpc('…')` call names resolve to a `CREATE FUNCTION` in `database/supabase/migrations` (`comm -23` empty). No missing DB function. webhook-service's `claim/complete/fail_webhook_delivery` defined at `000_baseline.sql:941,1398,4161`.
- **Undeclared imports:** `undeclared-import-validator.mjs` → passed (37 manifests). All 32+ distinct `@letbuyy/*` import specifiers map to declared packages with matching `exports` subpaths (`runtime-composition/storefront-query-layer`, `infrastructure/*-adapter`, etc.).
- **Dependency direction & cycles:** `dependency-graph-validator.mjs` (48 roots, 138 edges) and `circular-import-validator.mjs` (48 roots) → passed.
- **Package exports:** `package-export-validator.mjs` → passed (37 manifests).
- **Env tracked-files / generated artifacts:** `environment-validator.mjs` and generated-artifact validators → passed; no tracked `.env`, no tracked `*.tsbuildinfo` (`git ls-files | grep tsbuildinfo` empty).
- **api-gateway typecheck:** clean (`tsc --noEmit` exit 0) with full `@letbuyy/*` path mappings.
- **Webhook topics:** all four provider inbound routes (`/razorpay`, `/stripe`, `/paypal`, `/cashfree`) exist with signature verification before mutation (`webhook-service/src/index.ts:857,1043,1253,1390`); idempotency via `payment_webhook_events` upsert `onConflict: provider,provider_event_id`.

---

## Governance suite full output (E-GOV) — final clean run

`node scripts/validate-governance.mjs` → **exit 0**, 129 output lines, terminating with
`Governance validation passed (128 validators).` Head/representative lines:

```
Architecture validator passed (2931 tracked files scanned).
Runtime validator passed (21 canonical runtime roots checked).
Runtime manifest validator passed (21 runtime manifests checked).
Runtime topology validator passed (21 canonical runtime roots and 24 topology edges checked).
…
Execution layer validator passed (64 execution foundation files checked; 11 execution adapters enforced).
…
Dependency manifest validator passed (37 package manifests and source imports checked).
Package export validator passed (37 manifests and package import subpaths checked).
Dependency graph validator passed (48 governed roots and 138 internal dependency edges checked).
Circular import validator passed (48 governed roots checked for circular imports).
Environment validator passed (2931 tracked files scanned).
Generated artifact validator passed (2931 tracked files scanned).
Stale artifact validator passed (6 untracked non-ignored files and 2546 workspace files scanned).
Tooling governance validator passed (9 canonical tooling directories checked).
Governance validation passed (128 validators).
```

**Prior FAILING capture (first run, same command, exit 1):**
```
…
Execution reconciliation validator passed (execution WAL, lease, saga, and runtime reconciliation fixed point checked).
Execution layer validator failed:
- Apps/services may not define workflow, orchestration, aggregation, projection, or pipeline authority: services/api-gateway/src/routes/analytics.ts
- Apps/services may not define workflow, orchestration, aggregation, projection, or pipeline authority: services/api-gateway/src/routes/storefront.ts
```
(The suite is fail-fast; validators after the failing one did not run in that invocation.)

---

## Evidence Index

| Ref | Path | Lines / detail |
|-----|------|----------------|
| Governance runner | `scripts/validate-governance.mjs`; `scripts/validators/execution-layer-validator.mjs` | runner full; validator 200-221 |
| Governance failing capture | command output `node scripts/validate-governance.mjs` (run 1) | exit 1 (above) |
| Governance passing capture | command output (final run) | exit 0, 128 validators |
| Event contracts | `packages/event-core/src/index.ts` | 70-98, 202-388, 414-418 |
| Event routing heuristic | `packages/orchestration/src/event-runtime.ts` | 12-22, 178-212 |
| Theme/payout emit sites | `services/api-gateway/src/routes/themes.ts`; `src/execution/theme-execution.adapter.ts`; `src/execution/queue-execution.adapter.ts` | themes 756, 845; theme-adapter 1039, 1101; queue-adapter 495 |
| Queue producers/consumers | `services/api-gateway/wrangler.toml`; `services/queue-workers/wrangler.toml` | producers 55-73, 234-252; consumers 36-95, 232-291 |
| Queue send sites | `services/api-gateway/src/routes/storefront.ts`; `src/index.ts` | storefront 498; index 530, 578 |
| Dual platform-queue drain | `services/api-gateway/src/index.ts`; `src/execution/queue-execution.adapter.ts`; `services/queue-workers/src/platform-queue-consumer.ts` | gateway 525; adapter 216-229; worker 388-401, 516-540 |
| Test scripts | `services/api-gateway/package.json`; `services/webhook-service/package.json`; `services/queue-workers/package.json` | `"test": "echo 'No tests yet' && exit 0"` |
| api-gateway tests present | `services/api-gateway/src/__tests__/*.test.ts` | 6 files, `node:test` |
| tsconfig path asymmetry | `services/api-gateway/tsconfig.json`; `services/webhook-service/tsconfig.json`; `services/queue-workers/tsconfig.json` | gw 26-96; wh 12-16; qw 12-16 |
| FEATURE_LIQUID | `services/api-gateway/src/index.ts`; `src/middleware/featureFlags.ts` | index 101, 353-379; ff 4 |
| webhook reverse binding | `services/webhook-service/wrangler.toml`; `src/index.ts` | toml 60-62, 99-101; Env 25-48 |
| Mobile dart-defines | `apps/mobile/merchant-app/lib/config/app_config.dart`; `packages/dart/core/lib/src/config/gemini_config.dart`; `config/env/templates/mobile.dart-defines.example` | app_config 6-24; gemini 2-13; template full |
| Pooled-SQL fallback | `packages/infrastructure/pooled-sql-adapter/index.ts`; `services/api-gateway/src/routes/storefront.ts`; `config/env/templates/worker.env.example` | adapter 29, 39; storefront 944-988; template (no DATABASE_URL) |
| Internal-auth schemes | `services/api-gateway/src/lib/internal-auth.ts`; `src/routes/storefront.ts`; `src/routes/internal-console.ts`; `services/webhook-service/src/index.ts` | internal-auth 27-37; storefront 1691-1696; console 44-56; webhook 726-732 |
| Preview origin fallback | `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx` | 25-33, 44 |
| Declaration-only services | `services/event-bus/runtime.manifest.json`; `config/env/ownership/runtime-env-ownership.json` | manifest 8-9, 105; ownership 30-39 |
| Provider webhook routes | `services/webhook-service/src/index.ts` | 857, 1043, 1253, 1390 |
| RPC defs | `database/supabase/migrations/000_baseline.sql` | 941, 1398, 4161 (+97 funcs total) |
