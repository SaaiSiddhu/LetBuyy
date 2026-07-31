# LCOS Incident Discovery

**LetBuyy Commerce Operating System — Incident Intelligence Layer**

Generated: 2026-06-21
Source files: `graphify-out/incident-intelligence-v5.json`, `graphify-out/runbooks.json`,
`graphify-out/production-readiness-v2.json`, `graphify-out/runtime-intel.json`

LCOS is READ-ONLY. This document maps what is observable and detectable from the structural
intelligence layer. It never initiates remediation.

---

## 1. Runbook Inventory (22 domains)

`runbooks.json` contains exactly 22 domain runbooks, generated at `2026-06-14T05:53:49Z`.
Every runbook has the same five-section structure:
`detection` → `diagnosis` → `recovery` → `rollback` → `verification`.

The `summary.note` in the file states: _"Detection signals name the live source (NOT CONNECTED
until wired)."_ This applies to every signal in the table below.

| Domain | Trigger (Structural) | Live Signal Source | Detection Method | Connectivity |
|--------|---------------------|--------------------|------------------|--------------|
| `themes` | 5xx on routes: `themes` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for RUNTIME_QUEUE, EVENT_QUEUE | NOT_CONNECTED |
| `marketplace` | 5xx on routes: `app-store/app-lifecycle-routes`, `app-store/billing-oauth-routes`, `app-store/compliance-routes` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `developer` | 5xx on routes: `app-api`, `internal-console/developers`, `operations/developers` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `gift-cards` | `ledger_balance_breaks() > 0`; failed/abandoned ratio on `payment_transactions` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `refunds` | `ledger_balance_breaks() > 0`; failed/abandoned ratio on `payment_transactions` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `payouts` | `ledger_balance_breaks() > 0`; failed/abandoned ratio on `payment_transactions` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `payments` | `ledger_balance_breaks() > 0`; failed/abandoned ratio on `payment_transactions` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `gst` | 5xx on routes: `tax` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `discounts` | 5xx on routes: `coupons`, `marketing` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `shipping` | `ledger_balance_breaks() > 0`; failed/abandoned ratio on `payment_transactions` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `inventory` | `ledger_balance_breaks() > 0`; failed/abandoned ratio on `payment_transactions` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `collections` | 5xx on routes: `categories` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for SEARCH_QUEUE, EVENT_QUEUE | NOT_CONNECTED |
| `products` | 5xx on routes: `metafields`, `products` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for SEARCH_QUEUE, EVENT_QUEUE | NOT_CONNECTED |
| `orders` | `ledger_balance_breaks() > 0`; failed/abandoned ratio on `payment_transactions` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for RUNTIME_QUEUE, EVENT_QUEUE | NOT_CONNECTED |
| `storefront` | 5xx on routes: `blog`, `contacts`, `custom-domains` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for RUNTIME_QUEUE, SEARCH_QUEUE, EVENT_QUEUE | NOT_CONNECTED |
| `authorization` | 5xx on routes: `operations/rbac`, `two-factor` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `authentication` | 5xx on routes: `auth` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `identity` | 5xx on routes: `customers`, `kyc` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `merchant` | 5xx on routes: `billing`, `employee`, `internal-billing` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |
| `notifications` | 5xx on routes: `email`, `notifications`, `whatsapp` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for NOTIFICATION_QUEUE, EVENT_QUEUE | NOT_CONNECTED |
| `analytics` | 5xx on routes: `analytics`, `export`, `internal-events` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for ANALYTICS_QUEUE, EVENT_QUEUE | NOT_CONNECTED |
| `operations` | `ledger_balance_breaks() > 0`; failed/abandoned ratio on `payment_transactions` | Cloudflare Analytics Engine + Supabase | RUNTIME_TELEMETRY error rate / latency; queue depth + DLQ for EVENT_QUEUE | NOT_CONNECTED |

### Five-section structure (uniform across all 22 runbooks)

Every runbook contains exactly these five sections, in this order:

1. **detection** — named live signals (route 5xx, error rate/latency on worker, queue depth + DLQ).
   Source field: `Cloudflare Analytics Engine + Supabase (NOT CONNECTED until an environment is wired — see /api/live)`.
2. **diagnosis** — structural chain `Incident → Route → RPC → Table → Queue → Worker → Owner`.
   Queries: `/api/incident-intelligence?domain=<key>` and `/api/diagnose?target=<key>`.
