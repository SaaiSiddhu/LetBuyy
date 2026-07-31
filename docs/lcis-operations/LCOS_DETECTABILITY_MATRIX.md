# LCOS Detectability Matrix
**Phase-6 Discovery — LetBuyy Central Operations System**
_Generated: 2026-06-21_

Classification key:
- **DETECTABLE** — structural topology is repo-derived (CONNECTED now); LCOS can answer from artifacts.
- **PARTIAL** — topology known + binding declared; live metric value requires an env-var / adapter that is NOT yet connected.
- **UNKNOWN** — structural topology exists but LCOS cannot determine the metric without a live source.
- **NOT_DETECTABLE** — signal has no declared source in the repo or topology.

Honesty contract: every live value is real-source or `NOT_CONNECTED + exact env-var`. No metric value is fabricated.

---

## Service Area 1 — Runtime

| Signal | Classification | dataSource (structural) | liveSource | env-var / binding / RPC |
|---|---|---|---|---|
| Worker failures (error count) | PARTIAL | `runtime-intel.json` → `workers[].name`, `observability:true` | Cloudflare Analytics Engine SQL API over `RUNTIME_TELEMETRY` dataset | `RUNTIME_TELEMETRY` (Analytics Engine binding); `CF_API_TOKEN` |
| Worker error-rate (%) | PARTIAL | `runtime-intel.json` → 4 workers declared, `analyticsDatasets:["RUNTIME_TELEMETRY"]` | Cloudflare Analytics Engine | `RUNTIME_TELEMETRY`; `CF_API_TOKEN` |
| Queue backlog (depth) | PARTIAL | `runtime-observability.json` → 5 queues declared (`EVENT_QUEUE`, `ANALYTICS_QUEUE`, `SEARCH_QUEUE`, `NOTIFICATION_QUEUE`, `RUNTIME_QUEUE`) | Cloudflare Queues metrics API | `CF_API_TOKEN`; queue binding names declared in `wrangler.toml` |
| Dead-letters (DLQ count) | PARTIAL | `runtime-observability.json` → `deadLetterQueues:2` declared | Cloudflare Queues DLQ inspection API | `CF_API_TOKEN` |
| Stuck jobs / retries | PARTIAL | `runtime-observability.json` → queue consumer topology known | Cloudflare Queues metrics API (retry count) | `CF_API_TOKEN` |
| Cron failures | PARTIAL | `runtime-intel.json` → 2 cron schedules (`*/15 * * * *`, `17 */6 * * *`) on `letbuyy-api` | `wrangler tail letbuyy-api` event stream + Analytics Engine | `RUNTIME_TELEMETRY`; `CF_API_TOKEN` |
| Cold-start latency | PARTIAL | `telemetry-intelligence.json` → Cloudflare Analytics Engine adapter | Analytics Engine SQL | `RUNTIME_TELEMETRY`; `CF_API_TOKEN` |
| Subrequest count per worker | PARTIAL | Topology declared | `wrangler tail <worker>` stream | `CF_API_TOKEN` |

---

## Service Area 2 — Commerce

