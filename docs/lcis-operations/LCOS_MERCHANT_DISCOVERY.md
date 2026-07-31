# LCOS Merchant Discovery

**Source artifacts:** `merchant-intelligence.json`, `merchant-health.json`, `merchant-risk.json`, `merchant-growth.json`, `merchant-adoption.json`, `merchant-churn.json`
**Generated:** 2026-06-21 (artifacts dated 2026-06-14)
**Reuse points:** `lcis-core` ArtifactStore, `lcis-governance` (drift, RLS, ownership)

---

## 1. Architecture Note — Single-Tenant SPOF

Source: `merchant-intelligence.json` → `findings.M-1`

Every merchant shares a single Postgres schema, single Cloudflare Workers deploy, and single Vercel app fleet. Isolation is enforced exclusively by:

- **RLS** — `verifySiteOwnership` middleware + row-level policies keyed on `site_id`
- **`site_id` partitioning** — 256 tenant tables carry `site_id`; ledger RPCs accept and enforce `site_id`

**Finding M-1 (structural):** A bug in RLS policy or `verifySiteOwnership` is a cross-tenant data breach affecting all merchants simultaneously. This is a single point of dependency — one deploy pipeline (`production-deploy.yml`), one DB schema, one Workers bundle.

**Finding M-2 (structural):** Per-merchant feature behavior is controlled by `operational_feature_flags` / `operational_feature_flag_audit_events` — not separate code forks.

**Finding M-3 (info):** Merchant revenue is isolated per `site_id` in the canonical ledger via `ledger_entries.site_id` and enforced by `resolve_money_ledger_source_site_id` + `refresh_money_ledger_site_reconciliation`.

---

## 2. Merchant Lifecycle State Machine

Source: `merchant-intelligence.json` → `lifecycle`

### States (8)
`Created → Activated → First Product → First Order → First Revenue → Active → At Risk → Churned`

### Transitions — DETECTABLE (source tables known), NOT_CONNECTED (counts/rates)

| Transition | Signal | Source table / RPC | Signal class |
|---|---|---|---|
| Created | row in `sites` | `sites` | DETECTABLE — table present |
| Activated | onboarding completed | `onboarding_attempts`, `sites.status` | DETECTABLE — table present; count NOT_CONNECTED |
| First Product | product published | `products` | DETECTABLE — table present |
| First Order | first `orders` row | `orders` | DETECTABLE — table present; count NOT_CONNECTED |
| First Revenue | payment captured | `payment_transactions`, `ledger_entries` | DETECTABLE — tables present; amount NOT_CONNECTED |
| Active | recent `orders.created_at` | `orders` | DETECTABLE — table present; recency NOT_CONNECTED |
| At Risk | inactivity + billing signal | `orders`, `billing_dunning_events`, `subscriptions` | DETECTABLE (tables present); score NOT_CONNECTED |
| Churned | subscription cancelled + inactive | `subscriptions`, `orders` | DETECTABLE (tables present); status NOT_CONNECTED |

### Funnel metrics — NOT_CONNECTED

| Funnel | Steps | Metric | Source | Signal class |
|---|---|---|---|---|
| Activation | Created → Activated → First Product → First Order → First Revenue | count + conversion % per step | `sites`, `onboarding_attempts`, `products`, `orders`, `payment_transactions` | NOT_CONNECTED — Supabase rows |
| Retention | First Revenue → Active → At Risk → Churned | cohort retention % | `orders`, `subscriptions`, `billing_dunning_events` | NOT_CONNECTED — Supabase rows |

---

## 3. Merchant Health Model

Source: `merchant-health.json`

**Weighted score (0–100) per `site_id`. All values NOT_CONNECTED.**

| Dimension | Weight | Signal | Source tables |
|---|---|---|---|
| Order activity | 0.25 | order volume + recency | `orders`, `order_items`, `checkout_sessions` |
| Payment success | 0.25 | captured / attempted ratio | `payment_transactions`, `payment_attempts` |
| Fulfillment | 0.20 | shipped / fulfilled ratio + SLA | `fulfillment_orders`, `shipments`, `shipment_events` |
| Data integrity | 0.15 | no ledger breaks; RLS tenant data intact | `ledger_entries`, `money_ledger_site_reconciliations` |
| Incidents | 0.15 | open production incidents touching site | `production_incidents`, `production_incident_events` |