3. **recovery** — 2–3 ordered steps (pause route via feature flag; optionally reconcile ledger
   before retrying for money domains; replay DLQ; clear CACHE binding if stale).
4. **rollback** — single command:
   `node infrastructure/scripts/deploy/production-rollback.mjs --worker letbuyy-api --version-id <approved-prior> --reason "<incident>"`.
   Gate: `verify-health-gates.mjs`. Policy: fail-closed; migrations forward-fix-only (never down-migrate).
5. **verification** — governance gate 107/107; domain-specific health assertion (ledger clean or
   route 2xx + queue drained); blast-radius re-check at `/api/change-impact?key=<domain>`.

---

## 2. Incident Intelligence Model

### Source file

`graphify-out/incident-intelligence-v5.json` contains **one illustrative record** for the
`payments` domain. There is no array of historical incidents — the file is a structural model, not
a live incident log.

### Record schema (from the payments example)

Top-level fields present in the file:

| Field | Value (payments example) | Detectable? |
|-------|--------------------------|-------------|
| `example` | `"payments"` | DETECTABLE (structural label) |
| `target` | `"payments"` | DETECTABLE |
| `domain` | `"payments"` | DETECTABLE |
| `label` | `"Payments"` | DETECTABLE |
| `rollbackPolicy` | `"fail-closed (rollback-integrity-validator); migrations are forward-fix-only (never down-migrate)"` | DETECTABLE |

### `answers` sub-object

| Field | Value (payments example) | Detectable? |
|-------|--------------------------|-------------|
| `whatFailed` | `"money/ledger table"` | DETECTABLE (structural category) |
| `whoIsAffected` | `["@saai-sidd"]` | DETECTABLE (owner from CODEOWNERS) |
| `whichMerchants` | `"ALL tenants — shared multi-tenant schema; tenant isolation is RLS + verifySiteOwnership, not physical separation"` | DETECTABLE (schema topology) |
| `whichTables` | 11 tables (see §3) | DETECTABLE (from db-intel.json) |
| `whichRpcs` | 18 RPCs (see §3) | DETECTABLE (from db-intel.json) |
| `whichQueues` | `["EVENT_QUEUE"]` | DETECTABLE (wrangler.toml) |
| `whichWorkers` | `["letbuyy-api","letbuyy-queue-workers","letbuyy-webhook"]` | DETECTABLE (wrangler.toml) |
| `whichDeployments.worker` | `"letbuyy-api"` | DETECTABLE |
| `whichDeployments.head` | `"4a91fa96"` | PARTIAL — git SHA at graph-generation time; live HEAD requires `git rev-parse HEAD` or Cloudflare deploy API |
| `whichDeployments.branch` | `"stepup/main"` | PARTIAL — captured at generation time; live branch from `git branch --show-current` |
| `whichDeployments.latestMigration` | `"174_v1_gift_card_refund_restore.sql"` | PARTIAL — file-name is DETECTABLE; whether it is applied in production requires Supabase migration history |
| `whatRollback` | rollback command string | DETECTABLE (script exists at path) |
| `whatOwner` | `["@saai-sidd"]` | DETECTABLE (CODEOWNERS) |

### What is DETECTABLE structurally

- Domain → affected tables → affected RPCs mapping (from `db-intel.json`)
- Domain → affected queues mapping (from `wrangler.toml` via `runtime-intel.json`)
- Domain → worker assignment
- Rollback command (script path + worker name)
- Owner (CODEOWNERS)
- Tenant scope: always ALL tenants (shared schema, physical isolation is RLS)
- Rollback policy text

### What requires live records (NOT_CONNECTED)

| Data point | Source (exact) |
|------------|----------------|
| Active incident records (start time, duration, severity) | NOT_CONNECTED — no incident table exists in the repo; source would be a live incident tracker (e.g., PagerDuty, a `site_incidents` table, or an ops channel) |
| Current git HEAD / deployed version | NOT_CONNECTED — Cloudflare deploy API (`/accounts/:id/workers/scripts/:name/deployments`) or `wrangler deployments list` |
| Whether migration `174_v1_gift_card_refund_restore.sql` is applied in production | NOT_CONNECTED — Supabase migration history table (`supabase_migrations.schema_migrations`) queried via service-role key |
| `ledger_balance_breaks()` return value | NOT_CONNECTED — Supabase RPC call; requires `SUPABASE_SERVICE_ROLE_KEY` |
| `failed/abandoned ratio on payment_transactions` | NOT_CONNECTED — Supabase table query; requires `SUPABASE_SERVICE_ROLE_KEY` |

