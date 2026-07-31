# LCOS Deployment Discovery

**Phase:** 6 — LCOS Forensic Discovery  
**Mode:** READ-ONLY  
**Generated:** 2026-06-21  
**Source:** `graphify-out/deployment-intelligence-v5.json`, `deployment-state.json`, `.github/workflows/` (verified), `infrastructure/scripts/deploy/`.  
**Honesty contract:** Repository-declared state (HEAD commit, migration number, workflow files, script presence) is CONNECTED. Live deployed versions (actual Cloudflare worker version, Vercel build id, last-applied production migration) are NOT_CONNECTED — they require the respective provider APIs.

---

## 1. Declared Repository State

| Field | Value | Source |
|-------|-------|--------|
| HEAD commit | `4a91fa96` | `deployment-state.json` |
| Branch | `stepup/main` | `deployment-state.json` |
| Last tag | `convergence-cabe148c` | `deployment-state.json` |
| HEAD subject | `lcis(v5): live operating intelligence — runtime obs, merchant/revenue/security, readiness scoring, AI decision engine` | `deployment-state.json` |
| Latest migration | `#174 — 174_v1_gift_card_refund_restore.sql` | `deployment-state.json` |
| Total migrations | 103 | `deployment-state.json` |
| Migrate gate | ON (migrate-production runs before worker/app deploy) | `deployment-intelligence-v5.json` |

**Note:** The `deployment-intelligence-v5.json` was generated 2026-06-14; the current session's git status shows HEAD as `742192cf` on branch `stepup/main`. There is a **HEAD delta** between the artifact (generated 2026-06-14) and the live working tree (2026-06-21). The live deployed version in production may differ further — requires Cloudflare + Vercel API to confirm.

---

## 2. Deploy Targets

### 2.1 Cloudflare Workers (4)
| Worker | Name | Routes | Deploy gate |
|--------|------|--------|-------------|
| `services/api-gateway` | `letbuyy-api` | api.letbuyy.com, api-staging.*, api.staging.* | migrate-production + validate-governance |
| `services/queue-workers` | `letbuyy-queue-workers` | _(none — queue consumer only)_ | same |
| `services/webhook-service` | `letbuyy-webhook` | webhooks.letbuyy.com, webhooks-staging.*, webhooks.staging.* | same |
| `services/mobile-bff` | `letbuyy-mobile-bff` | bff.letbuyy.com, bff-staging.*, bff.staging.* | same |

### 2.2 Vercel Apps (5)
| App | Subdomain / purpose |
|-----|---------------------|
| `apps/marketing-site` | www.letbuyy.com (marketing) |
| `apps/identity-platform` | identity / auth flows |
| `apps/merchant-control-plane` | merchant admin UI |
| `apps/storefront-runtime` | `{store}.letbuyy.com` + custom domains |
| `apps/platform-console` | platform operations portal |

### 2.3 Secrets Required (19)
All 19 must be present (`wrangler secret put`) or the worker deploy fails closed:

```
SUPABASE_URL                    SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY       AUTH_SECRET
CSRF_SECRET                     CUSTOMER_SESSION_SECRET
STEP_UP_SIGNING_SECRET          LETBUYY_IDENTITY_PUBLIC_JWKS
CHECKOUT_SIGNING_SECRET         TURNSTILE_SECRET_KEY
INTERNAL_API_SECRET             LETBUYY_INTERNAL_API_SECRET
INTERNAL_API_KEYRING            QUEUE_TENANT_ENVELOPE_SECRET
PLATFORM_CONSOLE_API_TOKEN      UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN        RESEND_API_KEY
PAYMENT_CONFIG_ENCRYPTION_KEY
```

---

## 3. CI/CD Workflows — All 16 Files

`deployment-intelligence-v5.json` lists 15. Repo audit found **16 files** — `lcis-pr-analysis.yml` is the additional file (read-only PR analysis, no deploy side effects).

