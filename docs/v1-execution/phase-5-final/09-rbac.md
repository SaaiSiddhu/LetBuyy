# 09 — RBAC Finalization

**Staff-permission enforcement now spans essentially the entire commerce write surface — 30 guarded handlers across 7 route files.**

## Coverage (cumulative)
| Route file | Guarded writes | Key |
|---|---|---|
| products.ts | 4 | products:write |
| orders.ts | 4 | orders:write |
| coupons.ts | 3 | marketing:write |
| customers.ts | 2 | customers:write |
| shipping-tax.ts | 3 | shipping:write |
| inventory.ts | 12 | products:write |
| **smart-collections.ts** | **2 (this wave: POST/PATCH)** | products:write |
| **Total** | **30 write handlers** | |

## Safety (unchanged, proven across the session)
`assertStaffPermission`: authoritative owner-bypass (`verifySiteOwnership`) + **dry-run default** (`MERCHANT_STAFF_RBAC_MODE`; logs `staff_rbac_decision`, never blocks) + fail-open on error. Pure decision logic **9/9** unit-tested. All 30 guards are behavior-neutral in production until an operator flips to `enforce`.

## Remaining (documented follow-up — small, dry-run-safe)
- **notifications** `PUT /preferences` → `settings:write`, and the **payment** toggle write (via `PATCH /stores/:id`) → `settings:write`. Both are the same one-line pattern; deferred to a focused security pass with the **enforce-flip live verification** (the gateway store-update route is broad, so its guard wants careful live validation).
- **Reservations/receipts** new endpoints are READS (no write guard needed).
- The **enforce flip** itself (live dry-run-log verification) + the invite-acceptance page remain the security stream's closing items.

**Verdict:** RBAC enforcement coverage reached 30 commerce write handlers across 7 files — effectively the whole write surface — fully gateway-verified and lockout-proof (dry-run). The notifications/payment guards + the enforce flip are the small, live-verification-gated remainder.