---

## 3. Blast-Radius Links

### How blast links connect incidents to domains and merchants

The `blastRadius` object in `incident-intelligence-v5.json` (payments example) contains:

```json
{
  "domains": 11,
  "affected": [
    "refunds", "operations", "orders", "authentication", "notifications",
    "analytics", "payouts", "inventory", "shipping", "themes", "storefront"
  ],
  "layers": [3, 6, 2],
  "routes": 49,
  "rpcs": 103,
  "tables": 205
}
```

The structure expresses: a failure in `payments` propagates to **11 downstream domains** across
**3 graph layers**, touching **49 routes**, **103 RPCs**, and **205 tables**. Because all tenants
share a single schema with RLS isolation, a payments failure is cross-tenant by default.

### Top critical service by structural blast radius (from the JSON, real numbers)

| Domain | Affected Domains | Routes Reachable | RPCs Reachable | Tables Reachable |
|--------|-----------------|-----------------|---------------|-----------------|
| `payments` | 11 | 49 | 103 | 205 |

No other domain has a `blastRadius` record in `incident-intelligence-v5.json`. The file contains
only the `payments` template. For other domains, blast radius must be queried at runtime via
`/api/blast?q=<domain>` or `pnpm graph:intel blast "<symbol>"`.

The CLAUDE.md lists the highest-blast-radius symbols across the entire codebase:
- `getSupabaseAdmin` — **115 files**
- `@letbuyy/shared-types`
- `@letbuyy/api-client`
- `create_checkout_order`

These are not in `incident-intelligence-v5.json` directly; they are from the code graph
(`graph.json`).

### Reuse: BlastRadiusService in lcis-core

Do not reimplement blast radius computation. Use:

```
packages/lcis-core/src/blast-radius/
```

`BlastRadiusService` in `@letbuyy/lcis-core` computes blast radius from the structural graph.
Call it with a domain key or symbol name to get affected domains, routes, RPCs, and tables.
LCOS should call `BlastRadiusService` when surfacing the blast impact of a new incident
observation — it must not replicate the traversal logic.

---

## 4. Outage Patterns

### Structural patterns derivable from runbooks + production-readiness blockers

**Pattern 1 — Ledger-money domain failure (payments / refunds / payouts / gift-cards / shipping / inventory / orders / operations)**

8 of 22 domains follow the money-domain runbook pattern. Detection signal is the same across
all eight: `ledger_balance_breaks() > 0` or `failed/abandoned ratio on payment_transactions`.
Recovery is also identical: do NOT retry money mutations until reconciled; run
`refresh_money_ledger_site_reconciliation` / `ledger_balance_breaks` first, then replay DLQ.
This pattern reflects the canonical-ledger-only invariant enforced by the SECURITY DEFINER RPCs.

**Pattern 2 — Route 5xx domain failure (themes / marketplace / developer / gst / discounts / collections / products / storefront / authorization / authentication / identity / merchant / notifications / analytics)**

14 of 22 domains follow the route-error pattern. Detection is a 5xx on specific named routes.
Recovery is generic: pause affected route via feature flag, replay DLQ, clear CACHE binding.
No ledger reconciliation required.

**Pattern 3 — Search-queue involvement (collections / products / storefront)**

3 domains include `SEARCH_QUEUE` in their detection signals, in addition to `EVENT_QUEUE`. This
indicates these domains have search-index side effects on writes and outages in the search queue
path can manifest even when the primary route is healthy.

**Pattern 4 — Multi-queue storefront**

`storefront` is the only domain that names three queues in its detection signals:
`RUNTIME_QUEUE`, `SEARCH_QUEUE`, `EVENT_QUEUE`. It is structurally the highest queue-surface
domain among non-money domains.

**Production-readiness open blockers (from production-readiness-v2.json)**

`summary.openBlockers = 5`. The only named blocker present in the systems array is:

| Blocker ID | Affected Systems | Score Impact |
|------------|-----------------|-------------|
| `LB-7` | `shipping` (score 92, −8), `gst` (score 89, −8) | −8 pts each |

No blocker IDs are listed for: payments (score 88), merchant app (score 88). The lower scores
for those systems come from `candidate` RLS gaps (4 tenant tables without detected RLS for
payments; 4 for merchant) — these are validator-candidates, not confirmed violations.

