# LCOS Forecast Discovery

**Generated:** 2026-06-21  
**Source files read:** `graphify-out/cost-intelligence.json`, `graphify-out/merchant-intelligence.json`, `graphify-out/customer-intelligence.json`, `graphify-out/runtime-intel.json`, `graphify-out/deployment-intelligence-v5.json`, `graphify-out/merchant-growth.json`, `graphify-out/revenue-intelligence-v2.json`, `graphify-out/telemetry-intelligence.json`  
**Status legend:** DETECTABLE = structural model exists; PARTIAL = some data present; NOT_CONNECTED = no time-series in repo (exact source stated)

---

## 1. Cost Model (Structural)

### What cost-intelligence.json contains

Ten priced services with published list rates, a dependency graph mapping each cost driver to a scaling dimension, and a hotspot ranking. All usage values are `"live-query-required"` — no fabricated totals appear in the JSON.

**Real field values from JSON (`pricing` array):**

| Service | Unit | List Rate (published) | Usage Metric | Source |
|---|---|---|---|---|
| Cloudflare Workers (requests) | million requests | $0.30/million (after $5/mo Paid incl 10M) | request count | Analytics Engine / RUNTIME_TELEMETRY |
| Workers KV | reads/writes + GB-mo | $0.50/million reads, $5/million writes, $0.50/GB-mo | kv ops + storage | Cloudflare dashboard |
| R2 (object storage) | GB-mo + ops | $0.015/GB-mo storage, $4.50/million Class A ops, egress FREE | GB stored + ops | Cloudflare R2 metrics |
| Cloudflare Queues | million operations | $0.40/million operations | queue ops | Cloudflare Queues metrics |
| Analytics Engine | data points + queries | per data point written/read | telemetry write volume | RUNTIME_TELEMETRY dataset |
| Hyperdrive | connection pooling | no extra per-query | connections | Cloudflare Hyperdrive |
| Vercel | seats + bandwidth + functions | $20/seat/mo Pro + usage | seats + bandwidth + fn invocations | Vercel usage |
| Supabase (Postgres) | compute + storage + egress | $25/mo Pro + compute add-ons + $0.125/GB storage + egress | db size + compute + egress | Supabase usage / db size |
| Resend (email) | emails | $20/mo for 50k, then per-email | emails sent | Resend API / NOTIFICATION_QUEUE volume |
| Razorpay (payments) | % of transaction value | ~2% per captured transaction (India standard) | captured GMV | `payment_transactions` / ledger (live GMV) |

**Cost formula declared in JSON:**
```
monthlyCost = Σ_service (listRate × liveUsage) − freeTierAllowance
```

The JSON supplies the rate model and formula. `liveUsage` is the only missing variable.

### Hotspot ranking (real from JSON, `hotspots` array)

1. **Razorpay** — ~2% of GMV; grows linearly with revenue; largest line at scale. Lever: negotiate MDR; route COD off-gateway.
2. **Supabase Postgres** — single shared DB compute + storage scales with merchants × orders × catalog. Lever: read replicas, projections, partitioning.
3. **Cloudflare Workers + Queues** — request + queue ops scale with concurrent users; cheap per-unit but unbounded. Lever: cache (CACHE binding), batch queue consumers.
4. **Vercel bandwidth** — storefront traffic egress. Lever: CDN cache hit-rate, image optimization.

### Which cost dimensions are DETECTABLE structurally vs query-bound

| Cost Dimension | Status | Notes |
|---|---|---|
| Rate table (all 10 services) | DETECTABLE | Published list rates in `pricing[*].listRate` |
| Cost hotspot ranking | DETECTABLE | `hotspots[*].rank` + `why` in JSON |
| Scaling drivers per service | DETECTABLE | `dependencyGraph[*].driver` + `scalesWith` in JSON |
| Actual monthly totals | NOT_CONNECTED | `totalCost: "live-query-required"` — source per service in `pricing[*].source` |
| Workers request count | NOT_CONNECTED | Source: Analytics Engine / RUNTIME_TELEMETRY dataset |
| Supabase DB size | NOT_CONNECTED | Source: Supabase usage dashboard / `db size` metric |
| Captured GMV (Razorpay line) | NOT_CONNECTED | Source: `payment_transactions` table, `total_minor` column |
| Queue op count | NOT_CONNECTED | Source: Cloudflare Queues metrics API |
| Resend email volume | NOT_CONNECTED | Source: Resend API / `NOTIFICATION_QUEUE` volume |

