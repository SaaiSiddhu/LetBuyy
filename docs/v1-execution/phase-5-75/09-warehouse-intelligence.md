# 09 — Warehouse Intelligence

**Operational locations REAL + shipped (Phase 5.5); "KPIs/capacity/performance/health" need metrics that do not exist.**

## Real + shipped
Locations management UI (list/create) over `inventory_locations` (Phase 5.5). Per-location stock is in `inventory_levels.location_id`.

## NOT built (would be fabricated metrics)
**Warehouse KPIs / analytics / performance / capacity / health** need aggregation the gateway does not expose (no per-location rollup: SKU count, total units, value, throughput). And **capacity** has no backing field at all (no `inventory_locations.capacity` column) — a capacity metric would be entirely invented.

## Implementation spec
- A **per-location stock view** is genuinely buildable now: filter `inventory.levels` by `location_id` (real data) — a small real enhancement.
- KPIs/throughput need a `GET /inventory/locations/:id/metrics` aggregation endpoint (additive). Capacity needs a schema field (new column + ARB) — do not invent it.

**Verdict:** location management + per-location stock are real; warehouse *intelligence/capacity* needs additive metrics endpoints (and capacity needs a schema field) — specced, not faked.