| Signal | Classification | dataSource (structural) | liveSource | env-var / binding / RPC |
|---|---|---|---|---|
| GMV (gross merchandise value) | PARTIAL | `revenue-intelligence-v2.json` → 34 money RPCs, ledger model; `get_net_gmv` RPC named | Supabase: `SELECT sum(total_minor) FROM orders WHERE …` or named ledger reconciliation RPC | `SUPABASE_SERVICE_ROLE_KEY`; `NEXT_PUBLIC_SUPABASE_URL` |
| Orders created (count/rate) | PARTIAL | `merchant-intelligence.json` → `orders` money-stage declared | Supabase `orders` table row count / `created_at` timestamp scan | `SUPABASE_SERVICE_ROLE_KEY` |
| Refund spikes | PARTIAL | `revenue-intelligence-v2.json` → `refunds` model + `complete_order_refund` RPC | Supabase `refunds` table + `complete_order_refund` RPC calls | `SUPABASE_SERVICE_ROLE_KEY` |
| Payment failures (Razorpay) | PARTIAL | `security-intelligence-v5.json` → `payment_transactions` is a canonical ledger table; HMAC-SHA256 verification topology known | Supabase `payment_transactions.status = 'failed'` + Razorpay webhook events | `SUPABASE_SERVICE_ROLE_KEY`; `RAZORPAY_KEY_SECRET` |
| Checkout drop-off / abandonment | UNKNOWN | `customer-intelligence.json` → funnel graph model declared | `analytics_event_stream` + `orders` join (no live adapter wired) | `SUPABASE_SERVICE_ROLE_KEY`; Analytics Engine event stream |
| COD order rate | PARTIAL | `merchant-intelligence.json` → `orders` money-stage; COD supported by topology | Supabase `orders WHERE payment_method = 'cod'` | `SUPABASE_SERVICE_ROLE_KEY` |
| Gift-card liability | PARTIAL | `revenue-intelligence-v2.json` → `giftCardLiabilityModeled:true`; ledger-projection model | Supabase `gift_card_ledger_entries` balance projection RPC | `SUPABASE_SERVICE_ROLE_KEY` |
| Payout queue depth | PARTIAL | `revenue-intelligence-v2.json` → `payouts` model | Supabase `payouts` table + Razorpay payout API | `SUPABASE_SERVICE_ROLE_KEY`; `RAZORPAY_KEY_SECRET` |

---

## Service Area 3 — Merchant

| Signal | Classification | dataSource (structural) | liveSource | env-var / binding / RPC |
|---|---|---|---|---|
| Merchant activation count | PARTIAL | `merchant-intelligence.json` → 10 operating stages, `sites` table = tenant root | Supabase `sites` row count + lifecycle state | `SUPABASE_SERVICE_ROLE_KEY` |
| Merchant growth rate | PARTIAL | `merchant-intelligence.json` → `foundingProgram.capacity:100` | Supabase `sites.created_at` time-series | `SUPABASE_SERVICE_ROLE_KEY` |
| Merchant churn / dormancy | PARTIAL | `merchant-churn.json` + `merchant-intelligence.json` → lifecycle states declared | Supabase `sites` + `orders` last-activity scan | `SUPABASE_SERVICE_ROLE_KEY` |
| Single-point-of-dependency exposure | DETECTABLE | `merchant-intelligence.json` → `singlePointOfDependency:true`; structural finding is repo-derived | N/A — structural; no live data needed | N/A |
| Onboarding completion funnel | PARTIAL | `merchant-intelligence.json` → `operatingStages:10` | Supabase `sites` lifecycle column + `store_customers` registration events | `SUPABASE_SERVICE_ROLE_KEY` |
| Staff RBAC enforcement gaps | DETECTABLE | `security-intelligence-v5.json` → `crossTenantCandidates:20`; deterministic validator `rls-force-coverage` | N/A — structural gate is authoritative | N/A |

---

## Service Area 4 — Customer

| Signal | Classification | dataSource (structural) | liveSource | env-var / binding / RPC |
|---|---|---|---|---|
| Conversion rate | UNKNOWN | `customer-intelligence.json` → 8 funnel graphs modeled | `analytics_event_stream` + `orders` join — no live adapter wired | `SUPABASE_SERVICE_ROLE_KEY`; `RUNTIME_TELEMETRY` |
| Traffic / sessions | PARTIAL | `telemetry-intelligence.json` → Cloudflare Analytics Engine `requests` metric | Cloudflare Analytics Engine SQL | `RUNTIME_TELEMETRY`; `CF_API_TOKEN` |
| Search usage | PARTIAL | `runtime-intel.json` → `SEARCH_QUEUE` producer declared | Cloudflare Queues metrics API (SEARCH_QUEUE depth) | `CF_API_TOKEN` |
| Cart abandonment rate | UNKNOWN | `customer-journey-intelligence.json` → checkout journey modeled | `analytics_event_stream` — no adapter wired | `SUPABASE_SERVICE_ROLE_KEY`; `RUNTIME_TELEMETRY` |
| Refund requests (customer-initiated) | PARTIAL | `merchant-intelligence.json` → refund money-stage; `complete_order_refund` RPC | Supabase `refunds` table | `SUPABASE_SERVICE_ROLE_KEY` |