**Systems at structural risk (from production-readiness-v2.json)**

| System | Score | Primary Gap |
|--------|-------|-------------|
| Merchant App | 88 | 4 tenant tables w/o detected RLS (candidate) |
| Payments | 88 | 4 tenant tables w/o detected RLS (candidate) |
| GST | 89 | 1 tenant table w/o detected RLS (candidate); blocker LB-7 |
| Security | 90 | 20 tenant tables w/o detected RLS (candidate) |
| Identity | 97 | 1 tenant table w/o detected RLS (candidate) |

All scores below 100 are candidates only — the 107-validator gate is the authoritative
drift detector.

### Queue and worker capacity constraints (from runtime-intel.json, real values)

**Workers: 4 total**

| Worker | Routes | Cron | Queue Role | Observability | RUNTIME_TELEMETRY |
|--------|--------|------|-----------|--------------|-------------------|
| `letbuyy-api` | `api-staging.letbuyy.com`, `api.staging.letbuyy.com`, `api.letbuyy.com` | `*/15 * * * *` | Producer (5 queues) | true | true |
| `letbuyy-queue-workers` | none | `17 */6 * * *` | Consumer (7 queue bindings) | true | true |
| `letbuyy-webhook` | `webhooks-staging.letbuyy.com`, `webhooks.staging.letbuyy.com`, `webhooks.letbuyy.com` | none | none | true | true |
| `letbuyy-mobile-bff` | `bff-staging.letbuyy.com`, `bff.staging.letbuyy.com`, `bff.letbuyy.com` | none | none | true | true |

**Queues: 5 named queues (single producer: `letbuyy-api`; single consumer: `letbuyy-queue-workers`)**

| Queue | Producer | Consumer | Domain Usage |
|-------|---------|---------|-------------|
| `EVENT_QUEUE` | `letbuyy-api` | `letbuyy-queue-workers` | All 22 domains |
| `ANALYTICS_QUEUE` | `letbuyy-api` | `letbuyy-queue-workers` | analytics domain |
| `SEARCH_QUEUE` | `letbuyy-api` | `letbuyy-queue-workers` | collections, products, storefront |
| `NOTIFICATION_QUEUE` | `letbuyy-api` | `letbuyy-queue-workers` | notifications domain |
| `RUNTIME_QUEUE` | `letbuyy-api` | `letbuyy-queue-workers` | themes, orders, storefront |

**Single-consumer SPOF**: `letbuyy-queue-workers` is the only consumer for all 5 queues. A failure
of this single worker backs up all queues simultaneously. The 7 consumer-side queue bindings in
`wrangler.toml` include explicit dead-letter queues: `letbuyy-dead-letters-staging` and
`letbuyy-staging-dead-letter-queue`.

**Infrastructure SPOF noted**: `production-readiness-v2.json` → `infra:deploy` evidence: _"single pipeline = SPOF (mitigated by gates)"_.

### NOT_CONNECTED: live metrics (exact source per metric)

| Metric | Source (exact) |
|--------|---------------|
| Worker error rate | NOT_CONNECTED — Cloudflare Analytics Engine, dataset `RUNTIME_TELEMETRY`; query via `wrangler tail letbuyy-api` or Analytics Engine SQL |
| Worker latency (p50/p95/p99) | NOT_CONNECTED — Cloudflare Analytics Engine, dataset `RUNTIME_TELEMETRY` |
| Queue depth (messages pending) | NOT_CONNECTED — Cloudflare Queues API (`GET /accounts/:id/queues/:name/messages`) or `wrangler queues list` |
| DLQ message count | NOT_CONNECTED — Cloudflare Queues API for `letbuyy-dead-letters-staging` / `letbuyy-staging-dead-letter-queue` |
| Cron execution result (`*/15 * * * *`) | NOT_CONNECTED — Cloudflare Workers Cron Triggers API or `wrangler tail letbuyy-api` |
| `ledger_balance_breaks()` | NOT_CONNECTED — Supabase RPC; requires `SUPABASE_SERVICE_ROLE_KEY` |
| `payment_transactions` failed/abandoned ratio | NOT_CONNECTED — Supabase table query; requires `SUPABASE_SERVICE_ROLE_KEY` |
| Hyperdrive connection pool utilization | NOT_CONNECTED — Cloudflare Hyperdrive metrics (only available on `letbuyy-api`) |
| R2 storage utilization | NOT_CONNECTED — Cloudflare R2 API (only `R2_BUCKET` on `letbuyy-api`) |

