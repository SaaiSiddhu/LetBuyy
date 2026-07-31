# LCOS Telemetry Discovery

**Phase:** 6 — LCOS Forensic Discovery  
**Mode:** READ-ONLY  
**Generated:** 2026-06-21  
**Source:** `graphify-out/telemetry-intelligence.json`, `runtime-intel.json`, `runtime-observability.json` — verified against `wrangler.toml` files.  
**Honesty contract:** Every live VALUE is NOT_CONNECTED. Topology (bindings, dataset names, queue names, cron schedules) is CONNECTED (repo-derived). No value is fabricated.

---

## 1. Telemetry Sources — All 12 Adapters

### Adapter 1 — Cloudflare Analytics Engine
| Field | Value |
|-------|-------|
| **Source** | Cloudflare Analytics Engine |
| **Dataset** | `RUNTIME_TELEMETRY` |
| **Metrics** | latency, errors, requests, cpu, cold-starts |
| **Binding** | `RUNTIME_TELEMETRY` (wrangler binding declared in all 4 workers) |
| **Auth** | Cloudflare API token |
| **Query method** | Analytics Engine SQL API (GraphQL) over the `RUNTIME_TELEMETRY` dataset |
| **Status** | NOT_CONNECTED — CF API token required |

### Adapter 2 — Workers Runtime (wrangler tail)
| Field | Value |
|-------|-------|
| **Source** | Cloudflare Workers runtime |
| **Metrics** | invocations, errors, subrequest count |
| **Binding** | `observability.logs` block in each worker's wrangler.toml |
| **Auth** | wrangler (authenticated session) |
| **Query method** | `wrangler tail <worker-name>` streaming log |
| **Status** | NOT_CONNECTED — wrangler session + deploy required |

### Adapter 3 — Cloudflare Queues
| Field | Value |
|-------|-------|
| **Source** | Cloudflare Queues service |
| **Metrics** | backlog, retries, dead-letters, throughput |
| **Binding** | Queue consumer bindings + DLQ entries in wrangler.toml |
| **Auth** | Cloudflare API token |
| **Query method** | Queues metrics API + dead-letter queue inspection |
| **Status** | NOT_CONNECTED — CF API token required |

### Adapter 4 — Cron Triggers
| Field | Value |
|-------|-------|
| **Source** | Workers cron trigger execution logs |
| **Metrics** | last-run timestamp, success/fail, duration |
| **Binding** | `[triggers] crons` in wrangler.toml |
| **Auth** | wrangler |
| **Query method** | `wrangler tail <worker> --env production` filtered for cron events |
| **Status** | NOT_CONNECTED — wrangler session required |

### Adapter 5 — Deployment
| Field | Value |
|-------|-------|
| **Source** | Cloudflare Workers API + Vercel API + Supabase migrations API |
| **Metrics** | live worker version, Vercel build id, applied migration number |
| **Binding** | Cloudflare deploy API + Vercel REST API + Supabase project API |
| **Auth** | provider-specific tokens (CF, Vercel, Supabase) |
| **Query method** | Respective provider REST APIs |
| **Status** | NOT_CONNECTED — provider tokens required |

### Adapter 6 — API Gateway (per-route)
| Field | Value |
|-------|-------|
| **Source** | letbuyy-api worker |
| **Metrics** | route latency, status codes, rate-limit hits |
| **Binding** | `RUNTIME_TELEMETRY` (same dataset, route-tagged events) |
| **Auth** | CF API token |
| **Query method** | Analytics Engine SQL with route-level filters |
| **Status** | NOT_CONNECTED — CF API token required |

### Adapter 7 — Webhook Delivery
| Field | Value |
|-------|-------|
| **Source** | `webhook_deliveries` Supabase table |
| **Metrics** | delivery success, signature failures, retries |
| **Binding** | `webhook_deliveries` table (Supabase) |
| **Auth** | Supabase `SUPABASE_SERVICE_ROLE_KEY` |
| **Query method** | SQL aggregation over `webhook_deliveries` |
| **Status** | NOT_CONNECTED — Supabase credentials required |