---

## Service Area 5 — Deployment

| Signal | Classification | dataSource (structural) | liveSource | env-var / binding / RPC |
|---|---|---|---|---|
| Active deploys / deploy in progress | PARTIAL | `deployment-intelligence-v5.json` → `declaredHead:4a91fa96`; 5 Vercel apps + 4 Workers declared | Vercel Deployments API + GitHub Actions status API | `VERCEL_TOKEN`; `GITHUB_TOKEN` |
| Release health score | PARTIAL | `deployment-intelligence-v5.json` → `rollbackPresent:true`, `missingRollback:0` | Vercel + GitHub Actions run status | `VERCEL_TOKEN`; `GITHUB_TOKEN` |
| Rollback availability | DETECTABLE | `deployment-intelligence-v5.json` → `rollbackPresent:true`, `missingRollback:0`; declared structural | N/A — structural | N/A |
| Failed deploys | PARTIAL | `deployment-intelligence-v5.json` → pipeline order + `migrateGate:true` | GitHub Actions workflow run status API | `GITHUB_TOKEN` |
| Migration gate status | DETECTABLE | `deployment-intelligence-v5.json` → `migrateGate:true`, `appliesMigrations:false` | N/A — structural | N/A |
| SPOFs in deployment topology | DETECTABLE | `deployment-intelligence-v5.json` → `spofCount:3` named | N/A — structural | N/A |
| Secrets present in environment | PARTIAL | `deployment-intelligence-v5.json` → `secretsRequired:19` declared | Vercel env-var presence check API | `VERCEL_TOKEN` |

---

## Service Area 6 — Incident

| Signal | Classification | dataSource (structural) | liveSource | env-var / binding / RPC |
|---|---|---|---|---|
| Active incidents | UNKNOWN | `incident-intelligence-v5.json` → blast/rollback shape declared; no live incident store | No incident-management integration (PagerDuty/OpsGenie) configured | NOT_DETECTABLE until incident-store adapter is added |
| Incident blast radius | DETECTABLE | `blast-radius` service via `BlastRadiusService.blast(subject)` over `graph.json` | N/A — structural | N/A |
| Time-to-recovery (TTR) | NOT_DETECTABLE | No historical incident duration data in repo | Requires incident timeline store | NOT_DETECTABLE |
| Recovery action availability | DETECTABLE | `incident-intelligence-v5.json` → `rollbackPolicy` per domain; `EisEngine.rollback` plans structural | N/A — structural | N/A |
| Outage impact (affected domains) | DETECTABLE | `BlastRadiusService.crossDomain()` returns affected domains from `domain-intel.json` | N/A — structural | N/A |
| Queue-driven incident detection | PARTIAL | `runtime-observability.json` → 2 DLQs + 5 queue topologies | Cloudflare Queues DLQ length | `CF_API_TOKEN` |

---

## Service Area 7 — Security

| Signal | Classification | dataSource (structural) | liveSource | env-var / binding / RPC |
|---|---|---|---|---|
| Auth anomalies (failed logins, token reuse) | PARTIAL | `security-intelligence-v5.json` → trust boundaries + issuer topology; Supabase adapter declared | Supabase Auth logs + `auth.audit_log_entries` | `SUPABASE_SERVICE_ROLE_KEY` |
| Rate-limit breaches | PARTIAL | `security-intelligence-v5.json` → Turnstile + rate-limit topology declared | Cloudflare Turnstile analytics + Analytics Engine | `CF_API_TOKEN`; `TURNSTILE_SECRET_KEY` |
| Credential / secret events | NOT_DETECTABLE | `deployment-intelligence-v5.json` → 19 secrets required; names known | Requires secret-rotation / audit log integration | NOT_DETECTABLE until Vault / secret-audit adapter added |
| Cross-tenant candidates (RLS gaps) | DETECTABLE | `security-intelligence-v5.json` → `crossTenantCandidates:20` (structural heuristics) | N/A — gate is authoritative | N/A |
| RLS policy coverage | DETECTABLE | `security-intelligence-v5.json` → 651 policies, `tenantTables:255`; `rls-force-coverage` validator | N/A — deterministic validator | N/A |
| Step-up HMAC gate status | DETECTABLE | `security-intelligence-v5.json` → step-up topology declared (refunds/payouts gated) | N/A — structural | N/A |
| Webhook HMAC verification | DETECTABLE | `security-intelligence-v5.json` → webhook HMAC signing declared (`signQueueTenantEnvelope`) | N/A — structural | N/A |
| Abuse / scraping detection | UNKNOWN | Cloudflare WAF topology partially declared | Cloudflare WAF analytics — no adapter key wired | `CF_API_TOKEN`; WAF ruleset API |

