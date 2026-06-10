# PHASE 2 ARB CHALLENGE — FOUNDATION STRENGTH REPORT
**Date:** 2026-06-09
**Posture:** Read-only forensic. Every claim carries a `path[:line]` code citation.
**Challenge target:** `LETBUYY_MASTER_FORENSICS_AND_FOUNDATION_VERDICT.md` (composite 45/100)
**Reviewer role:** Principal Database Architect + Principal Platform Engineer

---

## 1. SCALE TRUTH MATRIX

Subsystems evaluated at 100 / 1,000 / 10,000 / 50,000 active merchants. Each tier gives a verdict (YES / CONDITIONAL / NO) plus the **binding constraint** with evidence.

### 1.1 Database (Supabase Postgres)

| Tier | Verdict | Binding Constraint & Evidence |
|------|---------|-------------------------------|
| 100 merchants | YES | Standard Supabase shared-cluster headroom. Tenant isolation via `site_id` GUC convention; claim procedures use `FOR UPDATE SKIP LOCKED` correctly (`migrations/000_baseline.sql:744-759`). |
| 1,000 merchants | CONDITIONAL | Hot tables `outbox_events`, `analytics_event_stream`, `platform_queue_jobs` are **unpartitioned in production paths**. Partitioned shadows exist (`migrations/081-083`) but comments state "drain before cutover" and "live cutover requires staging proof" — **cutover never executed** (`migrations/081_partition_outbox_events.sql:98`). `outbox_events` will grow monotonically; `claim_outbox_events` does a `FOR UPDATE SKIP LOCKED` on an ever-larger heap. Vacuum/autovacuum lag begins at ~1 M rows. |
| 10,000 merchants | NO | Three compounding blockers: (a) `payout_statements.gross_amount_minor INTEGER` (`migrations/119_mobile_money_ledgers.sql:16`) overflows at ₹21,474,836.47 — crossed by a single mid-tier merchant at peak; (b) `products` table lacks a composite `(site_id, status, created_at)` index — only `idx_products_store (store_id)` and `idx_products_active (site_id WHERE deleted_at IS NULL)` exist (`migrations/000_baseline.sql:18056-18063`); at 10k merchants × ~500 products each, product-list queries with status filter force heap scan; (c) `orders` has `idx_orders_store (store_id)` and `idx_orders_status (status)` as separate single-column indexes — the compound `(store_id, status, created_at DESC)` added in `migrations/130_orders_site_id_not_null.sql:59-61` postdates the baseline and must be verified as applied in production. |
| 50,000 merchants | NO | Supabase free/pro shared Postgres reaches connection exhaustion. Every Cloudflare Worker invocation calls `createSupabaseServiceClient(env)` using REST (`packages/infrastructure/supabase-adapter/index.ts:34-38`). **Hyperdrive is bound but bypassed** — the connection string path (`HYPERDRIVE.connectionString`) is never called anywhere in the service; all queries go through PostgREST HTTP (`supabase-adapter/index.ts:59-89`). At 50k merchants with burst traffic, the Supabase REST/Postgres connection pool exhausts. No connection-pooler interception is coded. |

### 1.2 Cloudflare Workers

| Tier | Verdict | Binding Constraint & Evidence |
|------|---------|-------------------------------|
| 100 merchants | YES | Stateless Workers auto-scale; no per-Worker limit at this tier. |
| 1,000 merchants | CONDITIONAL | CPU time. Workers free tier: 10 ms CPU/request (paid: 30 s with Unbound). GraphQL bulk operations and export jobs use `c.executionCtx.waitUntil()` (`routes/export.ts:699,720,740,809`; `graphql/bulk.ts:478`) — the job body runs unbounded after response. Unbound Workers mitigates this but is not the default; the `compatibility_date = "2026-05-25"` and no `usage_model = "unbound"` declaration in `wrangler.toml` means the paid tier but potentially **standard CPU limit applies to each `.fetch()`**. |
| 10,000 merchants | CONDITIONAL | Subrequest limit: 50 outbound fetches per Worker invocation. A checkout flow triggers: Supabase REST (auth), Supabase REST (cart), Razorpay/Cashfree, WhatsApp notification, queue enqueue, analytics queue. Counting `rateLimit.ts` Redis calls (1 pipeline), Turnstile verify (`security.ts:237`), WEBHOOK_SERVICE.fetch (`index.ts:863`), and domain DNS fetch (`lib/dns.ts:14`), heavy routes approach 10–15 subrequests per invocation. WASM module fetch in app extensions (`extensions/app-functions-runtime.ts:361`) adds 1 per extension call. Not yet hitting the 50 ceiling at current feature set, but app-extension + GraphQL shim routes compound fast. |
| 50,000 merchants | NO | Workers `smart` placement (`wrangler.toml:33, env.production`) routes to nearest POP, but Supabase Postgres is in `ap-south-1`. Cross-region latency adds 40-80 ms per query hop from distant POPs. At 50k merchants the API becomes geo-latency-bound when Indian merchants hit `ap-south-1` Supabase from non-Asia POPs; no connection pre-warming or true connection pooling exists. Rate limiting is **in-memory per-Worker-isolate** when Redis is absent (non-prod) or fails-open in prod (`rateLimit.ts:884-888`), meaning isolate recycling resets all counters — 50k merchants can trivially bypass rate limits. |

