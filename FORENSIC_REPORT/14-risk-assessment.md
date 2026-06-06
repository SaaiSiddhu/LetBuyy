# Phase 14 — Risk Assessment (Operational Focus)

Investigation date: 2026-06-05 (second pass, post-remediation)

This report documents the **current operational state** of the LetBuyy platform from a production-operations, scaling, operational-security, developer-experience, and reliability standpoint. It is a forensic record of what exists in the tree at the audited commit — not a remediation plan. A sibling report (`FORENSIC_REPORT/11-architecture-violations.md`) covers structural layer/boundary violations; this report deliberately avoids re-deriving those and focuses on runtime/operational risk. Every risk cites file paths and/or command output. Where a control is present, that is stated as evidence; absence is only claimed where a search returned nothing.

This is the **second pass**: each first-pass risk carries a status tag — **RESOLVED**, **REDUCED**, **STILL-OPEN**, or **NEW** — with the evidence that supports the tag.

Repository (file tools): `/Users/saai_sidd/Git/Letbuyy_Store`
Repository (bash): `/sessions/brave-sweet-gates/mnt/Letbuyy_Store`
Audited HEAD (second pass): `127a850e 2026-06-05 23:22:01 +0530 fix(consolidation): align local stack scripts governance` (`git log -1`)
Total commits: 802 (`git rev-list --count HEAD`); **74 commits since the first-pass HEAD** `5346ced9` (`git rev-list --count 5346ced9..HEAD` = 74). First-pass baseline: 727 commits, 34 risks (0 Critical / 9 High / 15 Medium / 10 Low).

---

## Changes since first pass

74 commits landed between `5346ced9` and `127a850e` (`git log --oneline 5346ced9..HEAD`), dominated by merges of remediation workstreams (`stream/letbuyy-remediation`, `stream/WS1-designsystem`, `stream/WS5-operations`, `stream/WS7-hardening`, `stream/WS9-settings`, `stream/WS10-devportal`). `git diff --stat 5346ced9..HEAD` = 344 files changed, +23,635 / −8,761. Operationally relevant deltas, each verified:

1. **Webhook-service single-writer extraction (verified).** `services/webhook-service` no longer writes `orders`/`products`/`subscriptions`/`sites`/`billing_history` directly — `Grep "\.from\('(orders|products|subscriptions|sites|billing_history)'\)"` over `services/webhook-service/src` → **no matches**. Mutations route through new gateway-owned internal endpoints via the `API_GATEWAY_SERVICE` binding with `X-Internal-API-Secret` (`webhook-service/src/gateway-order-transitions.ts:14-46`, `gateway-billing-transitions.ts`, `gateway-events.ts`); the client **fails closed** when binding or secret is absent (`gateway-order-transitions.ts:19-25`).
2. **New gateway internal mutation surface (verified — introduces a NEW risk).** `services/api-gateway/src/routes/storefront/internal-payment-routes.ts` (233 lines, new), `routes/internal-billing.ts` (197 lines, new), `routes/internal-events.ts` (61 lines, new). The payment routes' guard **fails open in non-production** (`internal-payment-routes.ts:71-76`, see §3.9 NEW); billing/events guards fail closed (`internal-billing.ts:49-53`, `internal-events.ts:20-24`).
3. **Real per-workspace tests appeared in 2 of 12 deployables (verified).** `services/webhook-service/package.json` `"test": "node --test --experimental-strip-types test/*.test.mjs"` → **12 tests, 12 pass** (run in this audit); `services/queue-workers` same pattern → **2 tests, 2 pass**. The other 10 deployables (all 9 apps + api-gateway) keep `"test": "echo 'No tests yet' && exit 0"`.
4. **New root-level tests (verified present, runner gap found).** `git diff --name-status 5346ced9..HEAD -- tests/` adds 10 test files: `tests/contracts/domain-event-contracts.test.ts`, `tests/contracts/storefront-internal-payment-routes.test.ts`, `tests/federation/{app-api-route-ownership,app-install-idempotency,app-install-store-ownership,app-review-verified-install,developer-portal-capability-messaging,marketplace-service-error-handling}.test.mjs`, `tests/performance/dual-model-consolidation.test.mjs`, `tests/theme-engine/theme-template-editor.test.mjs`. The 5 federation `.mjs` suites named in the remediation claims = **12 tests, 12 pass** when run. The two `.ts` contract tests **fail to load under the root runner** (`node --test` → `ERR_UNSUPPORTED_DIR_IMPORT` / `ERR_MODULE_NOT_FOUND` on extensionless imports) and are matched by **no** script — root `"test"` globs only `tests/*/*.test.mjs` (`package.json:43`); see §4.3.
5. **api-gateway `__tests__` additions.** `services/api-gateway/src/__tests__/cloudflare-queue-triggers.test.ts` is new (7 colocated `__tests__` files now), backing a new real queue-trigger producer `src/execution/cloudflare-queue-triggers.ts` (`planScheduledDispatchQueueTriggers`, `:92-137`). These are still **not** run by the package `test` script (no-op echo).
6. **Deploy workflows: only matrix additions.** `git diff 5346ced9..HEAD -- .github/workflows/` touches **only** `deploy-production.yml` (+2: developer-portal in matrix + health URL) and `production-deploy.yml` (+4: developer-portal in preflight + matrix). The dual-trigger race, the ungated path's missing migration job, and the SKIP-on-missing-creds behavior are byte-identical otherwise (§1.1, §1.2). `tests/operations/production-deploy-workflow.test.mjs` now names `deploy-production.yml` the **`legacyWorkflow`** and asserts both matrices stay in sync (`:6, :90-97`) — the dual-workflow topology is codified, not removed.
7. **app-marketplace / theme-marketplace API base URL fail-fast (verified).** Both now throw instead of defaulting to a staging host (`apps/app-marketplace/src/lib/api/client.ts:20-31`; `apps/theme-marketplace/src/lib/api/client.ts:20-21`). `identity-platform` and `platform-operations-portal` still default to staging (§3.10).
8. **Governance/validators grew and now pass within budget.** `node scripts/validate-governance.mjs` → **"Governance validation passed (129 validators)"**, completing inside a 40s timeout (first pass: killed at 35s). New validators include `single-writer-ownership-validator.mjs` (+112 lines) and a `runtime-manifest-validator` extension; new 885-line `scripts/utilities/local-stack-up.mjs` local-stack orchestrator (not wired into any `package.json` script — `grep 'local-stack' package.json` → none).
9. **Three new migrations** (`085_orders_items_reconcile.sql`, `086_products_variants_reconcile.sql`, `087_theme_template_drafts.sql`; `088` modified) — `database/supabase/migrations/` now 18 files. `000_baseline.sql` unchanged (same 3 tables without RLS). `node scripts/validators/migration-safety-validator.mjs` → passed.
10. **Unchanged operational hot spots (verified by diff):** `services/api-gateway/src/middleware/rateLimit.ts`, `src/lib/storefront-cache.ts`, `packages/infrastructure/pooled-sql-adapter/`, `services/webhook-service/wrangler.toml`, `services/queue-workers/wrangler.toml` all absent from `git diff --stat 5346ced9..HEAD`; `services/api-gateway/wrangler.toml` gained only 6 lines (`*_QUEUE_NAME` vars). `infrastructure/observability/` and `infrastructure/monitoring/` untouched.

---

## Method

Commands and tools run (all read-only against the codebase; the sole write is this report):

