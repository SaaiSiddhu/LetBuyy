# 01 — Inventory Intelligence

**Honest split: the operational layer is REAL; the "intelligence/analytics" layer needs a metrics backend that does not exist.**

## Real + usable now (no fabrication)
- **Low-stock detection** — `GET /inventory/levels?low_stock=true` EXISTS. A low-stock view is genuinely buildable over it (real data).
- **Inventory history/movements** — shipped Phase 5.5 (`inventory-history` page over `/inventory/history`).
- Basic counts (total SKUs, low-stock count) are computable from `inventory.levels` — real.

## NOT built (would be fabricated data)
- **Dead-stock / overstock detection, inventory KPIs, "insights", health scores** — these require aggregation/analytics the gateway does **not** expose (no inventory-analytics endpoint; no last-movement rollup; stock *value* needs cost data not surfaced). Building dashboards over non-existent metrics = the fabricated readiness the mission forbids. Dead-stock (no movement in N days) is theoretically computable from `inventory_events`, but only via a new aggregation endpoint — not client-side over unbounded history.

## Implementation spec (to make it real, later)
Add an `/inventory/analytics` gateway endpoint (aggregates `inventory_levels` + `inventory_events`: low-stock count, dead-stock by last-movement, value if cost is available) → api-client → a real KPI dashboard. This is additive backend work + a live DB to verify — not buildable verifiably here.

**Verdict:** low-stock + movements are real; KPI/dead-stock/overstock "intelligence" needs an analytics endpoint first — blueprinted, not faked.