### Detectors

| Detector | Metric | Query pattern | Signal class |
|---|---|---|---|
| `healthScore` | weighted 0-100 per `site_id` | aggregate per `site_id` over 5 dimensions | NOT_CONNECTED |
| `unhealthyMerchants` | sites with score < 60 | filter `health < 60` | NOT_CONNECTED |

**Structural finding MH-1:** Health is computable from canonical tables with one aggregation query — no separate telemetry pipeline needed. All 5 dimensions are backed by real tables in `db-intel.json`.

---

## 4. Merchant Risk Model

Source: `merchant-risk.json`

**Composite risk score (0–100) per `site_id`. All values NOT_CONNECTED.**

| Dimension | Signal | Source tables |
|---|---|---|
| KYC completeness | merchant KYC docs verified | `merchant_kyc_documents`, `onboarding_attempts` |
| Order risk | risk-scored orders ratio | `order_risk_assessments`, `risk_scores`, `risk_signals`, `risk_rules`, `risk_action_events` |
| Payment risk | failed/abandoned payment ratio | `payment_transactions`, `payment_attempts` |
| Refund/chargeback | refund-to-order ratio | `refunds`, `refund_transactions`, `return_requests` |
| Billing risk | dunning / mandate failures | `billing_dunning_events`, `billing_mandates`, `merchant_billing_invoices` |

### Detectors

| Detector | Metric | Source | Signal class |
|---|---|---|---|
| `riskScore` | composite risk per site | `risk_scores` / `order_risk_assessments by site_id` | NOT_CONNECTED |
| `highRiskMerchants` | sites above risk threshold | `risk_scores by site_id` | NOT_CONNECTED |
| `kycGaps` | sites with incomplete KYC | `merchant_kyc_documents` | NOT_CONNECTED |

**Structural findings:**
- **MR-1:** Full risk chain exists in-schema: `risk_rules → risk_signals → risk_scores → risk_action_events` + `order_risk_assessments`
- **MR-2:** KYC is document-backed (`merchant_kyc_documents`) and gated at onboarding via `onboarding_attempts`

---

## 5. Merchant Growth Model

Source: `merchant-growth.json`

**GMV trend per `site_id`. All values NOT_CONNECTED.**

| Dimension | Signal | Source tables |
|---|---|---|
| GMV trend | `sum(orders.total_minor)` over time per site | `orders`, `ledger_entries` |
| Catalog growth | new products published | `products`, `product_options`, `collections` |
| Repeat rate | returning customers per site | `store_customers`, `customer_activity_log`, `orders` |
| AOV (avg order value) | avg `orders.total_minor` trend | `orders`, `order_items` |
| Channel mix | gift-card + promotion uptake | `gift_card_accounts`, `promotion_redemptions` |

### Detectors

| Detector | Metric | Source | Signal class |
|---|---|---|---|
| `growthRate` | GMV MoM growth % per site | `orders by site_id, monthly` | NOT_CONNECTED |
| `growingMerchants` | top sites by GMV growth | `orders + ledger` | NOT_CONNECTED |
| `stalledMerchants` | flat/declining GMV | `orders` growth <= 0 | NOT_CONNECTED |

---

## 6. Merchant Adoption Model

Source: `merchant-adoption.json`

**Feature adoption % per `site_id`. All values NOT_CONNECTED.**

| Feature | Signal | Source tables |
|---|---|---|
| Feature flags | enabled operational flags per site | `operational_feature_flags`, `operational_feature_flag_exposures` |
| Catalog | products published | `products`, `collections` |
| Theme customization | theme drafts/instances edited | `store_themes`, `theme_instances`, `theme_editor_drafts` |
| Gift cards | gift-card program active | `gift_card_accounts` |
| Payments configured | payment credentials set | `payment_credentials`, `payment_tokens` |
| Shipping configured | shipping zones/rates set | `shipping_zones`, `shipping_rates` |
| Entitlements | plan entitlements consumed | `plan_entitlements`, `site_entitlement_overrides`, `usage_meter_entries` |

### Detectors