- Baseline diffing: `git log -1`, `git rev-list --count`, `git log --oneline 5346ced9..HEAD`, `git diff --stat/--name-status 5346ced9..HEAD` scoped to `.github/`, `scripts/`, `tests/`, `services/`, `database/`, `infrastructure/`, `README.md`, `docs/governance/`, and the specific files cited in first-pass risks.
- Deploy/infra re-read: full reads of `.github/workflows/production-deploy.yml` (448 lines) and `.github/workflows/deploy-production.yml` (170 lines) at HEAD; exact `git diff` of both vs `5346ced9`; `grep "schedule:" .github/workflows/` (no cron workflows); `grep "d1 migrations" .github/` (none); `grep -rn "vercel rollback"` (none outside this report).
- Test reality: `"test"` script census across all `apps/*/package.json` and `services/*/package.json`; `Grep "\"test\":"` over `packages/**/package.json` (none); executed `node --test --experimental-strip-types test/*.test.mjs` inside `services/webhook-service` (12/12 pass) and `services/queue-workers` (2/2 pass); executed the 5 new federation suites (12/12 pass); attempted both new `.ts` contract tests under `node --test --experimental-strip-types` (both fail to load: `ERR_UNSUPPORTED_DIR_IMPORT` for `storefront-internal-payment-routes.test.ts`, `ERR_MODULE_NOT_FOUND` on `packages/event-core/src/index` for `domain-event-contracts.test.ts`); full root suite `node --test tests/*/*.test.mjs` → 411 tests, **402 pass / 9 fail**, every sampled failure being `ERR_MODULE_NOT_FOUND` (e.g. `Cannot find package 'typescript'`) in this dependency-free environment.
- Security re-verification: reads of `services/api-gateway/src/routes/internal-console.ts:38-66` (static token), `routes/storefront/internal-payment-routes.ts` (full), `routes/internal-billing.ts:49-53`, `routes/internal-events.ts:20-24`, `src/index.ts:360-410` (CORS), `apps/platform-console/src/lib/console-auth-server.ts:138-155` (TOTP + dev bypass), `apps/identity-platform/src/app/api/auth/signup/route.ts` (full; OTP echo), webhook signature path (`webhook-service/src/index.ts:228-229`, `app-lifecycle-dispatch.ts:59-63`); RLS recount via `comm -23` of `CREATE TABLE` vs `ENABLE ROW LEVEL SECURITY` in `000_baseline.sql`.
- Observability re-verification: `Grep "writeDataPoint"` repo-wide (only forensic/mission docs); `Grep "prom-client|@opentelemetry"` over `**/package.json` (none); `Grep` for the four alert metric names (only `infrastructure/observability/*` + docs); `Grep "ensure_next_hot_table_partitions|detach_expired_hot_table_partitions"` (migration `079`, governance doc, and a text-assertion test `tests/performance/partition-retention.test.mjs` — no runtime caller).
- Validators executed: `node scripts/validate-governance.mjs` → PASS (129 validators, < 40s); `node scripts/validators/migration-safety-validator.mjs` → PASS.
- Config: `supabase/config.toml` vs `database/supabase/config.toml` major-version recheck; `services/api-gateway/wrangler.toml` `ENVIRONMENT` defaults and `*_QUEUE_NAME` vars; `package.json` scripts (47 total; `validate:runtime` = 53 chained validators).

Environment constraint (worse than first pass): repo-root `node_modules/` is now **completely empty** (`ls node_modules/` → nothing) — the remediation status doc itself records that "Recursive cleanup removed workspace-local `node_modules`" (`CODEX_FOUNDATION_HARDENING_STATUS.md`, F0 gate evidence). `pnpm` remains unavailable in this bash workspace. Consequently **no typecheck/lint/build could be executed here**; the remediation document's gate claims (`pnpm turbo typecheck: PASS - 60/60 tasks`, `pnpm lint: PASS - 9/9 tasks`, `pnpm install --frozen-lockfile --force: PASS`, `pnpm run validate:governance: PASS - 129/129`) are recorded as **claims**, of which only the governance number (129) was independently reproduced here. Cheap structural checks done in lieu: every app/service workspace has a `tsconfig.json` (12/12 present), and the same doc's **baseline** section records that before its own F0 fix, `pnpm turbo typecheck` FAILED on `apps/developer-portal` and `packages/shared-types` resolution — i.e. install/typecheck fragility was real as recently as 2026-06-05T13:54Z.

---

## 1. Production Risks

### 1.1 Two parallel, overlapping production deploy workflows both trigger on push to `main` — **STILL-OPEN**
**Severity: High — Likelihood: High**
Unchanged at HEAD. Both `.github/workflows/production-deploy.yml` (`name: Production deploy`) and `.github/workflows/deploy-production.yml` (`name: Deploy Production`) declare `on: push: branches: [main]` (`production-deploy.yml:3-7`; `deploy-production.yml:3-6`) with **different concurrency groups** (`production-deploy`, `:12-14` vs `deploy-production`, `:11-13`), so GitHub will not serialize them — both run on the same `main` push and deploy the same targets (now **nine** Vercel apps each, developer-portal added to both matrices, plus three workers) by different mechanisms. `git diff 5346ced9..HEAD` on both files shows **only** the developer-portal matrix/preflight/health additions — the race is byte-identical otherwise. The situation is now **codified**: `tests/operations/production-deploy-workflow.test.mjs:6` loads `deploy-production.yml` as `legacyWorkflow` and `:90-97` asserts every production app appears in **both** workflows, institutionalizing the parallel topology rather than retiring it.
- Evidence: both workflow headers at HEAD; `git diff 5346ced9..HEAD -- .github/workflows/{deploy-production,production-deploy}.yml` (matrix-only deltas); `tests/operations/production-deploy-workflow.test.mjs:6, 90-98`.
- Affected surface: all nine production Vercel apps + all three Cloudflare workers (concurrent same-target deploys, last-writer-wins).

### 1.2 Ungated deploy workflow has no migration step, no staging gate, and silently skips on missing credentials — **STILL-OPEN**
**Severity: High — Likelihood: Medium**
Unchanged. `deploy-production.yml` jobs remain `deploy-workers → deploy-apps → smoke-test-production` with **no** `migrate*` job and **no** staging-e2e gate; every deploy step is guarded by `HAS_CLOUDFLARE_CREDS`/`HAS_VERCEL_CREDS` and falls through to `echo "SKIP…"` (`deploy-production.yml:73-75, 117-120, 130-132, 140-142`). A "green" run can deploy nothing, or deploy worker/app code ahead of schema when this path lands before (or instead of) the gated one. The gated `production-deploy.yml` still hard-fails preflight on any missing credential (`:63-106`, now 35 required secrets including the new `PRODUCTION_DEVELOPER_PORTAL_PROJECT_ID`).
- Evidence: `deploy-production.yml` full read at HEAD (jobs list; skip steps); `production-deploy.yml:24-106` preflight.
- Affected surface: production release integrity; schema/code version skew.

### 1.3 Production DB migration runs `supabase db push --include-all` against the live DB with no transactional/manual review gate — **STILL-OPEN**
**Severity: High — Likelihood: Medium**
Unchanged. `migrate-production` in the gated workflow still: `db diff` → 30-day artifact (`production-deploy.yml:184-195`) → encrypted `pg_dump` backup, 7-day artifact (`:197-214`) → `pnpm dlx supabase@latest db push --db-url "$PRODUCTION_DB_CONNECTION_STRING" --include-all` (`:216-219`). No human approval step is encoded between diff and push; the `production-migrations` GitHub environment (`:163`) *could* carry a protection rule but none is represented in-repo. Mitigating control re-verified this pass: `node scripts/validators/migration-safety-validator.mjs` → "Migration safety validator passed (Supabase migration history checked for destructive replay hazards)". `tests/operations/production-deploy-workflow.test.mjs:39-47` now asserts the diff/backup/push sequence exists — it tests for the *presence* of `db push`, not for an approval gate.
- Evidence: `production-deploy.yml:159-219`; validator output (passed); `production-deploy-workflow.test.mjs:39-47`.
- Affected surface: production Postgres (commerce + operational tables; three new migrations 085-087 pending in this set).