| # | Workflow File | Deploys Workers | Deploys Vercel | Runs Migrations | Triggers | Gates |
|---|--------------|:-:|:-:|:-:|----------|-------|
| 1 | `architecture-governance.yml` | ✗ | ✓ | ✗ | PR, push | validate-governance, rollback |
| 2 | `branch-lag-monitor.yml` | ✗ | ✗ | ✗ | schedule, dispatch | branch-lag |
| 3 | `ci.yml` | ✗ | ✗ | ✗ | PR, push | _(none)_ |
| 4 | `deploy-staging.yml` | ✓ | ✓ | ✓ | push, dispatch | validate-governance |
| 5 | `environment-lifecycle.yml` | ✗ | ✗ | ✗ | PR, dispatch | _(none)_ |
| 6 | `full-security-audit.yml` | ✗ | ✗ | ✗ | schedule, dispatch | _(none)_ |
| 7 | `graph-intelligence.yml` | ✗ | ✗ | ✓ | push, PR, dispatch | validate-governance |
| 8 | `hot-table-partition-maintenance.yml` | ✗ | ✗ | ✗ | schedule, dispatch | _(none)_ |
| 9 | `lcis-pr-analysis.yml` | ✗ | ✗ | ✗ | PR (opened/sync/reopened) | _(none — read-only)_ |
| 10 | `live-production-certification.yml` | ✗ | ✗ | ✗ | dispatch | rollback |
| 11 | `mobile-merchant-release.yml` | ✗ | ✗ | ✗ | dispatch | _(none)_ |
| 12 | `production-deploy.yml` | ✓ | ✓ | ✓ | push, dispatch | **branch-lag + validate-governance + migrate-production** |
| 13 | `production-rollout.yml` | ✗ | ✓ | ✓ | dispatch | validate-governance, rollback |
| 14 | `security-review.yml` | ✗ | ✗ | ✗ | PR | validate-governance |
| 15 | `staging-deploy.yml` | ✓ | ✓ | ✓ | dispatch | _(none)_ |
| 16 | `staging-runtime-deployment.yml` | ✗ | ✗ | ✗ | dispatch, push | _(none)_ |

**Workflows that deploy to production:**
- `production-deploy.yml` — the primary production pipeline (all gates active)
- `production-rollout.yml` — Vercel + migrations only (no worker deploy; used for app-only rollouts)

**Workflows that run migrations:**
- `deploy-staging.yml`, `graph-intelligence.yml`, `production-deploy.yml`, `production-rollout.yml`, `staging-deploy.yml` (5 total)

---

## 4. Deployment Pipeline Order

```
production-deploy.yml execution order:
  1. branch-lag-guard         ← blocks if branch is behind main
  2. validate-governance      ← runs node scripts/validate-governance.mjs (107 validators)
  3. migrate-production       ← Supabase DB push --include-all (gated; does NOT apply automatically)
  4. deploy-workers-production ← wrangler deploy (all 4 workers)
  5. deploy-apps (Vercel)     ← 5 Vercel apps
```

**Key property:** `migrateGate: true`, `appliesMigrations: false` — the gate blocks the pipeline if the migration step fails, but the step itself does NOT auto-apply in CI without explicit approval flow. This is the fail-closed migration pattern (D-3 SPOF mitigation).

---

## 5. Single Points of Failure (3 declared)

### D-1: Single Pipeline
**Kind:** single-pipeline  
**Detail:** One `production-deploy.yml` deploys all 4 workers + 5 Vercel apps. A pipeline failure (any gate, any step) blocks the whole platform release.  
**Mitigation:** migrate-production gate + branch-lag-guard + forward-fix-only migrations.  
**Observation:** No per-worker or per-app partial deploy mechanism exists at the workflow level. A failing test in one worker blocks all others.

### D-2: Shared Datastore
**Kind:** shared-datastore  
**Detail:** Single Supabase Postgres instance behind one Hyperdrive binding for all tenants. The DB is the platform SPOF.  
**Mitigation:** RLS per-tenant + connection pooling (Hyperdrive) + read scale via projections (651 policies, 826 indexes).  
**Observation:** No read replica or failover DB is declared. A Supabase region outage affects all 22 domains simultaneously.

### D-3: Migrate-Before-Deploy
**Kind:** migrate-before-deploy  
**Detail:** `migrate-production` runs before worker/app deploy. A failed migration blocks the entire release (fail-closed by design).  
**Mitigation:** forward-compatible migrations; rollback is forward-fix, never down-migrate (103 migrations, none with a `down` script).  
**Observation:** This SPOF is intentional and documented. The risk is a long-running migration on a large table blocking a production release window.

---

## 6. Rollback Posture

### Scripts (all present — CONNECTED)
| Script | Path | Purpose |
|--------|------|---------|
| `production-rollback.mjs` | `infrastructure/scripts/deploy/production-rollback.mjs` | Primary rollback orchestrator |
| `production-deploy.mjs` | `infrastructure/scripts/deploy/production-deploy.mjs` | Deploy script (re-deploy for rollback) |
| `deploy-worker-runtime.mjs` | `infrastructure/scripts/deploy/deploy-worker-runtime.mjs` | Per-worker deploy |
| `verify-health-gates.mjs` | `infrastructure/scripts/deploy/verify-health-gates.mjs` | Post-deploy health verification |