---

## 5. Recovery Intelligence

### Recovery steps mapped from runbooks (structural)

Two distinct recovery protocols exist across the 22 domains:

**Protocol A — Money domains** (payments, refunds, payouts, gift-cards, shipping, inventory, orders, operations)

1. Pause the affected route via feature flag (`operational_feature_flags` table).
2. DO NOT retry money mutations until reconciled — run `refresh_money_ledger_site_reconciliation`
   then verify `ledger_balance_breaks()` returns 0.
3. Replay failed queue jobs from the DLQ after reconciliation.

**Protocol B — Non-money domains** (themes, marketplace, developer, gst, discounts, collections, products, storefront, authorization, authentication, identity, merchant, notifications, analytics)

1. Pause the affected route via feature flag.
2. Replay failed queue jobs from the DLQ.
3. Clear the relevant cache (CACHE binding) if stale.

**Rollback command (uniform across all 22 domains)**

```bash
node infrastructure/scripts/deploy/production-rollback.mjs \
  --worker letbuyy-api \
  --version-id <approved-prior> \
  --reason "<incident>"
```

Gate that must pass before rollback: `verify-health-gates.mjs`
Policy: fail-closed (`rollback-integrity-validator`); migrations are forward-fix-only (never down-migrate).

**Verification (uniform)**

1. Governance gate: 107/107 validators green.
2. Domain-specific assertion (ledger clean OR route 2xx + queue drained).
3. Blast-radius re-check: `/api/change-impact?key=<domain>`.

### Reuse: RollbackIntelligence in lcis-execution

Do not reimplement rollback logic or version resolution. Use:

```
packages/lcis-execution/src/rollback/
```

`RollbackIntelligence` in `@letbuyy/lcis-execution` encapsulates:
- Rollback command construction (`--worker`, `--version-id`, `--reason` parameter building)
- Gate sequencing (`verify-health-gates.mjs` must precede deployment rollback)
- Migration forward-fix-only policy enforcement (blocks down-migration attempts)
- Post-rollback verification steps

LCOS should call `RollbackIntelligence` to surface recovery plans in the observation layer.
It must not embed the rollback command string directly or replicate gate sequencing.

### NOT_CONNECTED: live deploy state and rollback targets

| Data point | Source (exact) |
|------------|---------------|
| Current deployed version ID (`--version-id` value) | NOT_CONNECTED — Cloudflare Workers API: `GET /accounts/:id/workers/scripts/letbuyy-api/deployments`; env var `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` required |
| Previous approved version ID (the rollback target) | NOT_CONNECTED — same Cloudflare deployments API; requires human approval of version ID before passing to rollback script |
| Whether `verify-health-gates.mjs` currently passes | NOT_CONNECTED — must be executed in CI or locally; output is a pass/fail exit code |
| Current migration state in production | NOT_CONNECTED — Supabase migration history (`supabase_migrations.schema_migrations`); requires `SUPABASE_SERVICE_ROLE_KEY` |
| Whether `ledger_balance_breaks()` is currently 0 post-rollback | NOT_CONNECTED — Supabase RPC call; requires `SUPABASE_SERVICE_ROLE_KEY` |

---

## 6. Connectivity Table