### 1.3 Cloudflare Durable Objects

| Tier | Verdict | Binding Constraint & Evidence |
|------|---------|-------------------------------|
| All tiers | CONDITIONAL | The only DO is `LetbuyyRuntimeDurableObject` (`durable/runtime-coordinator.ts`). It handles only `/health` GET and `/checkpoint` POST. It is **not** on any hot path — no product mutation, no cart, no payment flows through it. Single-instance bottleneck risk is nil for this DO at any scale. HOWEVER: if future work promotes it to a coordination role (as its naming implies), a single DO instance would be a hard bottleneck. Current verdict is safe only because the DO is a pure health/checkpoint telemetry node. |

### 1.4 Cloudflare KV (CACHE)

| Tier | Verdict | Binding Constraint & Evidence |
|------|---------|-------------------------------|
| 100 merchants | YES | KV used for: storefront page caching (`lib/storefront-cache.ts:127`), rate-limit fallback (`rateLimit.ts:864-880`). |
| 1,000–50,000 merchants | CONDITIONAL | KV is **eventually consistent** (up to 60 s global propagation). Two races: (1) Rate limiting: if CACHE KV is used as rate-limit backend (when Redis is absent), counts from different PoPs can drift — a client in Mumbai and Singapore simultaneously hitting auth can each see 0 count and both be allowed 60 req/window instead of 30. (2) Storefront cache: a merchant publishing a product update will see stale cached pages for up to 60 s from POPs that haven't propagated the KV invalidation. `cache_invalidation_events` table exists (`migrations/000_baseline.sql:16852`) with a claim index, but the consumer that processes it and calls `CACHE.delete()` has no verified call-site in `routes/` or `execution/`. |

### 1.5 Cloudflare Queues

| Tier | Verdict | Binding Constraint & Evidence |
|------|---------|-------------------------------|
| 100 merchants | YES | 5 producer queues defined (`wrangler.toml:env.production`); consumers in `queue-workers/wrangler.toml:env.production`. |
| 1,000 merchants | CONDITIONAL | Queue drain bottleneck: api-gateway cron fires **every 15 minutes** (`wrangler.toml:env.production.triggers: "*/15 * * * *"`). Comments confirm this was deliberately throttled from every 1 minute: "Beta free-tier: was `*/1` (1,440 fires/day)... 15m = 96 fires/day." Each batch processes max 50 outbox events. At 1,000 merchants each placing 10 orders/day: 10,000 order events/day ÷ 96 fires ÷ 50/batch = 2 cron windows needed minimum, with no burst headroom. Any spike pushes outbox lag to 30+ minutes. |
| 10,000 merchants | NO | 10,000 merchants × 10 orders/day = 100,000 events/day; 50 events/cron × 96 fires = 4,800 events/day drained. **Outbox grows 95x faster than it drains.** The 15-minute cron is structurally inadequate. queue-workers consumers on Cloudflare Queues (push-model, up to 500 batches/s per queue) could absorb this, but the **outbox→platform_queue_jobs→queue-workers path depends on the cron-triggered api-gateway dispatch being the upstream feeder** — the api-gateway cron writes to `platform_queue_jobs`, then queue-workers consumers drain those. The Cloudflare Queue push trigger (`queue-workers/src/index.ts:7`) only drains `platform_queue_jobs` rows — the outbox-to-queue-jobs fanning step still requires the api-gateway cron. |
| 50,000 merchants | NO | Same structural bottleneck, 50× worse. Also: in-memory circuit breakers in `platform-queue-consumer.ts:183` (`queueCircuitBreakers`) are per-Worker-isolate. State is lost on isolate recycle; a transient DB failure opens the circuit in one isolate but not others, causing inconsistent drain behavior across concurrent Workers. |

### 1.6 Cloudflare R2 (Media Storage)

| Tier | Verdict | Binding Constraint & Evidence |
|------|---------|-------------------------------|
| All tiers | CONDITIONAL | R2 is globally distributed with no throughput cap at any merchant scale. Binding constraint: **no R2 backup or lifecycle policy in code**. `docs/media/README.md` mentions "R2 backup lifecycle" but no terraform or wrangler R2 lifecycle config was found. Merchant-uploaded media is permanent with no expiry. GDPR/right-to-erasure has no automated path. |

### 1.7 Payments Path