### 1.4 Migration tooling has two diverging roots (Postgres major 15 vs 17) — **STILL-OPEN**
**Severity: Medium — Likelihood: Medium**
Unchanged. Root `supabase/` contains only `config.toml` with `major_version = 15` (`supabase/config.toml:13`; `ls supabase/` → `config.toml` only, no `migrations/`); `database/supabase/config.toml:11` says `major_version = 17`. The active migration set lives in `database/supabase/migrations/` (now **18 files**: `000_baseline.sql`, `073`–`089`; three added since first pass). Which config the Supabase CLI binds to still depends on invocation cwd, and the two configs still disagree on the Postgres major version.
- Evidence: `supabase/config.toml:13` vs `database/supabase/config.toml:11`; `ls database/supabase/migrations/` (18 files); `git diff --name-status 5346ced9..HEAD -- database/` (085/086/087 added, 088 modified).
- Affected surface: migration determinism; shadow-DB diffing during `db diff`/`db push`.

### 1.5 Cloudflare D1 migrations are not applied by either production deploy workflow — **STILL-OPEN**
**Severity: Medium — Likelihood: Medium**
Unchanged. `grep "d1 migrations" .github/` → no matches; `wrangler d1 migrations apply` remains only in `infrastructure/scripts/cloudflare/bootstrap-environment.mjs` (manual, mutation-approval-gated). The D1 binding and its single migration (`database/cloudflare/d1/migrations/0001_provider_execution_foundation.sql`) are unchanged since first pass (`infrastructure/` absent from the diffstat).
- Evidence: `Grep "d1 migrations"` over `.github/` → none; `git diff --stat 5346ced9..HEAD -- infrastructure/` → no changes.
- Affected surface: `letbuyy-production-d1` schema drift vs worker code.

### 1.6 Rollback exists for Workers but no encoded rollback path for Vercel apps — **STILL-OPEN**
**Severity: Medium — Likelihood: Medium**
Unchanged. `grep -rn "vercel rollback"` across the repo matches only this report. The Worker rollback wrapper (`infrastructure/scripts/deploy/production-rollback.mjs`) and lineage manifest are unchanged. Recovery of a bad deploy of any of the **nine** production apps still depends on out-of-repo Vercel dashboard action.
- Evidence: `Grep "vercel rollback"` → 1 file (`FORENSIC_REPORT/14-risk-assessment.md` itself); `infrastructure/` unchanged in `git diff --stat 5346ced9..HEAD`.
- Affected surface: production app tier (nine Next.js apps).

### 1.7 Health checks are shallow (HTTP status only); error-tracking SaaS absent — **STILL-OPEN**
**Severity: Medium — Likelihood: High**
Unchanged. `deploy-production.yml:144-169` still asserts only `200`/`302` from edge URLs (now including `developers.letbuyy.store`) and `200` from `/v1/health`; `healthResponse` is still static `{status:'healthy', version:'2.0.0'}` (`services/api-gateway/src/index.ts:134-141, 403-405`). `Grep "@sentry|Sentry|datadog|newrelic|honeycomb|axiom|betterstack"` over `apps/` and `services/` → **no matches** at HEAD.
- Evidence: greps as above; `deploy-production.yml:144-169`; `index.ts:134-141`.
- Affected surface: production incident detection/triage latency.

### 1.8 Staging vs production separation: present and reasonably clean (positive control) — **UNCHANGED (positive)**
**Severity: Low — Likelihood: Low**
The env-separated topology (separate project-id secret sets, per-env worker names/routes/KV/D1/Hyperdrive/R2/queues, `develop → staging` / `main → production`) is unchanged, and the gated workflow's staging-E2E hard gate before production migration remains (`production-deploy.yml:108-157`). The residual foot-gun is also unchanged and now **compounds**: the base `[vars]` of `services/api-gateway/wrangler.toml:27` still hardcodes `ENVIRONMENT = "staging"`, so a bare `wrangler deploy` (no `--env production`) publishes a worker that self-identifies as staging — and the **new** internal-payment-route guard treats any `ENVIRONMENT !== 'production'` worker with a missing `INTERNAL_API_SECRET` as open (see §3.9 NEW). The only wrangler change this pass is six added `*_QUEUE_NAME` vars (`wrangler.toml:51-55, 130-134, 234-238`).
- Evidence: `services/api-gateway/wrangler.toml:27, 51-55, 106, 210`; `git diff --stat 5346ced9..HEAD -- services/api-gateway/wrangler.toml` = +6.

---

## 2. Scaling Risks

### 2.1 Single API gateway worker is a shared chokepoint for the entire platform — **STILL-OPEN (surface grew)**
**Severity: High — Likelihood: Medium**
One worker (`letbuyy-api`) still serves the whole REST + GraphQL surface; the mounted-router count **grew from ~30 to 37** (`grep -c "^api.route(\|^app.route(" services/api-gateway/src/index.ts` = 37) because the remediation **centralized** webhook-side mutations into new gateway-owned internal routes (`/v1/internal/billing/*`, `/v1/internal/events/domain`, `/v1/storefront/internal/payments/*`). The webhook and queue workers now depend on the gateway **more**, not less: their payment/billing/event writes are `API_GATEWAY_SERVICE.fetch` calls (`webhook-service/src/gateway-order-transitions.ts:27`, `queue-workers/src/gateway-events.ts`), so a gateway outage now also halts webhook-driven order finalization. `routes/storefront.ts` is **4,833 lines** (was 4,826) — the F1.6 "god-file split" so far extracted only the 233-line `storefront/internal-payment-routes.ts` while the parent file did not shrink.
- Evidence: router count = 37; `wc -l routes/storefront.ts` = 4833; new internal routes + webhook client dependency files listed above; `CODEX_FOUNDATION_HARDENING_STATUS.md` ("F1.6 storefront god-file split in progress").
- Affected surface: every external request path **plus** (new) webhook-driven payment finalization.

### 2.2 Connection pooling exists but is bypassed by the dominant Supabase-REST path — **STILL-OPEN (call sites grew)**
**Severity: Medium — Likelihood: Medium**
`packages/infrastructure/pooled-sql-adapter/` is byte-identical to first pass (absent from the diffstat); `getPooledSql` is still used only by a handful of storefront loaders (`routes/storefront.ts:917, 927, 942, 961`). The service-role REST call-site count **rose from 448 to 460** (`grep -o "getSupabaseAdmin\b" services/api-gateway/src -r | wc -l` = 460) because the new internal billing/payment/event routes also use `getSupabaseAdmin`. The pool therefore covers an even smaller fraction of DB traffic than at first pass.
- Evidence: diffstat (adapter unchanged); call-site count 460; `internal-payment-routes.ts:4, 83, 140, 163, 194, 221`.
- Affected surface: DB throughput under load; PostgREST connection ceiling.

### 2.3 Sequential fallback queries amplify storefront hot-path latency — **STILL-OPEN**
**Severity: Medium — Likelihood: Medium**
Unchanged. The site loader still issues up to **five sequential** compat-fallback selects (`routes/storefront.ts:1087-1103`) and the theme-release loader up to three (`:1127-1135`), each awaited serially, with the pooled-SQL fast path tried first and returning null on miss. Storefront cache config unchanged (`lib/storefront-cache.ts` absent from diffstat).
- Evidence: `routes/storefront.ts:1087-1103, 1108-1138` at HEAD.
- Affected surface: storefront TTFB on cache miss / schema-compat fallback stores.