### Adapter 8 — Database (Supabase)
| Field | Value |
|-------|-------|
| **Source** | Supabase Postgres |
| **Metrics** | query latency, connection count, DB size, slow queries |
| **Binding** | Supabase project dashboard + `pg_stat_statements` |
| **Auth** | Supabase service role + pg superuser |
| **Query method** | Supabase metrics endpoint + `pg_stat_statements` SQL view |
| **Status** | NOT_CONNECTED — Supabase credentials required |

### Adapter 9 — Resend (email)
| Field | Value |
|-------|-------|
| **Source** | Resend API |
| **Metrics** | delivered, bounced, complained |
| **Binding** | `RESEND_API_KEY` |
| **Auth** | Resend API key |
| **Query method** | Resend API + webhook events |
| **Status** | NOT_CONNECTED — `RESEND_API_KEY` required |

### Adapter 10 — Razorpay (payments)
| Field | Value |
|-------|-------|
| **Source** | Razorpay API + `payment_webhook_events` table |
| **Metrics** | captured, failed, settlement status |
| **Binding** | `payment_webhook_events` (Supabase) + Razorpay key (server-side only) |
| **Auth** | Razorpay key (server-side) + Supabase service role |
| **Query method** | Razorpay API reports + SQL over `payment_webhook_events` |
| **Status** | NOT_CONNECTED — both Razorpay key and Supabase credentials required |

### Adapter 11 — Merchant Metrics
| Field | Value |
|-------|-------|
| **Source** | Supabase — site-scoped tables |
| **Metrics** | per-site GMV, orders, health score |
| **Binding** | Supabase `service role` + `verifySiteOwnership` RPC |
| **Auth** | `SUPABASE_SERVICE_ROLE_KEY` + site ownership verification |
| **Query method** | SQL aggregation over `orders`, `payment_transactions`, `sites` |
| **Status** | NOT_CONNECTED — Supabase service role required |

### Adapter 12 — Customer Metrics
| Field | Value |
|-------|-------|
| **Source** | `analytics_event_stream` Supabase table |
| **Metrics** | funnel steps, conversion rate, retention |
| **Binding** | `analytics_event_stream` (Supabase) |
| **Auth** | `SUPABASE_SERVICE_ROLE_KEY` |
| **Query method** | SQL aggregation / window functions over `analytics_event_stream` |
| **Status** | NOT_CONNECTED — Supabase service role required |

---

## 2. All Metrics by Category

### Runtime Metrics (10 — all NOT_CONNECTED)
| Metric | Worker(s) | Binding | Query |
|--------|-----------|---------|-------|
| latency | all 4 | `RUNTIME_TELEMETRY` | Analytics Engine SQL |
| errors | all 4 | `RUNTIME_TELEMETRY` + observability.logs | Analytics Engine / `wrangler tail --status error` |
| retries | letbuyy-queue-workers | queue consumer | Cloudflare Queues dashboard |
| dead-letters | letbuyy-queue-workers | DLQ bindings | Queues dashboard / `wrangler tail` |
| queueBacklogs | letbuyy-queue-workers | queue depth | Cloudflare Queues dashboard |
| failures | all 4 | `RUNTIME_TELEMETRY` | Analytics Engine SQL (non-2xx + exceptions) |
| timeouts | all 4 | worker limits | `wrangler tail --status error` (exceeded resources) |
| coldStarts | all 4 | isolate lifecycle | Analytics Engine / Trace |
| memory | all 4 | worker limits (128MB isolate) | Cloudflare dashboard |
| cpu | all 4 | worker limits | Cloudflare dashboard / Analytics Engine |

---

## 3. All Queues (5 business + 2 DLQs per environment = 14 queue names)

### Business Queues

