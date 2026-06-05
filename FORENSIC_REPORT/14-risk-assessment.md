# Phase 14 — Risk Assessment (Operational Focus)

Investigation date: 2026-06-05

This report documents the **current operational state** of the LetBuyy platform from a production-operations, scaling, operational-security, developer-experience, and reliability standpoint. It is a forensic record of what exists in the tree at the audited commit — not a remediation plan. A sibling report (`FORENSIC_REPORT/11-architecture-violations.md`) covers structural layer/boundary violations; this report deliberately avoids re-deriving those and focuses on runtime/operational risk. Every risk cites file paths and/or command output. Where a control is present, that is stated as evidence; absence is only claimed where a search returned nothing.

Repository (file tools): `/Users/saai_sidd/Git/Letbuyy_Store`
Repository (bash): `/sessions/brave-sweet-gates/mnt/Letbuyy_Store`
Audited HEAD: `5346ced9 2026-06-05 17:58:44 +0530 fix(database): add hot table partition shadows` (`git log -1`)
Total commits: 727 (`git rev-list --count HEAD`); first commit `390811f1 2026-02-12`.

---

## Method

Commands and tools run (all read-only):

- Topology enumeration: `Glob` / `Grep` over `apps/*/package.json`, `services/*/package.json`, `pnpm-workspace.yaml`, `vercel.json`, `**/wrangler.toml`, `.github/workflows/*`.
- Deploy/infra read: full reads of `.github/workflows/{ci,production-deploy,deploy-production,staging-deploy,deploy-staging,production-rollout,staging-runtime-deployment,environment-lifecycle,live-production-certification}.yml`, all three `services/*/wrangler.toml`, `infrastructure/scripts/deploy/production-rollback.mjs`, `infrastructure/scripts/cloudflare/bootstrap-environment.mjs`, `config/runtime/deployment-lineage-manifest.json`.
- DB discipline: `database/supabase/migrations/` listing + `grep` for `DROP/TRUNCATE/DELETE/DETACH/ENABLE ROW LEVEL SECURITY/CREATE POLICY`; RLS coverage computed via `comm -23` of created tables vs RLS-enabled tables in `000_baseline.sql`; `node scripts/validators/migration-safety-validator.mjs`.
- Security: `grep` for committed secrets (`sk_live`, `rzp_live`, JWT patterns, `service_role`), `.gitignore` review, `git rev-list --all --objects | grep -iE '\.env'`, webhook signature path in `services/webhook-service/src/index.ts`, CORS/CSP in `services/api-gateway/src/index.ts` and `middleware/security.ts`, `supabase/config.toml` + `database/supabase/config.toml`.
- Scaling: reads of `packages/infrastructure/pooled-sql-adapter/index.ts`, `services/api-gateway/src/middleware/rateLimit.ts`, `lib/storefront-cache.ts`, `routes/storefront.ts` (4,826 lines), `services/queue-workers/wrangler.toml` consumer config.
- Build/test reality: `node_modules/.bin/turbo --version` (2.8.9), per-workspace `tsc --noEmit` on `services/api-gateway` and `apps/identity-platform`, `node --test` on sample suites, `node scripts/validate-governance.mjs`, test-file census via `Glob`/`Grep` (`"test":` scripts, `*.test.*`).
- Observability: reads of `infrastructure/observability/*` (otel-collector, prometheus-rules, 6 Grafana dashboards), `infrastructure/monitoring/slo-catalog.yaml`, `services/api-gateway/src/middleware/observability.ts`; cross-check that referenced metric names are emitted anywhere in worker code.

Environment constraint: `pnpm` is not installed in the bash workspace and `corepack enable` fails with `EACCES` (`/usr/bin/pnpm`). `node_modules` is only partially installed at the repo root (root `node_modules` contains `@cloudflare`, `@playwright`, `turbo`, `typescript`; per-app `node_modules` are absent — `ls apps/identity-platform/node_modules` returns empty). Full `pnpm install` could not be executed; build/typecheck reliability is therefore assessed from partial typechecks, CI config, and the prior `LETBUYY_STATE.md` audit note.

---

## 1. Production Risks

### 1.1 Two parallel, overlapping production deploy workflows both trigger on push to `main`
**Severity: High — Likelihood: High**
Both `.github/workflows/production-deploy.yml` (`name: Production deploy`) and `.github/workflows/deploy-production.yml` (`name: Deploy Production`) declare `on: push: branches: [main]` (lines 3-6 of each). They have **different concurrency groups** (`production-deploy` vs `deploy-production`), so GitHub will not serialize them against each other — both run on the same `main` push. They deploy the same eight Vercel apps and three workers to the same production targets by different mechanisms: `production-deploy.yml` runs a gated pipeline (preflight → staging-e2e → migrate → workers → apps → smoke) using `vercel deploy --prod`; `deploy-production.yml` runs an ungated `deploy-workers → deploy-apps → smoke` using `vercel pull/build/deploy --prebuilt --prod`. Two concurrent deploys of the same artifacts to the same projects is a race with non-deterministic "last writer wins" outcome.
- Evidence: `.github/workflows/production-deploy.yml:1-14`; `.github/workflows/deploy-production.yml:1-13`; matching app matrices at `production-deploy.yml:303-319` and `deploy-production.yml:85-93`.
- Affected surface: all production Vercel apps + all three Cloudflare workers.

### 1.2 Ungated deploy workflow has no migration step, no staging gate, and silently skips on missing credentials
**Severity: High — Likelihood: Medium**
`deploy-production.yml` deploys workers and apps with **no DB migration job** and **no staging-e2e gate**; its only post-deploy check is curl health probes. Every deploy step is guarded by `if: ${{ env.HAS_CLOUDFLARE_CREDS == 'true' }}` / `HAS_VERCEL_CREDS` and falls through to an `echo "SKIP…"` step when secrets are absent (lines 50-75, 113-131, 139-141). A run that "succeeds" can therefore deploy nothing. This contradicts the gated discipline of `production-deploy.yml` (which hard-fails preflight when credentials are missing, `production-deploy.yml:100-104`).
- Evidence: `.github/workflows/deploy-production.yml` (no `migrate*` job; jobs are `deploy-workers`, `deploy-apps`, `smoke-test-production`); skip steps at `:73-75`, `:129-131`, `:139-141`.
- Affected surface: production release integrity; schema/code version skew if this path runs instead of the gated one.

