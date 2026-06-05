# Production Readiness Assessment

**Investigation date:** 2026-06-05
**Nature of this document:** A factual, evidence-cited assessment of the platform's *current* readiness state across the dimensions a production-operations review would examine. It documents what exists and what is absent. It does **not** prescribe fixes, sequencing, or target architectures — those are out of scope for this forensic investigation. "Readiness state" labels below describe observed maturity, not a recommendation to ship or not ship.

**Readiness scale (descriptive):**
- **Operational** — implemented, wired, and exercised by code paths that run.
- **Partial** — implemented but with material gaps, unwired pieces, or no exercise evidence.
- **Contract-only** — declared in manifests/docs/schema with no executing implementation.
- **Absent** — not found in the repository.

Synthesized primarily from [14 Risk Assessment](14-risk-assessment.md), [08 Error & Misconfiguration](08-error-misconfiguration.md), [11 Architecture Violations](11-architecture-violations.md), and [07 Integration](07-integration.md).

---

## Readiness scorecard

| Dimension | State | One-line basis |
|---|---|---|
| Deployment & environments | **Partial** | Staging/prod separation cleanly encoded; two prod deploy workflows race; no migration gate in `deploy-production.yml`. |
| Database & migrations | **Partial** | Real squashed baseline + RLS; two diverging migration roots (PG 15 vs 17); sequence gaps; `db push --include-all` against live DB. |
| Automated testing | **Contract-only** | 0 package unit tests; all 12 deployable workspaces' `test` = `echo 'No tests yet'`; governance tests assert manifests, not behavior. |
| Observability (metrics/alerts) | **Contract-only** | Prometheus/Grafana/SLO definitions reference metrics no runtime emits; no OTel/prom-client dep. |
| Logging | **Partial** | Structured logging present in places; no central aggregation/dashboard evidence; failures are log-detected. |
| Error tracking | **Absent** | No Sentry/equivalent dependency or DSN wiring found in deployable code. |
| Secret management | **Operational** | No live secrets in tracked source; `.gitignore` blocks env files; CVE pins via `pnpm.overrides`. |
| AuthN/AuthZ (platform) | **Partial** | Real Supabase auth + RLS + store-ownership checks; ops plane uses a single static bearer token; split merchant credential authority. |
| Payments | **Partial** | 4 providers with timing-safe signature verification + server-side recompute/idempotency; INR-centric; app-billing payouts are test-mode only. |
| Scaling & resilience | **Partial** | Outbox/queue/lease machinery exists; single gateway + single Supabase + single Redis SPOFs; `FAILOVER_REGION` is a status string. |
| Rate limiting / abuse | **Partial** | identity-platform has rate-limit + Turnstile; storefront customer login does not; no per-app API quotas. |
| Build reliability | **Partial** | Turbo/pnpm workspace builds; `pnpm install` did not complete cleanly in this environment; one app typecheck fails. |
| Backup / restore / DR | **Contract-only** | DR/failover described in governance docs; no executing backup/restore or failover code found in repo. |
| Monitoring of background jobs | **Partial** | Cron-driven outbox dispatch is wired; hot-table partition lifecycle has no scheduler/caller in-repo. |

---

## 1. Deployment & environment posture

Staging and production are cleanly separated in configuration, and Worker rollback is disciplined through a lineage-gated wrapper ([14](14-risk-assessment.md)). However, the investigation found **two production deploy workflows that both trigger on push to `main`** with *different* concurrency groups, allowing concurrent deploys to the same target to race ([14](14-risk-assessment.md), H-15 in [16](16-critical-findings-summary.md)). `deploy-production.yml` contains **no database-migration job and no staging gate**, and `echo "SKIP"`s steps when credentials are absent — meaning a green production run can deploy nothing, or can deploy application code ahead of the schema it expects.

Default API/account base URLs across web apps point at **staging** (`api.staging.letbuyy.store`), with production reliant on environment overrides; marketing-site CTAs hardcode `accounts.staging.letbuyy.store` as literal link hrefs ([03](03-application-investigation.md)). Vercel/Cloudflare deploy targets exist (`vercel.json`, `infrastructure/`, wrangler configs), but eight `VERCEL_PROJECT_ID_*` env vars are defined-but-unused, superseded by a CI matrix-secret scheme ([09](09-dead-code.md)).

## 2. Database & migration discipline

The database is real and non-trivial: a squashed baseline (`database/.../000_baseline.sql`) defining ~233 tables with 350+ RLS policies (≈98.7% table coverage) ([01](01-repository-inventory.md)). Readiness gaps are in *process*, not structure:

- **Two diverging migration roots** — `supabase/` (Postgres major 15) and `database/supabase/` (major 17) ([14](14-risk-assessment.md)).
- **Discontinuous history** — baseline `000` then `073`–`089` with archived gaps; `AGENTS.md` still cites a relocated migration `065` ([01](01-repository-inventory.md), [13](13-technical-debt.md)).
- **Live-DB push** — production schema applied via `db push --include-all` with the diff only archived afterward; no in-repo approval gate ([14](14-risk-assessment.md)).
- **Partition lifecycle has no driver** — migration 079's `ensure/detach…hot_table_partitions` requires an external caller that does not exist in-repo, creating partition-exhaustion exposure ([14](14-risk-assessment.md)).

## 3. Testing reality

This is the single most overstated readiness dimension. Independently verified: **every one of the 12 deployable workspaces (9 apps + api-gateway/webhook-service/queue-workers) has `"test": "echo 'No tests yet' && exit 0"`** ([17](17-evidence-appendix.md)). The 30 workspace packages have **no test script at all**. Real tests exist only in three spots — api-gateway `__tests__` (~6 files incl. `tenant-isolation`, `security`, `payments`), identity-platform (~2), and merchant-app (~1) — but the package `test` scripts do not run them.