| Binding | Staging Queue Name | Production Queue Name | Producer | Consumer |
|---------|-------------------|-----------------------|----------|----------|
| `EVENT_QUEUE` | `letbuyy-events-staging` | `letbuyy-events-production` | letbuyy-api | letbuyy-queue-workers |
| `ANALYTICS_QUEUE` | `letbuyy-analytics-queue-staging` | `letbuyy-analytics-queue-production` | letbuyy-api | letbuyy-queue-workers |
| `SEARCH_QUEUE` | `letbuyy-search-queue-staging` | `letbuyy-search-queue-production` | letbuyy-api | letbuyy-queue-workers |
| `NOTIFICATION_QUEUE` | `letbuyy-notifications-queue-staging` | `letbuyy-notifications-queue-production` | letbuyy-api | letbuyy-queue-workers |
| `RUNTIME_QUEUE` | `letbuyy-staging-queue` | `letbuyy-production-queue` | letbuyy-api | letbuyy-queue-workers |

**Naming note:** `RUNTIME_QUEUE` uses a different naming pattern (`letbuyy-{env}-queue`) vs the other 4 (`letbuyy-{purpose}-queue-{env}`). This is a cosmetic inconsistency only.

### Dead Letter Queues

| Environment | DLQ Name | Feeds from | Consumer |
|-------------|----------|-----------|----------|
| Staging | `letbuyy-dead-letters-staging` | EVENT, ANALYTICS, SEARCH, NOTIFICATION queues | letbuyy-queue-workers (named consumer) |
| Staging | `letbuyy-staging-dead-letter-queue` | RUNTIME_QUEUE | letbuyy-queue-workers |
| Production | `letbuyy-dead-letters-production` | EVENT, ANALYTICS, SEARCH, NOTIFICATION queues | letbuyy-queue-workers |
| Production | `letbuyy-production-dead-letter-queue` | RUNTIME_QUEUE | letbuyy-queue-workers |

**DLQ processing:** queue-workers has `letbuyy-dead-letters-staging` as an explicit named consumer entry in wrangler.toml — meaning DLQ messages are processed (not merely deposited). The processing frequency is cron-limited (every 6 hours). No separate alerting binding is declared.

---

## 4. All Workers (4 active)

| Worker | Routes (declared) | Cron | Observability | Analytics Dataset | R2 | Cache | Hyperdrive |
|--------|------------------|------|--------------|-------------------|----|-------|-----------|
| `letbuyy-api` | api.letbuyy.com, api-staging.letbuyy.com, api.staging.letbuyy.com | `*/15 * * * *` (production env only) | ✓ | `RUNTIME_TELEMETRY` | `R2_BUCKET` | ✓ | ✓ |
| `letbuyy-queue-workers` | _(none)_ | `17 */6 * * *` | ✓ | `RUNTIME_TELEMETRY` | _(none)_ | ✗ | ✗ |
| `letbuyy-webhook` | webhooks.letbuyy.com, webhooks-staging.letbuyy.com, webhooks.staging.letbuyy.com | _(none)_ | ✓ | `RUNTIME_TELEMETRY` | _(none)_ | ✗ | ✗ |
| `letbuyy-mobile-bff` | bff.letbuyy.com, bff-staging.letbuyy.com, bff.staging.letbuyy.com | _(none)_ | ✓ | `RUNTIME_TELEMETRY` | _(none)_ | ✗ | ✗ |

**Domain coverage per worker (from `runtime-observability.json`):**
- `letbuyy-api`: 22 domains, 129 RPCs, 328 tables (17 money, 209 tenant)
- `letbuyy-queue-workers`: 22 domains, 129 RPCs, 328 tables (same — via shared access layer)
- `letbuyy-webhook`: 5 domains (marketplace, refunds, payouts, payments, notifications), 35 RPCs, 89 tables (11 money, 56 tenant)
- `letbuyy-mobile-bff`: 0 domains, 0 RPCs, 0 tables — **under-mapped or placeholder**

---

## 5. All Cron Jobs (2 declared)

| Cron Expression | Human-readable | Worker | Environment | Declared in |
|-----------------|----------------|--------|-------------|------------|
| `*/15 * * * *` | Every 15 minutes | `letbuyy-api` | Production only (`[env.production]` block, line 236) | `services/api-gateway/wrangler.toml` |
| `17 */6 * * *` | Every 6 hours at minute 17 | `letbuyy-queue-workers` | All environments | `services/queue-workers/wrangler.toml` |

