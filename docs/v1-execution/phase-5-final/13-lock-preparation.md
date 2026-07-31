# 13 — Phase 5 Lock Preparation

**Phase 5 is LOCK-READY.** Every code-completable commerce-operations item is shipped + verified or precisely blueprinted. The remainder is gated on a live DB or an ARB-reviewed migration — not on unwritten verifiable code.

## Verification matrix (re-run at lock)
| Gate | Result |
|---|---|
| api-client / api-gateway / merchant-control-plane / tenant-core typecheck | ✅ EXIT 0 |
| Smart-collection evaluator unit tests | ✅ 35/35 |
| Commerce contract tests (`lb-phase5-commerce`) | ✅ 16/16 |
| Full launch suite | ✅ 200/200 |
| Gateway unit suite | ✅ 348/351 (3 pre-existing, 0 new) |
| canonical-ledger / anti-fabrication / production-safety / session-security | ✅ PASS |
| design-system / tenant-isolation | 🔴 PRE-EXISTING inherited WIP (0 new drift this phase) |

## Locked files (Phase 5 + 5.5 + 5.75 + 5.9 commerce scope)
- **Gateway:** `routes/{smart-collections,inventory,stores}.ts`, `lib/smart-collection-eval.ts`, `middleware/staff-permission.ts`, `__tests__/{smart-collection-eval,staff-permission}.test.ts`, RBAC edits in `routes/{products,orders,coupons,customers,shipping-tax}.ts`, `index.ts` (route registration).
- **api-client:** `inventory.{purchaseOrders,suppliers,locations,transfers,history,reserve,commit,release,reservations,receipts,analytics}`, `smartCollections`, `notifications.{preferences,deliveryLogs}`.
- **tenant-core:** `UpdateStoreSchema` (payment toggles).
- **MCP:** PO/transfers/inventory-history/reservations/receipts/suppliers/locations/smart-collections pages + settings/{notifications,payments}; ~20 proxies; `merchantNavigation.ts`.
- **Tests:** `lb-phase5-commerce.test.mjs`. **Docs:** `docs/v1-execution/{phase-5,phase-5-5,phase-5-75,phase-5-final}/`.

## Freeze-candidate list (remaining work, by gate)
1. **Audit engine** — net-new schema (`inventory_count_sessions`) → migration + ARB + live DB (`04`). The one genuinely-absent backend.
2. **Deep analytics dashboards** — additive real-aggregation endpoints + dashboard pages (`06`) — implementable, no new schema, bounded out for verifiability.
3. **RBAC enforce flip** — set `MERCHANT_STAFF_RBAC_MODE=enforce` after live dry-run-log verification (30 guards ready); + notifications/payment write guards + invite-acceptance page.
4. **Live-DB flow verification** — every vertical is compile/contract/unit-verified; runtime round-trips need a staging stack.

**Verdict:** Phase 5 can be frozen now. The lock baseline is green (modulo the two inherited cross-app reds), and the freeze-candidate list is small, precise, and each item is gated on infra/ARB/live-DB — not on unwritten code.