### 1.3 Production DB migration runs `supabase db push --include-all` against the live DB with no transactional/manual review gate
**Severity: High — Likelihood: Medium**
In the gated workflow, `migrate-production` captures an encrypted `pg_dump` backup, generates a `db diff` artifact, then runs `pnpm dlx supabase@latest db push --db-url "$PRODUCTION_DB_CONNECTION_STRING" --include-all` (`production-deploy.yml:215`). The diff is only uploaded as a 30-day artifact (`:187-193`) — there is no human approval step between diff generation and `db push`, and `--include-all` applies every pending migration. The job runs in the `production-migrations` environment (`:161`), so a GitHub environment protection rule *could* gate it, but no such rule is encoded in-repo. Mitigating control present: `node scripts/validators/migration-safety-validator.mjs` passes and is wired into rollback validation, scanning Supabase migration history for "destructive replay hazards."
- Evidence: `production-deploy.yml:157-217`; migration-safety validator run output: `Migration safety validator passed`.
- Affected surface: production Postgres (commerce + operational tables).

### 1.4 Migration tooling targets a directory the deploy never points to; two diverging migration roots exist
**Severity: Medium — Likelihood: Medium**
The active migration set lives in `database/supabase/migrations/` (15 files: `000_baseline.sql`, `073`–`089`, `git status` shows `089_quarantine_platform_queue_job.sql` as latest tracked). But `supabase db push` is invoked from the repo root, and there is **also** a `supabase/config.toml` (root) and a `database/supabase/config.toml` with **different `major_version`** (root = 15, `database/supabase/config.toml` = 17) and different pooler settings. The root `supabase/` has no `migrations/` directory (`ls supabase/migrations` → empty). Which config/migration root the CLI binds to depends on invocation cwd, and the two configs disagree on the Postgres major version.
- Evidence: `supabase/config.toml:13` (`major_version = 15`) vs `database/supabase/config.toml:11` (`major_version = 17`); `ls supabase/` → only `config.toml` + `.temp`; migration list under `database/supabase/migrations/`.
- Affected surface: migration determinism; shadow-DB diffing during `db diff`/`db push`.

### 1.5 Cloudflare D1 migrations are not applied by either production deploy workflow
**Severity: Medium — Likelihood: Medium**
`wrangler.toml` binds a D1 database (`RUNTIME_DB`) with `migrations_dir = "../../database/cloudflare/d1/migrations"` (api-gateway `wrangler.toml:165-169, 267-271`), and one D1 migration exists (`database/cloudflare/d1/migrations/0001_provider_execution_foundation.sql`). `wrangler d1 migrations apply` appears **only** in `infrastructure/scripts/cloudflare/bootstrap-environment.mjs:54-68` (a manual bootstrap script gated on `LETBUYY_PROVIDER_MUTATION_APPROVED=true` for production), **not** in `production-deploy.yml` or `deploy-production.yml`. Neither push-triggered production workflow applies D1 schema changes; D1 drift relative to worker code is possible if a worker release assumes a newer D1 schema.
- Evidence: `grep "d1 migrations" .github/workflows/` → no matches; `bootstrap-environment.mjs:53-68`; D1 binding in `services/api-gateway/wrangler.toml`.
- Affected surface: `letbuyy-production-d1` (durable runtime/provider-execution tables).

### 1.6 Rollback exists for Workers but no encoded rollback path for Vercel apps
**Severity: Medium — Likelihood: Medium**
A disciplined Worker rollback wrapper exists: `infrastructure/scripts/deploy/production-rollback.mjs` requires `--worker`, `--version-id`, `--reason`, a present `config/runtime/deployment-lineage-manifest.json`, `CLOUDFLARE_API_TOKEN`, runs `validate:rollback`, then `wrangler rollback` (`production-rollback.mjs:28-53`). The lineage manifest forbids raw `wrangler rollback` outside the wrapper and encodes per-worker rollback commands (`config/runtime/deployment-lineage-manifest.json:36-50`). However, `grep -rn "vercel rollback"` across `infrastructure/`, `.github/`, `scripts/` returns **no matches** — there is no scripted rollback for the eight Next.js apps; recovery of a bad app deploy depends on the Vercel dashboard/manual promotion, which is not represented in-repo.
- Evidence: `grep -rn "vercel rollback"` → empty; `production-rollback.mjs` (Worker-only); `deployment-lineage-manifest.json` `rollbackManifests` cover only `services/*` roots.
- Affected surface: production app tier (storefront, admin, identity, marketing, marketplaces, console, ops).

### 1.7 Health checks are shallow (HTTP status only); error-tracking SaaS (Sentry etc.) is absent
**Severity: Medium — Likelihood: High**
Production smoke checks assert only `200`/`302` from edge URLs and `200` from `/v1/health` (`deploy-production.yml:143-167`; gated workflow adds a Playwright smoke suite `tests/e2e/smoke/`, `production-deploy.yml:417-435`). `/v1/health` returns a static body (`{status:'healthy', version:'2.0.0'}`, `services/api-gateway/src/index.ts:125-132`) with no dependency probing; only `/v1/health/queues` checks binding presence (`:340-343`). A `grep` for `@sentry`, `Sentry`, `datadog`, `newrelic`, `honeycomb`, `axiom`, `betterstack` across `apps/` and `services/` returns **no matches** — there is no exception-tracking service wired into any runtime. Error visibility is limited to Cloudflare structured `console.error` logs and Supabase request-log rows.
- Evidence: `Grep "@sentry|Sentry|datadog|newrelic|honeycomb|axiom|betterstack"` over `apps/` and `services/` → no files; `services/api-gateway/src/index.ts:125-164`.
- Affected surface: production incident detection/triage latency.

### 1.8 Staging vs production separation: present and reasonably clean (positive control)
**Severity: Low — Likelihood: Low**
Distinct environments are well-encoded: separate Vercel project-id secret sets (`STAGING_*_PROJECT_ID` vs `PRODUCTION_*_PROJECT_ID`), separate Cloudflare worker names/routes/KV/D1/Hyperdrive/R2/queues per `[env.staging]` and `[env.production]` (e.g. `services/api-gateway/wrangler.toml:83-287`), separate Supabase connection-string secrets, and a `develop → staging`, `main → production` branch model (`.github/BRANCH_STRATEGY.md`). The gated production workflow runs the full E2E suite **against staging** as a hard gate before production migration (`production-deploy.yml:106-155`).
- Evidence: `services/api-gateway/wrangler.toml`; `.github/workflows/staging-deploy.yml`; `.github/BRANCH_STRATEGY.md:5-15`.
- Note (risk within the positive): the **base/top-level** `[vars]` block of every `wrangler.toml` hardcodes `ENVIRONMENT = "staging"` (e.g. `api-gateway/wrangler.toml:26-33`). A `wrangler deploy` issued **without** `--env production` would publish a worker that self-identifies as staging. Production deploys always pass `--env production` in the workflows, but the unguarded default is a foot-gun (Medium likelihood if anyone deploys manually).