### 2.4 Rate limiting fails closed platform-wide when Redis is absent — **STILL-OPEN**
**Severity: Medium — Likelihood: Medium**
Unchanged: `services/api-gateway/src/middleware/rateLimit.ts` is absent from `git diff --stat 5346ced9..HEAD`; the `unavailable: true` → HTTP 503 fail-closed paths persist (current line refs `rateLimit.ts:726, 776, 846` among 18 `unavailable/503` sites). A Redis outage or missing `UPSTASH_REDIS_REST_*` secret still converts to a full-platform 503. Storefront caching still no-ops without the KV `CACHE` binding.
- Evidence: diffstat (file unchanged); `Grep "unavailable: true|503"` over `rateLimit.ts` → 18 hits at the same logic sites.
- Affected surface: entire `/v1` surface.

### 2.5 Queue backpressure controls configured; DLQs exist per environment — **UNCHANGED (positive, residual gap remains)**
**Severity: Low — Likelihood: Low**
`services/queue-workers/wrangler.toml` is unchanged (absent from diffstat): bounded consumers, per-queue DLQs, circuit-breaker vars all as first pass. The residual gap is also unchanged: **no DLQ redrive automation** — `grep -rln "redrive" scripts/ infrastructure/` matches only validators (`queue-convergence-validator.mjs`, `queue-recovery-validator.mjs`, etc.), no executable redrive script; the runbook `docs/governance/queue-dlq-redrive.md` remains documentation. New this pass (positive): the gateway's scheduled dispatch now actually **produces** Cloudflare queue messages — `src/execution/cloudflare-queue-triggers.ts` plans sends to `EVENT_QUEUE`/`RUNTIME_QUEUE` always and `ANALYTICS/SEARCH/NOTIFICATION` queues when platform-queue work exists (`:92-137`), with 3 colocated behavior tests (`__tests__/cloudflare-queue-triggers.test.ts`).
- Evidence: diffstat (queue-workers wrangler unchanged); redrive grep; `cloudflare-queue-triggers.ts:92-137`.
- Affected surface: async pipelines; DLQ recovery still manual.

### 2.6 Single queue-worker runtime and single webhook runtime (no per-domain isolation) — **STILL-OPEN**
**Severity: Medium — Likelihood: Low**
Unchanged: one `letbuyy-queue-workers` consumes all queues + DLQs; one `letbuyy-webhook` handles all four payment providers. The webhook worker's blast surface arguably **narrowed in kind** (it no longer holds direct DB write paths) but its availability coupling to the gateway widened (§2.1).
- Evidence: `services/queue-workers/wrangler.toml` (unchanged); `services/webhook-service/src/` file census (one worker, four providers, gateway-transition clients).

---

## 3. Security Risks (Operational)

### 3.1 No live secrets committed at HEAD; `.gitignore` blocks env files — **UNCHANGED (positive); rotation still unverified**
**Severity: Low — Likelihood: Low**
First-pass verification stands; nothing in the 74-commit delta reintroduces env files (`.gitignore` unchanged; no `*.env` additions in `git diff --name-status`). The operational caveat is also unchanged: `tasks/todo.md:19-32` Phase-0 secret-rotation checkboxes remain **unchecked** at HEAD, so rotation of the historically exposed secrets is still unevidenced in-repo.
- Evidence: `tasks/todo.md:17-44` at HEAD (still unchecked); diff scan.

### 3.2 service_role key stays server-side; platform leans on app-layer tenant scoping — **STILL-OPEN (lean increased)**
**Severity: Low — Likelihood: Low**
Boundary unchanged (`import 'server-only'` clients in apps; service-role only in workers). The RLS-bypassing footprint grew: 460 `getSupabaseAdmin` call sites (was 448), including all new internal mutation routes. Tenant isolation remains an application-code property, not a DB property.
- Evidence: call-site count 460; `apps/*/src/lib/api/client.ts:1` `server-only` (spot-checked app-marketplace, identity-platform).

### 3.3 Three baseline tables ship without RLS — **STILL-OPEN**
**Severity: Medium — Likelihood: Low**
Re-derived at HEAD: `comm -23` of created vs RLS-enabled tables in `database/supabase/migrations/000_baseline.sql` still yields exactly **`contacts`, `employee_permissions`, `projects`** (baseline file unchanged in the diff; none of migrations 085-088 adds RLS to these).
- Evidence: recomputed `comm -23` output this pass; `git diff --stat 5346ced9..HEAD -- database/supabase/migrations/000_baseline.sql` → no change.

### 3.4 Static shared bearer token gates the platform-console API plane — **STILL-OPEN**
**Severity: High — Likelihood: Medium**
Unchanged. `routes/internal-console.ts:43-66` still compares the single `PLATFORM_CONSOLE_API_TOKEN` with plain `!==` string equality (`:56`, not even timing-safe), no per-operator identity, no expiry/rotation; audit `actor_*` fields remain self-asserted by the caller. The token is still a single shared production secret (`production-deploy.yml:255`). The console *frontend* has session+MFA (`apps/platform-console`, see §3.11), but the **API plane** accepts the raw token directly (CORS even allow-lists the `X-Platform-Console-Token` header, `index.ts:395`).
- Evidence: `internal-console.ts:38-66` at HEAD; `index.ts:395`; `production-deploy.yml:255`.
- Affected surface: super-admin/operations API plane.

### 3.5 Webhook signature verification implemented (timing-safe) — **UNCHANGED (positive)**
**Severity: Low — Likelihood: Low**
Re-verified at HEAD: `hmacSha256Hex` + `timingSafeEqual` in `webhook-service/src/index.ts:228-229`; the new app-lifecycle dispatcher also signs and timing-safe-verifies (`src/app-lifecycle-dispatch.ts:59-63, 86`). Production webhook secrets still set in the gated deploy (`production-deploy.yml:277-279`). Additionally hardened in effect: a forged-but-signed webhook can now only reach the gateway's internal endpoints, which apply order-state validation in `PaymentExecutionAdapter` (single-writer).
- Evidence: file/line refs above; webhook-service behavior tests 12/12 pass.

### 3.6 CORS mixes staging conventions; wildcard `*.letbuyy.store` echo with credentials — **STILL-OPEN**
**Severity: Medium — Likelihood: Low**
Unchanged in behavior; line numbers shifted: the gateway CORS allow-list (`index.ts:372-399`) hardcodes `*.staging.letbuyy.store` (dot scheme) origins while `deploy-staging.yml:146-174` health-checks `*-staging.letbuyy.store` (hyphen scheme) — the dual staging-host conventions persist (`deploy-staging.yml` unchanged since first pass). The credentialed wildcard echo `^https:\/\/[a-z0-9-]+\.letbuyy\.store$` remains (`index.ts:391`, `credentials: true` at `:398`).
- Evidence: `index.ts:372-399`; `deploy-staging.yml:146-174`; diffstat (deploy-staging unchanged).

### 3.7 Input "sanitization" middleware logs-but-does-not-block — **STILL-OPEN (by design)**
**Severity: Low — Likelihood: Low**
Unchanged: `middleware/security.ts` absent from the services diff except where shared (`security.ts` itself not in `git diff --name-only 5346ced9..HEAD -- services/`); behavior as first pass (1 MB cap, log-only XSS detection, strong output headers).
- Evidence: diff file list (security.ts unchanged).

### 3.8 Dependency currency / SCA overrides — **UNCHANGED (positive)**
**Severity: Low — Likelihood: Low**
`pnpm-lock.yaml` last changed at commit `b7978d81 2026-06-05 16:32` (before the first-pass HEAD); root `package.json` `pnpm.overrides` block intact (`packageManager: pnpm@10.6.2`). No dependency regression observed in the delta.
- Evidence: `git log -1 -- pnpm-lock.yaml`; `package.json` overrides + packageManager.