| Tier | Verdict | Binding Constraint & Evidence |
|------|---------|-------------------------------|
| 100 merchants | CONDITIONAL | Real webhook HMAC + idempotency in `webhook-service`. **Default `LETBUYY_PAYMENT_MODE` is `mock`** (`index.ts:102`); wrangler.toml production does not explicitly set payment mode overrides, relying on `SKIP_NEEDS_HUMAN_*` placeholders for Razorpay (`wrangler.toml:257`). If a secret is missing, mock path silently marks orders paid. |
| 1,000 merchants | CONDITIONAL | Partner payouts: `planSandboxAppPayoutTransfer` in `packages/billing-core/src/index.ts:525-546` is **always called** by `platform-queue-consumer.ts`; when `providerMode !== 'live'` it returns `status: 'released'` with a fabricated `sandbox_payout_${ledgerEntryId}` reference without making any API call. Production `provider_mode = 'live'` path returns `status: 'processing'` — but then **no live provider call is made**; it sets `live_transfer_required: true` in metadata and stops. Money is never actually moved out. |
| 10,000+ merchants | NO | Integer overflow in `payout_statements.gross_amount_minor INTEGER` (`migrations/119_mobile_money_ledgers.sql:16,53`). Max safe value = 2,147,483,647 paise = ₹21,474,836.47. A single high-GMV merchant crossing this threshold causes a Postgres integer overflow exception, corrupting payout records. |

### 1.8 Identity Path

| Tier | Verdict | Binding Constraint & Evidence |
|------|---------|-------------------------------|
| 100 merchants | CONDITIONAL | Real opaque sessions exist; TOTP MFA exists but is not enforced at login (`LETBUYY_MASTER_FORENSICS_AND_FOUNDATION_VERDICT.md:116`). Static `super_admin` JWT bypass in `middleware/auth.ts:216-231`. |
| 1,000+ merchants | NO | Three parallel session systems + two identity stores create ambiguous auth state at scale. Session lookup is a DB round-trip on every protected request (no JWT-native verification); at 1,000+ concurrent merchants this becomes a Supabase hot path with no caching layer. |

### 1.9 Theme Rendering / Storefront Runtime

| Tier | Verdict | Binding Constraint & Evidence |
|------|---------|-------------------------------|
| 100 merchants | YES | Real section/block theme registry; KV-backed storefront cache with stale-while-revalidate. |
| 1,000+ merchants | CONDITIONAL | KV eventual consistency (above). `FEATURE_LIQUID = "false"` in production (`wrangler.toml:241`) — Liquid rendering is disabled in prod. The storefront serves section-rendered JSON, not templated HTML. Theme-preview sessions expire correctly (`migrations/000_baseline.sql:18934-18948`). |

### 1.10 Checkout

| Tier | Verdict | Binding Constraint & Evidence |
|------|---------|-------------------------------|
| All tiers | NO | The master verdict correctly identifies: checkout handoff HMAC is real, but `/checkout/confirm` **does not create an order or a payment record** as of the last forensic pass (`LETBUYY_MASTER_FORENSICS_AND_FOUNDATION_VERDICT.md:111`). This is a scale-independent correctness failure before a scale analysis even applies. |

---

## 2. OUTBOX VERDICT

**Verdict: CONDITIONAL — structurally sound design, operationally rate-limited to the point of accumulation under any meaningful load.**

### Evidence chain

1. **Outbox design is correct.** `claim_outbox_events` uses `FOR UPDATE SKIP LOCKED` with a 120-second lock timeout (`migrations/000_baseline.sql:744-759`). Idempotency keys prevent double-dispatch. The `complete_outbox_event` / `fail_outbox_event` / `dead_lettered_at` lifecycle is complete.

2. **Dispatch pipeline is real end-to-end.** `OutboxExecutionAdapter.dispatchBatch()` (`services/api-gateway/src/execution/outbox-execution.adapter.ts:70-95`) claims events, fans out to `platform_queue_jobs` via upsert (idempotent on `queue_name, idempotency_key`), and creates `webhook_deliveries` rows. `PlatformQueueConsumer` (`services/queue-workers/src/platform-queue-consumer.ts`) drains `platform_queue_jobs`, processes analytics/search/payment events, inserts `notifications`, and calls FCM/APNs push. WhatsApp is handled via the `webhook-service` FETCH call (`index.ts:863`).

3. **The drain bottleneck is the 15-minute cron.** `api-gateway/wrangler.toml:env.production.triggers = ["*/15 * * * *"]`. The comment confirms this was **manually throttled from `*/1`** to save free-tier quota. Each run processes max 50 outbox events and max 50 queue jobs (hardcoded at `index.ts:855-876`). Under 1,000 merchants with normal order volumes, the outbox accumulates faster than it drains. Events are durably stored (they do not disappear) but delivery lag grows linearly.

4. **Domain events (order.paid → WhatsApp/notifications) are delivered, but with lag.** The sequence is: order.paid → `outbox_events` row (synchronous) → cron fires every 15 min → `OutboxExecutionAdapter` claims and fans to `platform_queue_jobs` → Cloudflare Queue message → `queue-workers` consumer processes within seconds (Cloudflare Queues push is near-realtime). The Cloudflare Queue consumer leg is fast; the outbox→queue_jobs fan-out leg is the 15-minute chokepoint.