| Data Point | Status | Source |
|------------|--------|--------|
| Domain runbook structure (22 domains, 5 sections each) | DETECTABLE | `graphify-out/runbooks.json` |
| Recovery protocol per domain (money vs. non-money) | DETECTABLE | `graphify-out/runbooks.json` → `recovery` array |
| Rollback command string | DETECTABLE | `graphify-out/runbooks.json` → `rollback.command`; script at `infrastructure/scripts/deploy/production-rollback.mjs` |
| Rollback gate (`verify-health-gates.mjs`) | DETECTABLE | `graphify-out/runbooks.json` → `rollback.gateBefore` |
| Rollback migration policy (forward-fix-only) | DETECTABLE | `graphify-out/runbooks.json` → `rollback.policy` |
| Blast radius: payments domain (11 domains, 49 routes, 103 RPCs, 205 tables) | DETECTABLE | `graphify-out/incident-intelligence-v5.json` → `blastRadius` |
| Affected tables for payments incident (11 tables) | DETECTABLE | `graphify-out/incident-intelligence-v5.json` → `answers.whichTables` |
| Affected RPCs for payments incident (18 RPCs) | DETECTABLE | `graphify-out/incident-intelligence-v5.json` → `answers.whichRpcs` |
| Queue topology (5 queues, producers, consumers) | DETECTABLE | `graphify-out/runtime-intel.json` → `queueGraph` |
| Worker declarations (4 workers, routes, crons) | DETECTABLE | `graphify-out/runtime-intel.json` → `workers` |
| Cron schedules (`*/15 * * * *`, `17 */6 * * *`) | DETECTABLE | `graphify-out/runtime-intel.json` → `summary.crons` |
| Production-readiness scores (18 systems) | DETECTABLE | `graphify-out/production-readiness-v2.json` → `systems` |
| Open blockers (`LB-7` affecting shipping + GST) | DETECTABLE | `graphify-out/production-readiness-v2.json` → `systems[*].blockers` |
| Overall launch verdict (NO-GO, 5 open blockers) | DETECTABLE | `graphify-out/production-readiness-v2.json` → `summary` |
| Domain owner (all 22 domains owned by `@saai-sidd`) | DETECTABLE | `graphify-out/runbooks.json` → `<domain>.owner` |
| Tenant scope for any incident | DETECTABLE | `graphify-out/incident-intelligence-v5.json` → `answers.whichMerchants` (ALL tenants, shared schema) |
| Deployed git HEAD (`4a91fa96`) | PARTIAL | Captured at `2026-06-14T05:53:49Z` graph-generation time; live HEAD: `git rev-parse HEAD` or Cloudflare deployments API |
| Whether migration 174 is applied in production | PARTIAL | File name DETECTABLE from `incident-intelligence-v5.json`; live application state: NOT_CONNECTED — Supabase `supabase_migrations.schema_migrations` via `SUPABASE_SERVICE_ROLE_KEY` |
| Incident records (historical log) | NOT_CONNECTED | No incident table in the repo; source: external incident tracker or `site_incidents` table (not observed in schema) |
| Live error rates per worker | NOT_CONNECTED | Cloudflare Analytics Engine, dataset `RUNTIME_TELEMETRY` (env var: `RUNTIME_TELEMETRY` binding declared in `wrangler.toml`) |
| Live latency per worker (p50/p95/p99) | NOT_CONNECTED | Cloudflare Analytics Engine, dataset `RUNTIME_TELEMETRY` |
| Live queue depth per queue | NOT_CONNECTED | Cloudflare Queues API: `GET /accounts/:id/queues/:name/messages`; env var: `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` |
| Live DLQ message count | NOT_CONNECTED | Cloudflare Queues API for `letbuyy-dead-letters-staging` / `letbuyy-staging-dead-letter-queue` |
| Worker health (is worker up / responding) | NOT_CONNECTED | Cloudflare Workers API or `wrangler tail <worker>`; env var: `CLOUDFLARE_API_TOKEN` |
| Blast propagation timing (how fast failure spreads) | NOT_CONNECTED | Structural topology is CONNECTED (this document); timing requires live telemetry from Cloudflare Analytics Engine |
| Current rollback target version ID | NOT_CONNECTED | Cloudflare Workers API: `GET /accounts/:id/workers/scripts/letbuyy-api/deployments`; env var: `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` |
| `ledger_balance_breaks()` current value | NOT_CONNECTED | Supabase RPC; env var: `SUPABASE_SERVICE_ROLE_KEY` |
| `payment_transactions` failed/abandoned ratio | NOT_CONNECTED | Supabase table query; env var: `SUPABASE_SERVICE_ROLE_KEY` |
| Hyperdrive pool utilization | NOT_CONNECTED | Cloudflare Hyperdrive metrics; env var: `CLOUDFLARE_API_TOKEN` |

---

## Appendix: Source file inventory check

All four requested files were present in `graphify-out/` at the time of this discovery:

| File | Present | Notes |
|------|---------|-------|
| `incident-intelligence-v5.json` | YES | One structural record (payments domain); not a live incident log |
| `runbooks.json` | YES | 22 runbooks, generated 2026-06-14T05:53:49Z |
| `production-readiness-v2.json` | YES | 18 systems, overall score 98, verdict NO-GO, 5 open blockers |
| `runtime-intel.json` | YES | 4 workers, 5 queues, 2 crons; `liveSnapshot: false` |
