# Analytics Audit

**Date:** 2026-06-19  
**LCIS Domain:** `analytics` (4 routes, 14 RPCs, 36 tables, 54 policies)  
**Evidence:** `services/api-gateway/src/routes/analytics.ts` (753 lines), merchant admin `/analytics/page.tsx`, LCIS telemetry score 90%, live data NOT CONNECTED

---

## Completion Score: **65%**

*Infrastructure is complete (90%). Live data ingestion NOT CONNECTED — dashboards show structure but not live numbers.*

---

## Sub-System Audit

### Revenue Analytics
**Score: 72%**

**What exists:**
- `mrr_arr_rollups` table — MRR/ARR projections
- `analytics_rollups_daily` table — daily revenue rollups
- `increment_analytics_rollup` RPC — atomic rollup incrementing
- `refresh_commerce_analytics_daily_mv` RPC — daily materialized view refresh
- Revenue models in LCIS: 8 revenue models modeled (gift card liability, payout dependency, etc.)
- `analytics.ts:753 lines` — revenue endpoint implementations
- `metric_rollups` table for flexible metric aggregation

**What is missing:**
- Live Supabase connection (H4) — rollups exist but aren't fed real data yet
- Revenue dashboard in merchant admin (UI may show loading states with no data)
- Real-time revenue figures (requires RUNTIME_TELEMETRY connection)

**Evidence:** LCIS analytics domain — 36 tables, 14 RPCs; LCIS score 90% (architecture complete, live ingestion adapter-bound)

---

### Orders Analytics
**Score: 70%**

**What exists:**
- Order count tracking in `analytics_rollups_daily`
- `operation_metrics` table for order-level metrics
- Order fulfillment rate tracking (fulfillment_orders vs orders)
- Conversion funnel infrastructure (cart → checkout → order)
- `tenant_operation_projections` table for per-tenant order metrics

**What is missing:**
- Live data connection
- Order analytics dashboard UI (may be placeholder)
- Abandoned cart rate computation (infrastructure exists, UI gap)

**Evidence:** LCIS analytics domain tables, `orders` domain consumed by analytics (strength 2)

---

### Customers Analytics
**Score: 62%**

**What exists:**
- 8 customer graphs modeled in LCIS (merchant-health, risk, growth, adoption, churn)
- Customer acquisition tracking (new vs returning)
- Customer lifetime value model in LCIS
- `audit_activity_events` for customer activity

**What is missing:**
- Customer analytics UI in merchant dashboard
- Live customer metrics (not connected)
- Cohort analysis (V2)

**Evidence:** LCIS `/api/merchant-intelligence`, `/api/customer-intelligence-v2`

---

### Products Analytics
**Score: 60%**

**What exists:**
- `restock_events` table — inventory/stock analytics
- Product view tracking infrastructure (event store)
- Top products ranking infrastructure (analytics_rollups_daily per product)
- `SEARCH_QUEUE` consumer for product search analytics

**What is missing:**
- Products analytics UI in merchant admin
- Live product view counts
- Product performance dashboard

**Evidence:** LCIS analytics domain, `restock_events` table

---

### Dashboards
**Score: 63%**

**What exists:**
- Analytics page in merchant admin: `apps/merchant-control-plane/src/app/[store]/analytics/page.tsx`
- Dashboard page: `apps/merchant-control-plane/src/app/[store]/dashboard/DashboardClient.tsx`
- Dashboard setup API: `api/stores/[store]/dashboard/setup/route.ts`
- LCIS-powered AI analytics: OMEGA, v11 business intelligence modes
- `migration 169_internal_os_executive_analytics_rollups.sql` — executive analytics rollups

**What is missing:**
- Live data feeding the dashboards (requires H4 production Supabase)
- Revenue charts with real numbers (currently show 0 or loading state)
- Real-time metrics (RUNTIME_TELEMETRY NOT CONNECTED per LCIS)

**Evidence:** LCIS telemetry score: "architecture 100%, live ingestion adapter-bound — NOT CONNECTED"

---

## Blockers

| # | Blocker | Severity | Impact |
|---|---|---|---|
| H4 | Production Supabase connection | Human seam | No live data until connected |
| H1 | Push to origin + deploy | Human seam | No production analytics without deployment |
| RUNTIME_TELEMETRY | Live telemetry not connected | Capability gap | 13 live data sources NOT CONNECTED per LCIS |

---

## Launch Readiness

**Analytics is 65% ready.** The infrastructure (tables, RPCs, rollups, event store) is complete and solid. The merchant dashboard exists. But the dashboards show empty/loading state until production data flows.

This is acceptable for a V1 launch with pilot merchants — the first real data will populate the dashboards once orders flow through. Analytics is a post-launch-grows-over-time feature.

**Recommended V1.0.0 scope:** Dashboard exists with real-time data once production connected. Revenue, orders, customers, top products.

**Delay to V1.1:** Advanced cohort analysis, abandonment rate, marketing attribution, product analytics depth.

**Delay to V2:** Predictive analytics, AI-powered recommendations, competitor benchmarking.