5. **Push credentials are placeholder in all environments.** `FCM_PROJECT_ID = "SKIP_NEEDS_HUMAN_PUSH_FCM_PROJECT_ID"` (`queue-workers/wrangler.toml:24`). `PUSH_DISPATCH_MODE = "dry-run"` in staging. `PUSH_DISPATCH_MODE = "live"` in production but FCM/APNs keys are `SKIP_NEEDS_HUMAN_*`. Push notifications are code-complete but will fail silently in production until credentials are injected. Failures are logged to `notification_logs` (correct), not re-queued.

**Summary:** The outbox is not dead and not purely lossy. It is **structurally reliable but operationally rate-limited**: events accumulate with up to 15-minute delivery lag, which is acceptable for analytics/search but unacceptable for order confirmation WhatsApp messages (merchants expect near-realtime). At any meaningful merchant scale above ~200 orders/hour, the outbox accumulates permanently.

---

## 3. DATABASE INDEX AUDIT

### 3.1 Hot tables — index coverage

**`orders`**
- `idx_orders_store (store_id)` — baseline (`000_baseline.sql:17727`): non-selective, scans all tenant rows
- `idx_orders_status (status)` — baseline (`000_baseline.sql:17720`): global status, useless for tenant queries
- `idx_orders_active (store_id WHERE deleted_at IS NULL)` — baseline (`000_baseline.sql:17699`): better, but no `status` or `created_at`
- `idx_orders_store_status_created_active (store_id, status, created_at DESC WHERE deleted_at IS NULL)` — migration 130 (`migrations/130_orders_site_id_not_null.sql:59-61`): **THIS IS THE CORRECT INDEX** — added later
- `idx_orders_site_status_created_active (site_id, status, created_at DESC WHERE deleted_at IS NULL)` — migration 130 (`migrations/130_orders_site_id_not_null.sql:63-65`): correct mirror

**Finding:** The composite orders indexes are adequate **if migration 130 has been applied**. The baseline alone is insufficient.

**`products`**
- `idx_products_store (store_id)` — single column only (`000_baseline.sql:18063`)
- `idx_products_active (site_id WHERE deleted_at IS NULL)` — better (`000_baseline.sql:18056`)
- **MISSING: `(site_id, status, created_at DESC)` composite.** The product listing query pattern is `WHERE site_id = $1 AND status = 'active' AND deleted_at IS NULL ORDER BY created_at DESC`. No such index exists in any migration. At 10k products per tenant, this is a sequential scan within the partition.

**`ledger_entries`** (`migrations/139`)
- `ledger_entries_site_currency_idx (site_id, currency, created_at)` — exists (`139_executable_foundation_ledger_core.sql:160`)
- **MISSING: `(account_id, created_at)` index.** Account balance queries — `SUM(amount_minor) WHERE account_id = $1 AND side = 'debit'` — have no targeted index. The balance enforcement trigger uses a full `WHERE transaction_id = $1` scan which is covered by the `transaction_id NOT NULL` reference, but direct account balance reads (settlement/payout reconciliation) are not indexed.

**`sessions`**
- `idx_sessions_token (token)` — exists (`000_baseline.sql:18413`): correct for session lookup
- `idx_sessions_user (user_id)` — exists (`000_baseline.sql:18420`)
- `idx_sessions_expires (expires_at)` — exists (`000_baseline.sql:18406`): correct for cleanup
- **Assessment: adequate.**

**`outbox_events` (unpartitioned live table)**
- `idx_outbox_events_dispatch_claim (status, next_attempt_at, available_at, created_at WHERE status IN ('queued','failed'))` — exists (`000_baseline.sql:17762`): correct claim index
- `idx_outbox_events_site_status_available (site_id, status, available_at, created_at)` — exists (`000_baseline.sql:17783`)
- **Assessment: well-indexed for claim queries. The problem is not missing indexes but table bloat from lack of partitioning.**

**`platform_queue_jobs`**
- `idx_platform_queue_jobs_claim (queue_name, status, available_at, created_at WHERE status IN ('queued','failed') AND deleted_at IS NULL)` — exists (`000_baseline.sql:17951`): correct
- **Assessment: adequate.**

### 3.2 Critical missing indexes

| Table | Missing Index | Query Pattern | Impact Tier |
|-------|--------------|---------------|-------------|
| `products` | `(site_id, status, created_at DESC) WHERE deleted_at IS NULL` | Product listing with status filter | 1k+ |
| `ledger_entries` | `(account_id, created_at)` | Account balance aggregation | 1k+ |
| `notifications` | `(user_id, created_at DESC) WHERE deleted_at IS NULL` | Notification feed for user | 1k+ |
| `analytics_event_stream` | Partitioned shadow not cut over (`migrations/081`) | High-volume event writes | 10k+ |
| `webhook_deliveries` | Partitioned shadow not cut over (`migrations/083`) | Webhook retry scanning | 10k+ |

---

## 4. CONNECTION MODEL ANALYSIS

### 4.1 Hyperdrive binding vs. actual usage

`wrangler.toml` binds Hyperdrive in both staging and production:
```
[[env.production.hyperdrive]]
binding = "HYPERDRIVE"
id = "9e08563f410040d9a8bd67b7938f0bb5"
```