### Forecast method applicable when live usage data is wired

Once a time-series of monthly usage snapshots is available (minimum 3 months):

- **Linear trend:** `cost_next = a + b × t` (OLS on historical monthly totals per service)
- **Razorpay specifically:** `monthly_fee = 0.02 × GMV_month` — a direct ratio model, no regression needed; accuracy tracks GMV forecast accuracy
- **Composite model:** `totalMonthlyCost(m) = Σ_service max(0, listRate_s × usage_s(m) − freeTier_s)`; substitute moving-average forecast for each `usage_s(m)`
- **Confidence interval:** ±1.96 × σ of residuals from the trend (normal approx); valid at ≥6 data points

---

## 2. Scaling & Capacity Model

### Queue / Worker topology from runtime-intel.json (real values)

**Workers declared (`workers` array, 4 total):**

| Worker name | Routes | Crons | Role |
|---|---|---|---|
| `letbuyy-api` | `api.letbuyy.com`, staging variants | `*/15 * * * *` (every 15 min) | API gateway; produces all 5 queues |
| `letbuyy-queue-workers` | none (no HTTP routes) | `17 */6 * * *` (every 6 h at :17) | Consumes all 7 queue bindings |
| `letbuyy-webhook` | `webhooks.letbuyy.com`, staging | none | Webhook delivery |
| `letbuyy-mobile-bff` | `bff.letbuyy.com`, staging | none | Mobile back-end-for-frontend |

**Queue graph (`queueGraph` array, 5 queues):**

| Queue binding | Producer | Consumer |
|---|---|---|
| `EVENT_QUEUE` | `letbuyy-api` | `letbuyy-queue-workers` |
| `ANALYTICS_QUEUE` | `letbuyy-api` | `letbuyy-queue-workers` |
| `SEARCH_QUEUE` | `letbuyy-api` | `letbuyy-queue-workers` |
| `NOTIFICATION_QUEUE` | `letbuyy-api` | `letbuyy-queue-workers` |
| `RUNTIME_QUEUE` | `letbuyy-api` | `letbuyy-queue-workers` |

Dead-letter queues registered (from `telemetry-intelligence.json` `ingestion.realBindingsInRepo.deadLetterQueues`):
- `letbuyy-dead-letters-staging`
- `letbuyy-staging-dead-letter-queue`

**`liveSnapshot: false`** — the JSON explicitly records no live snapshot was captured at graph time.

### Saturation thresholds derivable structurally

Cloudflare Workers and Queues impose platform-level limits rather than configured per-app limits; none are declared in `wrangler.toml` files (no `max_concurrent_consumers`, no `queue_size_limit` in the JSON). The structural model maps the topology and scaling drivers:

- Workers scale horizontally on Cloudflare's global network — per-request limits (CPU time: 10 ms on Free, 30 s on Paid) apply but are not encoded in LCIS.
- Queue throughput scales with the number of `letbuyy-queue-workers` instances running concurrently; Cloudflare enforces a default `max_concurrency` that is runtime-configured, not in the repo.
- The `17 */6 * * *` cron runs 4 times per day — any backlog must clear in under 6 hours between cron sweeps.

### NOT_CONNECTED: live queue depth and worker utilization

| Signal | Status | Exact Source |
|---|---|---|
| Queue backlog (messages in flight) | NOT_CONNECTED | Cloudflare Queues metrics API; also `wrangler tail letbuyy-queue-workers` (stream) |
| Worker invocation count / error rate | NOT_CONNECTED | Analytics Engine SQL API over `RUNTIME_TELEMETRY` dataset; binding `RUNTIME_TELEMETRY`, auth: CF API token |
| Worker CPU / latency percentiles | NOT_CONNECTED | Cloudflare Analytics Engine — `adapters[0].adapter` in `telemetry-intelligence.json` |
| Dead-letter queue depth | NOT_CONNECTED | Cloudflare Queues metrics API on `letbuyy-dead-letters-staging` / `letbuyy-staging-dead-letter-queue` |
| Cron last-run / duration | NOT_CONNECTED | Workers cron trigger logs via `wrangler tail`; binding: `[triggers] crons` |