---

## 2. Scaling Risks

### 2.1 Single API gateway worker is a shared chokepoint for the entire platform
**Severity: High — Likelihood: Medium**
One worker (`letbuyy-api`, route `api.letbuyy.store`) serves all REST + GraphQL for storefront, admin, auth, payments, marketplace, and operations — `services/api-gateway/src/index.ts` mounts ~30 routers (`:373-424`). The webhook and queue workers depend on it via service bindings (`API_GATEWAY_SERVICE` in `webhook-service/wrangler.toml:99-101` and `queue-workers/wrangler.toml:293-295`). `routes/storefront.ts` alone is **4,826 lines** (`wc -l`) and is the hot path for every storefront read. Cloudflare Workers scale horizontally per-isolate, but all tenants share one code deployment and one upstream datastore, so a regression or saturation in this one worker is platform-wide.
- Evidence: `services/api-gateway/src/index.ts:373-424`; `wc -l routes/storefront.ts` = 4826; service bindings in the other two `wrangler.toml`.
- Affected surface: every external request path.

### 2.2 Connection pooling to Postgres exists but is conditional and bypassed by 448 service-role call sites
**Severity: Medium — Likelihood: Medium**
A Hyperdrive-backed pooled-SQL adapter exists (`packages/infrastructure/pooled-sql-adapter/index.ts`) with `max: 5`, `idle_timeout: 20s`, `prepare: false`, cached per connection-string (`:36-60`), gated by `STOREFRONT_POOLED_SQL` (default `on`) and a present connection string. Hyperdrive is bound for staging and production (`api-gateway/wrangler.toml:161-163, 263-265`). **However**, pooled SQL is used in only a handful of storefront read helpers (`getPooledSql` appears in `routes/storefront.ts` at the published-store / site / theme loaders), while the dominant data path is the Supabase JS client via REST: `grep -c "getSupabaseAdmin\b"` in `services/api-gateway/src` = **448** call sites. Those go over PostgREST (HTTP), not the pooled Postgres connection, so the pool covers a small fraction of DB traffic. The `postgres` npm package is imported in exactly one place (`pooled-sql-adapter/index.ts:1`).
- Evidence: `pooled-sql-adapter/index.ts:36-60`; `grep -c "getSupabaseAdmin\b"` = 448; `grep "from 'postgres'"` → only the adapter.
- Affected surface: storefront/admin DB throughput under load; PostgREST connection ceiling.

### 2.3 Sequential fallback queries amplify latency on the storefront hot path (N round-trips per lookup)
**Severity: Medium — Likelihood: Medium**
The storefront site loader issues **up to five sequential Supabase queries** for a single site lookup, each awaited before the next, trying progressively older column-compat `SELECT`s until one returns a row (`routes/storefront.ts:1109-1127`: `STOREFRONT_SITE_RELEASE_SELECT` → `_COMPAT_SELECT` → `_SITE_SELECT` → `_SITE_COMPAT_SELECT` → unfiltered). The theme-release loader follows the same fallback pattern (`:1130-1142`). On stores that land on a late fallback, a single page render incurs several serial DB round-trips before the pooled-SQL fast path is even consulted (the pooled path is tried first and returns null on miss). Storefront caching (`lib/storefront-cache.ts`, 60s TTL + 300s SWR, KV-backed) mitigates repeat reads but not cold/cache-miss latency.
- Evidence: `routes/storefront.ts:1109-1127`, `:1130-1142`; `lib/storefront-cache.ts:12-13`.
- Affected surface: storefront TTFB on cache miss / schema-compat fallback stores.

### 2.4 Cache and rate-limit infrastructure are present but degrade hard when Redis is absent
**Severity: Medium — Likelihood: Medium**
Rate limiting is a real, layered implementation (`middleware/rateLimit.ts`): Upstash Redis (sliding/leaky-bucket Lua scripts) primary, Cloudflare KV fallback, in-memory fallback for local only. **In production**, if `UPSTASH_REDIS_REST_URL/TOKEN` are unset, the limiter does **not** fall back to KV — it returns `unavailable: true` and the middleware **fails closed with HTTP 503** for the entire request surface (`rateLimit.ts:718-728, 834-848`; query-cost variant `:771-782`). This is safe-by-default but means a Redis outage or missing secret converts into a full-platform 503. The production deploy sets these Redis secrets (`production-deploy.yml:254-255`), so the dependency is hard. Storefront caching similarly no-ops without the KV `CACHE` binding (`storefront-cache.ts:75, 85`).
- Evidence: `rateLimit.ts:712-728`, `:834-848`, `:771-782`; KV/Redis secrets in `production-deploy.yml:244-255`.
- Affected surface: entire `/v1` surface (rate-limit 503 fail-closed); storefront cache effectiveness.

### 2.5 Queue backpressure controls are configured; dead-letter queues exist per environment
**Severity: Low — Likelihood: Low** (positive control with a residual gap)
`services/queue-workers/wrangler.toml` configures bounded consumers with `max_batch_size`, `max_concurrency`, `max_retries`, `retry_delay`, and explicit `dead_letter_queue` per queue, plus app-level circuit breaker vars (`PLATFORM_QUEUE_CIRCUIT_FAILURE_THRESHOLD = "3"`, `PLATFORM_QUEUE_CIRCUIT_OPEN_SECONDS = "60"`, `PLATFORM_QUEUE_CLAIM_LIMIT = "25"`) for staging and production (`:30-95, 226-291`). Production DLQs (`letbuyy-dead-letters-production`, `letbuyy-production-dead-letter-queue`) are declared and themselves consumed. Residual gap: there is no in-repo DLQ **redrive automation** beyond a documented runbook (`docs/governance/queue-dlq-redrive.md` exists; no script). The cron that drains the outbox/queues runs every 1 minute in production (`api-gateway/wrangler.toml:203`).
- Evidence: `services/queue-workers/wrangler.toml:30-95, 232-291`; `api-gateway/wrangler.toml:202-203`.
- Affected surface: async event/search/notification/analytics pipelines.

### 2.6 Single queue-worker runtime and single webhook runtime (no per-domain isolation)
**Severity: Medium — Likelihood: Low**
All five logical queues (events, analytics, search, notifications, runtime) plus both DLQs are consumed by **one** worker deployment (`letbuyy-queue-workers`). A poison-message storm or a deterministic bug in one job type shares the same isolate budget and circuit breaker as all others. Likewise one `letbuyy-webhook` worker handles Razorpay + Stripe + PayPal + Cashfree. This is a single-point-of-failure-per-tier topology (see §5.2).
- Evidence: `services/queue-workers/wrangler.toml` (one worker, all consumers); `services/webhook-service/src/index.ts` (one worker, four providers).
- Affected surface: async processing isolation; webhook ingestion.