**Gaps:**
- No cron in staging for `letbuyy-api` — health pulse does not fire in staging
- No cron in `letbuyy-webhook` or `letbuyy-mobile-bff`
- Last-run success for both crons: NOT_CONNECTED (requires `wrangler tail` or cron trigger logs)

---

## 6. All Event Emitters (observability.logs binding)

All 4 workers emit to `[observability.logs]` — the structural binding is declared in each `wrangler.toml`. The emitter pattern is:

```
Worker HTTP handler → observability middleware → RUNTIME_TELEMETRY.writeDataPoint(...)
                                              └→ [observability.logs] (structured log)
```

Key emitter in `services/api-gateway/src/middleware/observability.ts`:
- Emits to `runtimeQueue` (RUNTIME_QUEUE binding) for cross-worker observability propagation
- Emits to `RUNTIME_TELEMETRY` dataset for Analytics Engine queries

---

## 7. All Observability Bindings (declared in wrangler.toml, NOT_CONNECTED live)

| Binding Name | Type | Worker(s) | Status |
|-------------|------|-----------|--------|
| `RUNTIME_TELEMETRY` | Analytics Engine dataset | all 4 | DETECTABLE (declared) / NOT_CONNECTED (live values) |
| `observability.logs` | Workers structured logs | all 4 | DETECTABLE / NOT_CONNECTED |
| `letbuyy-dead-letters-staging` | Cloudflare Queue (DLQ) | letbuyy-queue-workers | DETECTABLE / NOT_CONNECTED |
| `letbuyy-staging-dead-letter-queue` | Cloudflare Queue (DLQ) | letbuyy-queue-workers | DETECTABLE / NOT_CONNECTED |
| `letbuyy-dead-letters-production` | Cloudflare Queue (DLQ) | letbuyy-queue-workers | DETECTABLE / NOT_CONNECTED |
| `letbuyy-production-dead-letter-queue` | Cloudflare Queue (DLQ) | letbuyy-queue-workers | DETECTABLE / NOT_CONNECTED |
| `R2_BUCKET` | Cloudflare R2 object storage | letbuyy-api | DETECTABLE / NOT_CONNECTED |
| `Hyperdrive` | Cloudflare Hyperdrive (DB proxy) | letbuyy-api | DETECTABLE / NOT_CONNECTED |
| `webhook_deliveries` (table) | Supabase table | letbuyy-webhook | DETECTABLE / NOT_CONNECTED |
| `analytics_event_stream` (table) | Supabase table | letbuyy-api | DETECTABLE / NOT_CONNECTED |
| `payment_webhook_events` (table) | Supabase table | letbuyy-api, letbuyy-webhook | DETECTABLE / NOT_CONNECTED |

---

## 8. Ingestion Contract

To feed LCOS offline (without live credentials), an operator drops a snapshot at:

```
graphify-out/runtime-metrics.json
```

Keyed by metric: `errorsByWorker`, `latencyByWorker`, `queueDepth`, `errorsByRoute`, etc.

**`snapshotPresent`: false** — no snapshot exists in this environment. All 12 adapters therefore have live values NOT_CONNECTED.

---

## 9. LCIS Reuse Points for Telemetry

| Need | Reuse target |
|------|-------------|
| Read telemetry topology (bindings, datasets, queues) | `lcis-core` → `ArtifactStore.load('telemetry-intelligence.json')` |
| Probe live adapter when credentials present | `lcis-live` → `LivePlatform` adapter registry (each adapter maps to a `LiveAdapter` implementation) |
| Report NOT_CONNECTED with exact source | `lcis-live` → `NOT_CONNECTED` + binding name returned by adapter probe |
| Verify a telemetry claim | `lcis-core` → `VerificationService.verify(claim, sources)` |
| Correlate queue backlog → DLQ → cron window | `lcis-governance` → operational compliance rule R-OPS-01 (gap: not yet defined — this discovery surfaces it) |