### 3.9 **NEW — Gateway internal payment-mutation routes fail OPEN in non-production environments**
**Severity: High — Likelihood: Medium** (staging exposure; production safe only while two conditions hold)
The remediation's new single-writer endpoints `/v1/storefront/internal/orders/:id/payable`, `/internal/payments/{reference,confirm,failure,event}` are guarded by `isInternalRequest` in `services/api-gateway/src/routes/storefront/internal-payment-routes.ts:71-76`, which **returns `true` (request allowed, unauthenticated) whenever `INTERNAL_API_SECRET` is unset and `ENVIRONMENT !== 'production'`**. These endpoints mutate payment state with the service-role client: `confirm` marks orders paid and emits an order-paid event (`:153-181`), `failure` cancels/refunds and can release inventory (`:184-208`). Three aggravators: (a) the base `[vars]` of every gateway deploy defaults `ENVIRONMENT = "staging"` (`wrangler.toml:27`), so any worker deployed without `--env production` — or any staging worker whose secret was never `wrangler secret put` — exposes these mutations to anyone who can reach the route; (b) the **sibling** internal routers fail **closed** (`internal-billing.ts:49-53` and `internal-events.ts:20-24` both `if (!secret) return false;`), so this is an inconsistency, not a policy; (c) the new contract test only asserts the **production-env** 403 (`tests/contracts/storefront-internal-payment-routes.test.ts:5, 23-29` passes `{ ENVIRONMENT: 'production' }`), so the fail-open branch is untested — and that test file isn't wired into any runner anyway (§4.3). The webhook-service **client** side fails closed (`gateway-order-transitions.ts:19-25`), which mitigates the legitimate caller path but not direct external calls to a misconfigured non-production gateway.
- Evidence: `internal-payment-routes.ts:71-76, 106-232`; `internal-billing.ts:49-53`; `internal-events.ts:20-24`; `wrangler.toml:27`; `tests/contracts/storefront-internal-payment-routes.test.ts` (production-only assertion; fails to load under `node --test`, `ERR_UNSUPPORTED_DIR_IMPORT`).
- Affected surface: order payment state, inventory release, order-paid event emission on any non-production gateway lacking the secret.

### 3.10 Staging-default base URLs in app code — **REDUCED (2 of 4 server API clients fixed; widespread defaults remain)**
**Severity: Medium — Likelihood: Medium**
Partially remediated, verified: `apps/app-marketplace/src/lib/api/client.ts:20-31` and `apps/theme-marketplace/src/lib/api/client.ts:20-21` now **throw** ("refusing to fall back to a hardcoded staging host") when no API base URL env is set — the claimed fail-fast fix is real for these two apps. Still defaulting to staging: `apps/identity-platform/src/lib/api/client.ts:14` (`DEFAULT_API_BASE_URL = 'https://api.staging.letbuyy.store/v1'`, used at `:79`) and `apps/platform-operations-portal/src/lib/api/client.ts:13` (same pattern) — these are the auth plane and the ops plane, arguably the worst two to mis-point. Beyond API clients, ~30 hardcoded `*.staging.letbuyy.store` fallbacks persist across app UI/config (`merchant-control-plane/src/proxy.ts:29`, `identity-platform/src/lib/email/resend.ts:4`, `identity-platform/src/lib/auth/cookies.ts:27` cookie domain, `marketing-site` signup CTAs, `theme-marketplace/src/hooks/useAuth.ts:6`, `storefront-runtime/src/lib/seo.ts:6`, etc. — grep over `apps/**/*.ts*` returns 34 matches). Two apps default the **other** direction — `merchant-control-plane` and `storefront-runtime` clients default to the **production** API (`client.ts:14` / `:13` = `https://api.letbuyy.store/v1`), meaning a misconfigured staging deploy of those apps would hit production.
- Evidence: file/line refs above; full grep result set for `staging.letbuyy` over `apps/`.
- Affected surface: env mis-pointing (staging→prod or prod→staging) on incomplete env injection.

### 3.11 Dev MFA bypass and dev OTP echo — **STILL-OPEN (both)**
**Severity: Medium — Likelihood: Low (production) / Medium (staging)**
Both first-pass findings persist verbatim:
- Platform-console TOTP accepts a static `PLATFORM_CONSOLE_DEV_MFA_CODE` whenever `NODE_ENV !== 'production'` (`apps/platform-console/src/lib/console-auth-server.ts:140-144`), ahead of the real HOTP comparison (`:146-155`). Any non-production build of the console with that env var set has a fixed MFA code.
- Identity signup echoes the emailed OTP back in the JSON response (`devOtp`) whenever `NODE_ENV !== 'production'` (`apps/identity-platform/src/app/api/auth/signup/route.ts:9-26`, attached at `:106` and `:137`). On a staging deployment built without `NODE_ENV=production`, email-verification OTPs are readable by the requester, defeating verification on that environment.
- Evidence: exact lines above, re-read at HEAD; neither file appears in `git diff --name-only 5346ced9..HEAD`.
- Affected surface: non-production console MFA; non-production email verification integrity.

---

## 4. Developer Experience Risks

### 4.1 Install/typecheck reliability unproven here; remediation claims green gates after fixing real baseline failures — **REDUCED (claimed) / unverifiable in this environment**
**Severity: High — Likelihood: Medium** (downgraded likelihood: the failure modes are now documented and claimed fixed)
This environment is **worse-equipped** than first pass: root `node_modules/` is now completely empty (the remediation itself recursively removed workspace `node_modules`/`.turbo`/`dist`/`.next` — `CODEX_FOUNDATION_HARDENING_STATUS.md` F0 evidence), and `pnpm` remains unavailable, so no install/typecheck/lint/build could be executed. What the in-repo record shows: the status doc's **baseline** section (2026-06-05T13:54Z) records `pnpm turbo typecheck: FAIL` (unresolved `apps/developer-portal`, `packages/shared-types`), `pnpm lint: FAIL`, `pnpm turbo build: FAIL` (missing `next` in developer-portal) — i.e. the first-pass fragility was real — followed by F0 gate **claims** of `pnpm install --frozen-lockfile --force: PASS`, `pnpm turbo typecheck: PASS - 60/60 tasks`, `pnpm lint: PASS - 9/9`, repeated as PASS in every subsequent F1.x gate. Independently reproduced here: `validate:governance` = 129 validators PASS (matches the claim exactly); all 12 deployable workspaces have `tsconfig.json`; root tests run dependency-free at 402/411 (the 9 failures are all `ERR_MODULE_NOT_FOUND` on uninstalled packages such as `typescript` — environment-caused, and consistent with the doc's own 431/432 note under a real install). The 60/60-typecheck and lint claims remain **uncorroborated by execution in this audit**.
- Evidence: `ls node_modules/` (empty); `CODEX_FOUNDATION_HARDENING_STATUS.md` baseline + F0/F1.x gate sections; governance run output (129 PASS); root-suite run (402/411; sampled failure `Cannot find package 'typescript'` in `tests/app-platform/app-bridge.test.mjs`).
- Affected surface: onboarding/build confidence; claim-vs-execution gap.

### 4.2 CI typecheck/test filtered to changed packages — **STILL-OPEN**
**Severity: Medium — Likelihood: Medium**
`ci.yml` unchanged (absent from workflow diff): `pnpm turbo test --filter="...[HEAD^1]"` (`ci.yml:94`) and the analogous typecheck/lint/build filters persist, so latent breaks in untouched packages still surface only when those packages change.
- Evidence: `ci.yml:73-94` at HEAD; workflow diffstat.

