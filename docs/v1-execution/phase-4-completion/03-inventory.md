# 03 — Inventory

**Readiness (merchant UI): ~40%.** View + single-item adjust are real; the rich gateway features are UI-invisible.

## Real
View inventory levels (product/variant/location, available/reserved/on-hand), low/out-of-stock badges, single-item inline delta adjustment (→ idempotent `adjust_inventory_level` RPC), search/filter. Checkout-path reservations work (reserve/commit/release RPCs) — correct for V1.

## Gaps (documented)
- **Purchase orders page: explicit STUB** ("not available yet", buttons disabled). HIGH.
- **Transfers page: explicit STUB.** HIGH.
- Inventory history is a complete gateway feature (`GET /inventory/history`) with **no proxy/UI**. HIGH.
- Bulk-adjust, locations, suppliers: gateway routes exist, no UI. MEDIUM/LOW.
- Adjustment reason hardcoded; no pagination (limit=100). MEDIUM.

**Verdict:** functional for a single-location MVP (view + adjust), but the stub pages create a misleading merchant experience; surfacing history + removing/finishing the stubs is real remaining work.