---

## 3. Security Risks (Operational)

### 3.1 No live secrets are committed at HEAD; `.gitignore` blocks env files; history is clean for `all.env`
**Severity: Low — Likelihood: Low** (verification of a previously-flagged risk)
The `tasks/todo.md` "Phase 0 EMERGENCY" section asserts nine production secrets were once committed to `all.env` and demands history purge (`tasks/todo.md:17-32`). At the audited commit: `all.env` is **not present** and was **never tracked** (`git log --all --follow -- all.env` → empty; `git rev-list --all --objects | grep -iE '\.env'` returns only `*.env.example`/`*.env.template` files and the archived rotation checklist, no real `all.env`). `.gitignore` blocks `.env`, `.env.*`, `*.env`, `all.env`, `.dev.vars` (`.gitignore:84-95`). A repo-wide `grep` for `sk_live`, `rzp_live`, AWS keys, and JWT-shaped strings across all source/config returns only placeholder strings (`rzp_test_...`/`rzp_live_...` placeholders in a settings UI and a Zod regex). No `service_role` key literals appear in `apps/` code; the only `NEXT_PUBLIC_…SERVICE…` hit is documentation in an `AGENTS.md`.
- Evidence: `git rev-list --all --objects | grep -iE '\.env'`; `.gitignore:84-95`; secret-pattern grep → only `apps/merchant-control-plane/.../payments/page.tsx:352` and `packages/tenant-core/src/index.ts:112` placeholders.
- Affected surface: n/a (control verified present). Caveat: history was not cryptographically swept beyond object-name scan; the open `todo.md` items remain unchecked, indicating rotation may be unverified operationally even though the file is gone.

### 3.2 service_role key reaches client-reachable code only inside server-side workers (acceptable boundary)
**Severity: Low — Likelihood: Low**
`createSupabaseServiceClient` (which uses `SUPABASE_SERVICE_ROLE_KEY` and **bypasses RLS** — documented at `services/api-gateway/src/lib/supabase.ts:9-14`) is defined in `packages/infrastructure/supabase-adapter/index.ts:34-39` and invoked from worker code (api-gateway, webhook-service, queue-workers) — all server-side Cloudflare runtimes. The Next.js apps consume the API via signed internal requests (`apps/storefront-runtime/src/lib/api/client.ts:1` is `import 'server-only'`). No `SUPABASE_SERVICE_ROLE_KEY` reference was found in any `apps/**/*.tsx` client path. The boundary is correct, but note the platform leans heavily on service-role (RLS-bypassing) access: **448** `getSupabaseAdmin` call sites vs RLS-respecting user clients — operational security therefore depends almost entirely on application-layer tenant scoping in the gateway, not database RLS.
- Evidence: `supabase-adapter/index.ts:34-39`; `lib/supabase.ts:9-25`; `grep -c "getSupabaseAdmin\b"` = 448; `client.ts:1` `server-only`.
- Affected surface: tenant isolation correctness (enforced in app code, not DB) — see §3.4.

### 3.3 RLS is enabled on nearly all tables, but three base tables ship without RLS
**Severity: Medium — Likelihood: Low**
`000_baseline.sql` creates 233 tables and enables RLS on 230 (`grep -c "CREATE TABLE"` = 233; `grep -c "ENABLE ROW LEVEL SECURITY"` = 230; 352 `CREATE POLICY`). Computing the set difference (created tables minus RLS-enabled tables) yields **three tables with no `ENABLE ROW LEVEL SECURITY`: `contacts`, `employee_permissions`, `projects`**. Two of these (`employee_permissions`, `contacts`) are sensitive (RBAC grants and contact PII). Because almost all gateway reads use the service-role client (which bypasses RLS regardless), RLS is a defense-in-depth layer here rather than the primary control; the gap matters most for any direct-Postgres or anon-client access path.
- Evidence: `comm -23` of `CREATE TABLE` vs `ENABLE ROW LEVEL SECURITY` extracted from `database/supabase/migrations/000_baseline.sql` → `contacts`, `employee_permissions`, `projects`.
- Affected surface: `contacts`, `employee_permissions`, `projects` tables under any non-service-role access.

### 3.4 Static shared bearer token gates the super-admin / platform-console API plane
**Severity: High — Likelihood: Medium**
The `/v1/internal/console` router (audit logs, revenue, platform operations) authenticates with a **single static token** compared by string equality: `token !== c.env.PLATFORM_CONSOLE_API_TOKEN` (`routes/internal-console.ts:43-66`). There is no per-operator identity, no expiry, and no rotation mechanism at the API layer — every console operator shares one credential, and audit-log `actor_*` fields are self-asserted in the request body (`AuditLogWriteSchema`, `:20-30`). The token is injected as a worker secret (`production-deploy.yml:253`). Compromise of this one token grants full platform-console API access with attributable-to-nobody audit entries.
- Evidence: `services/api-gateway/src/routes/internal-console.ts:43-66`; secret set at `production-deploy.yml:253`.
- Affected surface: platform-console / platform-operations API plane.

### 3.5 Webhook signature verification is implemented (timing-safe) — positive control
**Severity: Low — Likelihood: Low**
Contrary to the open `tasks/todo.md:34-37` items, signature verification **is present** in `services/webhook-service/src/index.ts`: Razorpay uses `hmacSha256Hex(secret, rawBody)` compared with `timingSafeEqual` (`:266-274`); the four providers (`razorpay`, `stripe`, `paypal`, `cashfree`) each have provider adapters, and PayPal/Cashfree hard-throw if credentials are unconfigured (`:282-306`). Webhook events are persisted with `signature_valid` and deduped via upsert on `(provider, provider_event_id)` (`:54-75`). Production webhook secrets (`RAZORPAY_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`) are set in deploy (`production-deploy.yml:275-276`).
- Evidence: `webhook-service/src/index.ts:266-274`, `:282-306`, `:54-75`.
- Affected surface: payment webhook ingestion (control verified present).