### 4.3 Behavioral test coverage inside deployable workspaces: 2 of 12 now real; new contract tests orphaned from every runner — **REDUCED, with a NEW gap**
**Severity: High — Likelihood: High**
Verified recount: **10 of 12** deployable workspaces still have `"test": "echo 'No tests yet' && exit 0"` (all 9 apps + `services/api-gateway`); **2 of 12** now run real tests — `services/webhook-service` (`node --test --experimental-strip-types test/*.test.mjs`; executed: **12 pass / 0 fail** across `gateway-billing-transitions`, `gateway-events`, `gateway-order-transitions` suites) and `services/queue-workers` (executed: **2 pass / 0 fail**, real gateway-event behavior assertions with a captured service-binding double, `test/gateway-events.test.mjs:6-45`). `packages/*` still have **no** test scripts (`Grep "\"test\":"` over `packages/**/package.json` → none). api-gateway gained a 7th colocated `__tests__` file (`cloudflare-queue-triggers.test.ts`) but its package `test` script is still the no-op echo, so none of the 7 run under `turbo test`. New root tests: the 5 claimed federation suites exist and pass (12/12 when executed); the 2 new TypeScript contract tests (`tests/contracts/domain-event-contracts.test.ts`, `tests/contracts/storefront-internal-payment-routes.test.ts`) exist but (a) the root `"test"`/`"test:governance"` scripts glob only `tests/*/*.test.mjs` (`package.json:43-44`) so they are never selected, (b) under direct `node --test --experimental-strip-types` both **fail to load** (`ERR_UNSUPPORTED_DIR_IMPORT` on the `routes/storefront` directory import; `ERR_MODULE_NOT_FOUND` on the extensionless `packages/event-core/src/index` import) — they run only via `npx tsx --test` as the remediation ledger did, and (c) `grep -rn 'tests/contracts' package.json .github/ scripts/ turbo.json` shows no runner references them (only the coverage-governance validator lists older `.mjs` contract files). Net: the two contract tests guarding the **new payment-mutation auth boundary** and the **domain event schema** execute in no automated pipeline.
- Evidence: test-script census output (12 manifests); executed test counts above; `package.json:43-45`; load-failure stderr for both `.ts` tests; `scripts/validators/test-coverage-governance-validator.mjs:67-75` (lists `.mjs` only).
- Affected surface: regression safety net for shipped runtimes; specifically the unguarded new internal payment routes (§3.9).

### 4.4 README under-describes the real workflow — **STILL-OPEN**
**Severity: Low — Likelihood: Medium**
`README.md` unchanged (19 lines; absent from diffstat). It still omits the root-vs-workspace test split, the now-47-script `validate:*` surface, and the dual deploy workflows. New onboarding tooling exists (`scripts/utilities/local-stack-up.mjs`, 885 lines, + `local-stack-down.mjs`) but is wired into **no** `package.json` script (`grep "local-stack" package.json` → nothing) and is not mentioned in the README; historical ledger references point at the old `scripts/dev/` path.
- Evidence: `README.md` at HEAD; `scripts/utilities/local-stack-up.mjs:1-12`; package.json grep.

### 4.5 Governance validation: passes within budget now; rollout chain still long — **REDUCED**
**Severity: Low — Likelihood: Low**
Improvement verified: `node scripts/validate-governance.mjs` completed with "Governance validation passed (129 validators)" inside a 40s timeout in this audit (first pass: killed at 35s, EXITCODE 124). The serial fan-out remains heavy for release paths: `validate:runtime` now chains **53** validator invocations (`package.json:18`; counted programmatically), up from ~50.
- Evidence: governance run output + exit 0; `validate:runtime` chain count = 53; total scripts = 47.

---

## 5. Operational Risks

### 5.1 Observability dashboards and alert rules reference metrics that no runtime emits — **STILL-OPEN (unchanged)**
**Severity: High — Likelihood: High**
Re-verified at HEAD, nothing changed: `infrastructure/observability/` and `infrastructure/monitoring/` are absent from the 74-commit diffstat. `Grep "writeDataPoint"` repo-wide matches **only** forensic reports and the two CODEX mission documents (which themselves flag it) — no runtime call. `Grep "prom-client|@opentelemetry"` over every `package.json` → none. The four alert metric names (`http_requests_total`, `http_server_errors_total`, `letbuyy_queue_dead_letter_total`, `letbuyy_replay_lag_seconds`) appear only in `prometheus-rules.yaml`, three Grafana dashboards, and audit/mission docs — no producer in `services/`, `packages/`, or `apps/`. Production alerting/SLO enforcement remains a contract artifact with no live pipeline.
- Evidence: greps above (file lists captured this pass); `git diff --stat 5346ced9..HEAD -- infrastructure/` → empty.
- Affected surface: production alerting/SLO enforcement (effectively absent).

### 5.2 Single points of failure across all three runtime tiers; `FAILOVER_REGION` is still a label — **STILL-OPEN**
**Severity: High — Likelihood: Medium**
Unchanged: one gateway, one webhook worker, one queue-worker deployment, one Supabase connection string, one Upstash Redis. `FAILOVER_REGION` remains declared in wrangler vars and the worker env **type interfaces** (`queue-workers/src/index.ts:34`, `api-gateway/src/index.ts:121`) but its only runtime consumption is still the status echo `failover_region: c.env.FAILOVER_REGION || 'unset'` (`internal-console.ts:203`) — grep confirms no datastore-switching or traffic-routing code. The SPOF coupling **tightened** this pass: webhook payment finalization now requires the gateway to be up (§2.1).
- Evidence: full `FAILOVER_REGION` grep at HEAD (declarations + one status read); single `PRODUCTION_DB_CONNECTION_STRING` in `production-deploy.yml:19, 185, 199, 217`.
- Affected surface: whole-platform availability under a Supabase/Redis/gateway/region outage.

### 5.3 Structured logging exists; centralized metric/log pipeline unproven — **STILL-OPEN**
**Severity: Medium — Likelihood: Medium**
Unchanged: `middleware/observability.ts` not in the diff; structured JSON logs + Workers Logs sampling + 0.02 request-log DB sample rate as first pass; `otel-collector.yaml` still has no worker-side producer (§5.1).
- Evidence: diff file list; first-pass line refs remain valid (`observability.ts:69-226`).

### 5.4 Hot-table partition lifecycle still has no scheduler — **STILL-OPEN**
**Severity: Medium — Likelihood: Medium**
Re-verified: `Grep "ensure_next_hot_table_partitions|detach_expired_hot_table_partitions"` matches only (a) the defining migration `database/supabase/migrations/079_partition_worker_request_logs.sql`, (b) the governance doc `docs/governance/hot-table-retention-governance.md`, (c) a **text-assertion** test `tests/performance/partition-retention.test.mjs` that regex-checks the migration SQL (it asserts month seeds for `2026-06-01`/`2026-07-01` exist in the file, `:42-50` — it does not execute anything against a database), and (d) this report. `grep "schedule:" .github/workflows/` → still no scheduled workflow; the only cron remains the api-gateway worker's dispatch cron. The migrations seed partitions only through **2026-07-01**; with no caller for `ensure_next_*`, hot tables run out of pre-created monthly partitions after July 2026 (rows then land in the `_default` partitions, defeating partition pruning/retention) and `detach_expired_*` never runs.
- Evidence: grep result set (4 files); `partition-retention.test.mjs:42-50`; workflow cron grep.
- Affected surface: `worker_request_logs`, `runtime_telemetry_metrics`, `outbox_events`, `platform_queue_jobs`, `webhook_deliveries` partitioned tables.

### 5.5 Backup: pre-migration encrypted backup only; no scheduled backup or restore drill — **STILL-OPEN**
**Severity: Medium — Likelihood: Low**
Unchanged: the gated workflow's `pg_dump`→`gpg`→artifact (7-day retention) sequence persists (`production-deploy.yml:197-214`); it still does not run in `deploy-production.yml`; no scheduled backup workflow exists (no `schedule:` triggers); no executable restore-drill in-repo (runbooks only).
- Evidence: `production-deploy.yml:197-214` at HEAD; workflow grep.