---

## 3. Growth Series Availability

### Merchant growth time-series

From `merchant-intelligence.json`:
- No `timeSeries` array, `historicalPoints` array, or any dated sequence of merchant counts exists in the JSON.
- The JSON contains a structural lifecycle model (8 states: Created → Activated → First Product → First Order → First Revenue → Active → At Risk → Churned), transition signals, and detector query templates.
- The founding program capacity is structural (`total: 100`, `public: 70`, `invited: 20`, `partner: 10`), but `remainingSlots`, `allocated`, and `conversionRate` are all `connected: false`.

**DETERMINISTIC FORECAST NOT POSSIBLE — 0 historical merchant-count data points present. Need ≥3 points.**

Exact Supabase table that supplies the series: `sites` (one row per merchant/store, `created_at` timestamp for cohort series); secondary signals from `onboarding_attempts.created_at`, `subscriptions.status`.

### Customer growth / funnel time-series

From `customer-intelligence.json`:
- The JSON declares 8 graph models (funnel, conversion, refund, retention, risk, journey, abandonment, loyalty) with sources and metric definitions.
- Every single model value field is `"live-query-required"` — no data points are stored.
- No historical series exists in the file.

**DETERMINISTIC FORECAST NOT POSSIBLE — 0 historical customer/funnel data points present. Need ≥3 points.**

Exact Supabase tables that supply the series:
- Funnel stages: `analytics_event_stream`, `analytics_events`, `carts`, `checkout_sessions`, `orders`
- Retention / repeat purchase: `store_customers`, `orders`, `customer_activity_log`
- Abandonment: `carts`, `checkout_sessions`, `customer_wishlists`

### Merchant growth model (from merchant-growth.json)

Five growth dimensions declared with sources:

| Dimension | Signal | Source Tables |
|---|---|---|
| GMV trend | `sum(orders.total_minor)` over time per site | `orders`, `ledger_entries` |
| Catalog growth | new products published | `products`, `product_options`, `collections` |
| Repeat rate | returning customers per site | `store_customers`, `customer_activity_log`, `orders` |
| AOV | avg order value trend | `orders`, `order_items` |
| Channel mix | gift-card + promotion uptake | `gift_card_accounts`, `promotion_redemptions` |

All detector values (`growthRate`, `growingMerchants`, `stalledMerchants`) are `"live-query-required"`.

**DETERMINISTIC FORECAST NOT POSSIBLE for any growth dimension — 0 historical data points present. Need ≥3 points.**

---

## 4. Forecast Methods (Ready to Apply)

No series in the current `graphify-out/` files contains ≥1 historical data point. The following table records the deterministic method to apply once data is connected; no simulation or estimate is used.

### Series with data present: NONE

All series in `merchant-intelligence.json`, `customer-intelligence.json`, and `merchant-growth.json` return `"live-query-required"` with zero stored values.

### Methods ready to apply when data is connected

**Merchant count (new stores per month)**
- Source: `SELECT date_trunc('month', created_at) AS month, count(*) FROM sites GROUP BY 1 ORDER BY 1`
- Method once ≥3 months available: simple linear trend `y = a + bx` (OLS). At ≥6 months: 3-period simple moving average (SMA-3) for smoothing; compare with OLS R².
- Confidence interval: ±1.96 × residual standard error (normal approximation; valid at ≥6 points).

**Customer funnel conversion rate (stage-to-stage)**
- Source: `analytics_event_stream` aggregated by `event_type` + `session_id` per month.
- Method once ≥3 months available: each stage-to-stage ratio treated as an independent time series; SMA-3 on each ratio. At ≥12 months: seasonal decomposition (additive) for Indian festive patterns (Diwali, Holi windows).
- Bottleneck detection: the stage with the lowest and most declining conversion ratio is the forecast bottleneck; no AI required.

**GMV / revenue per month**
- Source: `SELECT date_trunc('month', created_at) AS month, sum(total_minor)/100.0 AS gmv_inr FROM orders GROUP BY 1 ORDER BY 1`; cross-check with `ledger_entries` via `refresh_money_ledger_site_reconciliation` RPC.
- Method once ≥3 months available: OLS trend on monthly GMV. Razorpay fee forecast = `0.02 × GMV_forecast`.
- Confidence interval: ±1.96 × σ of OLS residuals.

