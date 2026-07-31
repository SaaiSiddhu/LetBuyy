# 05 — Freeze Manifest

**Frozen commerce-operations scope (Phases 5 → 5-complete).** These files constitute the Phase-5 baseline.

## Gateway (`services/api-gateway/src/`)
- Routes: `smart-collections.ts`, `commerce-analytics.ts`, additive GETs + RBAC in `inventory.ts`, `stores.ts` (payment allow-list), RBAC in `routes/{products,orders,coupons,customers,shipping-tax}.ts`, `index.ts` (registrations).
- Libs (pure, unit-tested): `smart-collection-eval.ts`, `automation-rule-eval.ts`, `inventory-audit-variance.ts`, `middleware/staff-permission.ts`.
- Tests: `__tests__/{smart-collection-eval,automation-rule-eval,inventory-audit-variance,staff-permission}.test.ts`.

## api-client (`packages/typescript/api-client/src/index.ts`)
`inventory.{purchaseOrders,suppliers,locations,transfers,history,reserve,commit,release,reservations,receipts,analytics}`, `smartCollections`, `commerceAnalytics`, `notifications.{preferences,deliveryLogs}`.

## tenant-core
`UpdateStoreSchema` (payment toggle fields).

## merchant-control-plane (`apps/merchant-control-plane/src/app/`)
- Pages: `[store]/products/{purchase-orders,transfers,suppliers,locations,inventory-history,reservations,receipts,smart-collections,operations-dashboard}`, `[store]/settings/{notifications,payments}`, `accept-invite` (public).
- ~28 proxies under `api/stores/[store]/...` + `api/employees/accept-invite`.
- `components/merchantNavigation.ts`.

## Tests / Docs
`tests/launch/lb-phase5-commerce.test.mjs`; `docs/v1-execution/{phase-5,phase-5-5,phase-5-75,phase-5-final,phase-5-complete,phase-5-lock}/`.

## Verification stamp
4 typechecks EXIT 0 · launch 205/205 · commerce contract 21/21 · evaluator cores 97/97 · 4 governance validators PASS · 0 new drift.

**This manifest is the Phase-5 freeze.** Changes to these files after the freeze should be tracked against this baseline.
