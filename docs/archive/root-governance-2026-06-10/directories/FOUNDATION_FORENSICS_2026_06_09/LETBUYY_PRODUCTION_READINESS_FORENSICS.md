# LetBuyy Production Readiness Forensics
## Phase H — Deployment, CI/CD, Observability, Scaling Audit
**Date:** 2026-06-09
**Scope:** Read-only forensic due-diligence ahead of hypothetical $100M acquisition
**Auditor policy:** Every claim backed by file:line evidence; no trust in self-graded ledgers

---

## Executive Summary

LetBuyy has a legitimately bifurcated deployment topology (Cloudflare Workers for backend, Vercel for frontend), a CI/CD pipeline that contains real gates rather than pure theater, and structured observability scaffolding — but the observability stack is not deployed to any confirmed infrastructure, several production `wrangler.toml` vars carry unresolved `SKIP_NEEDS_HUMAN` placeholders, there is no scheduled automated database backup beyond pre-migration `pg_dump` snapshots in GitHub Artifacts (7-day retention), and the Kubernetes/Helm files are governance artifacts that satisfy validators without being wired to a running cluster.

**Production Readiness Score: 31 / 100**

Breakdown:
- Deployment topology clarity: 14/20 (coherent split but Vercel env vars still point to `letbuyy.store` while domain migration to `letbuyy.com` is in progress)
- CI/CD real gates: 14/20 (real test + E2E + secret preflight; but staging deploy silently skips when credentials absent)
- Observability: 5/20 (config files exist; no confirmed running Prometheus/Grafana/Loki stack; Cloudflare Analytics Engine telemetry is real but limited)
- Secrets/ENV hygiene: 6/15 (secret placeholder validator works; 5 non-secret SKIP_NEEDS_HUMAN vars in production wrangler.toml survive CI because the committed-secret validator only gates `_SECRET`/`_TOKEN` keys)
- DR/Backups: 2/15 (pg_dump in GitHub workflow artifacts, 7-day retention; no PITR config; no dedicated backup schedule)
- Scaling design: 12/25 (Cloudflare Workers + Hyperdrive is horizontally scalable by design; Supabase is the single-region bottleneck; table partitioning exists for hot tables; rate limiting is real via Upstash Redis)
- Certify/phase4 theater: -22 (phase4-ultimate-validate self-records `"status":"passed"` back to its own API endpoint — this is self-attestation, not external verification)

---

## 1. Deployment Topology Truth

### Target: Bifurcated — Cloudflare Workers (backend) + Vercel (frontend Next.js apps)

The `vercel.json` at root (`vercel.json:1-4`) contains only `installCommand`; it is not the primary deploy config. All 9 Next.js frontend apps are deployed via `pnpm dlx vercel@latest deploy --prod` in the production-deploy workflow (`production-deploy.yml:386-388`), each with its own `VERCEL_PROJECT_ID` from GitHub secrets.

The backend (api-gateway, webhook-service, queue-workers, mobile-bff) deploys as Cloudflare Workers via `pnpm exec wrangler deploy --env production` (`production-deploy.yml:292`, `309`, `326`, `339`). The wrangler topology is fully wired: KV namespaces, R2 buckets, D1 databases, Cloudflare Hyperdrive, Analytics Engine datasets, Durable Objects, Queue producers — all bound in `services/api-gateway/wrangler.toml:177-325`.

**Domain inconsistency:** Production deploy workflow injects `NEXT_PUBLIC_APP_URL: https://letbuyy.store` (`production-deploy.yml:394`), while the build CI step uses `https://letbuyy.com` (`ci.yml:253`). This creates a real URL mismatch between CI build and production artifact.

**Kubernetes/Helm status:** `infrastructure/deployment/kubernetes/namespace.yaml` and `infrastructure/deployment/helm/letbuyy-production/` exist and are checked by the production-readiness-validator, but no workflow provisions a cluster, no kubeconfig is set, and the Helm chart is a health-probe CronJob only (`runtime-health-cronjob.yaml`). These files satisfy the file-existence validators; they are not wired to a running cluster.

