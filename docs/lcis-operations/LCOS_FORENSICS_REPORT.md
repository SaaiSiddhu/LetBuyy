# LCOS Forensics Report — LetBuyy Central Operations System

**Phase:** 6 — LCOS Forensic Discovery  
**Mode:** READ-ONLY observation (observes / analyzes / correlates / explains / reports — never deploys, executes, mutates, or remediates)  
**Generated:** 2026-06-21  
**Source files:** `graphify-out/runtime-intel.json`, `runtime-observability.json`, `operations-center.json`, `telemetry-intelligence.json`, `deployment-intelligence-v5.json`, `deployment-state.json` — verified against live wrangler.toml files and `.github/workflows/`.

---

## 1. Operational Topology Overview

### 1.1 Workers (4 active, 6 reserved stubs)

| Worker | Name | Routes | Crons | Queue Role |
|--------|------|--------|-------|------------|
| `services/api-gateway` | `letbuyy-api` | `api.letbuyy.com`, `api-staging.letbuyy.com`, `api.staging.letbuyy.com` | `*/15 * * * *` (production env block only) | Producer: EVENT, ANALYTICS, SEARCH, NOTIFICATION, RUNTIME |
| `services/queue-workers` | `letbuyy-queue-workers` | _(none — no HTTP routes)_ | `17 */6 * * *` | Consumer: all 5 queues + 2 DLQs |
| `services/webhook-service` | `letbuyy-webhook` | `webhooks.letbuyy.com`, `webhooks-staging.letbuyy.com`, `webhooks.staging.letbuyy.com` | _(none)_ | _(none)_ |
| `services/mobile-bff` | `letbuyy-mobile-bff` | `bff.letbuyy.com`, `bff-staging.letbuyy.com`, `bff.staging.letbuyy.com` | _(none)_ | _(none)_ |

**Reserved stubs (no deployable source):** `services/checkout-runtime`, `services/event-bus`, `services/analytics-pipeline`, `services/media-service`, `services/notification-service`, `services/search-service` — all carry `runtimeCategory: "reserved-service"` in their manifests; api-gateway + queue-workers are the active capability owners.

**Additional service observed:** `services/lcis-api` — directory present with `dist/`, `src/`, `test/`, not listed in `deployment-intelligence-v5.json` deploy targets; status requires verification.

### 1.2 Queue Topology (5 business queues + 2 DLQs)

| Queue Binding | Production Name | Staging Name | Producer | Consumer | DLQ |
|--------------|-----------------|--------------|----------|----------|-----|
| `EVENT_QUEUE` | `letbuyy-events-production` | `letbuyy-events-staging` | letbuyy-api | letbuyy-queue-workers | `letbuyy-dead-letters-*` |
| `ANALYTICS_QUEUE` | `letbuyy-analytics-queue-production` | `letbuyy-analytics-queue-staging` | letbuyy-api | letbuyy-queue-workers | `letbuyy-dead-letters-*` |
| `SEARCH_QUEUE` | `letbuyy-search-queue-production` | `letbuyy-search-queue-staging` | letbuyy-api | letbuyy-queue-workers | `letbuyy-dead-letters-*` |
| `NOTIFICATION_QUEUE` | `letbuyy-notifications-queue-production` | `letbuyy-notifications-queue-staging` | letbuyy-api | letbuyy-queue-workers | `letbuyy-dead-letters-*` |
| `RUNTIME_QUEUE` | `letbuyy-production-queue` | `letbuyy-staging-queue` | letbuyy-api | letbuyy-queue-workers | `letbuyy-production-dead-letter-queue` |

**Dead Letter Queues (2 per environment):**
- Staging: `letbuyy-dead-letters-staging` (shared DLQ for events/analytics/search/notifications), `letbuyy-staging-dead-letter-queue` (RUNTIME_QUEUE DLQ)
- Production: `letbuyy-dead-letters-production`, `letbuyy-production-dead-letter-queue`

**Gap:** queue-workers also consumes `letbuyy-dead-letters-staging` directly as a named consumer — DLQ processing is self-contained within queue-workers (no separate DLQ worker).

### 1.3 Cron Jobs (2 declared)

| Schedule | Worker | Purpose |
|----------|--------|---------|
| `*/15 * * * *` | `letbuyy-api` (production env block, line 236 in wrangler.toml) | Health/telemetry pulse — exact handler: observability middleware cron trigger |
| `17 */6 * * *` | `letbuyy-queue-workers` | Queue maintenance / dead-letter processing — runs every 6 hours at minute 17 |

**Note:** The api-gateway default and staging env blocks declare `crons = []`; the cron is active in the `[env.production]` block only. This is DETECTABLE (topology known) — whether it last succeeded is NOT_CONNECTED.

### 1.4 Operations Center — 7 Areas

