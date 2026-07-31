# 08 — Transfer Intelligence

**Operational transfers REAL + shipped (Phase 5.5); "analytics/metrics/performance" need aggregation endpoints that do not exist.**

## Real + shipped
Full transfer lifecycle UI (list/create/ship/receive) over `inventory_transfers/_lines/_receipts` + the SD RPCs (Phase 5.5). Transfer status + history-per-transfer are visible.

## NOT built (would be fabricated metrics)
**Transfer metrics / analytics / performance / "transfer search & filters" beyond status** need aggregation the gateway does not expose (no transfer-analytics endpoint: avg fulfillment time, in-transit value, completion rate). Building a metrics dashboard over non-existent aggregates = fabrication.

## Implementation spec
Add `GET /inventory/transfers/analytics?store_id=` (aggregates the transfer tables: counts by status, avg ship→receive duration, in-transit lines) → api-client → a transfer-analytics view. Additive read endpoint + live DB to verify. Basic status filters are buildable client-side over the existing list (a small, real enhancement).

**Verdict:** transfers operate end-to-end; deep transfer *intelligence* needs an analytics endpoint first — specced, not faked.