### 3.6 CORS allow-list mixes production and a non-canonical staging domain scheme; wildcard subdomain echo
**Severity: Medium — Likelihood: Low**
The gateway CORS config (`services/api-gateway/src/index.ts:297-327`) statically allows production origins **and** staging origins of form `*.staging.letbuyy.store`, and additionally **echoes back any `https://<sub>.letbuyy.store` origin** via regex `^https:\/\/[a-z0-9-]+\.letbuyy\.store$` with `credentials: true` (`:316-319`). This is intentional for tenant storefronts but means any subdomain attacker-controlled record under `letbuyy.store` would be reflected as an allowed credentialed origin. The staging origins here use `accounts.staging.letbuyy.store` while the deploy/health workflows use the **other** scheme `accounts-staging.letbuyy.store` (`deploy-staging.yml:153`) — the two staging host conventions are inconsistent across the codebase.
- Evidence: `services/api-gateway/src/index.ts:300-320`; staging host mismatch vs `deploy-staging.yml:150-181`.
- Affected surface: cross-origin credentialed requests to `/v1`.

### 3.7 Input "sanitization" middleware logs-but-does-not-block dangerous payloads
**Severity: Low — Likelihood: Low**
`inputValidation` detects XSS-ish patterns in request bodies but explicitly **does not block** — "Don't block — just log" (`middleware/security.ts:192-203`). It enforces a 1 MB body cap (`:184-188`). Output-side error sanitization and security headers (CSP `default-src 'none'`, HSTS, `X-Frame-Options: DENY`) are present and applied globally (`security.ts:20-48`). This is a defensible design (store-raw, encode-on-output) but is noted because the middleware name implies blocking it does not perform.
- Evidence: `middleware/security.ts:174-220`, `:20-48`.
- Affected surface: API request handling.

### 3.8 Dependency CVE exposure: stack is current; transitive CVEs actively pinned via overrides
**Severity: Low — Likelihood: Low**
No obviously ancient majors. Lockfile `pnpm-lock.yaml` is `lockfileVersion: 9.0`, dated **2026-06-05** (same day as HEAD). Key versions: `next@16.1.6`, `react@19.2.3`, `wrangler@4.94.0`, `@supabase/supabase-js@2.95.3`, `hono` pinned to `4.12.4`, `jose@6.1.3`, `postgres@3.4.9`, `bcryptjs@3.0.3`. The root `package.json` `pnpm.overrides` block actively force-upgrades known-vulnerable transitive packages (`undici@<6.24.0 → 6.24.0`, `hono@<4.12.4 → 4.12.4`, multiple `minimatch`/`picomatch`/`flatted`/`fast-uri` floors) (`package.json:59-73`). This indicates an SCA discipline is in place. No network scan was performed (none required); assessment is version-currency only.
- Evidence: `package.json:59-73`; `pnpm-lock.yaml` header + `grep` of pinned versions; `stat pnpm-lock.yaml` mtime `2026-06-05`.
- Affected surface: supply chain (low residual at audited snapshot).

---

## 4. Developer Experience Risks

### 4.1 `pnpm install` could not complete in this environment; root install is partial
**Severity: High — Likelihood: High** (DX/onboarding reliability)
The repo pins `packageManager: pnpm@10.6.2` (`package.json:74`) and the README onboarding step 1 is `pnpm install` (`README.md:7`). In the audit environment, `pnpm` is not on PATH and `corepack enable` fails (`Internal Error: EACCES … symlink … /usr/bin/pnpm`). The repo-root `node_modules` is only partially populated (`@cloudflare`, `@playwright`, `turbo`, `typescript`); per-app `node_modules` are empty (`ls apps/identity-platform/node_modules` → nothing), and `node_modules/.pnpm` holds 861 entries — far fewer than a full workspace install of 46 manifests would produce. A typecheck of `apps/identity-platform` consequently fails with `Cannot find module 'next' / 'next/server' / 'node:test'` (modules not installed). The prior in-repo audit note corroborates install/typecheck friction: `LETBUYY_STATE.md` records that `pnpm run typecheck` "fails on unresolved `@cloudflare/workers-types` for worker service packages" and governance "fails on stale generated artifacts."
- Evidence: `corepack enable` EACCES output; `ls apps/identity-platform/node_modules` empty; `apps/identity-platform` `tsc --noEmit` errors (`next`, `next/server`, `node:test` unresolved); `LETBUYY_STATE.md` intro paragraph.
- Affected surface: new-contributor onboarding; CI parity vs local.

### 4.2 Typecheck passes where deps are present (gateway) but is not provable workspace-wide here
**Severity: Medium — Likelihood: Medium**
`services/api-gateway` typechecks **clean** (`tsc --noEmit -p tsconfig.json` → EXITCODE 0), demonstrating the worker packages compile when their deps resolve. But because the full workspace install did not complete, a green `turbo typecheck`/`turbo build` across all 46 manifests could not be reproduced in this environment. The Turbo pipeline itself is correctly shaped: `build`/`typecheck`/`test` declare `dependsOn: ["^build"]` / `["^typecheck","^build"]` with sensible outputs (`turbo.json:6-58`). CI runs typecheck/lint/test/build filtered to `...[HEAD^1]` (`.github/workflows/ci.yml:48,71,94,137`), so unchanged packages are skipped per-PR — a fast pipeline, but it means a latent break in an untouched package may not surface until that package changes.
- Evidence: `services/api-gateway` `tsc` EXITCODE 0; `turbo.json:1-59`; `ci.yml:27-147`.
- Affected surface: build confidence; CI coverage of unchanged packages.