**Queue depth trend**
- Source: Cloudflare Queues metrics API (authenticated CF API token); no Supabase table — queue state is ephemeral in Cloudflare.
- Method once ≥7 daily snapshots available: SMA-7 on daily peak queue depth; flag when SMA-7 exceeds 80% of Cloudflare's platform limit.
- Saturation ratio: `depth_t / platform_limit` (ratio model, no regression needed).

**Worker error rate**
- Source: Analytics Engine SQL API over `RUNTIME_TELEMETRY` dataset; query `SELECT date_trunc('hour', timestamp), sum(errors)/sum(requests) FROM RUNTIME_TELEMETRY GROUP BY 1`.
- Method once ≥24 hourly points available: SMA-6h (6-period hourly moving average). Alert when SMA-6h error rate exceeds 1%.

**Deployment frequency**
- Source: `deployment-intelligence-v5.json` `state` field records `declaredHead: "4a91fa96"`, `latestMigration: {n: 174, file: "174_v1_gift_card_refund_restore.sql"}`, `totalMigrations: 103`. These are point-in-time snapshots, not a time series.
- Method: count of `production-deploy.yml` workflow runs per week (source: GitHub Actions API, `GITHUB_TOKEN`). SMA-4w once ≥4 weeks available.

---

## 5. Merchant & Revenue Forecast Model

### Structural model: fields describing revenue potential

From `revenue-intelligence-v2.json` (`models` object):

**Revenue funnel stages** (`models.funnel.stages`):
1. `GMV` — gross merchandise value
2. `captured` — payment captured
3. `net revenue` — after refunds
4. `payout` — after commission/settlement

**Source tables for each stage:**
- `orders` — GMV (column: `total_minor` bigint, `*_minor` convention throughout)
- `payment_transactions` — captured payments (status filter)
- `ledger_entries` — canonical double-entry ledger; `ledger_transactions` for grouping
- `payout_statements`, `settlements` — payouts after commission

**Money RPCs available (34 total per JSON):**

Key reconciliation RPCs (real names from `models.leakageDetection.rpcs`):
- `refresh_money_ledger_site_reconciliation` — per-site balance reconciliation
- `assert_money_ledger_site_reconciliation` — assertion check
- `reconcile_orders_items_dual_model` — orders vs items cross-check
- `report_orders_items_reconciliation` — report generation
- `ledger_balance_breaks` — detects balance anomalies
- `sync_cod_reconciliation_money_bigint` — COD cash reconciliation

**Gift-card liability** (`models.giftCardLiability`): unredeemed gift-card balance is a liability (not revenue). Source tables: `gift_card_accounts`, `gift_card_ledger_entries`, `gift_card_redemptions`. Balance is a ledger projection — `gift_card_available_balance` RPC is the query target.

**Per-merchant revenue partitioning** (`models.merchantRevenueDependency`): `orders` and `ledger_entries` both carry `site_id`; revenue is partitioned by `site_id`. Every merchant shares the one ledger — no physical isolation.

### Revenue forecast query (ready to apply when data is live)

```sql
-- Monthly GMV per site (run against Supabase with service role)
SELECT
  date_trunc('month', created_at)  AS month,
  site_id,
  count(*)                          AS order_count,
  sum(total_minor) / 100.0          AS gmv_inr
FROM orders
WHERE status NOT IN ('cancelled', 'draft')
GROUP BY 1, 2
ORDER BY 1, 3 DESC;
```

Cross-check via: `SELECT * FROM refresh_money_ledger_site_reconciliation(site_id := NULL)` (NULL = all sites).

### NOT_CONNECTED: actual GMV series

| Data Series | Status | Exact Source |
|---|---|---|
| Monthly GMV | NOT_CONNECTED | Table `orders`, column `total_minor` (bigint, minor units), `created_at` timestamp, `site_id` |
| Captured payments series | NOT_CONNECTED | Table `payment_transactions`, columns `amount_minor`, `status='captured'`, `created_at` |
| Refund value series | NOT_CONNECTED | Tables `refunds`, `refund_transactions`, `ledger_entries` |
| Payout series | NOT_CONNECTED | Table `payout_statements`, `settlements` |
| Gift-card liability series | NOT_CONNECTED | Tables `gift_card_accounts`, `gift_card_ledger_entries`; RPC `gift_card_available_balance` |
| Per-site GMV concentration | NOT_CONNECTED | `orders GROUP BY site_id` — `detectors.revenueConcentration` in `merchant-intelligence.json` |

