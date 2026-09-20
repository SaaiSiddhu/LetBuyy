# Phase 8 — Error & Misconfiguration Audit

Investigation date: 2026-06-05 (second pass, post-remediation)

> Forensic scope: hunt for broken imports, missing registrations/configurations/env vars,
> missing event subscribers/emitters, missing webhook topics, unenforced flags, and missing
> dependency wiring on the LetBuyy platform — re-verified after the remediation/consolidation
> merge (`develop` head `a8cd5fde`, merges of WS1/WS5/WS7/WS9/WS10 + letbuyy-remediation plus
> three `fix(consolidation)` commits `218a0905`/`98b7653c`/`a8cd5fde`). Every finding cites
> file/line or command output. Impact statements are factual. Items that could not be proven
> are marked "not found in repository".

---

## Changes since first pass

| First-pass finding | Second-pass status | One-line evidence |
|--------------------|--------------------|-------------------|
| C-GOV-1 non-deterministic execution-layer failure | **RESOLVED** — 2 full suite runs + 4 isolated validator runs all pass ("64 files; 12 execution adapters enforced", was 11); the in-flight edits were committed in the consolidation commits | run captures below |
| C-A1 theme/payout events uncontracted | **RESOLVED (theme)** — `theme.purchase.*`/`theme.draft.*` registered in `DOMAIN_EVENT_CONTRACTS` (27 types, was 24) with payload schemas + `webhook-service` consumer; **residual** uncontracted payment.* events remain (see M-N2) | `event-core/src/index.ts:74-102,398-429` |
| H-A1 queues without producers | **RESOLVED** — scheduled dispatch produces to all 5 queues via `cloudflare-queue-triggers.ts`; new `/v1/health/queues` readiness endpoint | `index.ts:304-355,413-416,617-620,665` |
| H-A2 dual `platform_queue_jobs` drain | **OPEN** — unchanged dual drain + dual projection writers; new single-writer validator deliberately excludes these tables | writer grep below |
| H-A3 payout.released/failed contracts without producers | **RESOLVED-BY-DESIGNATION** — marked `implementationStatus: 'reserved-human-gated'` with `reservedReason`; still no emitter (intentional) | `event-core:438-457` |
| H-C1 tests exist but never run | **PARTIALLY RESOLVED** — webhook-service & queue-workers `test` scripts now real (`node --test … test/*.test.mjs`; verified passing); **api-gateway `test` is still `echo 'No tests yet' && exit 0`** while holding 7 `src/__tests__/*.test.ts` files (one new); two new repo-level `.test.ts` contract tests are not matched by the root `tests/*/*.test.mjs` glob | scripts + CI greps below |
| M-C1 webhook/queue-workers tsconfig path asymmetry | **OPEN** — both tsconfigs still map only `@letbuyy/infrastructure/*` while queue-workers imports `@letbuyy/event-core`/`orchestration`/`runtime-composition`/`notification-core`; api-gateway maps 19 `@letbuyy` paths. (Standalone `tsc` repro not re-runnable this pass: the repo-root `node_modules` present in the first pass is now absent.) | tsconfigs below |
| M-A1 FEATURE_LIQUID never enforced | **OPEN (now documented)** — still zero enforcement in code; flag formally recorded as production-disabled in `docs/governance/feature-flag-governance.md:20`; new test asserts only declaration + wrangler value | grep + doc below |
| M-A2 API_GATEWAY_SERVICE binding without caller | **RESOLVED** — 8 webhook-service call sites + queue-workers payout emission; binding added to queue-workers wrangler (staging+production) | `gateway-*.ts` clients |
| M-E1 mobile dart-defines missing from template | **OPEN** — template unchanged (`SUPABASE_URL/ANON_KEY/API_BASE_URL/RAZORPAY_KEY_ID/ENVIRONMENT`); code still reads `IDENTITY_BASE_URL`, `STOREFRONT_BASE_URL`, `GEMINI_API_KEY/BASE_URL/MODEL` | template + multiline grep |
| M-E2 worker DB fallback vars not in template | **OPEN** — `worker.env.example` still lacks `DATABASE_URL`/`SUPABASE_DB_URL`; pooled-SQL fallback unchanged | template grep |
| M-A3 wrangler-vars-only operational toggles | **OPEN** — same pattern; toggle set grew (`ORDER_ITEMS_RELATIONAL_READS`, `PRODUCT_VARIANTS_RELATIONAL_READS`, 5 `*_QUEUE_NAME` vars, 5 `PLATFORM_QUEUE_*` tuning vars on queue-workers) | wrangler vars |
| L-A1 declaration-only services | **OPEN (unchanged)** | dir listings |
| L-A2 heterogeneous internal-auth + non-prod no-secret trust | **PARTIALLY CHANGED** — the no-secret trust moved with the extracted routes and now guards the worker→gateway **payment-mutation** endpoints; the two *other* new internal routers fail closed. Split into L-A2 (schemes) + H-N1 (payment endpoints). | `internal-payment-routes.ts:71-76` vs `internal-billing.ts:49-53` |
| L-A3 preview postMessage `'*'` fallback | **OPEN (unchanged)** | `storefront-preview-bridge.tsx:25-33,44` |
| L-A4 developer-portal not wired | **OPEN (still static)** — grew 7→18 source files (WS10), still no API client / env reads | file count + grep |
| L-A5 theme-marketplace auth callback placeholder | **OPEN (unchanged)** | route file |
| New findings this pass | **N-1 … N-5** below (1 High, 2 Medium, 2 Low) | — |