### 4.3 Behavioral test coverage is effectively zero inside the deployable workspaces
**Severity: High — Likelihood: High**
**Every** app and service `package.json` defines `"test": "echo 'No tests yet' && exit 0"` — verified across all 9 apps (`apps/*/package.json:10`) and all 3 services (`services/{api-gateway,webhook-service,queue-workers}/package.json:9`). So `turbo test` (and CI's `pnpm turbo test`) exercises **no assertions** for any shipped app/service. The only colocated tests are two files under `apps/identity-platform/src/__tests__/` (`auth-flow.test.ts`, `rate-limit.test.ts`) and six `__tests__` files under `services/api-gateway/src/` — but these are **not run by the package `test` script** (which is the no-op echo). `packages/*` have **no** `test` script at all (`grep "\"test\":" packages/**/package.json` → no matches). All real test mass lives at the **repo root** `tests/` tree (100+ `*.test.mjs` governance/contract/operations suites) and is run via root `node --test tests/*/*.test.mjs`, **outside** the per-workspace pipeline. Sample root suites pass (`node --test tests/auth/csrf-contract.test.mjs tests/operations/cron-noop.test.mjs` → 7 pass / 0 fail). E2E (`tests/e2e/`) requires a live staging stack and only runs in the deploy workflows.
- Evidence: `Grep "\"test\":"` over `apps/`, `services/`, `packages/`; `tests/` census (100+ files); `node --test … csrf-contract … cron-noop` → `# pass 7 # fail 0`.
- Affected surface: regression safety net for all shipped runtimes (contract/governance tests exist; unit/integration tests for app & service code largely do not).

### 4.4 README onboarding under-describes the real workflow; root vs workspace test split is undocumented
**Severity: Low — Likelihood: Medium**
`README.md` (20 lines total) lists `pnpm install → turbo typecheck → lint → turbo build → validate:governance → deploy to staging` but does not mention: the 30+ `validate:*` scripts that gate production rollout (`package.json:7-51`), the root `node --test` suite that holds the actual tests, the partial-install/Cloudflare-types friction, or the dual deploy workflows. A new engineer following only the README would not know that `turbo test` is a no-op or that real tests live at root.
- Evidence: `README.md` (full file); `package.json:7-51` script surface; §4.3.
- Affected surface: onboarding accuracy.

### 4.5 Governance validation is heavy and slow; a single command fans out to dozens of validators
**Severity: Low — Likelihood: Low**
`pnpm run validate:governance` passed each validator in this run but the **aggregate exceeded a 40s wall-clock budget** (`node scripts/validate-governance.mjs` was killed at 35s with EXITCODE 124 having printed ~8 passing validators including provider-isolation scanning 3,011 files). Production-rollout chains far more (`validate:runtime` alone invokes ~50 validator scripts serially, `package.json:18`). This is thorough but the serial fan-out is a long feedback loop locally and in `production-rollout.yml`.
- Evidence: timed `validate-governance.mjs` run (EXITCODE 124 at 35s, all printed validators passing); `package.json:18` (validate:runtime chain length).
- Affected surface: local/CI feedback latency.

---

## 5. Operational Risks

### 5.1 Observability dashboards and alert rules reference metrics that no runtime emits
**Severity: High — Likelihood: High**
A full Grafana/Prometheus/OTel surface exists on paper: `infrastructure/observability/` holds 6 Grafana dashboards, `prometheus-rules.yaml`, and `otel-collector.yaml`; `infrastructure/monitoring/slo-catalog.yaml` defines SLOs. **But the alert/SLO expressions reference metric names that are produced nowhere in the runtime code.** `prometheus-rules.yaml` alerts on `http_server_errors_total{runtime="api-gateway"}`, `http_requests_total`, `letbuyy_queue_dead_letter_total`, `letbuyy_replay_lag_seconds` — a `grep` for each of these across `services/`, `packages/`, `apps/` returns **no matches**, and **no `@opentelemetry/*` or `prom-client` dependency exists** in any `services/` or `packages/` manifest. The workers emit only (a) structured JSON via `console.*` (`middleware/observability.ts:69-81`), (b) request-log rows into Supabase (`:191-226`), and (c) Cloudflare Analytics Engine `RUNTIME_TELEMETRY` (binding present; `writeDataPoint` is **not called anywhere** — `grep "writeDataPoint"` → no files). Grafana dashboards are wired to `postgres` and `prometheus` datasources. Net effect: the SLO/alerting stack is a contract artifact, not a live pipeline — production alerts on these rules would never fire because the series do not exist.
- Evidence: `Grep "http_requests_total|http_server_errors_total|letbuyy_queue_dead_letter_total|letbuyy_replay_lag_seconds"` over `services/` → no files; `Grep "prom-client|@opentelemetry/sdk|@opentelemetry/api"` over `{services,packages}/**/package.json` → no files; `grep "writeDataPoint"` → no files; `prometheus-rules.yaml:4-30`; `slo-catalog.yaml:1-43`; `observability.ts:69-226`.
- Affected surface: production alerting/SLO enforcement (effectively absent despite the dashboards/rules existing).

### 5.2 Single points of failure across all three runtime tiers
**Severity: High — Likelihood: Medium**
One API gateway (`api.letbuyy.store`), one webhook worker (`webhooks.letbuyy.store`), one queue-worker deployment — and all of them depend on **one** Supabase Postgres (a single `PRODUCTION_DB_CONNECTION_STRING`) and one Upstash Redis. `wrangler.toml` declares `PRIMARY_REGION = "ap-south-1"` and `FAILOVER_REGION = "ap-southeast-1"`, but `FAILOVER_REGION` is only ever **reported** in a status endpoint (`routes/internal-console.ts:203`) — `grep` finds no code that switches datastore or routes traffic to the failover region; it is a label, not a mechanism. Cloudflare `placement = { mode = "smart" }` is set but does not provide DB failover. There is no read-replica or multi-region datastore evidence in the gateway path (the only pooled connection string is single-homed).
- Evidence: single connection-string secret in `production-deploy.yml:19,183,215`; `FAILOVER_REGION` usage = status string only (`internal-console.ts:203`); `placement` blocks in all `wrangler.toml`.
- Affected surface: whole-platform availability under a Supabase/Redis/region outage.

### 5.3 Structured logging exists; centralized log sink is unproven
**Severity: Medium — Likelihood: Medium**
The runtimes do emit consistent structured JSON logs with `level`/`service`/`request_id`/`trace_id`/`route`/`status_code`/`latency_ms` (`middleware/observability.ts:69-81, 166-178`) and Cloudflare Workers Logs are enabled with `invocation_logs = true` and `head_sampling_rate = 0.1` per env (`api-gateway/wrangler.toml:10-17, 91-98, 193-200`). `otel-collector.yaml` defines an OTLP→Tempo/Prometheus collector with auth/cookie redaction (`otel-collector.yaml:1-30`). However, since no runtime ships OTLP/metrics (§5.1), the collector has no worker-side producer wired in; log aggregation in production reduces to Cloudflare's own log retention + the Supabase `worker_request_logs` table (request-log writes are sampled at `REQUEST_LOG_SAMPLE_RATE = "0.02"`, so 98% of successful storefront reads are **not** persisted to the DB log — only errors/auth/payment/admin are forced to record, `observability.ts:126-143`).
- Evidence: `observability.ts:69-81, 126-143`; `wrangler.toml` observability blocks; `otel-collector.yaml`; `REQUEST_LOG_SAMPLE_RATE` in `wrangler.toml:44`.
- Affected surface: forensic log completeness; metric-based monitoring.

### 5.4 Scheduled jobs: cron is owned solely by the api-gateway worker; partition lifecycle has no scheduler
**Severity: Medium — Likelihood: Medium**
The only cron definitions are in `services/api-gateway/wrangler.toml`: `crons = ["*/5 * * * *"]` base/staging and `["*/1 * * * *"]` production (`:19-20, 100-101, 202-203`), driving `runScheduledDispatch` (outbox/queue/webhook drain, `src/index.ts:471-529`). No GitHub Actions `schedule:` triggers exist (`grep "schedule:" .github/workflows` → none) and no Vercel cron config exists (`apps/*/vercel.json` have only `headers`). Critically, migrations `079`–`083` add a **table-partition lifecycle** (`ensure_next_hot_table_partitions`, `detach_expired_hot_table_partitions`) and the migration itself notes pg_cron is unavailable and an **external scheduler must call these functions** (`079_partition_worker_request_logs.sql:450`). A `grep` for those function names across `services/`, `packages/`, `scripts/`, `infrastructure/` returns **no caller** — nothing in-repo schedules partition creation/detachment. If no external scheduler is configured, hot tables (request logs, telemetry, outbox, queue jobs, webhook deliveries) will stop getting new partitions and will not shed old ones.
- Evidence: cron only in `api-gateway/wrangler.toml`; `grep "schedule:" .github/workflows` → none; `079_partition_worker_request_logs.sql:265-315, 450`; `Grep "ensure_next_hot_table_partitions|detach_expired_hot_table_partitions"` over code → no matches.
- Affected surface: time-partitioned operational tables (request logs, telemetry, outbox, queue jobs, webhook deliveries).

### 5.5 Backup/restore: a pre-migration encrypted backup is captured, but no restore drill or scheduled backup is in-repo
**Severity: Medium — Likelihood: Low**
The gated production workflow captures an encrypted logical backup before migrating: `pg_dump --format=custom` → `pg_restore --list` (verification listing) → `gpg --symmetric --cipher-algo AES256` → `sha256sum`, uploaded as a 7-day artifact (`production-deploy.yml:195-212`). This is a genuine pre-change safety net. Gaps: (a) it only runs in the **gated** workflow, not `deploy-production.yml`; (b) retention is 7 days; (c) there is **no scheduled/periodic backup** job and **no restore-drill** automation in-repo (recovery runbooks exist as docs — `docs/governance/infra-recovery.md`, `regional-failover.md` — but no executable restore test). Routine backup cadence presumably relies on Supabase's managed backups, which are not represented in the repo.
- Evidence: `production-deploy.yml:195-212`; absence of any scheduled backup workflow; `docs/governance/` runbook filenames only.
- Affected surface: disaster recovery RPO/RTO assurance.

### 5.6 Incident tooling is documentation-grade; SLO error-budget enforcement depends on the missing metrics pipeline
**Severity: Medium — Likelihood: Medium**
A substantial incident/runbook library exists under `docs/governance/` (`incident-response-governance.md`, `incident-sev1.md`, `queue-dlq-redrive.md`, `regional-failover.md`, `secret-rotation.md`, `feature-flag-rollback.md`, `event-replay.md`, etc.) and `prometheus-rules.yaml` annotations point alerts at these runbooks. The `slo-catalog.yaml` defines error-budget policies (e.g. `freeze-risky-deployments-below-25-percent`) keyed to evidence tables like `sre_error_budget_snapshots`. But because the metrics that would populate those budgets are not emitted (§5.1), error-budget gating cannot be computed from live data — it is a governance contract awaiting a telemetry producer. Incident response is therefore runbook-driven and human-detected rather than alert-driven.
- Evidence: `ls docs/governance/` (runbook set); `slo-catalog.yaml:1-43`; `prometheus-rules.yaml` runbook annotations; cross-ref §5.1.
- Affected surface: incident detection latency; automated deploy-freeze on budget burn.

### 5.7 Reserved/incubating service roots are governance-only shells (state, not yet runtime)
**Severity: Low — Likelihood: Low**
`services/` contains six reserved roots (`analytics-pipeline`, `checkout-runtime`, `event-bus`, `media-service`, `notification-service`, `search-service`) that several SLOs already name as owners (`slo-catalog.yaml:9-36` references `services/checkout-runtime` and `services/event-bus`). These are not deployed by any workflow (only api-gateway/webhook/queue-workers are). The SLO catalog thus tracks owners that have no running service — an operational bookkeeping mismatch rather than a live failure.
- Evidence: `ls services/`; `slo-catalog.yaml:9-36`; deploy workflows deploy only the three active workers.
- Affected surface: SLO ownership accuracy.

---

## Risk Counts by Severity (per category)

| Category | Critical | High | Medium | Low |
|---|---|---|---|---|
| 1. Production | 0 | 2 | 4 | 2 |
| 2. Scaling | 0 | 1 | 4 | 1 |
| 3. Security (operational) | 0 | 2 | 2 | 4 |
| 4. Developer Experience | 0 | 2 | 1 | 2 |
| 5. Operational | 0 | 2 | 4 | 1 |
| **Total** | **0** | **9** | **15** | **10** |

(34 risks total. No Critical-rated risks: each individual control has partial mitigation or is environment-conditional; the most severe items are rated High.)

---

## Top 10 Risks

1. **[High]** Observability is a paper artifact — Prometheus rules / Grafana dashboards / SLOs reference metrics (`http_requests_total`, `letbuyy_queue_dead_letter_total`, `letbuyy_replay_lag_seconds`) that **no runtime emits**; no OTel/prom-client dependency; `writeDataPoint` never called. Production alerting effectively does not fire. (§5.1)
2. **[High]** Whole-platform single points of failure: one gateway worker, one Supabase, one Redis; `FAILOVER_REGION` is a status string with no failover mechanism in code. (§5.2)
3. **[High]** Two overlapping production deploy workflows both fire on push to `main` with **different concurrency groups** → concurrent same-target deploys (gated pipeline + ungated pipeline) race. (§1.1)
4. **[High]** Static shared bearer token (`PLATFORM_CONSOLE_API_TOKEN`, string-equality) is the sole auth for the super-admin/operations API plane; no per-operator identity, no rotation; audit `actor_*` is self-asserted. (§3.4)
5. **[High]** Behavioral test coverage is ~zero inside deployable workspaces — all 9 apps + 3 services have `"test": "echo 'No tests yet' && exit 0"`; `packages/*` have no test script; real tests live only at repo-root `tests/` outside the per-workspace pipeline. (§4.3)
6. **[High]** Single API gateway worker (route handlers incl. 4,826-line `storefront.ts`) is the shared chokepoint for storefront, admin, auth, payments, marketplace, and ops. (§2.1)
7. **[High]** `pnpm install` cannot complete in a clean environment here (corepack EACCES; partial `node_modules`; `apps/identity-platform` typecheck fails on unresolved `next`/`node:test`); prior in-repo audit also records typecheck/governance failures. Onboarding/build reliability is unproven. (§4.1)
8. **[High]** Ungated `deploy-production.yml` has no DB-migration job and no staging gate, and every deploy step `echo "SKIP"`s on missing credentials — a "green" run can deploy nothing or deploy code ahead of schema. (§1.2)
9. **[Medium]** Hot-table **partition lifecycle has no scheduler**: migration `079` requires an external scheduler to call `ensure_next_hot_table_partitions`/`detach_expired_hot_table_partitions`; no in-repo caller exists, risking partition exhaustion on request-log/telemetry/outbox/queue/webhook tables. (§5.4)
10. **[Medium]** Production `db push --include-all` runs against the live DB with the diff only archived as an artifact (no human approval gate in-repo), and migration tooling has two diverging roots (`supabase/` vs `database/supabase/` with Postgres major 15 vs 17). (§1.3, §1.4)

---

## Evidence Index

- **Deploy workflows**: `.github/workflows/ci.yml`; `.github/workflows/production-deploy.yml` (gated: preflight `:24-104`, staging-e2e gate `:106-155`, migrate+backup `:157-217`, workers `:219-294`, apps `:296-360`, smoke `:394-443`); `.github/workflows/deploy-production.yml` (ungated, skip-on-no-creds `:50-141`); `.github/workflows/staging-deploy.yml`; `.github/workflows/deploy-staging.yml`; `.github/workflows/production-rollout.yml`; `.github/workflows/staging-runtime-deployment.yml`; `.github/workflows/environment-lifecycle.yml`; `.github/workflows/live-production-certification.yml`; `.github/BRANCH_STRATEGY.md`.
- **Vercel**: `vercel.json` (root, install command only); `apps/*/vercel.json` (framework/build/region/headers; `regions: ["bom1"]` for storefront).
- **Cloudflare worker config**: `services/api-gateway/wrangler.toml` (base `[vars]` defaults to staging `:26-33`; crons `:19-20, 202-203`; queues `:55-73, 234-252`; KV/D1/Hyperdrive/R2/DO/services per env); `services/webhook-service/wrangler.toml`; `services/queue-workers/wrangler.toml` (consumer/DLQ/circuit-breaker config `:30-95, 232-291`).
- **Rollback/lineage**: `infrastructure/scripts/deploy/production-rollback.mjs`; `config/runtime/deployment-lineage-manifest.json:9-50`; `infrastructure/scripts/cloudflare/bootstrap-environment.mjs:53-68` (D1 apply).
- **DB / migrations / RLS**: `database/supabase/migrations/` (15 files; `000_baseline.sql` = 233 tables / 230 RLS / 352 policies; tables w/o RLS = `contacts`, `employee_permissions`, `projects`); `077_customer_reset_tokens.sql`; `079_partition_worker_request_logs.sql:265-315, 450`; `supabase/config.toml:13` (major 15); `database/supabase/config.toml:11` (major 17); `scripts/validators/migration-safety-validator.mjs` (passed); `database/cloudflare/d1/migrations/0001_provider_execution_foundation.sql`.
- **Security**: `services/api-gateway/src/lib/supabase.ts:9-25`; `packages/infrastructure/supabase-adapter/index.ts:34-49`; `services/api-gateway/src/middleware/auth.ts:64-120`; `services/api-gateway/src/middleware/security.ts:20-48, 174-220`; `services/api-gateway/src/index.ts:297-327` (CORS); `services/api-gateway/src/routes/internal-console.ts:43-66` (console token); `services/webhook-service/src/index.ts:54-75, 266-306` (signature verify); `apps/identity-platform/src/lib/auth/cookies.ts:26-34, 145-161`; `.gitignore:84-95`; `git rev-list --all --objects | grep -iE '\.env'` (no real `all.env`); secret-pattern grep (placeholders only at `apps/merchant-control-plane/.../payments/page.tsx:352`, `packages/tenant-core/src/index.ts:112`).
- **Scaling**: `packages/infrastructure/pooled-sql-adapter/index.ts:28-66`; `services/api-gateway/src/middleware/rateLimit.ts:701-797, 834-848`; `services/api-gateway/src/lib/storefront-cache.ts:12-13, 59-100`; `services/api-gateway/src/routes/storefront.ts:790-820, 1109-1142` (sequential fallback loaders); `grep -c "getSupabaseAdmin\b"` = 448.
- **Build/test**: `turbo.json:1-59`; `.github/workflows/ci.yml:27-147`; `node_modules/.bin/turbo --version` = 2.8.9; `services/api-gateway` `tsc --noEmit` EXITCODE 0; `apps/identity-platform` `tsc --noEmit` (unresolved `next`/`node:test`); `package.json` `"test"` scripts (all apps/services = no-op echo; packages = none); root `tests/` (100+ `*.test.mjs`); `node --test tests/auth/csrf-contract.test.mjs tests/operations/cron-noop.test.mjs` → 7 pass/0 fail; `corepack enable` EACCES; `LETBUYY_STATE.md` (typecheck/governance failure note); `README.md` (onboarding).
- **Observability/ops**: `infrastructure/observability/prometheus-rules.yaml:1-30`; `infrastructure/observability/otel-collector.yaml:1-30`; `infrastructure/observability/grafana-*.json` (6 dashboards, postgres/prometheus datasources); `infrastructure/monitoring/slo-catalog.yaml:1-43`; `services/api-gateway/src/middleware/observability.ts:69-226`; `Grep` for `http_requests_total|http_server_errors_total|letbuyy_queue_dead_letter_total|letbuyy_replay_lag_seconds` over `services/` → no files; `Grep "prom-client|@opentelemetry/*"` over `{services,packages}/**/package.json` → no files; `grep "writeDataPoint"` → no files; `docs/governance/` runbook set (`incident-response-governance.md`, `incident-sev1.md`, `queue-dlq-redrive.md`, `regional-failover.md`, `secret-rotation.md`, `feature-flag-rollback.md`, `event-replay.md`, `infra-recovery.md`, `deployment-rollback.md`).
- **Dependencies**: `package.json:59-74` (pnpm overrides + packageManager pin); `pnpm-lock.yaml` (`lockfileVersion 9.0`, mtime 2026-06-05; `next@16.1.6`, `react@19.2.3`, `wrangler@4.94.0`, `@supabase/supabase-js@2.95.3`, `hono@4.12.4`, `jose@6.1.3`, `postgres@3.4.9`, `bcryptjs@3.0.3`).
- **Repo state**: `git log -1` = `5346ced9 2026-06-05`; `git rev-list --count HEAD` = 727; `tasks/todo.md:17-44` (open Phase-0 items); `LETBUYY_STATE.md` (prior single-pass audit).