What *does* run in CI is ~149 `tests/**/*.test.mjs` governance files plus the 128-validator suite. These assert that JSON manifests are internally consistent and that source files contain expected string fragments (e.g. checking `source.includes("compileConvergenceProof")`). Load and chaos suites default to plan mode (print commands, record nothing) and self-label `mode: "governance-contract-not-live-evidence"` ([14](14-risk-assessment.md)). **No CI test calls a running system.** Consequently there is effectively no automated regression protection on deployable behavior.

## 4. Observability, logging, error tracking

The platform ships a complete-looking monitoring *contract* — Prometheus rules, Grafana dashboards, and SLO definitions — but they reference metrics (`http_requests_total`, `letbuyy_queue_dead_letter_total`, `letbuyy_replay_lag_seconds`) that **no runtime emits**; there is no OpenTelemetry or prom-client dependency, and the Analytics-Engine `writeDataPoint` is never called ([14](14-risk-assessment.md), C-14 in [16](16-critical-findings-summary.md)). No Sentry or equivalent error-tracking integration was found in deployable code. Net effect: production incidents are **human- and log-detected**; the alerting stack cannot fire because nothing feeds it.

## 5. Security hygiene (operational)

Stronger than the rest of the readiness profile, and it corrects several stale alarms in the repo's own older ledgers:

- **No live secrets in tracked source** — scans for `sk_live_`, `rzp_live_`, `service_role` JWTs, and PEM private keys all came back empty ([17](17-evidence-appendix.md)); `.gitignore` blocks env files; `all.env` was never tracked.
- **Webhook signatures verified timing-safe for all four PSPs** ([14](14-risk-assessment.md)).
- **Dependency stack is current** (Next 16.1.6, wrangler 4.94, supabase-js 2.95.3) with active `pnpm.overrides` CVE pinning ([14](14-risk-assessment.md)).

Open operational-security items: a **single static bearer token** is the only credential for the super-admin/ops API plane (no per-operator identity or rotation; audit actor self-asserted — H-16); **credentialed CORS** (`credentials:true`) is allowed for every wildcard tenant subdomain on the central API ([11](11-architecture-violations.md)); merchant password verification runs in the Next app with the hash shipped over HTTP each login (H-7); and 121 route sites can return raw DB `error.message`, guarded only by a 3-code denylist sanitizer with at least one known miss ([11](11-architecture-violations.md)). A development MFA-bypass code and dev-only OTP echo exist but are `NODE_ENV`-guarded ([03](03-application-investigation.md)).

## 6. Scaling, resilience & SPOFs

The repository contains sophisticated distributed-systems scaffolding (outbox, queues, leases, replay, CQRS) but the *operational* posture is single-instance: **one api-gateway Worker, one Supabase, one Redis**, with `FAILOVER_REGION` present only as a status string and no failover code ([14](14-risk-assessment.md)). The gateway monolith — including the ≈4,900-line `storefront.ts` — is the shared chokepoint for all external traffic ([11](11-architecture-violations.md)). Redis-backed rate limiting treats Redis as optional in code while the gateway `Env` marks it required, an inconsistency that affects degraded-mode behavior ([03](03-application-investigation.md)). Three Cloudflare queues have provisioned consumers but no producers ([07](07-integration.md)).

## 7. Build & developer-experience reliability

Workspace builds are Turbo/pnpm-orchestrated, but in this environment `pnpm install` could not complete cleanly (corepack EACCES, partial `node_modules`) and at least one app (`identity-platform`) fails typecheck; a prior in-repo audit corroborates typecheck/governance friction on developer machines ([14](14-risk-assessment.md)). Standalone `tsc --noEmit` for `webhook-service` and `queue-workers` fails due to tsconfig `paths` asymmetry versus api-gateway ([08](08-error-misconfiguration.md)). The repo's own stale-artifact validator exits non-zero on dev machines due to local build output and tracked root `.md` residue ([11](11-architecture-violations.md)).

## 8. The governance-vs-reality gap (the defining readiness risk)

The repository's self-assessment tooling reports health: **`node scripts/validate-governance.mjs` passes all 128 validators (exit 0)**, confirmed this investigation ([17](17-evidence-appendix.md)). That result is genuine for what it measures — manifest consistency, import boundaries, RLS coverage, secret hygiene, naming/topology rules. But it does **not** measure runtime behavior, test coverage, live telemetry, money movement, or end-to-end extensibility. Every Critical finding in [16](16-critical-findings-summary.md) coexists with a fully green governance run. For a readiness review, the operative caution is therefore:

> A passing governance/"production-certification" suite in this repository certifies *documents and structure*, not a *running, tested, observable production system*. The two should not be conflated.

---

### Evidence Index (this report)
- Deploy workflows, SLO/metric absence, SPOFs, migration push, partition lifecycle, secret/PSP positives — `FORENSIC_REPORT/14-risk-assessment.md`
- Service code-presence, test-script strings, base-URL defaults, MFA/OTP dev paths — `FORENSIC_REPORT/03-application-investigation.md`, `FORENSIC_REPORT/17-evidence-appendix.md`
- Gateway monolith size, CORS, error-message leakage, `@letbuyy/utils` admin client — `FORENSIC_REPORT/11-architecture-violations.md`
- Queue producer/consumer asymmetry, tsc paths asymmetry, internal-endpoint secret gap — `FORENSIC_REPORT/07-integration.md`, `FORENSIC_REPORT/08-error-misconfiguration.md`
- Table/RLS counts, migration sequence — `FORENSIC_REPORT/01-repository-inventory.md`
- `validate-governance.mjs` output (128 validators, exit 0) — captured live this investigation, logged in `FORENSIC_REPORT/17-evidence-appendix.md`