Merge-damage check: no unresolved conflict markers in `apps/`, `services/`, `packages/`,
`scripts/`, `config/` (grep `^<<<<<<< ` → empty); `undeclared-import`, `dependency-graph`
(48 roots / 138 edges), `circular-import`, `event-schema`, `single-writer` validators all pass
individually; full suite passes 129/129. The three `fix(consolidation)` commits repaired:
merged settings types in merchant-control-plane + 3 ops-portal IndexTables (`218a0905` — current
files read clean), the scheduled-dispatch trigger typing + ops page (`98b7653c`), and moved
`scripts/dev/local-stack-*.mjs` → `scripts/utilities/` (`a8cd5fde`). No residual breakage from
those areas was found in this pass.

---

## Method

Read-only; no repository files modified except the two permitted report files. Actions (second pass):

1. Read first-pass 07/08 reports as baseline; re-verified each finding in the current tree.
2. `node scripts/validate-governance.mjs` — 2 full runs, both **exit 0**, `Governance validation passed (129 validators).` (E-GOV below).
3. Individual validators re-run: `execution-layer` (×4), `undeclared-import`, `dependency-graph`, `circular-import`, `single-writer-ownership`, `event-schema` — all pass.
4. Read new files: `scripts/validators/single-writer-ownership-validator.mjs`; gateway `routes/internal-billing.ts`, `routes/internal-events.ts`, `routes/storefront/internal-payment-routes.ts`, `execution/cloudflare-queue-triggers.ts`; webhook-service `gateway-{order,billing}-transitions.ts`, `gateway-events.ts`; queue-workers `gateway-events.ts`; new tests under `tests/contracts/`, `tests/feature-flags/`, `services/webhook-service/test/`, `services/queue-workers/test/`.
5. Ran `node --test test/gateway-order-transitions.test.mjs` in webhook-service → 5/5 pass (Node v22.22.0 strips types natively).
6. Greps: conflict markers; `patchSupabaseRows|upsertSupabaseRows|insertSupabaseRows` per worker; `payment_webhook_events` across services; `queue.send|createCloudflareQueueProducer`; `FEATURE_LIQUID`; `fromEnvironment(` (multiline) across `apps/mobile` + `packages/dart`; table-writer enumeration for `analytics_event_stream|notifications|search_documents|platform_queue_jobs`.
7. Config reads: all three `wrangler.toml`; `config/env/templates/{mobile.dart-defines,worker.env}.example`; root + worker `package.json` scripts; `.github/workflows/*` test invocations.
8. Git: `git log --oneline -15`; `git show --stat` for `218a0905`/`98b7653c`/`a8cd5fde`; `git status --porcelain`.
9. **Tooling caveat (changed since first pass):** the repo-root `node_modules` (which previously provided `tsc`) is absent in this environment, so the standalone `tsc --noEmit` reproductions for webhook-service/queue-workers could not be repeated; M-C1 is re-verified structurally from the tsconfigs + import lists.
10. **Live-repo caveat:** concurrent processes modified *other* `FORENSIC_REPORT/*.md` files during this audit (`git status`: 03/04/05/06/09/12/14 modified); no `apps/`/`services/`/`packages/` source file changed mid-audit this pass. Sole untracked non-ignored file: `.claude/settings.local.json` (matches the stale-artifact validator's "1 untracked" count).

---

# Critical severity

*(none open this pass)*

### C-GOV-1 — Governance suite non-determinism on api-gateway routes — **RESOLVED**
- **First pass:** one `validate-governance.mjs` run failed on `routes/analytics.ts` + `routes/storefront.ts` (execution-layer authority) while those files were being edited concurrently; later runs passed.
- **Second pass evidence:** 2 full suite runs → exit 0; `execution-layer-validator.mjs` ×4 → `passed (64 execution foundation files checked; 12 execution adapters enforced)` every time (adapter count grew 11→12 with `subscription-execution.adapter.ts`). The mid-audit edits are now committed history (`f1b3253b refactor(storefront): split internal payment routes`, `e518315e fix(events): centralize outbox event writes`, `600fe573 fix(events): register theme event contracts honestly`).
- **Status:** no failing state reproducible in the current tree.

### C-A1 — Theme events emitted with no registered contract — **RESOLVED** (theme scope)
- **Second pass evidence:** `DOMAIN_EVENT_TYPES` now includes `theme.purchase.payment_order_created`, `theme.purchase.completed`, `theme.draft.saved`, `theme.draft.discarded` (`packages/event-core/src/index.ts:95-98`) with full contracts (`:398-429`: producer `api-gateway`, consumers incl. `webhook-service`, typed payload schemas `:200-227`). Emitters pass conformant payloads (`routes/themes.ts:754-770` order-created; `:843-858` completed; draft events via `theme-execution.adapter.ts`). Contract test `tests/contracts/domain-event-contracts.test.ts` exercises `getDomainEventContract`/`parseDomainEventPayload` for them.
- **Residual (downgraded, tracked as M-N2):** webhook-service still emits uncontracted `payment.captured` / `payment.failed` / `refund.created` / `payment.subscription.activated` (now via the gateway's `/v1/internal/events/domain`), and `EventExecutionAdapter.emitDomainEvent` still accepts raw payloads for unknown types (`event-execution.adapter.ts:54-56`).

---

# High severity

### H-N1 (new split of first-pass L-A2) — Worker→gateway **payment mutation** endpoints trust requests with no secret in non-production
- **Location:** `services/api-gateway/src/routes/storefront/internal-payment-routes.ts:71-76` —
  ```ts
  function isInternalRequest(c: AppContext): boolean {
      const configuredSecret = c.env.INTERNAL_API_SECRET;
      if (!configuredSecret && c.env.ENVIRONMENT !== 'production') return true;
      ...
  ```
  guarding `GET /internal/orders/:id/payable`, `POST /internal/payments/{reference,confirm,failure,event}` (`:108,128,153,184,211`), mounted under public `/v1/storefront` before `authMiddleware` (`index.ts:455,463`).
- **Evidence of inconsistency:** the two sibling internal routers added in the same remediation **fail closed**: `internal-billing.ts:49-53` and `internal-events.ts:20-24` both `if (!secret) return false;`. The contract test (`tests/contracts/storefront-internal-payment-routes.test.ts`) asserts only the `ENVIRONMENT: 'production'` 403 path; the non-prod bypass is untested. The repo's own audit roadmap records this as an open item: `docs/audit/12-api-refactoring-roadmap.md:43` ("replace with fail-closed (secret required in every env)").
- **Observed impact:** in any non-production gateway deployment where `INTERNAL_API_SECRET` is unset, unauthenticated callers can confirm payments, mark failures/refunds, attach payment references, and read payable orders. These endpoints now also carry the **production payment-transition traffic** from webhook-service (E14/E28), raising their blast radius relative to first pass. Production with a configured secret is guarded. Severity raised from the first-pass Low (was an aside inside L-A2) because the endpoints became the canonical order-mutation path.

### H-A2 — Dual ownership of `platform_queue_jobs` drain and downstream projections — **OPEN**
- **Location:** gateway cron `index.ts:599` (`queue.consumeQueues(workerId, ['analytics-events','search-indexing','payment-events'], 50)`) + `queue-execution.adapter.ts:217` (`claim_platform_queue_jobs`); queue-workers `platform-queue-consumer.ts:392` (same RPC).
- **Evidence:** both runtimes still write `analytics_event_stream` (`queue-execution.adapter.ts:269` / `platform-queue-consumer.ts:448`), `notifications` (`:350` / `:529`), `search_documents` (`:525-564` / `:751-790`), `partner_payout_ledger_entries` (`:444-506` / `:644-700`, both `onConflict: 'source_event_id'`). Both emit `payout.ledger_entry.created` (gateway directly `queue-execution.adapter.ts:491-506`; queue-workers via `/v1/internal/events/domain`, `platform-queue-consumer.ts:728`) while the contract declares producer `queue-workers` (`event-core:430-437`). The new `single-writer-ownership-validator.mjs` rule set (`:22-43`) intentionally does **not** cover these tables, so governance does not flag the duality.
- **Observed impact:** unchanged from first pass — correctness rests on the per-queue claim lock + onConflict keys; no manifest reserves a single drain owner. The remediation added per-queue circuit breakers and drain budgets on the queue-workers side only (`platform-queue-consumer.ts:170-247`, env vars `PLATFORM_QUEUE_*`), making the two drain paths behaviorally asymmetric.

### H-C1 — Test wiring still incomplete on api-gateway and for new repo-level TS tests — **PARTIALLY RESOLVED**
- **Resolved part:** `services/webhook-service/package.json` and `services/queue-workers/package.json` now have `"test": "node --test --experimental-strip-types test/*.test.mjs"`; test files exist (`webhook-service/test/gateway-{order,billing}-transitions.test.mjs`, `gateway-events.test.mjs`; `queue-workers/test/gateway-events.test.mjs`) and run green (executed: `gateway-order-transitions` → 5 pass). CI runs them via `pnpm turbo test` (`.github/workflows/ci.yml:94`).
- **Open part 1:** `services/api-gateway/package.json` still has `"test": "echo 'No tests yet' && exit 0"` while `src/__tests__/` holds 7 real `node:test` files — including the **new** `cloudflare-queue-triggers.test.ts` written for this remediation — none executed by `pnpm test`/turbo/CI.
- **Open part 2:** root `"test": "node --test tests/*/*.test.mjs"` (also `test:governance`; invoked by 3 workflows: `architecture-governance.yml:112`, `production-rollout.yml:123`, `live-production-certification.yml:117`) does not match the two new TypeScript tests `tests/contracts/storefront-internal-payment-routes.test.ts` and `tests/contracts/domain-event-contracts.test.ts` (`.test.ts` ≠ `.test.mjs` glob). The security-relevant 403 contract test therefore runs in no script found in the repository.

---

# Medium severity

### M-C1 — webhook-service & queue-workers tsconfig path asymmetry vs api-gateway — **OPEN**
- **Location:** `services/webhook-service/tsconfig.json` and `services/queue-workers/tsconfig.json` — both still map only `"@letbuyy/infrastructure/*"` in `paths`; `services/api-gateway/tsconfig.json` maps 19 `@letbuyy` specifiers.
- **Evidence:** queue-workers source imports `@letbuyy/event-core`, `@letbuyy/orchestration`, `@letbuyy/runtime-composition`, `@letbuyy/notification-core` (`platform-queue-consumer.ts:1-17`) — none path-mapped. The first-pass `tsc --noEmit` failures (TS2307 on exactly these specifiers) could not be re-executed this pass because the repo-root `node_modules` that previously supplied `tsc` is absent (verified: `node_modules/.bin` empty/missing); the structural asymmetry that caused them is unchanged. Both workers' `build`/`typecheck` scripts remain `tsc --noEmit`.
- **Observed impact:** as in first pass — these two services are not type-checkable in isolation the way api-gateway is; resolution depends on an installed workspace.

### M-N2 (residual of C-A1) — Uncontracted `payment.*` / `refund.*` events accepted by `/v1/internal/events/domain` without payload validation
- **Location:** emitters `services/webhook-service/src/index.ts:264-288` (`emitPaymentDomainEvent`), defaults `payment.captured` (`:335`), `payment.failed` (`:375`), `refund.created` (`markOrderRefunded`), `payment.subscription.activated` (`:481`); acceptor `services/api-gateway/src/routes/internal-events.ts:9-18` (Zod validates the **envelope** only — `eventType: z.string()`); `event-execution.adapter.ts:49-56` (`contract` null → raw payload stored).
- **Evidence:** none of these types appear in `DOMAIN_EVENT_TYPES` (grep `payment.captured|payment.failed|refund.created|payment.subscription` in `event-core/src/index.ts` → no matches). Routing falls to the prefix heuristic (`event-runtime.ts:191` → `payment-events` + `analytics-events`); no `webhook-service` consumer is ever assigned to them, so partner webhooks never fire for raw provider payment events (the contracted `order.paid` emitted by the gateway confirm path covers the order-level signal).
- **Observed impact:** schema-unvalidated rows in `outbox_events` for the highest-volume external-event class; the centralized-emission remediation (D1/E30) moved the write path but not the contract gap.

### M-A1 — `FEATURE_LIQUID` declared, documented, tested-as-declared — still never enforced — **OPEN**
- **Location:** `services/api-gateway/src/index.ts:108` (Env), `middleware/featureFlags.ts:4`; values `wrangler.toml:36,115` (`"true"`), `:219` (`"false"` prod).
- **Evidence:** `featureGate(...)` instantiated only for `FEATURE_GRAPHQL` (`index.ts:426`) and `FEATURE_EXTENSIONS` (`:431`); no `featureGate('FEATURE_LIQUID', …)` and no `c.env.FEATURE_LIQUID` read anywhere in `src/routes/**` (grep). Liquid bundle classification/validation in `execution/schema-registry-execution.adapter.ts:160-299` executes regardless of the flag. New artifacts only *document* the flag: `docs/governance/feature-flag-governance.md:14-22` (claims an "Active code surface" for it) and `tests/feature-flags/gateway-feature-gates.test.mjs:11-15` (asserts the type union and that prod wrangler value is `"false"` — not enforcement).
- **Observed impact:** unchanged — toggling `FEATURE_LIQUID` changes nothing at runtime; the governance doc's "Active code surface" column overstates the wiring.

### M-E1 — Mobile dart-define keys used but absent from the mobile env template — **OPEN**
- **Location:** `config/env/templates/mobile.dart-defines.example` (unchanged: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `API_BASE_URL`, `RAZORPAY_KEY_ID`, `ENVIRONMENT`).
- **Evidence (re-grep, multiline):** `fromEnvironment` keys in code: `API_BASE_URL`, `IDENTITY_BASE_URL`, `STOREFRONT_BASE_URL`, `RAZORPAY_KEY_ID` (`apps/mobile/merchant-app/lib/config/app_config.dart:6-24`), `GEMINI_API_KEY`, `GEMINI_BASE_URL`, `GEMINI_MODEL` (`packages/dart/core/lib/src/config/gemini_config.dart:3-10`), `API_BASE_URL` (`packages/dart/core/lib/src/constants/api_constants.dart:3-4`). Used-but-untemplated: `IDENTITY_BASE_URL`, `STOREFRONT_BASE_URL`, `GEMINI_*` (GEMINI_API_KEY defaults to empty string). Templated-but-unread-via-fromEnvironment: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ENVIRONMENT`.
- **Observed impact:** unchanged from first pass.

### M-E2 — Worker fallback DB URL vars not in worker template — **OPEN**
- **Location:** `packages/infrastructure/pooled-sql-adapter/index.ts:29` fallback chain `HYPERDRIVE → DATABASE_URL → SUPABASE_DB_URL`; gateway `Env` `index.ts:63-64`.
- **Evidence:** `config/env/templates/worker.env.example` defines neither (grep → only `INTERNAL_API_SECRET`/`LETBUYY_INTERNAL_API_SECRET` at lines 7-8 among related keys).
- **Observed impact:** unchanged — pooled storefront reads silently degrade when Hyperdrive is unbound, with no template guidance.

### M-A3 — Behavior-altering wrangler-vars without schema validation — **OPEN (surface grew)**
- **Location:** gateway `wrangler.toml:34-55` now carries 13 operational vars incl. new `ORDER_ITEMS_RELATIONAL_READS`, `PRODUCT_VARIANTS_RELATIONAL_READS`, and 5 `*_QUEUE_NAME` vars; queue-workers `wrangler.toml:30-34` adds `PLATFORM_QUEUE_CLAIM_LIMIT`, `…_DRAIN_BUDGET_PER_BATCH`, `…_CIRCUIT_FAILURE_THRESHOLD`, `…_CIRCUIT_OPEN_SECONDS`, `…_DRAIN_GENERIC_FANOUT`.
- **Evidence:** consumed as raw strings with `Number(...)`/string compare (e.g. `storefront.ts:440-442` sample-rate coercion; `platform-queue-consumer.ts` clamp helpers). No schema validates them.
- **Observed impact:** unchanged class of risk; an invalid `STOREFRONT_VIEW_SAMPLE_RATE` still silently falls back; misspelled queue-name vars would silently relabel health/telemetry (`index.ts:155-173` uses fallback names).

---

# Low severity

### L-N1 (new) — `platform_queue_jobs` rows with `queue_name='webhook-deliveries'` have no consumer
- **Location:** producer `services/api-gateway/src/execution/outbox-execution.adapter.ts:165-189` (`enqueueWebhookDeliveryJob`, one row per outbox event that fanned out webhook deliveries, `job_type: 'webhook.deliver'`).
- **Evidence:** both drains claim only `analytics-events`/`search-indexing`/`payment-events` (`index.ts:196,552`; `platform-queue-consumer.ts:21` union; `operations.ts:536` manual consume list; `claim_platform_queue_jobs` is per-queue-name, `000_baseline.sql:793-796`). The cron preflight filters to the 3 names (`index.ts:242-247`), so these rows neither trigger nor receive work. Actual partner delivery flows through `webhook_deliveries` + webhook-service RPCs, independent of these rows.
- **Observed impact:** rows accumulate in `queued` status indefinitely; they appear in the `/v1/operations/jobs` listing (filterable) but are dead weight. Introduced by the remediation (commit `e518315e fix(events): centralize outbox event writes` window).

### L-N2 (new) — `API_GATEWAY_SERVICE` binding absent from both workers' top-level (default) wrangler env
- **Location:** `services/webhook-service/wrangler.toml` and `services/queue-workers/wrangler.toml` declare `[[env.staging.services]]`/`[[env.production.services]]` only (webhook `:60-62,99-101`; queue-workers `:191-193,293-295`); the top-level config (which also declares queue consumers, queue-workers `:36-95`) has no `[[services]]` block, and `INTERNAL_API_SECRET` is a secret not present in any `[vars]`.
- **Evidence:** the gateway clients throw at call time when either is missing (`gateway-order-transitions.ts:19-25`; `queue-workers/src/gateway-events.ts:25-31`). queue-workers' `index.ts` `Env` (`:26-40`) does not even list `API_GATEWAY_SERVICE`/`INTERNAL_API_SECRET` (they ride in optionally via `PlatformQueueConsumerEnv`, `platform-queue-consumer.ts:136-144`).
- **Observed impact:** a deploy of either worker without `--env staging|production` (top-level profile) would consume queues/webhooks but fail every gateway-routed mutation at runtime with "API_GATEWAY_SERVICE binding is required…". Deploys via the documented env profiles are correctly wired. Factual configuration asymmetry; no proof any deploy path uses the top-level profile.

### L-A2 — Heterogeneous internal-auth schemes across the gateway boundary — **OPEN (scheme count unchanged)**
- **Evidence (current):** HMAC session headers (`createLetbuyyInternalSessionHeaders`, merchant/ops clients); HMAC app-attestation `X-LetBuyy-Internal-App` (storefront customer paths, `client.ts:102-116`); raw `X-Internal-API-Secret` (now the worker→gateway scheme for payments/billing/events); static bearer `PLATFORM_CONSOLE_API_TOKEN` (`internal-console.ts:44-45`); `X-LetBuyy-Internal-Secret`/Bearer (gateway→webhook-service, `webhook-service:526-555`). The non-prod no-secret trust formerly noted here is split out as H-N1.
- **Observed impact:** five distinct internal trust mechanisms persist; three key off the same `INTERNAL_API_SECRET`/`AUTH_SECRET` material.

### L-A1 — Six `services/*` runtime roots declaration-only — **OPEN (unchanged)**
- Same directory contents (`AGENTS.md` + `runtime.manifest.json` each); responsibilities still realized in api-gateway/queue-workers; governed as reserved per CLAUDE.md/manifests.

### L-A3 — Theme-editor preview postMessage `'*'` origin fallback — **OPEN (unchanged)**
- `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx:25-33` (`getParentTargetOrigin` → `'*'` when no referrer), `:44` (`selectSection` posts to `window.location.origin`). Identical to first pass.

### L-A4 — developer-portal still integrates with nothing — **OPEN (grew but static)**
- 18 source files now (was 7; WS10 scaffold, `apps/developer-portal/CODEX_WS10_LEDGER.md` checked in at app root); still no `lib/api/client.ts`, zero `process.env.*` reads (grep empty).

### L-A5 — theme-marketplace `auth/callback` pure-redirect placeholder — **OPEN (unchanged)**

### L-N3 (new) — Workstream-ledger documents checked into app source trees
- **Location:** `apps/merchant-control-plane/src/app/[store]/settings/CODEX_WS9_LEDGER.md` (inside a Next.js route segment), `apps/developer-portal/CODEX_WS10_LEDGER.md`, `packages/typescript/ui/CODEX_WS1_LEDGER.md`, plus root-level `CODEX_MASTER_EXECUTION_LEDGER.md`, `CODEX_WS5_LEDGER.md`, `CODEX_WS7_LEDGER.md`, `CODEX_WS12_LEDGER.md`, `CODEX_FOUNDATION_HARDENING_{LEDGER,MISSION,STATUS}.md`, `CODEX_FOUNDATION_REMEDIATION_MISSION.md`.
- **Evidence:** glob `**/CODEX_*`; prior-wave equivalents were archived under `docs/archive/root-residue/2026-06-05-foundation-hardening/` while these new ones were not. Inert at runtime (`.md` is not a Next route file); architecture/tooling validators pass with them present.
- **Observed impact:** merge residue of the 5-workstream consolidation living outside `docs/`; documents-as-source-tree drift relative to the archived convention. No functional break.

---

## Cross-checks that PASSED (negative findings)

- **Conflict markers:** none in `apps/`, `services/`, `packages/`, `scripts/`, `config/` (`^<<<<<<< ` grep empty). No duplicate route mounts found in `index.ts` (each `api.route` path unique; internal payment paths exist only in the extracted module — `isInternalRequest`/`X-Internal-API-Secret` grep in `storefront.ts` → zero matches).
- **Single-writer:** `single-writer-ownership-validator.mjs` → passed ("107 source files"); independent greps confirm webhook-service writes only `payment_webhook_events` (`:76,96`) and that `payment_webhook_events` has zero references in api-gateway/queue-workers source.
- **Imports/graph:** `undeclared-import` (37 manifests), `dependency-graph` (48 roots / 138 edges), `circular-import` (48 roots) → passed. The new worker modules introduce no new package edges (plain relative imports + existing deps).
- **Worker→gateway clients tested:** `node --test test/gateway-order-transitions.test.mjs` → 5/5 pass (asserts URL `/v1/storefront/internal/payments/*`, method, `X-Internal-API-Secret` header, body shape, and error propagation on non-2xx).
- **Provider webhook topics:** all four inbound routes present with signature verification before mutation (`webhook-service/src/index.ts:661,852,1051,1189`); idempotency via `payment_webhook_events` upsert `onConflict provider,provider_event_id` (`:76-87`); processing status patched terminally (`:89-104`).
- **Queue producer/consumer symmetry:** per-env producer queue names (`wrangler.toml:57-75,136-154,240-258`) exactly match queue-workers consumer queue names (`queue-workers/wrangler.toml:36-95,130-189,232-291`) for all 5 queues + DLQs; `*_QUEUE_NAME` vars match producer bindings; `GET /v1/health/queues` reports binding presence (`index.ts:143-173`).
- **Internal endpoints fail-closed where claimed:** `internal-billing.ts:49-53` and `internal-events.ts:20-24` return false (→403) when `INTERNAL_API_SECRET` unset — verified in code; production path of the payment routes verified by the (unwired) contract test reading.
- **Generated/stale/env artifacts:** environment + generated-artifact validators pass (3043 tracked files); stale-artifact reports exactly 1 untracked non-ignored file = `.claude/settings.local.json` (session tooling, not codebase).

---

## Governance suite full output (E-GOV) — second pass

`node scripts/validate-governance.mjs` → **exit 0** (both runs), 130 output lines, terminating
with `Governance validation passed (129 validators).` Tail:

```
…
CI simulation validator passed (CI workflows and release promotion plan checked for mandatory enterprise gates).
Domain boundary validator passed (13 domain packages, 17 schema facades, and 115 app API route ownership records checked).
Single-writer ownership validator passed (107 source files checked for Single-Writer table ownership).
Environment validator passed (3043 tracked files scanned).
Generated artifact validator passed (3043 tracked files scanned).
Stale artifact validator passed (1 untracked non-ignored files and 2672 workspace files scanned).
Tooling governance validator passed (9 canonical tooling directories checked).
Governance validation passed (129 validators).
```

**Validator #129 (the addition since first pass's 128):** `single-writer-ownership-validator.mjs`
— listed at line 129 of the runner array in `scripts/validate-governance.mjs` (the 129 array
entries are the complete suite; `scripts/validators/` holds 132 `.mjs` files, the 3 non-runner
files being the shared helpers `governance-common.mjs`,
`operational-certification-common.mjs`, `production-certification-common.mjs`). Its rules
(`:22-62`): webhook-service may not write `orders/products/subscriptions/sites/billing_history/outbox_events`;
queue-workers may not write `outbox_events`; api-gateway and queue-workers may not write
`payment_webhook_events`; webhook-service may not call the 8 gateway-owned
`*_with_ledger`/inventory order RPCs. Detection: regex over `patchRows/patch|insert|upsertSupabaseRows`
helper calls and Supabase query-builder `.from('<table>')…(insert|update|upsert|delete)` chains.

Isolated re-runs: `execution-layer-validator.mjs` ×4 → pass ("12 execution adapters enforced");
`undeclared-import` / `dependency-graph` / `circular-import` / `single-writer-ownership` /
`event-schema` → pass.

---

## Evidence Index

| Ref | Path | Lines / detail |
|-----|------|----------------|
| Governance runner + new validator | `scripts/validate-governance.mjs`; `scripts/validators/single-writer-ownership-validator.mjs` | runner array (129 entries, line 129); validator 22-62, 68-112 |
| Governance passing captures (×2) + isolated runs | command output | exit 0; tails above |
| Event contracts (27 types; reserved markers) | `packages/event-core/src/index.ts` | 74-133, 200-235, 398-471, 487-504 |
| Event routing heuristic | `packages/orchestration/src/event-runtime.ts` | 178-212 |
| Theme emit sites (contracted) | `services/api-gateway/src/routes/themes.ts` | 754-770, 843-858 |
| Internal payment routes + no-secret bypass | `services/api-gateway/src/routes/storefront/internal-payment-routes.ts` | 71-76, 106-233 |
| Internal billing/events (fail-closed) | `services/api-gateway/src/routes/internal-billing.ts`; `routes/internal-events.ts` | billing 49-53, 96-195; events 9-59 |
| Route mounts | `services/api-gateway/src/index.ts` | 42-43, 455-463 |
| Queue trigger planner + enqueue + health | `services/api-gateway/src/execution/cloudflare-queue-triggers.ts`; `src/index.ts` | planner 92-137; index 143-173, 304-355, 413-416, 617-620, 665 |
| Dual drain + projections | `services/api-gateway/src/index.ts`; `src/execution/queue-execution.adapter.ts`; `services/queue-workers/src/platform-queue-consumer.ts` | index 196, 242-247, 599; gw-adapter 217, 269, 350, 444-506, 525-564; qw 21, 392, 448, 529, 644-738, 751-790 |
| webhook-deliveries dead jobs | `services/api-gateway/src/execution/outbox-execution.adapter.ts`; `routes/operations.ts` | adapter 165-189; ops 500-539 |
| webhook-service writes + gateway clients + provider routes | `services/webhook-service/src/index.ts`; `src/gateway-*.ts`; `test/*.test.mjs` | index 66-104, 264-514, 526-655, 661, 852, 1051, 1189; clients full; tests run 5/5 |
| Wranglers (bindings per env; vars) | `services/api-gateway/wrangler.toml`; `services/webhook-service/wrangler.toml`; `services/queue-workers/wrangler.toml` | gw 26-83, 102-188, 206-292; wh 60-62, 99-101; qw 19-98, 191-200, 293-303 |
| Test scripts + CI | `services/*/package.json`; root `package.json`; `.github/workflows/{ci,architecture-governance,production-rollout,live-production-certification}.yml` | scripts quoted above; ci.yml 94; others 112/123/117 |
| api-gateway untested tests | `services/api-gateway/src/__tests__/` | 7 files incl. `cloudflare-queue-triggers.test.ts` |
| Unwired TS contract tests | `tests/contracts/storefront-internal-payment-routes.test.ts`; `tests/contracts/domain-event-contracts.test.ts` | full; root glob `tests/*/*.test.mjs` |
| tsconfig asymmetry | `services/api-gateway/tsconfig.json` (19 `@letbuyy` mappings); `services/webhook-service/tsconfig.json`; `services/queue-workers/tsconfig.json` | wh/qw paths block (infrastructure only) |
| FEATURE_LIQUID | `services/api-gateway/src/index.ts`; `middleware/featureFlags.ts`; `wrangler.toml`; `docs/governance/feature-flag-governance.md`; `tests/feature-flags/gateway-feature-gates.test.mjs`; `execution/schema-registry-execution.adapter.ts` | index 108, 426-435; ff 4; toml 36/115/219; doc 14-22; test 10-52; adapter 160-299 |
| Mobile dart-defines | `apps/mobile/merchant-app/lib/config/app_config.dart`; `packages/dart/core/lib/src/config/{gemini,razorpay}_config.dart`; `…/constants/api_constants.dart`; `config/env/templates/mobile.dart-defines.example` | app_config 6-24; gemini 3-10; template full (unchanged) |
| Pooled-SQL fallback + worker template | `packages/infrastructure/pooled-sql-adapter/index.ts`; `config/env/templates/worker.env.example` | adapter 29; template 7-8 |
| Internal-auth schemes | `apps/storefront-runtime/src/lib/api/client.ts`; `routes/internal-console.ts`; `webhook-service/src/index.ts` | client 102-116, 142-154; console 44-45; wh 526-555 |
| Preview origin fallback | `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx` | 25-33, 44 |
| Workstream ledger residue | glob `**/CODEX_*`; `docs/archive/root-residue/2026-06-05-foundation-hardening/` | paths listed in L-N3 |
| Consolidation commits | git `218a0905`, `98b7653c`, `a8cd5fde` + 6 merge commits | `git log`/`git show --stat` |
| Live-repo state | `git status --porcelain` | 8 FORENSIC_REPORT files modified by concurrent agents; 1 untracked `.claude/settings.local.json` |