**Verdict:** Coherent two-target topology (Workers + Vercel). Kubernetes artifacts are governance props, not live infrastructure.

---

## 2. CI/CD Reality Table

| Workflow | Trigger | What It Actually Does | Real Gate? | Notes |
|---|---|---|---|---|
| `ci.yml` | PR to develop/main; push | typecheck (incremental), lint, secret-hygiene validator, unit tests, behavioral tests, contract tests, Flutter analyze+test, build | YES | `test:behavioral`, `test:contracts`, `test:unit:gateway` are real test suites. Build uses placeholder env vars (ci.yml:247-256). Flutter mobile tests run on macOS. |
| `production-deploy.yml` | push to main; workflow_dispatch | Secret preflight (30+ secrets checked), migration diff generation + upload, staging E2E gate (Playwright against live staging), encrypted pre-migration pg_dump, supabase db push, wrangler deploy (4 workers), vercel deploy (9 apps), post-deploy smoke tests | YES (strong) | pg_dump backup artifact has only 7-day retention (production-deploy.yml:237). Secrets are GitHub secrets pushed via `wrangler secret put`, not committed. |
| `staging-deploy.yml` | push to develop | migrate staging DB, deploy workers + apps, smoke tests | CONDITIONAL | All deployment steps have `if: ${{ env.HAS_SUPABASE_CREDS == 'true' }}` guards (staging-deploy.yml:44, 77, 102). If credentials are absent, deployment is silently skipped with `echo "SKIP"`. This means staging can fall out of sync. |
| `architecture-governance.yml` | PR on infrastructure paths; push to main | 20+ `validate:*` script invocations, typecheck, dependency audit, SBOM generation | PARTIAL THEATER | Validators check file existence and JSON schema conformance. They pass if the files exist with correct structure. Does not test runtime behavior. |
| `production-rollout.yml` | workflow_dispatch (manual) | ~18 validator invocations, phase4-ultimate-validate, survivability suite, production-deploy script | PARTIAL THEATER | The validate:* steps run the same file-existence/schema validators as governance. The `--execute` mode calls `phase4-ultimate-validate --execute` which self-records pass evidence to the operations API (phase4-ultimate-validate.mjs:~80-130). The actual Wrangler deploy is triggered through the production-deploy script as a subprocess. |
| `live-production-certification.yml` | workflow_dispatch | All validator gates, then `run-provider-production-certification.mjs` | PARTIAL — credential-gated | The `--execute` mode requires `PROMETHEUS_URL`, `GRAFANA_URL`, `OTEL_COLLECTOR_HEALTH_URL` env secrets; without them, observability verification is file-content-only (verify-observability-rollout.mjs:52-68). |
| `environment-lifecycle.yml` | PR on lifecycle config paths | Lifecycle contract validator (operational-lifecycle-validator.mjs), typecheck, governance gates | MOSTLY THEATER | Validates JSON schema of lifecycle config files. |
| `staging-runtime-deployment.yml` | push to main/release on worker/infra paths | Governance + Cloudflare validators, phase4-ultimate-validate (staging), bootstrap plan/execute | PARTIAL | Bootstrap plan is dry-run only by default. Execute requires explicit `inputs.execute=true`. |
| `hot-table-partition-maintenance.yml` | Schedule: `15 2 1 * *` (monthly) | Runs `ensure_next_hot_table_partitions` and `detach_expired_hot_table_partitions` SQL functions via psql | YES (real) | This is a genuine operational maintenance task. Tables partitioned: worker_request_logs, runtime_telemetry_metrics, outbox_events, platform_queue_jobs, webhook_deliveries (migration 079-083). |
| `architecture-governance.yml` (also) | Push to main/codex/** | Same validator chain + SBOM | PARTIAL THEATER | See above. |

**Key finding:** The production-deploy workflow is the most real pipeline. It has: credential preflight that hard-fails on missing secrets, a genuine E2E suite against live staging as a deploy gate, encrypted pre-migration backup, actual `wrangler deploy` and `vercel deploy` calls, and post-deploy smoke tests. The production-rollout workflow adds layers of validator theater around the same underlying deploy.

---

## 3. Secrets/ENV Handling

- **No `.env.example` files found** in root, api-gateway, or any app directory. The source of truth for required env vars is the production-deploy workflow (30 secrets checked) and wrangler.toml `[vars]`.
- **Secret storage:** Cloudflare Worker secrets via `wrangler secret put` in CI; Vercel env vars injected at deploy time. No committed secrets for `_SECRET`/`_TOKEN` keys (enforced by committed-secret-placeholder-validator.mjs).
- **SKIP_NEEDS_HUMAN placeholders in production wrangler.toml (non-credential keys):** `AI_PROVIDER_MODEL`, `AI_CREDIT_RAZORPAY_KEY_ID`, `WHATSAPP_WEBHOOK_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_WHATSAPP_FROM` are set to `SKIP_NEEDS_HUMAN_*` in `services/api-gateway/wrangler.toml:253-262`. These pass CI because the committed-secret-validator only gates keys ending in `_SECRET` or `_TOKEN`. However, `WHATSAPP_WEBHOOK_SECRET` ends in `_SECRET` — this means WHATSAPP_WEBHOOK_SECRET = "SKIP_NEEDS_HUMAN_WHATSAPP_WEBHOOK_SECRET" is a committed placeholder for a secret-class key. The validator catches keys in `[vars]` sections of wrangler.toml — it should flag this. Further inspection needed, but it may be that the validator uses a regex that matches only keys with non-empty quoted values that don't contain "SKIP".
- **Secret count for production:** ~30 required GitHub secrets, plus Cloudflare Worker secrets (16 for api-gateway production). Total unique production secrets: ~46.
- **Secret rotation:** `docs/runbooks/secret-rotation.md` exists; 90-day rotation cadence per `infrastructure/security/production-security-controls.yaml:5`.

---

## 4. Observability / DR State

### Observability

**What exists as config:**
- `infrastructure/observability/otel-collector.yaml` — OTEL collector config with OTLP receivers, Prometheus exporter, Loki exporter, Tempo exporter. References `tempo.letbuyy-observability.svc.cluster.local` and `loki.letbuyy-observability.svc.cluster.local` — Kubernetes cluster DNS names.
- `infrastructure/observability/prometheus-rules.yaml` — 7 real alert rules (LetBuyyApiGatewayHighErrorRate, LetBuyyQueueDeadLetterGrowth, etc.)
- 6 Grafana dashboard JSON files — each has 4 panels, real uid, valid structure.
- `infrastructure/monitoring/slo-catalog.yaml` — 6 SLOs defined with targets and evidence tables.

**What is confirmed running:**
- Cloudflare Workers built-in observability: `[observability] enabled = true` with `head_sampling_rate = 0.1` and `invocation_logs = true` in `wrangler.toml:10-17` for both staging and production. This is real — Cloudflare logs worker invocations to Cloudflare Logpush.
- Cloudflare Analytics Engine: `RUNTIME_TELEMETRY` binding in wrangler.toml:321; the observability middleware writes metrics to it per request (`observability.ts:154`). This is real runtime telemetry.
- Structured request logs: `writeStructuredRuntimeLog` writes JSON to Cloudflare's console output (`observability.ts:73-82`), picked up by Cloudflare Logpush.
- Upstash Redis rate limiting is real and integrated.

**What is unconfirmed:**
- The Prometheus/Grafana/Loki/Tempo stack: references cluster DNS `*.letbuyy-observability.svc.cluster.local` — no Kubernetes cluster is provisioned by any workflow. The `verify-observability-rollout.mjs` only probes live URLs when `--execute` flag is set AND env vars `PROMETHEUS_URL`, `GRAFANA_URL`, `OTEL_COLLECTOR_HEALTH_URL` are present. In the `architecture-governance.yml` run (the only automated path), the file is not even called — only `validate:observability` from the validator package runs, which is file-existence checking.
- There is no Grafana Cloud, Datadog, or Sentry configuration anywhere. The dashboards have no datasource configured (`grafana-runtime-dashboard.json` parsed with `datasource: not found`).

**Verdict:** Cloudflare-native observability (Workers Logs, Analytics Engine) is real. The Prometheus/Grafana/Loki stack described in config files is not deployed and its existence in CI validation is file-existence theater.

### DR / Backups

- **Pre-migration backup only:** A `pg_dump --format=custom` is run in the `migrate-production` job of `production-deploy.yml:220-227`, encrypted with GPG, and uploaded as a GitHub Actions artifact with **7-day retention** (`production-deploy.yml:237`). This is the only DB backup mechanism in the codebase.
- **No scheduled backup job:** No workflow schedules regular `pg_dump` or uses Supabase PITR. The hot-table-partition-maintenance workflow (`hot-table-partition-maintenance.yml`) runs monthly but only manages partition lifecycle.
- **No PITR configuration found:** No Supabase project config referencing `pitr_enabled`, no Terraform config for backup schedules.
- **Supabase PITR exists at the platform level** for paid tiers, but there is no evidence it has been enabled or configured for this project.
- **Multi-region DR:** `values.yaml` declares `primaryRegion: ap-south-1` and `failoverRegion: ap-southeast-1` but the failover is not wired to any automated failover mechanism. The `docs/runbooks/regional-failover.md` exists as a manual procedure runbook.
- **Supabase recovery runbook:** `docs/runbooks/infra-recovery.md:18-23` — Supabase recovery is 4 bullet points with no PITR step, no recovery time objective, no automated drill evidence.

**Verdict:** Backup strategy is pre-migration-only with 7-day artifact retention. There is no continuous backup, no PITR configuration, no DR drill automation.

---

## 5. Scaling Analysis

### 100 Merchants

**Verdict: Survives.** Cloudflare Workers are serverless and scale automatically. Supabase at this tier with Hyperdrive connection pooling (bound in wrangler.toml:186-189, pooled-sql-adapter/index.ts:28-29) handles connection load. Rate limiting via Upstash Redis is functional. Queue topology (5 queues with DLQ) is provisioned in Terraform.

**Binding blocker:** None at this tier, assuming secrets are all set. Actual blocker is the `SKIP_NEEDS_HUMAN` vars for WhatsApp/Twilio, which would disable those channels.

### 1,000 Merchants

**Verdict: At risk.** The binding blocker is the single Supabase instance with no read replica and no confirmed connection pool count. The `pooled-sql-adapter` defaults to `maxConnections: 5` per Worker invocation (`pooled-sql-adapter/index.ts:52`). Cloudflare Workers can scale to thousands of concurrent instances; each Worker instance that uses the pooled SQL path could open up to 5 direct Postgres connections. Supabase free/pro tiers cap at 60 direct connections before exhaustion.

Hyperdrive mitigates this: if `HYPERDRIVE` binding is present, `pooledSqlConnectionString` returns `env.HYPERDRIVE?.connectionString` (line 29), which routes through Cloudflare's connection pooler. The HYPERDRIVE binding IS present in wrangler.toml:186-189 (staging) and 303-305 (production). **However**, the Supabase client (`createSupabaseServiceClient`) used by the majority of routes goes through the Supabase REST API (HTTP-based), not through Hyperdrive. Hyperdrive is used only by the `pooled-sql-adapter` (for direct SQL queries to storefront views). The main RLS-bypassing service-role client hits `SUPABASE_URL/rest/v1/*` directly.

**Additional blocker at 1k:** No search service. The `search-service` is reserved/not implemented. Product search at 1k merchants with diverse catalogs will be slow full-table-scan queries against Supabase.

### 10,000 Merchants

**Verdict: Not survivable without architectural changes.** Binding blockers:

1. **Single Supabase instance:** All 9 apps + api-gateway share one Supabase project. At 10k merchants with active storefronts, the Postgres connection pool and query throughput will be the ceiling. Supabase's largest plan (Business) gives 256 connections. With Workers scaling horizontally and the non-Hyperdrive Supabase client path, connection exhaustion is the first failure mode.

2. **Observability stack not deployed:** At 10k merchants, debugging incidents without Prometheus/Grafana would require manual inspection of Cloudflare Analytics Engine, which has limited query/retention capabilities.

3. **No search service:** The `search-service` is explicitly `reserved, not implemented` in CLAUDE.md. Full-text product search at scale requires an external index.

4. **No CDN for media at scale:** R2 bucket `letbuyy-media-production` has no CDN distribution config. 10k merchant media assets served directly from R2 would have latency and cost implications.

5. **Scheduled cron throttled:** Production cron is every 15 minutes (`wrangler.toml:229`, comment: "Beta free-tier: was */1 ... 15m = 96 fires/day"). The queue drain frequency limits outbox processing throughput.