`Env` interface declares `HYPERDRIVE?: Hyperdrive` (`index.ts:97`).

**Hyperdrive is never used.** The only Supabase client factory is `createSupabaseServiceClient(env)` (`lib/supabase.ts:12-13`) → `createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, ...)` (`supabase-adapter/index.ts:34-38`). This creates a PostgREST HTTP client, not a `pg` wire-protocol client. Hyperdrive pools TCP connections to Postgres; PostgREST uses HTTP. **These are architecturally incompatible** — Hyperdrive only helps TCP-based `pg` clients. The binding exists but provides zero benefit.

**Connection exhaustion model:**
- Every Worker invocation calls `createSupabaseServiceClient` once, creating a PostgREST HTTP client.
- Each `db.from(table).select()` call opens an HTTP connection to Supabase's PostgREST endpoint, which internally takes a Postgres connection from pgBouncer.
- A single checkout route makes 6-10 sequential Supabase calls (cart, inventory, payment session, order write, outbox write, notifications).
- Cloudflare Workers can run thousands of concurrent isolates. At 10k merchants × burst traffic, the number of concurrent Supabase HTTP connections can exceed Supabase's pgBouncer pool (default: 15 connections for free, 60 for pro, 200 for business tier).
- There is no connection reuse across requests because Workers are stateless.

**Risk:** Connection exhaustion causes 503s from Supabase (pgBouncer pool full) with no retry logic in the adapter. `selectSupabaseRows` / `patchSupabaseRows` just throw on non-OK responses (`supabase-adapter/index.ts:82-86`).

---

## 5. CLOUDFLARE LIMITS ANALYSIS

### 5.1 CPU time per request

Production flags disable GraphQL (`FEATURE_GRAPHQL = "false"`), Extensions (`FEATURE_EXTENSIONS = "false"`), and Liquid (`FEATURE_LIQUID = "false"`) (`wrangler.toml:239-241`). This is a deliberate beta throttle that removes the heaviest CPU paths. Without these flags, a GraphQL introspection request + bulk operation + Liquid theme rendering would approach the 50ms CPU limit on the standard tier.

### 5.2 Subrequest limit (50/request)

Worst-case heavy routes:
- Checkout with app extension: Redis rate limit (1) + Turnstile verify (1) + Supabase auth (1) + cart load (1) + inventory check (1) + payment session (1) + webhook-service fetch (1) + queue enqueue ×2 (2) + WASM module fetch (1) = **10 subrequests** — well within 50 for current disabled-feature set.
- With GraphQL enabled + app extension + WhatsApp notification: adds REST-shim sub-fetch (1) + extension WASM fetch (1) + Twilio fetch (1) = 13 total. Still safe individually, but `app.fetch(request, c.env)` GraphQL shim sub-request (`index.ts:642,697`) counts toward the limit.

### 5.3 Durable Objects bottleneck

`LetbuyyRuntimeDurableObject` handles only health checks and checkpoint writes (`durable/runtime-coordinator.ts`). It is **not on any product hot path**. No scale bottleneck from the current DO design.

### 5.4 KV consistency for rate limiting

As documented in section 1.4: KV eventual consistency (up to 60 s) means rate-limit windows observed at different edge PoPs can diverge. Auth rate limit (`authRateLimit`) is applied to `/auth/*` routes — potentially allowing 2× the intended requests per window from multi-PoP attacks.

### 5.5 Cron as queue-drain bottleneck

The 15-minute production cron (`wrangler.toml:env.production.triggers`) is a single-instance scheduled invocation that:
1. Checks pending work (3 DB count queries in parallel)
2. Runs `OutboxExecutionAdapter.dispatchBatch(limit=50)`
3. Calls WEBHOOK_SERVICE for deliveries
4. Runs `QueueExecutionAdapter.consumeQueues(limit=50)`
5. Enqueues completion trigger messages

This is **not parallelized** across merchants. 50 outbox events/15 min = 4,800 events/day maximum throughput through this path. Any event volume above this accumulates indefinitely. The Cloudflare Queue consumer leg (queue-workers) is fast and parallel, but it only fires after the cron has promoted events into `platform_queue_jobs`.

---

## 6. DISASTER RECOVERY TRUTH

### 6.1 RTO / RPO

**No RTO or RPO is defined anywhere in the codebase, runbooks, or infrastructure config.** `docs/runbooks/infra-recovery.md` exists but contains "4 bullet points with no recovery time objective" (confirmed from prior forensic: `FOUNDATION_FORENSICS_2026_06_09/LETBUYY_PRODUCTION_READINESS_FORENSICS.md:100`).

### 6.2 Postgres backups

- **Only mechanism:** `pg_dump --format=custom` run as a pre-migration step in `production-deploy.yml:220-227`, encrypted with GPG, uploaded as a GitHub Actions artifact with **7-day retention**.
- **No scheduled backup job** — no cron-triggered `pg_dump`, no Supabase PITR configuration found in any terraform or config file.
- **Supabase PITR** exists as a platform feature on Pro+ tiers but no evidence of enablement. `docs/runbooks/infra-recovery.md` has no PITR step.
- **Effective RPO: time since last deployment** (could be weeks). **Effective RTO: undefined (no tested restore procedure).**