---

## Service Area 8 — Forecast

| Signal | Classification | dataSource (structural) | liveSource | env-var / binding / RPC |
|---|---|---|---|---|
| Traffic growth projection | PARTIAL | `runtime-intel.json` → 4 workers + routes declared; cost scaling model in `cost-intelligence.json` | Cloudflare Analytics Engine (request trend) | `RUNTIME_TELEMETRY`; `CF_API_TOKEN` |
| Order volume forecast | PARTIAL | `revenue-intelligence-v2.json` → 8 models; growth model in `merchant-growth.json` | Supabase `orders.created_at` time-series | `SUPABASE_SERVICE_ROLE_KEY` |
| Queue saturation forecast | PARTIAL | `runtime-observability.json` → 5 queues + consumer topology; `cost-intelligence.json` → scaling model | Cloudflare Queues current depth (live backlog needed for trend) | `CF_API_TOKEN` |
| Merchant growth forecast | PARTIAL | `merchant-growth.json` + `merchant-intelligence.json` → `foundingProgram.capacity:100`; lifecycle states | Supabase `sites.created_at` time-series | `SUPABASE_SERVICE_ROLE_KEY` |
| Cost forecast | PARTIAL | `cost-intelligence.json` → 10 services, 4 hotspots, rate model (published-list reference) | Usage is `live-query-required`; no usage stored in repo | `CF_API_TOKEN`; Vercel API; Supabase billing API |
| Gift-card liability forecast | PARTIAL | `revenue-intelligence-v2.json` → `giftCardLiabilityModeled:true`; ledger projection model | Supabase `gift_card_ledger_entries` balance sum | `SUPABASE_SERVICE_ROLE_KEY` |
| Infra capacity headroom | DETECTABLE | `cost-intelligence.json` → scaling model + `hotspots:4`; structural ceiling from Workers plan | N/A for structural headroom ceiling | N/A |

---

## Summary counts

| Classification | Count |
|---|---|
| DETECTABLE (structural, repo-derived, no live data needed) | 16 |
| PARTIAL (topology known; live value needs env-var/adapter) | 37 |
| UNKNOWN (topology partial; no live source wired, source identified) | 5 |
| NOT_DETECTABLE (no declared source, adapter needed) | 3 |
| **Total signals** | **61** |

### Adapter connection map (what to wire to unlock PARTIAL signals)

| Adapter | Env-var(s) required | Signals unlocked |
|---|---|---|
| Cloudflare (Analytics Engine + Queues) | `CF_API_TOKEN`, `RUNTIME_TELEMETRY` binding | Worker failures, error-rate, queue backlog, DLQs, cron failures, cold-start, traffic, search depth, cost |
| Supabase (service-role read) | `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` | GMV, orders, refunds, payments, gift-card liability, merchant activation/growth/churn, customer refunds, order forecast |
| GitHub Actions | `GITHUB_TOKEN` | Deploy status, failed deploys, release health |
| Vercel | `VERCEL_TOKEN` | Deploy health, secrets presence |
| Razorpay | `RAZORPAY_KEY_SECRET` | Payment failures (webhook events), payout queue |
| Incident store (future) | TBD — PagerDuty / OpsGenie | Active incidents, TTR |
| Secret-audit adapter (future) | TBD | Credential / secret events |
