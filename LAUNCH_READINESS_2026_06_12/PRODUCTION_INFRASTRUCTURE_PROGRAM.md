# DOCUMENT 4 — PRODUCTION INFRASTRUCTURE PROGRAM

**Scope:** Phase C. Everything here uses the providers already canonical in the tree (Supabase Postgres, Cloudflare Workers/Queues/Turnstile/DNS, Vercel hosting, Resend, Sentry-class observability per SKIP-W3, Razorpay rails). **No new infrastructure providers are introduced — that would be an architecture change (frozen).** One region, by Constitution.

## 1. PRODUCTION ENVIRONMENTS

| Env | Purpose | Source | Data |
|---|---|---|---|
| `production` | Real merchants | protected `main`, gated deploy workflow only | live DB, live providers |
| `staging` | Pre-prod verification, restore-drill target, canary origin | `main` (same SHA as prod candidate) | isolated project, masked/synthetic data, sandbox provider modes |
| `local/CI` | Gate + tests | any branch | fixtures + executable Postgres proofs (`tests/executable/`) |

Rules: production topology is exactly `config/runtime/production-topology.json` (3 deployed services + web runtimes); frozen apps have **no** environment anywhere (SKIP-D4 deletes their Vercel projects); reserved services never get an environment; environment-honesty validator remains the arbiter of declared-vs-real env.

## 2. SECRETS MANAGEMENT

1. **Inventory = the env contract.** Tracked env templates are the declared set (validator-checked). Production values live only in: Vercel project env, Cloudflare worker secrets, GitHub Actions environments (deploy-scoped), Supabase config. Never in git (gitignore already enforces `.env*`).
2. **Custody:** signing keys (identity JWKS, checkout signing, step-up TOTP/HMAC) are KMS-backed (HR-KMS-LIVE); `AUTH_SECRET` remains shared across 3 services until the recorded Wave-1 split — rotation still applies to it as one unit.
3. **Rotation:** SKIP-W4 dual-secret cutover pattern: introduce secondary, verify both-accepted, promote, retire primary, record evidence. Calendar: 90-day rotation for internal secrets, immediate on personnel/provider incident.
4. **Scope discipline:** per-service scoping as wired (e.g., `SUPABASE_SERVICE_ROLE_KEY` server-only — certified); deploy workflow gets only deploy-scoped tokens (SKIP-A4 secret scope step).

## 3. MONITORING & ALERTING

- **Error/exception:** observability project + DSN (SKIP-W3-SENTRY-DSN) with PII redaction proof before first event leaves the building.
- **Runtime alerts:** the repo-side alert bridge (`letbuyy.alert.runtime.error`, dry-run certified at `0f72fbe3`) goes live per CAP-C10: route → on-call channel; live-delivery certification = induced redacted test alert received end-to-end.
- **Money signals (non-negotiable pages):** reconciliation mismatch queue depth > 0 for > 24h; suspense balance unexplained; webhook signature failures; payout release failures; capture-without-ledger-entry detector.
- **Platform signals:** gateway 5xx rate, p95 latency, queue-worker lag/dead-letters, webhook-service delivery failure rate, branch-lag monitor (SKIP-A5), gate status on main.
- **Synthetic checks:** G4 smoke set re-run on schedule: storefront render, login, checkout session create, `/email/send` healthcheck (sandbox), mobile-bff proxy ping.

## 4. BACKUPS

| Asset | Mechanism | Evidence required |
|---|---|---|
| Postgres (the money truth) | Supabase PITR paid tier (SKIP-W0) + daily logical dump retained 30d | **Restore drill to staging with row-count + ledger-invariant verification** — drill is the deliverable, not the checkbox |
| Object storage (themes/media) | Provider versioning + lifecycle | sample-restore evidence |
| Repo + governance | origin (post-Phase A) + existing backup artifacts (ledger row 45) | quarterly readability check |
| Provider config (DNS, Vercel, CF) | Terraform single-zone file is DNS truth; export others to evidence dir | drift check vs console |

## 5. DISASTER RECOVERY (one-region doctrine)

Multi-region is constitutionally rejected; DR therefore means **restore, not failover**: RPO ≤ 5 min (PITR), RTO ≤ 4 h (restore + redeploy + DNS TTL). DR runbook (to live in `docs/runbooks/`): declare incident → freeze deploys → PITR restore to fresh project → repoint connection strings via env (no code change) → re-run G4 smoke → reconcile ledger vs provider for the gap window → incident ledger row. **Drill once before Phase F** with timing evidence. Provider-outage posture: Supabase down = full stop (status page honesty); Cloudflare degraded = queue backlog drains on recovery (idempotent consumers already required by design).

## 6. DEPLOYMENT PROCESS

`main` (protected, governance-gate required check) → production workflow: gate → tests → build → deploy → post-deploy smoke → ledger row. Rules: no manual console deploys; no deploy with red gate (hard CI dependency, closed in Phase A); migrations applied before code that needs them, each with tested rollback file (the `*_rollback.sql` convention already in tree); feature-flag flips are deploys (recorded, reversible); rollback = redeploy previous build + (only if unavoidable) paired rollback migration — ledger rows for both.

## 7. PRODUCTION READINESS CHECKLIST (sign before Phase D starts)

| # | Item | Evidence |
|---|---|---|
| 1 | origin == local converged reality; protection + required gate check on | remote SHAs, branch-protection screenshot |
| 2 | Deploy workflow runs gate and blocks on red | red-gate dry-run blocked CI link |
| 3 | All production secrets provisioned + scoped; rotation drill done | SKIP-PROVIDER-SECRETS, SKIP-W4 evidence |
| 4 | PITR on + restore drill passed with invariant check | SKIP-W0 drill record |
| 5 | DSN live, redaction proven; alert end-to-end test received | SKIP-W3, CAP-C10 evidence |
| 6 | Money pages configured (recon, suspense, webhook-sig, payout) | alert-rule export |
| 7 | DNS cutover complete incl. checkout host + signing secret | SKIP-PROD-DNS-CUTOVER, D6 smoke |
| 8 | Live tenancy probes green (anon-grant, FORCE-RLS, RT-1…9) | SKIP-D2/D4, CAP-C11 outputs |
| 9 | DR runbook written + drill timed within RTO/RPO | drill record |
| 10 | Frozen-app Vercel projects deleted/disabled | SKIP-D4 console evidence |
| 11 | Branch-lag monitor + synthetic smoke schedule live | SKIP-A5, scheduler config |
| 12 | Step-up live cert (CAP-C06); mobile Turnstile live (CAP-C09) | cert evidence |

All 12 EVIDENCED = infrastructure GO. Any row open = Phase D does not start.