6. **Missing notification/analytics pipelines:** `notification-service` and `analytics-pipeline` are reserved/not implemented. At 10k merchants, order confirmation emails, marketing notifications, and analytics would all be greenfield.

---

## 6. The "certify:production" / phase4-live-certify Machinery

**Verdict: Self-graded theater with a real credential-gated escape hatch.**

The `phase4-ultimate-validate.mjs` runs a series of sub-scripts including `verify-observability-rollout.mjs`, `verify-security-gates.mjs`, `verify-live-operations.mjs`, and `run-live-drills.mjs`. In `--execute` mode, after the sub-scripts succeed, it `POST`s evidence back to `${API_BASE_URL}/v1/operations/runtime/readiness-gates` with `"status": "passed"` hard-coded (`phase4-ultimate-validate.mjs:~89-130`). This means the certification evidence written to the database is produced by the same process being certified.

The `verify-observability-rollout.mjs` is the clearest case:
- In plan mode: reads YAML/JSON files and asserts string fragments exist. Passes if files are present and correctly formatted.
- In `--execute` mode: performs actual HTTP GETs against `PROMETHEUS_URL`, `GRAFANA_URL`, `OTEL_COLLECTOR_HEALTH_URL`. If these secrets are not set, it throws before executing.

For the `architecture-governance.yml` automated path, the observability verification runs file-content-only (no `--execute`). The `live-production-certification.yml` workflow is the only path that would exercise live endpoints — and it requires manual `workflow_dispatch` with approved secrets.