| Area | Declared Status | Live Status | Classification |
|------|----------------|-------------|----------------|
| **Incidents** | Incident model present (`production_incidents` table + incident-command worker + incident-response engine) | NOT_CONNECTED — needs live query `/api/incident-response?domain=X` | DETECTABLE |
| **Deployment** | HEAD `ab5b9065` (stepup/main); migration #174; migrate gate ON; rollback present | NOT_CONNECTED — live worker/Vercel versions need deploy APIs | DETECTABLE |
| **Environment** | Declared: local, staging, production | NOT_CONNECTED | PARTIAL |
| **Runtime** | 4 workers with `RUNTIME_TELEMETRY`; all 10 metrics emission wired | NOT_CONNECTED — latency/errors via Analytics Engine | DETECTABLE |
| **Queues** | 5 business queues / 7 consumers (incl. 2 DLQs) declared | NOT_CONNECTED — queue depth/backlog via Cloudflare Queues | DETECTABLE |
| **Workers** | letbuyy-api, letbuyy-queue-workers, letbuyy-webhook, letbuyy-mobile-bff | NOT_CONNECTED — errors/CPU via Analytics Engine | DETECTABLE |
| **Dependencies** | 49 cross-domain edges; 705 FK relationships | CONNECTED — repo-derived, always available | CONNECTED |

**Launch Verdict (from `operations-center.json`):** NO-GO — 5 open blockers as of 2026-06-14.

### 1.5 Telemetry Adapters (12)

| # | Source | Metrics | Binding | Auth | Status |
|---|--------|---------|---------|------|--------|
| 1 | Cloudflare Analytics Engine | latency, errors, requests, cpu, cold-starts | `RUNTIME_TELEMETRY` | CF API token | NOT_CONNECTED |
| 2 | Workers (runtime) | invocations, errors, subrequest count | `observability` (wrangler) | wrangler | NOT_CONNECTED |
| 3 | Cloudflare Queues | backlog, retries, dead-letters, throughput | queue consumers/DLQ | CF API token | NOT_CONNECTED |
| 4 | Cron | last-run, success, duration | `[triggers] crons` | wrangler | NOT_CONNECTED |
| 5 | Deployment | live worker version, Vercel build id, applied migration | deploy APIs | provider tokens | NOT_CONNECTED |
| 6 | API (gateway) | route latency, status codes, rate-limit hits | `RUNTIME_TELEMETRY` | CF API token | NOT_CONNECTED |
| 7 | Webhook | delivery success, signature failures, retries | `webhook_deliveries` table | Supabase | NOT_CONNECTED |
| 8 | Database (Supabase) | query latency, connections, db size, slow queries | Supabase project | Supabase service role | NOT_CONNECTED |
| 9 | Resend (email) | delivered, bounced, complained | `RESEND_API_KEY` | Resend key | NOT_CONNECTED |
| 10 | Razorpay (payments) | captured, failed, settlement status | `payment_webhook_events` | Razorpay key (server-side) | NOT_CONNECTED |
| 11 | Merchant metrics | per-site GMV / orders / health | SQL over site-scoped tables | Supabase (service role + verifySiteOwnership) | NOT_CONNECTED |
| 12 | Customer metrics | funnel / conversion / retention | `analytics_event_stream` | Supabase | NOT_CONNECTED |

### 1.6 Deployment Workflows (15 listed + 1 discovered)

The deployment-intelligence-v5.json lists 15 workflows. Verified against `.github/workflows/` — **16 files found**. The 16th is `lcis-pr-analysis.yml` (LCIS blast-radius analysis on every PR; read-only, no deploy). Full breakdown in LCOS_DEPLOYMENT_DISCOVERY.md.

---

## 2. Structural CONNECTED vs Live NOT_CONNECTED Posture

### Summary Counts

| Classification | Count | What it means |
|---------------|-------|---------------|
| **CONNECTED** (structural, always available) | 6 signals | Topology, routes, queue graph, FK relationships (705), cross-domain edges (49), RLS policies (651) |
| **DETECTABLE** (binding known, signal reachable, value requires live query) | 10 runtime metrics + 5 ops areas + 2 cron jobs + 12 telemetry adapters | The emission point and binding are declared in the repo; operator runs `wrangler tail` or queries Analytics Engine |
| **PARTIAL** (some data in repo, some data live) | 1 (Environment area — environment types known, credential presence requires check) | `environment-registry.json` has declared environments but not credential presence |
| **NOT_CONNECTED** (value requires external API with no credential in repo) | All 12 telemetry adapter live values | Per-adapter exact binding/env var listed in Section 1.5 |

### Connected Structural Signals (always available)