| Detector | Metric | Source | Signal class |
|---|---|---|---|
| `adoptionScore` | % of available features activated per site | 7 feature tables | NOT_CONNECTED |
| `underAdopted` | sites using < N core features | filter adoption < threshold | NOT_CONNECTED |

---

## 7. Merchant Churn Model

Source: `merchant-churn.json`

**Churn probability per `site_id`. All values NOT_CONNECTED.**

| Signal | Indicator | Source tables |
|---|---|---|
| Order inactivity | no orders in N days | `orders`, `checkout_sessions` |
| GMV decline | sustained GMV drop | `orders`, `ledger_entries` |
| Subscription lapse | cancelled/expired plan | `subscriptions`, `plan_entitlements`, `site_entitlement_overrides` |
| Billing failure | dunning / failed mandate | `billing_dunning_events`, `billing_mandates`, `merchant_billing_invoices` |
| Login inactivity | no merchant session in N days | `sessions`, `site_memberships`, `store_memberships` |

### Detectors

| Detector | Metric | Source | Signal class |
|---|---|---|---|
| `churnRisk` | churn probability per site | `orders + subscriptions + billing_dunning_events + sessions` | NOT_CONNECTED |
| `churningMerchants` | sites at high churn risk | multi-signal threshold | NOT_CONNECTED |
| `churnedMerchants` | subscription cancelled + no orders | `subscriptions + orders` | NOT_CONNECTED |

---

## 8. Operating Stages Inventory

Source: `merchant-intelligence.json` → `operating`

| Stage | Apps | Tables | Tenant Tables | Money |
|---|---|---|---|---|
| Merchant | merchant-control-plane | 20 | 15 | no |
| Products | merchant-control-plane | 10 | 4 | no |
| Orders | merchant-control-plane, storefront-runtime | 10 | 9 | **yes** |
| Payments | merchant-control-plane, storefront-runtime | 11 | 10 | **yes** |
| Refunds | merchant-control-plane | 7 | 7 | **yes** |
| Payouts | merchant-control-plane | 10 | 9 | **yes** |
| Gift Cards | merchant-control-plane, storefront-runtime | 5 | 5 | **yes** |
| Analytics | merchant-control-plane | 36 | 26 | no |
| Storefront | storefront-runtime | 21 | 19 | no |
| Themes | merchant-control-plane, storefront-runtime | 32 | 8 | no |

**Total tenant tables tracked:** 256

---

## 9. Founding Merchant Program

Source: `merchant-intelligence.json` → `foundingProgram`

**Purpose:** First 100 paying merchants receive a lifetime price lock — guaranteed to never be charged catalog price regardless of future price changes.

**Structural status:** DETECTABLE — all tables, RPCs, and events are present in the schema.

### Capacity pools
| Pool | Slots |
|---|---|
| Public | 70 |
| Invited | 20 |
| Partner | 10 |
| **Total** | **100** |

Source resolved from `sites.intended_allocation_source` (default: PUBLIC).

### RPCs (all present — DETECTABLE)

| RPC | Purpose |
|---|---|
| `allocate_founding_merchant()` | Race-safe allocation via `SELECT … FOR UPDATE`; idempotent via partial unique index; cap via `CHECK (used_slots <= total_slots)` |
| `reclaim_founding_merchant()` | Razorpay subscription-refund webhook → release slot if ≤14 days, else retain as historical founder |
| `get_founding_program_public` | Public program state |
| `set_founding_program_state` | Admin control |
| `resolve_merchant_locked_price` | Called at every charge site; guarantees founders never charged catalog price |
| `reconcile_founding_program` | Counter integrity check: compares `remaining_slots` (GENERATED column) vs `COUNT(active allocations)` |
| `admin_repair_price_lock` | Manual repair |

### Tables
- `founding_merchant_program` — program state + slot counts
- `founding_merchant_allocations` — per-merchant allocation records
- `pricing_snapshots` — locked price snapshots per founder

### Invariants
- **I1:** Founders never charged catalog price (enforced at every charge site via `resolveMerchantPricing`)
- **I2:** Future catalog price changes never affect founders
- `remaining_slots` is a GENERATED column (`total_slots - used_slots`) — cannot drift independently

### Live metrics — all NOT_CONNECTED