### 5.6 Incident tooling documentation-grade; error-budget enforcement blocked on the missing metrics pipeline — **STILL-OPEN**
**Severity: Medium — Likelihood: Medium**
Unchanged in substance: `docs/governance/` gained 4 docs in the delta (`app-api-route-ownership.md` etc.) but the runbook/SLO surface and its dependency on non-emitted metrics (§5.1) are as first pass.
- Evidence: `git diff --stat 5346ced9..HEAD -- docs/governance/` (+85/−17, governance prose only); `slo-catalog.yaml` unchanged.

### 5.7 Reserved service roots remain governance-only shells — **STILL-OPEN (now manifest-tracked)**
**Severity: Low — Likelihood: Low**
The six reserved roots each gained a `runtime.manifest.json` in the delta (`services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}/runtime.manifest.json` in `git diff --name-only`), formalizing their placeholder status, consistent with the updated `CLAUDE.md` runtime map ("manifest-only placeholders"). They are still deployed by no workflow; SLO catalog still names them as owners.
- Evidence: diff name list; deploy workflows (three workers only); `slo-catalog.yaml` unchanged.

---

## Risk Counts by Severity (per category)

| Category | Critical | High | Medium | Low | Δ vs first pass |
|---|---|---|---|---|---|
| 1. Production | 0 | 2 | 4 | 2 | unchanged (8 risks, all STILL-OPEN / unchanged-positive) |
| 2. Scaling | 0 | 1 | 4 | 1 | unchanged (6 risks; 2.1/2.2 surface grew) |
| 3. Security (operational) | 0 | 2 | 4 | 5 | +3 entries: NEW High §3.9 (fail-open internal payment auth); §3.10 staging-defaults REDUCED → Medium; §3.11 dev MFA/OTP STILL-OPEN → Medium (both were context items in pass 1, now tracked) |
| 4. Developer Experience | 0 | 2 | 1 | 2 | counts unchanged; §4.1 and §4.3 REDUCED in substance, §4.3 carries a NEW orphaned-test gap, §4.5 REDUCED |
| 5. Operational | 0 | 2 | 4 | 1 | unchanged (7 risks, all STILL-OPEN) |
| **Total** | **0** | **9** | **17** | **11** | **37 tracked risks** |

Status split across the 37 tracked risks: **0 RESOLVED**, **3 REDUCED** (§3.10 staging-default base URLs — 2 of 4 server API clients now fail-fast; §4.3 workspace test coverage — 2 of 12 deployables now run real tests, 14 new passing service tests + 12 new passing federation tests; §4.5 governance-validation latency — now completes and passes 129/129), **1 partially-REDUCED claim-only** (§4.1 install/typecheck — fixed per remediation ledger, not executable here), **32 STILL-OPEN / unchanged** (including all positives, which remain positive), **1 NEW High** (§3.9 fail-open `isInternalRequest` on the new payment-mutation routes). High count stays at 9 because the NEW High (§3.9) replaces nothing; the apparent stability masks one genuinely new High-severity exposure introduced *by* the remediation. No Critical: §3.9 is environment-conditional (production fails closed when `ENVIRONMENT='production'` is set and deploys always pass `--env production`), and every other High retains partial mitigation.

---

## Top 10 Risks

1. **[High] STILL-OPEN** — Observability is a paper artifact: Prometheus rules / Grafana dashboards / SLOs reference metrics no runtime emits; no OTel/prom-client dependency anywhere; `writeDataPoint` never called (matches only audit/mission docs). Untouched by the 74-commit remediation delta. Production alerting effectively does not fire. (§5.1)
2. **[High] STILL-OPEN (coupling tightened)** — Whole-platform SPOFs: one gateway, one Supabase, one Redis; `FAILOVER_REGION` is still only a status string (`internal-console.ts:203`). New: webhook payment finalization now *requires* the gateway via `API_GATEWAY_SERVICE`, deepening the gateway SPOF. (§5.2, §2.1)
3. **[High] STILL-OPEN (codified)** — Two production deploy workflows still both fire on push to `main` with different concurrency groups; the only delta is developer-portal added to **both** matrices, and `tests/operations/production-deploy-workflow.test.mjs` now asserts the "legacy" workflow stays in sync rather than retiring it. (§1.1)
4. **[High] NEW** — The remediation's new gateway internal payment-mutation routes (`/v1/storefront/internal/payments/*`) **fail open when `INTERNAL_API_SECRET` is unset and `ENVIRONMENT !== 'production'`** (`internal-payment-routes.ts:71-76`) — unlike the sibling internal-billing/events guards which fail closed; the base wrangler `[vars]` defaults `ENVIRONMENT="staging"`; the covering contract test asserts only the production branch and is wired into no runner. (§3.9)
5. **[High] STILL-OPEN** — Static shared bearer (`PLATFORM_CONSOLE_API_TOKEN`, plain `!==` comparison, `internal-console.ts:56`) remains the sole auth for the platform-console API plane; no per-operator identity, no rotation, self-asserted audit actors. (§3.4)
6. **[High] REDUCED but dominant gap remains** — Workspace test coverage: now **10/12** deployables no-op (was 12/12); webhook-service has 12 real passing tests, queue-workers 2; api-gateway's 7 colocated `__tests__` still unwired; `packages/*` still untested; and the two new TypeScript contract tests (payment-route auth, domain events) load under **no** configured runner (`tests/*/*.test.mjs` glob; `ERR_UNSUPPORTED_DIR_IMPORT`/`ERR_MODULE_NOT_FOUND` under plain `node --test`). (§4.3)
7. **[High] STILL-OPEN (grew)** — Single API gateway worker now mounts **37** routers (was ~30) and absorbed webhook/queue mutation paths; `storefront.ts` is 4,833 lines (split extracted only 233 lines so far). (§2.1)
8. **[High] STILL-OPEN** — Ungated `deploy-production.yml` still has no migration job, no staging gate, and SKIPs every deploy step on missing credentials — unchanged except the larger app matrix. (§1.2)
9. **[High] claim-REDUCED, unverified** — Install/typecheck reliability: the remediation ledger documents the first-pass failures as real (baseline `turbo typecheck`/`lint`/`build` FAIL) and claims F0 fixed them (`60/60 typecheck PASS`, `9/9 lint PASS`); only the 129-validator governance PASS was independently reproduced here (root `node_modules` now empty; pnpm unavailable). Treat the green gates as claims pending CI evidence. (§4.1)
10. **[Medium] STILL-OPEN** — Hot-table partition lifecycle has **no scheduler caller**: partitions are pre-seeded only through `2026-07-01`; `ensure_next_/detach_expired_hot_table_partitions` are referenced only by the defining migration, a prose doc, and a SQL-text regex test — after July 2026 the five hot tables fall into default partitions with no retention shedding. Companion Medium: production `db push --include-all` remains approval-gateless and the two migration roots still disagree on Postgres major (15 vs 17). (§5.4, §1.3, §1.4)

---

## Evidence Index