1. **Worker topology** — 4 workers, routes, crons, queue producer/consumer graph — CONNECTED via `wrangler.toml` parse
2. **Queue graph** — 5 business queues, 2 DLQs, producer = letbuyy-api, consumer = letbuyy-queue-workers — CONNECTED
3. **FK relationships** — 705 relationships, tenant root `sites` — CONNECTED via `db-intel.json`
4. **Cross-domain edges** — 49 edges — CONNECTED via `domain-intel.json`
5. **RLS policies** — 651 policies — CONNECTED via `db-intel.json`
6. **Migration state** — 103 migrations, latest #174 `174_v1_gift_card_refund_restore.sql` — CONNECTED

### Key Live NOT_CONNECTED Gaps

| Gap | Exact Binding / Env Var | What connects it |
|-----|------------------------|-----------------|
| Worker error rates / latency | `RUNTIME_TELEMETRY` dataset | Cloudflare Analytics Engine API + CF API token |
| Queue backlog depths | Cloudflare Queues metrics API | CF API token |
| DLQ message count | `letbuyy-dead-letters-*` queue inspection | CF API token |
| Cron last-run success | Worker cron trigger logs | `wrangler tail letbuyy-api --env production` |
| Live deployed worker version | Cloudflare Workers API | CF API token |
| Applied migration in production | Supabase migrate API | `SUPABASE_SERVICE_ROLE_KEY` |
| Payment capture/fail rate | `payment_webhook_events` table | `SUPABASE_SERVICE_ROLE_KEY` |
| Email delivery status | Resend API | `RESEND_API_KEY` |
| Per-merchant GMV | SQL over `orders` + site-scoped tables | `SUPABASE_SERVICE_ROLE_KEY` + `verifySiteOwnership` |

---

## 3. Key Operational Findings

### F-1: RUNTIME_QUEUE naming asymmetry
The `RUNTIME_QUEUE` binding maps to `letbuyy-staging-queue` / `letbuyy-production-queue` — a different naming convention than the other 4 queues (which use `letbuyy-{purpose}-queue-{env}`). This does not affect operation but makes console-level identification inconsistent.

### F-2: DLQ monitoring gap (highest ops risk)
Two DLQs exist (`letbuyy-dead-letters-*`, `letbuyy-*-dead-letter-queue`). Neither has a dedicated alert binding. The queue-workers worker processes DLQs via the cron at `17 */6 * * *` — meaning a DLQ backlog can accumulate for up to 6 hours before the cron runs. Live DLQ depth is NOT_CONNECTED.

### F-3: letbuyy-mobile-bff has no DB or domain coverage
The `letbuyy-mobile-bff` worker declares 0 RPCs, 0 tables, 0 domains in `runtime-observability.json`. It has observability wired to `RUNTIME_TELEMETRY` but carries no business logic per the current graph. This may be a placeholder or an under-mapped service.

### F-4: api-gateway cron is production-env-only
The `*/15 * * * *` cron is only declared in the `[env.production]` block (line 236 of `wrangler.toml`). It does not fire in staging. Staging telemetry pulse therefore only comes from HTTP-triggered requests — no periodic health emission in staging.

### F-5: lcis-api not in deploy targets
`services/lcis-api/` has `dist/`, `src/`, and `test/` directories but is not listed as a deploy target in `deployment-intelligence-v5.json`. It may be local/dev-only or deploy via a separate mechanism (e.g. `tools/` infrastructure).

### F-6: 6 reserved service stubs have no deployable source
`checkout-runtime`, `event-bus`, `analytics-pipeline`, `media-service`, `notification-service`, `search-service` all carry `runtimeCategory: "reserved-service"` in their `runtime.manifest.json`. Their current behavior is owned by `services/api-gateway` and `services/queue-workers`. This is intentional per CLAUDE.md but represents future build scope.

---

## 4. LCIS Reuse Points

LCOS composes from the existing lcis-core stack — no reimplementation:

| Capability needed | Reuse target |
|------------------|-------------|
| Structural topology reads | `lcis-core` → `ArtifactStore` (reads `graphify-out/*.json`) |
| Blast radius of worker/queue changes | `lcis-core` → `BlastRadiusService` |
| Verifying structural vs live signal claims | `lcis-core` → `VerificationService` (VERIFIED/PARTIAL/UNVERIFIED/REFUTED) |
| Live adapter probes (when credentials present) | `lcis-live` → `LivePlatform` + per-adapter connectors |
| Deployment state and migration tracking | `lcis-execution` → deployment state model |
| Governance drift and compliance checks | `lcis-governance` → R001–R008 rules + `DriftIntelligence` |

---

## 5. Sibling Agent Scope (not covered here)

This report covers: Runtime · Queues · Workers · Crons · Telemetry · Deployment · Ops-Center areas.

Sibling agents own: **Incident** (incident-intelligence-v5.json), **Security** (security-intelligence), **Cost** (cost-intelligence.json). Cross-referencing those agents' outputs with the queue/DLQ gap (F-2) and the DLQ cron window is recommended as a follow-on.