| Metric | Source |
|---|---|
| `remainingSlots` | `GET /v1/founding-program/remaining` → `founding_merchant_program` |
| `allocated` count | `COUNT(founding_merchant_allocations WHERE released_at IS NULL)` — Supabase |
| `conversionRate` | paid activations / allocations — Supabase |
| `revenueDistribution` | `subscriptions.amount_paid` grouped by founder / non-founder — Supabase |
| `planDistribution` | `founding_merchant_allocations.plan_slug GROUP BY` — Supabase |
| `lifetimeDiscountLiability` | `sum(regular_price - locked_price) per active founder per month` — Supabase |

---

## 10. Live Detectors (all NOT_CONNECTED)

Source: `merchant-intelligence.json` → `detectors`

| Detector | Metric | Query pattern | Exact source |
|---|---|---|---|
| `topMerchants` | orders + GMV per `site_id` | `SELECT site_id, count(*), sum(total_minor) FROM orders GROUP BY 1 ORDER BY 3 DESC` | `orders` + `site_usage_meters` — Supabase |
| `inactiveMerchants` | sites with `max(orders.created_at) < now()-interval` | recency window per site | `orders.created_at by site_id` — Supabase |
| `brokenMerchants` | sites with high failed/abandoned payment ratio | `payment_transactions.status by site_id` | `payment_transactions` — Supabase |
| `highRiskMerchants` | sites above risk threshold | `order_risk_*, kyc tables` | `risk_scores`, `order_risk_assessments`, `merchant_kyc_documents` — Supabase |
| `revenueConcentration` | GMV share of top-k sites | `top-k GMV / total GMV` | `orders + ledger by site_id` — Supabase |

---

## 11. Signal Classification Summary

| Signal | Class | Exact source |
|---|---|---|
| Lifecycle state machine (8 states, transitions, source tables) | **DETECTABLE** | `merchant-intelligence.json` → `lifecycle` |
| Health model (5 dimensions, weights, source tables) | **DETECTABLE** | `merchant-health.json` → `model.dimensions` |
| Risk chain (risk_rules → risk_scores → order_risk_assessments) | **DETECTABLE** | `merchant-risk.json` + `db-intel.json` |
| Growth model (GMV trend, AOV, repeat rate) | **DETECTABLE** | `merchant-growth.json` → `model.dimensions` |
| Adoption model (7 features, source tables) | **DETECTABLE** | `merchant-adoption.json` → `model.features` |
| Churn signals (5 signals, source tables) | **DETECTABLE** | `merchant-churn.json` → `model.signals` |
| Founding program (tables, RPCs, invariants) | **DETECTABLE** | `merchant-intelligence.json` → `foundingProgram` |
| Operating stages (10 stages, 256 tenant tables) | **DETECTABLE** | `merchant-intelligence.json` → `operating` |
| Single-tenant SPOF (all merchants share schema) | **DETECTABLE** | Finding M-1 |
| Health scores (per-site weighted 0-100) | **NOT_CONNECTED** | `orders`, `payment_transactions`, `fulfillment_orders`, `ledger_entries`, `production_incidents` — Supabase |
| Risk scores (per-site composite 0-100) | **NOT_CONNECTED** | `risk_scores` / `order_risk_assessments` — Supabase |
| GMV per merchant | **NOT_CONNECTED** | `orders.total_minor by site_id` — Supabase |
| Active / inactive / churned counts | **NOT_CONNECTED** | `orders.created_at`, `subscriptions` — Supabase |
| Founding program slot count + conversion | **NOT_CONNECTED** | `founding_merchant_allocations` — Supabase |

---

## 12. Reuse Points

| Layer | Asset | What LCOS hooks into |
|---|---|---|
| `lcis-core` | `ArtifactStore` | Load all 6 merchant artifacts at boot |
| `lcis-core` | `BlastRadiusService` | `blast("verifySiteOwnership")` → cross-tenant SPOF impact |
| `lcis-governance` | R003 (RLS coverage) | Validate all 256 tenant tables have `site_id` + RLS enabled |
| `lcis-governance` | R007 (ownership) | Flag tables where `rls=false` on tenant data (e.g., `payouts`, `payout_items`, `ledger_accounts`) |
| `lcis-live` | Supabase adapter | Wire `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → connect health/risk/growth scores |