The `production-readiness-validator.mjs` checks that 60+ required files exist (including Kubernetes YAML, Helm charts, Grafana dashboards) and have correct schema. All these files exist in the repo. The validator passes. But file existence does not equal deployed infrastructure.

---

## 7. Additional Findings

### Hot Table Partitioning
Five tables are partitioned: `worker_request_logs`, `runtime_telemetry_metrics`, `outbox_events`, `platform_queue_jobs`, `webhook_deliveries` (migrations 079-083 in `database/supabase/migrations/`). Monthly partition maintenance runs via the `hot-table-partition-maintenance.yml` cron workflow using `public.ensure_next_hot_table_partitions()` and `public.detach_expired_hot_table_partitions()` SQL functions. This is real and operationally sound for high-write telemetry tables.

### Rate Limiting
Real Upstash Redis rate limiting is implemented (`rateLimit.ts:163-199`): fixed-window via Lua pipeline, with Cloudflare KV fallback and in-memory fallback. Auth routes have dedicated rate limiting. The `RATE_LIMIT_KV_FALLBACK=on` flag controls KV use for high-volume paths (rateLimit.ts:73).

### Connection Pooling Reality
- Cloudflare Hyperdrive bound in wrangler.toml for both staging and production.
- `pooled-sql-adapter` uses Hyperdrive connectionString if available (max 5 connections per client).
- Main Supabase REST API path (createSupabaseServiceClient) does NOT use Hyperdrive — HTTP to `SUPABASE_URL/rest/v1/`.
- Local dev has pgbouncer at `pool_mode = "transaction"`, `default_pool_size = 15` (`local-stack-up.mjs:257-262`). Production uses Supabase's built-in pooler if the connection string uses port 6543 (not verified in committed config).

