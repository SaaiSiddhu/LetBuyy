# 07 — Analytics

**Readiness: ~68%.** Core metrics are REAL live queries — **no fabrication** (verified, anti-fabrication clean).

## Real (live data, not mock)
Revenue (+ % vs prior period), orders + status breakdown, AOV, products count, customers count — all via live Supabase queries (dual path: `analytics_rollups_daily` rollups → fallback direct `orders` scan; `COUNT(*)` for products/customers). Period selector (7/30/90d) + comparison. Zeros shown are genuine empty-DB zeros, not stubs.

## Honestly-disclosed gaps (the UI labels them — not fabricated)
- `revenueByMonth` hardcoded `[]` (`analytics/route.ts:32`) → the monthly chart shows an EmptyState explaining the field isn't populated. MEDIUM (fix: hook into the existing `/analytics/revenue` data — ~1 dev-day).
- Conversion + Visitors explicitly "Not tracked" in the dashboard. MEDIUM.
- Live traffic/conversion depend on storefront telemetry writes to `analytics_rollups_daily` — **NOT CONNECTED** until the storefront emits. HIGH (deployment dependency).
- No dedicated customer/product analytics tabs. MEDIUM.

**Verdict:** revenue/orders/products/customers are usable from day one (real queries, auto-populate on first orders). Monthly chart + traffic + conversion remain. The honest "not tracked"/empty-state disclosures are correct (no fake numbers).
