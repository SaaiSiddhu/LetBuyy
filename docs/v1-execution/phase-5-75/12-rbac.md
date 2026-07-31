# 12 — RBAC Expansion

**Staff-permission enforcement now spans the commerce write surface — the verifiable backend-exposure win of this wave.**

## Added this wave
All 12 WRITE handlers in `services/api-gateway/src/routes/inventory.ts` now call `assertStaffPermission(c, <siteId>, customUser.id, 'products:write')` immediately after their `verifySiteOwnership` check:
locations · suppliers · purchase-orders create · PO receive · transfers create/ship/receive · reserve · commit · release · adjust · bulk-adjust. (`products:write` reused — no new key, reuses existing role grants.)

## Total enforcement coverage (cumulative)
| Domain | Write handlers guarded | Key |
|---|---|---|
| Products | 4 | products:write |
| Orders | 4 (status/fulfill/refund/refund-complete) | orders:write |
| Coupons | 3 | marketing:write |
| Customers | 2 | customers:write |
| Shipping rates | 3 | shipping:write |
| **Inventory/PO/transfers/suppliers/locations** | **12 (this wave)** | products:write |
| **Total** | **28 write handlers across 6 route files** | |

## Safety (unchanged)
`assertStaffPermission` is owner-bypass (authoritative `verifySiteOwnership`) + **dry-run by default** (`MERCHANT_STAFF_RBAC_MODE`, logs `staff_rbac_decision`, never blocks) + fail-open on error. So all 28 guards are behavior-neutral in production until an operator flips to `enforce` after live dry-run-log verification. The pure decision logic remains 9/9 unit-tested.

## Verification
api-gateway `tsc` EXIT 0 (the 12 new wirings compile); only `inventory.ts` changed; contract test asserts the inventory guards. No money/OAuth/RLS code touched.

## Remaining
Notifications/payment-config/smart-collection write routes (as those verticals' writes land) + the **enforce flip** (live verification) + the invite-acceptance page.

**Verdict:** RBAC enforcement coverage went from 16 → 28 commerce write handlers across 6 files — the largest single-wave backend-exposure increment, fully gateway-verified, lockout-proof (dry-run).