**Missing rollback scripts:** 0 (all expected scripts present)  
**Missing down-migrations:** by design (forward-only policy)  
**Rollback invocation:** triggered by `production-rollback.yml` (dispatch); also referenced as a gate in `architecture-governance.yml` and `live-production-certification.yml`.

### Rollback Strategy
- Worker rollback: re-deploy previous worker version via `deploy-worker-runtime.mjs`
- Vercel rollback: Vercel instant rollback via Vercel dashboard / API (not scripted in repo — platform-native)
- DB rollback: forward-fix migration only (no `down` scripts exist in the 103 migrations)

---

## 7. Subdomains / Release Topology (6 declared)

| Subdomain Pattern | App / Service | Deploy via |
|-------------------|--------------|-----------|
| `{store}.letbuyy.com` + custom domains | `apps/storefront-runtime` | Vercel + `proxy.ts` host routing middleware |
| Merchant / app console | `apps/merchant-control-plane` | Vercel |
| Identity / auth | `apps/identity-platform` | Vercel |
| Platform ops | `apps/platform-console` | Vercel |
| Marketing (www) | `apps/marketing-site` | Vercel |
| API gateway (`/v1`) | `services/api-gateway` | Cloudflare Worker (`letbuyy-api`) |
| Webhooks | `services/webhook-service` | Cloudflare Worker (`letbuyy-webhook`) |
| Mobile BFF | `services/mobile-bff` | Cloudflare Worker (`letbuyy-mobile-bff`) |

**Note:** The subdomains table counts 6 groups but covers 8 distinct services when workers are split out. `bff.letbuyy.com` and `webhooks.letbuyy.com` are Cloudflare Worker routes, not in the Vercel subdomain list.

---

## 8. Live Deploy State vs Repository-Declared State

| Field | Repository Declared | Live Value | Status |
|-------|--------------------|-----------|----|
| HEAD commit | `4a91fa96` (artifact 2026-06-14) / `742192cf` (current git) | Unknown | NOT_CONNECTED |
| Deployed worker version (Cloudflare) | Mapped from HEAD | Unknown — requires CF API | NOT_CONNECTED |
| Vercel build id | Mapped from HEAD | Unknown — requires Vercel API | NOT_CONNECTED |
| Latest applied migration (production) | #174 (artifact 2026-06-14) | Unknown — requires Supabase API | NOT_CONNECTED |
| Latest applied migration (staging) | #174 (artifact 2026-06-14) | Unknown | NOT_CONNECTED |
| Branch lag (stepup/main vs main) | Unknown | Unknown — requires `git fetch` + branch-lag-monitor | NOT_CONNECTED |

**Canary state:** No canary deployment mechanism is declared in any workflow. `production-deploy.yml` deploys all workers simultaneously (blue-green via Cloudflare's native worker versioning, not staged canary). Canary state = **none declared**.

---

## 9. Artifact vs Real-Time Delta

The `deployment-intelligence-v5.json` was generated `2026-06-14T05:53:50Z`. The repo has advanced since then (current git HEAD is `742192cf`, with commits through 2026-06-21 per recent activity). The following items in the artifact may be stale:

| Item | Artifact value | Stale risk |
|------|---------------|-----------|
| HEAD commit | `4a91fa96` | HIGH — 7 days of commits |
| Total migrations | 103 | MEDIUM — migrations may have been added |
| Latest migration | #174 | MEDIUM |
| Open blockers count | 5 | MEDIUM — blockers may have been resolved |
| Generated workflow list | 15 (missing `lcis-pr-analysis.yml`) | LOW — the file exists and is read-only |

Refresh with: `pnpm graph:omega` or specifically `pnpm graph:infra` to regenerate `deployment-intelligence-v5.json` and `deployment-state.json`.

---

## 10. LCIS Reuse Points for Deployment

| Need | Reuse target |
|------|-------------|
| Read deployment topology and workflow list | `lcis-core` → `ArtifactStore.load('deployment-intelligence-v5.json')` |
| Compare repo HEAD vs live worker version | `lcis-live` → `DeploymentAdapter` (CF API token binding) |
| Check migration applied in production | `lcis-live` → `SupabaseAdapter` (service role binding) |
| Blast radius before a deploy | `lcis-core` → `BlastRadiusService` → `/api/blast?q=<symbol>` |
| Governance gate compliance | `lcis-governance` → `GovernanceComplianceEngine` (R001–R008) |
| Change impact planning before deploy | `lcis-execution` → `ChangeIntelligence` → `/api/change-impact?key=X` |
| Rollback plan generation | `lcis-execution` → `ExecutionEngine` (plans only — never executes) |