### Rollback Path
`production-rollback.mjs` exists (`infrastructure/scripts/deploy/production-rollback.mjs`). The `production-rollout.yml` workflow includes a `--rollback` path. The Cloudflare Workers versioning API supports instant version rollback. Worker rollback is plausible. **Database migration rollback is NOT implemented**: migrations are forward-only with no down migration scripts. The pre-migration pg_dump artifact is the only rollback mechanism for schema changes.

---

## 8. Evidence-Backed Findings Summary

1. **Deployment topology is coherent (Cloudflare Workers + Vercel) but domain inconsistency exists between CI build and production deploy** — `ci.yml:253` uses `letbuyy.com`; `production-deploy.yml:394` uses `letbuyy.store`. Apps built with one base URL deployed to the other.

2. **Staging deploy silently skips when credentials absent** — `staging-deploy.yml:44-51` guards migration with `if: ${{ env.HAS_SUPABASE_CREDS == 'true' }}`; `staging-deploy.yml:162-164` skips workers entirely with `echo "SKIP"`. Staging can silently diverge from main.

3. **5 SKIP_NEEDS_HUMAN placeholders committed to production wrangler.toml** — `services/api-gateway/wrangler.toml:253-262`. These are non-credential env vars (`AI_PROVIDER_MODEL`, `WHATSAPP_WEBHOOK_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_WHATSAPP_FROM`, `AI_CREDIT_RAZORPAY_KEY_ID`). WHATSAPP_WEBHOOK_SECRET is a credential-class var that ends in `_SECRET` — its placeholder value means WhatsApp webhook verification would fail in production. (Note: committed-secret-validator.mjs may skip this because the value starts with "SKIP_NEEDS_HUMAN" and the validator's regex may require a non-SKIP value; requires runtime verification.)

4. **Phase4-ultimate-validate self-attests pass status to its own API endpoint** — `infrastructure/scripts/operations/phase4-ultimate-validate.mjs` POSTs `"status": "passed"` to `/v1/operations/runtime/readiness-gates` after sub-scripts succeed. The evidence recorded is generated by the thing being certified.

5. **Pre-migration backup has 7-day retention only; no scheduled backup exists** — `production-deploy.yml:234-237`. After 7 days, the only recovery option would be Supabase's platform PITR (if enabled — not verifiable from code).

6. **Prometheus/Grafana/Loki observability stack is config-only; no deployment wires it to infrastructure** — `infrastructure/observability/otel-collector.yaml` references `*.letbuyy-observability.svc.cluster.local` Kubernetes DNS. No workflow provisions a cluster. The dashboards have no datasource configured.

7. **Cloudflare Analytics Engine telemetry is real but Cloudflare-siloed** — `wrangler.toml:204-208` binds `RUNTIME_TELEMETRY` to Analytics Engine dataset. `observability.ts:154` writes to it per request. This is functional but has no alerting, no long-term retention beyond Cloudflare's defaults, and no cross-correlation with logs.

8. **No search service, no notification service, no analytics pipeline** — These are explicitly reserved/not-implemented per CLAUDE.md. At scale, product discovery (no full-text search), transactional notifications (greenfield), and merchant analytics (greenfield) are all absent.