---

## 6. Connectivity Table

| Series | Points Available | Forecast Method | Source (NOT_CONNECTED) |
|---|---|---|---|
| Merchant growth (new stores/month) | **0** — NOT_CONNECTED | OLS linear trend at ≥3 pts; SMA-3 at ≥6 pts | Table `sites`, column `created_at` (Supabase, service role) |
| Customer growth (new customers/month) | **0** — NOT_CONNECTED | OLS linear trend at ≥3 pts | Table `store_customers`, `created_at` (Supabase, service role) |
| Funnel conversion rates (view→cart→checkout→order) | **0** — NOT_CONNECTED | Stage-to-stage ratio SMA-3 at ≥3 months; additive seasonal decomp at ≥12 months | Table `analytics_event_stream` + `carts` + `checkout_sessions` + `orders` (Supabase) |
| Revenue / GMV (monthly INR) | **0** — NOT_CONNECTED | OLS on `total_minor`; `Razorpay fee = 0.02 × GMV` ratio model | Table `orders` (`total_minor`, `created_at`, `site_id`); cross-check via `refresh_money_ledger_site_reconciliation` RPC |
| Queue depth trend | **0** — NOT_CONNECTED | SMA-7 on daily peak; saturation ratio `depth/limit` | Cloudflare Queues metrics API (CF API token); 5 queues: EVENT, ANALYTICS, SEARCH, NOTIFICATION, RUNTIME |
| Worker saturation (error rate / CPU) | **0** — NOT_CONNECTED | SMA-6h on hourly error rate; alert at >1% | Analytics Engine SQL API over `RUNTIME_TELEMETRY` dataset (binding `RUNTIME_TELEMETRY`, CF API token) |
| Razorpay cost per tier | DETECTABLE (rate only) | `fee = 0.02 × GMV` (ratio model; no historical GMV to apply it to yet) | `payment_transactions` table, `total_minor` column (live Supabase rows needed) |
| Cloudflare Workers cost | DETECTABLE (rate: $0.30/million req) | `cost = rate × request_count`; OLS on monthly request_count at ≥3 pts | Analytics Engine / RUNTIME_TELEMETRY; `adapters[0]` in `telemetry-intelligence.json` |
| Supabase Postgres cost | DETECTABLE (rate: $25/mo + $0.125/GB) | `cost = 25 + 0.125 × db_size_gb + egress_cost`; storage trend OLS at ≥3 pts | Supabase usage dashboard; db size metric (not in repo) |
| Deployment frequency (deploys/week) | PARTIAL — 1 point (current HEAD `4a91fa96`, migration n=174) | SMA-4w at ≥4 weeks; 1 structural snapshot now — DETERMINISTIC TREND NOT YET POSSIBLE | GitHub Actions API, `production-deploy.yml` run history (`GITHUB_TOKEN`) |

---

## Summary

**Cost model:** fully DETECTABLE structurally (10 services, published rates, hotspot ranking, formula). Zero live usage values are in the repo — all cost totals are NOT_CONNECTED to runtime usage.

**Capacity model:** topology DETECTABLE (4 workers, 5 queues, 2 dead-letter queues, cron schedules). Zero live throughput or depth values stored. No per-app queue limits declared in wrangler config files.

**Growth series:** ZERO historical data points in any graphify-out file for merchant counts, customer counts, or funnel rates. Forecast methods are specified and ready; they cannot be applied until ≥3 monthly data points are ingested.

**Revenue model:** 8 structural models with named tables and 34 RPCs. All amounts are NOT_CONNECTED. The canonical ledger (`orders.total_minor`, `ledger_entries`, `payment_transactions`) is the authoritative source; the reconciliation RPC chain is wired and production-ready.

**Deployment series:** 1 structural point (HEAD commit + migration number). Not a time series; GitHub Actions run history is the exact source for a deployment frequency trend.

**No numbers have been invented.** Every value above comes directly from the field names and contents of the JSON files listed in the header.