- **Baseline / delta**: `git log -1` = `127a850e 2026-06-05 23:22`; `git rev-list --count HEAD` = 802; `git rev-list --count 5346ced9..HEAD` = 74; `git log --oneline -20` (workstream merges WS1/WS5/WS7/WS9/WS10 + letbuyy-remediation); `git diff --stat 5346ced9..HEAD` = 344 files, +23,635/−8,761; scoped `git diff --stat/--name-status` for `.github/`, `scripts/`, `tests/`, `services/`, `database/`, `infrastructure/`, `docs/governance/`, `README.md`, `pnpm-lock.yaml` (last change `b7978d81 2026-06-05 16:32`).
- **Deploy workflows**: `.github/workflows/production-deploy.yml` (448 lines; preflight `:24-106` w/ 35 required secrets incl. developer-portal; staging-e2e `:108-157`; migrate+backup `:159-219`; workers `:221-296`; apps matrix `:298-364` (9 apps); required-jobs gate `:366-396`; smoke `:398-447`); `.github/workflows/deploy-production.yml` (170 lines; jobs `deploy-workers`/`deploy-apps`(9-app matrix `:85-94`)/`smoke-test-production`; SKIP steps `:73-75, 117-120, 130-132, 140-142`; health URLs `:151-169` incl. `developers.letbuyy.store`); exact diffs vs `5346ced9` (developer-portal additions only); `ci.yml:73-94` (changed-package filters, unchanged); `deploy-staging.yml:146-174` (hyphen staging hosts, unchanged); `grep "schedule:" .github/workflows/` → none; `grep "d1 migrations" .github/` → none; `tests/operations/production-deploy-workflow.test.mjs:1-98` (`legacyWorkflow` sync assertions `:90-98`).
- **Cloudflare worker config**: `services/api-gateway/wrangler.toml` — base `ENVIRONMENT = "staging"` `:27`; new `*_QUEUE_NAME` vars `:51-55, 130-134, 234-238` (the only +6 delta); `FAILOVER_REGION` `:49, 128, 232`; `services/webhook-service/wrangler.toml` and `services/queue-workers/wrangler.toml` unchanged (absent from diffstat).
- **New internal mutation surface**: `services/api-gateway/src/routes/storefront/internal-payment-routes.ts` (233 lines; fail-open guard `:71-76`; payable read `:108-125`; reference `:128-150`; confirm `:153-181`; failure `:184-208`; event `:211-232`); `routes/internal-billing.ts` (fail-closed guard `:49-53`); `routes/internal-events.ts` (fail-closed guard `:20-24`); webhook clients `services/webhook-service/src/gateway-order-transitions.ts:14-67` (fail-closed `:19-25`; targets `/v1/storefront/internal/payments/confirm` `:59`), `gateway-billing-transitions.ts`, `gateway-events.ts`; `services/queue-workers/src/gateway-events.ts`; `Grep "\.from\('(orders|products|subscriptions|sites|billing_history)'\)"` over webhook-service src → none.
- **Queue triggers**: `services/api-gateway/src/execution/cloudflare-queue-triggers.ts:40-137` (`planScheduledDispatchQueueTriggers`); `src/__tests__/cloudflare-queue-triggers.test.ts` (new; not in any package test script).
- **Tests executed this pass**: `services/webhook-service` `node --test --experimental-strip-types test/*.test.mjs` → 12 pass/0 fail; `services/queue-workers` same → 2 pass/0 fail (`test/gateway-events.test.mjs:6-45`); 5 federation suites (`marketplace-service-error-handling`, `app-install-store-ownership`, `app-review-verified-install`, `app-api-route-ownership`, `app-install-idempotency`) → 12 pass/0 fail; root `node --test tests/*/*.test.mjs` → 411 tests, 402 pass / 9 fail (all sampled failures `ERR_MODULE_NOT_FOUND` on uninstalled deps, e.g. `typescript` in `tests/app-platform/app-bridge.test.mjs`); `tests/contracts/storefront-internal-payment-routes.test.ts` → `ERR_UNSUPPORTED_DIR_IMPORT` under node; `tests/contracts/domain-event-contracts.test.ts` → `ERR_MODULE_NOT_FOUND` (`packages/event-core/src/index`); root `"test"` glob `package.json:43-44` (`tests/*/*.test.mjs` only); `grep 'tests/contracts' package.json .github/ scripts/ turbo.json` → only `test-coverage-governance-validator.mjs:67-75` listing `.mjs` files.
- **Test-script census**: all 9 `apps/*/package.json` + `services/api-gateway/package.json` = `"test": "echo 'No tests yet' && exit 0"`; `services/{webhook-service,queue-workers}/package.json` = real `node --test` scripts; `Grep "\"test\":"` over `packages/**/package.json` → none.
- **Security re-reads**: `routes/internal-console.ts:38-66` (static token, `!==` at `:56`; `failover_region` echo `:203`); `index.ts:360-410` (CORS `:372-399`, wildcard echo `:391`, `credentials: true` `:398`, `X-Platform-Console-Token` header `:395`; static health `:134-141, 403-405`; 37 mounted routers); `webhook-service/src/index.ts:228-229` + `app-lifecycle-dispatch.ts:59-63, 86` (timing-safe HMAC); `apps/platform-console/src/lib/console-auth-server.ts:138-155` (dev MFA bypass `:140-144`); `apps/identity-platform/src/app/api/auth/signup/route.ts:9-26, 106, 137` (devOtp echo); RLS recount via `comm -23` on `000_baseline.sql` → `contacts`, `employee_permissions`, `projects`; `tasks/todo.md:17-44` (rotation items still unchecked).
- **Base-URL audit**: fail-fast verified at `apps/app-marketplace/src/lib/api/client.ts:20-31` and `apps/theme-marketplace/src/lib/api/client.ts:20-21`; staging defaults persist at `apps/identity-platform/src/lib/api/client.ts:14,79` and `apps/platform-operations-portal/src/lib/api/client.ts:13,24`; production defaults at `apps/merchant-control-plane/src/lib/api/client.ts:14` and `apps/storefront-runtime/src/lib/api/client.ts:13`; 34 `staging.letbuyy` matches across `apps/**/*.ts*` incl. `identity-platform/src/lib/auth/cookies.ts:27`, `lib/email/resend.ts:4`, `merchant-control-plane/src/proxy.ts:29`, `theme-marketplace/src/hooks/useAuth.ts:6`.
- **Scaling re-reads**: `wc -l routes/storefront.ts` = 4833; sequential loaders `routes/storefront.ts:1087-1103, 1108-1138`; `getPooledSql` sites `:54, 917, 927, 942, 961`; `getSupabaseAdmin` count = 460; `rateLimit.ts` unchanged (18 `unavailable/503` sites, e.g. `:726, 776, 846`); `storefront-cache.ts` + `pooled-sql-adapter/` absent from diff.
- **Observability re-greps**: `writeDataPoint` → 5 files, all docs (2 FORENSIC, 2 CODEX missions, this report's lineage); `prom-client|@opentelemetry` in `**/package.json` → none; four alert metric names → only `infrastructure/observability/{prometheus-rules.yaml, grafana-runtime/replay/queue-dashboard.json}` + audit docs; partition function names → `079_partition_worker_request_logs.sql`, `docs/governance/hot-table-retention-governance.md`, `tests/performance/partition-retention.test.mjs:30-50` (SQL-text regex assertions, seeds `2026-06-01`/`2026-07-01`), this report.
- **Validators executed**: `node scripts/validate-governance.mjs` → "Governance validation passed (129 validators)", exit 0, < 40s; `node scripts/validators/migration-safety-validator.mjs` → passed.
- **DB/config**: `supabase/config.toml:13` (`major_version = 15`; dir contains only config.toml); `database/supabase/config.toml:11` (`major_version = 17`); `database/supabase/migrations/` = 18 files (085/086/087 added, 088 modified since first pass); `000_baseline.sql` unchanged.
- **DX/tooling**: `ls node_modules/` → empty; `CODEX_FOUNDATION_HARDENING_STATUS.md` (baseline FAILs; F0/F1.x PASS claims incl. `turbo typecheck 60/60`, `lint 9/9`, node_modules cleanup note; "F1.6 storefront god-file split in progress"; H-11 SKIPPED — NEEDS HUMAN); 12/12 workspace `tsconfig.json` present; `package.json` 47 scripts, `validate:runtime` = 53 chained validators (`:18`), `packageManager: pnpm@10.6.2`; `scripts/utilities/local-stack-up.mjs` (885 lines, new) + `local-stack-down.mjs` (63 lines) with no package.json wiring; `README.md` 19 lines unchanged.
- **Reserved roots**: `services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}/runtime.manifest.json` added in delta; deploy workflows still deploy only the three active workers.