### 6.3 R2 / KV backups

- **R2:** No lifecycle policies, no cross-region replication config, no backup exports found in code or terraform.
- **KV:** No backup mechanism exists (Cloudflare KV has no native export/backup API that is scripted here). KV stores rate-limit counters and storefront cache — loss is operational inconvenience, not data loss.
- **D1:** One migration table (`0001_provider_execution_foundation.sql`) exists for lineage tracking. No D1 backup config found.

### 6.4 Migration safety

- **Destructive migrations: NONE found.** Every migration uses `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE ADD COLUMN` (additive), or `CREATE OR REPLACE FUNCTION`. No `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or mass `DELETE` found in any migration file.
- **`migrations/130_orders_site_id_not_null.sql`** runs a data-fixing `UPDATE` and adds `NOT NULL` constraints — has a guard that raises an exception if nulls exist before constraint enforcement (correct safety practice).
- **Migration safety assessment: GOOD** — the migration discipline is one of the stronger parts of the codebase.

---

## 7. NEW FINDINGS (not in master verdict)

### FINDING 1 — Hyperdrive is bound but architecturally incompatible; no connection pooling exists
**Claim:** Hyperdrive is configured for both environments but provides zero benefit because the data layer uses PostgREST HTTP, not `pg` wire protocol.
**Evidence:** `services/api-gateway/wrangler.toml:env.production.hyperdrive` binds ID `9e08563f...`; `packages/infrastructure/supabase-adapter/index.ts:34-38` creates a `createClient()` HTTP client; grep of entire codebase shows `HYPERDRIVE.connectionString` is never called.
**Severity:** HIGH — investment-grade claim "we have connection pooling" is false; connection exhaustion at scale is unmitigated.

### FINDING 2 — In-memory circuit breakers in queue-workers reset on isolate recycle
**Claim:** The per-queue circuit breaker (`queueCircuitBreakers` Map in `platform-queue-consumer.ts:183`) is stored in Worker isolate memory and is lost on every isolate cold start or recycle, meaning the circuit state is not durable and not shared across concurrent Worker instances.
**Evidence:** `services/queue-workers/src/platform-queue-consumer.ts:183` declares `const queueCircuitBreakers = new Map<...>()` at module scope; Cloudflare Workers isolates are recycled after idle periods; no KV/DO-backed state store is used.
**Severity:** MEDIUM — circuit breaker provides false confidence; a flapping DB will repeatedly open circuits in some isolates and remain closed in others, causing inconsistent drain behavior.

### FINDING 3 — FEATURE_GRAPHQL/EXTENSIONS/LIQUID are all disabled in production — core feature set is incomplete at launch
**Claim:** Three flagship features (GraphQL API, App Extensions, Liquid templating) are explicitly disabled in the production `wrangler.toml` with boolean flags, not by code absence. This is not a future roadmap item but an **active production configuration decision** that contradicts marketing claims.
**Evidence:** `services/api-gateway/wrangler.toml:239-241`:
```
FEATURE_GRAPHQL = "false"
FEATURE_EXTENSIONS = "false"
FEATURE_LIQUID = "false"
```
**Severity:** HIGH — investors and prospective merchants must know these are disabled in production; any merchant use-case requiring these features cannot be served today.

### FINDING 4 — Partitioned table shadows created but never cut over — hot tables remain unpartitioned
**Claim:** Migrations 079-083 create partitioned _shadow_ tables for `worker_request_logs`, `runtime_telemetry_metrics`, `outbox_events`, `platform_queue_jobs`, and `webhook_deliveries`, but explicit comments state "Live cutover requires staging proof and a maintenance window" — the live tables remain unpartitioned.
**Evidence:** `migrations/081_partition_outbox_events.sql:98`: "Non-terminal rows must be drained before cutover; outbox_events_legacy is retained for one retention cycle after swap." `migrations/080_partition_runtime_telemetry_metrics.sql:60`: "Partitioned shadow... Live cutover requires staging proof and approved maintenance-window cutover." No migration exists that renames `outbox_events` → `outbox_events_legacy` and promotes the partitioned shadow.
**Severity:** HIGH — hot tables are growing monotonically without range partitioning; autovacuum cannot reclaim space from processed rows without partition drop; at 10k merchants this becomes a vacuum/bloat emergency.

### FINDING 5 — `payout_statements` and `wallet_ledger_entries` use `INTEGER` for money columns (overflow at ₹21M)
**Claim:** Money amount columns in the mobile merchant money ledger are typed as Postgres `integer` (32-bit, max ~2.1B paise = ₹21,474,836), not `bigint`.
**Evidence:** `migrations/119_mobile_money_ledgers.sql:16-19`:
```sql
gross_amount_minor integer DEFAULT 0 NOT NULL,
platform_fee_minor integer DEFAULT 0 NOT NULL,
tax_minor         integer DEFAULT 0 NOT NULL,
net_amount_minor  integer DEFAULT 0 NOT NULL,
```
`wallet_ledger_entries.amount_minor integer` (`migrations/119_mobile_money_ledgers.sql:52`). A single high-GMV merchant's daily payout crossing ₹21.5M causes a silent overflow exception.
**Severity:** CRITICAL — financial data corruption without runtime error in many cases (Postgres raises on explicit overflow but COALESCE patterns mask it).

### FINDING 6 — Products table has no composite `(site_id, status, created_at)` index
**Claim:** The primary product-listing query pattern (`WHERE site_id=$1 AND status='active' AND deleted_at IS NULL ORDER BY created_at DESC`) has no matching index; the available indexes are single-column.
**Evidence:** All product indexes in `migrations/000_baseline.sql:18056-18070`: `idx_products_active (site_id WHERE deleted_at IS NULL)`, `idx_products_store (store_id)`, `idx_products_store_hsn (store_id, hsn_code WHERE hsn_code IS NOT NULL)`. No `status` column appears in any product index.
**Severity:** HIGH at 1k+ merchants — full partition scan for product listing with status filter on any store with >1k products.

### FINDING 7 — Rate limiting fails open silently in production when Redis is not provisioned
**Claim:** When `UPSTASH_REDIS_REST_URL`/`TOKEN` are not injected as runtime secrets, the production rate limiter fails open (allows all requests) rather than failing closed.
**Evidence:** `services/api-gateway/src/middleware/rateLimit.ts:884-888`: `if (isProduction) { warnRateLimitFailOpen('no_backend'); return checks.map((check) => failOpenRateLimitResult(...)); }` — a single console.warn (throttled to 1/minute) is emitted and all rate limit checks are bypassed. The `wrangler.toml` production vars section has **no `UPSTASH_REDIS_REST_URL`** entry — it is a secret injected at deploy time, but `SKIP_NEEDS_HUMAN_*` sentinel detection only applies to the credential keys listed in `wrangler.toml`; the deploy pipeline checks `HAS_PRODUCTION_UPSTASH_REDIS_REST_URL` (`production-deploy.yml:39`) but does not hard-fail if false. If the secret is empty, the runtime accepts all traffic with no rate control.
**Severity:** HIGH — a missing secret silently disables all auth brute-force protection, checkout abuse limits, and API quota controls.

### FINDING 8 — Cron-based outbox drain is structurally rate-limited to 4,800 events/day, structurally incompatible with 1k+ merchant scale
**Claim:** The 15-minute api-gateway scheduled cron (processing max 50 events/run) creates a hard ceiling of 4,800 outbox events/day drained through the outbox→platform_queue_jobs path.
**Evidence:** `services/api-gateway/wrangler.toml:env.production.triggers: ["*/15 * * * *"]`; `index.ts:855: dispatchBatch({ outboxLimit: 50 })`; comment at `wrangler.toml:229`: "Beta free-tier: was `*/1`... 15m = 96 fires/day." The queue-workers Cloudflare Queue consumer is push-triggered and fast, but it only processes `platform_queue_jobs` rows — which are only inserted by the api-gateway outbox dispatch step. The consumer cannot drain faster than the feeder cron.
**Severity:** CRITICAL at scale — WhatsApp order notifications, analytics writes, and webhook deliveries are all throttled by a cost-saving beta configuration that has been hardened into the production topology.

---

## 8. WHAT THE MASTER VERDICT GOT WRONG OR MISSED

### 8.1 Items the master verdict correctly identified (confirmed)
- Service-role client used everywhere; `getSupabaseUser` has 0 call-sites — **confirmed.**
- Payouts are fabricated; `planSandboxAppPayoutTransfer` is always called regardless of `providerMode` in the queue-worker path — **confirmed and extended:** even `providerMode='live'` only sets `live_transfer_required: true` in metadata; no actual API call is made to any PA (`billing-core/src/index.ts:529-545`).
- `integer` money overflow in `migrations/119` — **confirmed.** The master verdict identified it; this report adds the specific tables and amount threshold.
- 15-minute cron throttle — **confirmed and quantified** as a structural 4,800 events/day ceiling.

### 8.2 Items the master verdict overstated (downgraded)

**Durable Objects bottleneck risk: DOWNGRADED from implied concern to minimal risk.**
The master verdict's framing suggests DO could be a hot-path bottleneck. Code evidence shows `LetbuyyRuntimeDurableObject` handles only `/health` and `/checkpoint` (`durable/runtime-coordinator.ts:19-36`). No product write path uses the DO. This is not a current risk — only a future architectural risk if the DO is promoted.

**RLS "inert" framing: PARTIALLY CONFIRMED, PARTIALLY DOWNGRADED.**
The master verdict states "685 RLS policies inert" due to service-role bypass. This is correct for API paths (which all use `getSupabaseAdmin` → service role). However, migrations 119, 139 show that some tables have properly scoped `authenticated` role policies with subquery ownership checks (e.g., `payout_statements_site_owner_all`). These RLS policies are not inert — they protect direct Supabase dashboard / SDK access by authenticated users. The API data path bypasses them, but they are not zero-value. **Score impact: minor.**

### 8.3 New material the master verdict missed

1. **Hyperdrive is bound but provides zero benefit** (Finding 1) — not mentioned in master verdict.
2. **In-memory circuit breakers reset on isolate recycle** (Finding 2) — not mentioned.
3. **GraphQL/Extensions/Liquid all disabled in production** (Finding 3) — master verdict acknowledges FEATURE flags but does not state all three major features are currently disabled in production.
4. **Partition cutover never executed** (Finding 4) — master verdict mentions partitioning exists; does not state the hot live tables are still unpartitioned.
5. **Products table missing composite index** (Finding 6) — not mentioned.
6. **Rate limiting silently fails open when Redis secret absent** (Finding 7) — a prior forensic report (`PRODUCTION_READINESS_DEEP_AUDIT_2026-06-07.md:66`) mentioned a 503 risk; **the code has since been changed to fail OPEN instead of 503** — this is a different failure mode (silent bypass vs. hard failure). The master verdict does not reflect the current fail-open behavior.
7. **4,800 events/day outbox ceiling** (Finding 8) — quantified here for the first time.

---

## 9. CORRECTED PRODUCTION-READINESS SCORE

The master verdict scored **45/100**.

**Adjustments from this ARB challenge:**

| Delta | Rationale |
|-------|-----------|
| +0 | Outbox design is correct (confirmed) — no credit change |
| -3 | Hyperdrive false claim of connection pooling — infrastructure maturity overstated |
| -3 | All three major features disabled in production — functional completeness lower than represented |
| -2 | Partition cutover pending — scale readiness lower than indicated |
| -2 | 4,800 events/day cron ceiling at production — async throughput lower than implied |
| +2 | Migration discipline is stronger than scored — no destructive migrations, additive-only |
| +1 | Outbox design and queue-workers consumer are well-engineered — more credit warranted |
| -3 | Products index gap + INTEGER money overflow are unmitigated P0 bugs at 1k+ scale |

**Revised score: 35/100**

The score is lower than the master verdict's 45/100 primarily because:
- Three headline features are disabled in production
- The connection pooling claim (Hyperdrive) is false
- Partition cutover is unexecuted, leaving hot tables growing without bounds
- The outbox drain bottleneck is quantifiably incompatible with the stated scale targets

The revised score does not reflect a worse codebase — it reflects a more accurate assessment that removes credit for infrastructure capabilities (Hyperdrive, feature parity, partitioning) that exist in config but do not function at runtime.

---

## APPENDIX: Evidence Index

| Finding | Primary File | Lines |
|---------|-------------|-------|
| Hyperdrive bound, never used | `packages/infrastructure/supabase-adapter/index.ts` | 34-38 |
| Hyperdrive binding in wrangler | `services/api-gateway/wrangler.toml` | env.production.hyperdrive |
| HYPERDRIVE declared in Env | `services/api-gateway/src/index.ts` | 97 |
| In-memory circuit breaker | `services/queue-workers/src/platform-queue-consumer.ts` | 183, 232-254 |
| FEATURE flags production | `services/api-gateway/wrangler.toml` | 239-241 |
| Partition shadow not cut over | `database/supabase/migrations/081_partition_outbox_events.sql` | 98 |
| Partition shadow not cut over | `database/supabase/migrations/080_partition_runtime_telemetry_metrics.sql` | 60 |
| INTEGER money columns | `database/supabase/migrations/119_mobile_money_ledgers.sql` | 16-19, 52 |
| Products index gap | `database/supabase/migrations/000_baseline.sql` | 18056-18070 |
| Rate limit fail-open | `services/api-gateway/src/middleware/rateLimit.ts` | 884-888 |
| Cron 15-min throttle | `services/api-gateway/wrangler.toml` | env.production.triggers |
| Cron batch limit 50 | `services/api-gateway/src/index.ts` | 855 |
| Outbox dispatch correct | `services/api-gateway/src/execution/outbox-execution.adapter.ts` | 70-95 |
| Outbox claim SKIP LOCKED | `database/supabase/migrations/000_baseline.sql` | 744-759 |
| Orders composite index (migration 130) | `database/supabase/migrations/130_orders_site_id_not_null.sql` | 59-65 |
| Push credentials placeholder | `services/queue-workers/wrangler.toml` | 24-32 |
| planSandboxAppPayoutTransfer | `packages/billing-core/src/index.ts` | 525-546 |
| No RTO/RPO defined | `FOUNDATION_FORENSICS_2026_06_09/LETBUYY_PRODUCTION_READINESS_FORENSICS.md` | 100 |
| Backup 7-day retention only | `.github/workflows/production-deploy.yml` | 234-237 |
| KV eventual consistency | Cloudflare platform documentation + `lib/storefront-cache.ts` | 127 |
| DO health/checkpoint only | `services/api-gateway/src/durable/runtime-coordinator.ts` | 19-36 |
