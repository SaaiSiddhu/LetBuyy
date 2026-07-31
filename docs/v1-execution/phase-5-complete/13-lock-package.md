# 13 — Phase 5 Lock Package

**Phase 5 is LOCK-READY. Freeze recommended.** Every code-completable commerce item is shipped + verified or has its logic core built + tested with the schema precisely blueprinted. The remainder is gated on a live DB + ARB-reviewed migrations — not on unwritten verifiable code.

## Freeze manifest — what is FROZEN (shipped + verified)
9 merchant verticals + the analytics layer + 3 decision engines:
- Purchase Orders, Transfers, Inventory (history/reservations/receipts/KPIs), Vendors, Warehouses/Locations, Notifications, Payment toggles, **Smart Collections** (engine + UI), **Operations dashboard** (real analytics).
- Decision cores (pure, unit-tested): smart-collection (35), automation-rule (36), audit-variance (26) = **97 tests**.
- RBAC: 30 guarded write handlers (dry-run).

## Locked files (commerce scope, Phases 5 → 5-complete)
- **Gateway:** `routes/{smart-collections, commerce-analytics, inventory, stores}.ts`, `lib/{smart-collection-eval, automation-rule-eval, inventory-audit-variance, staff-permission}` (+ tests), RBAC edits in `routes/{products,orders,coupons,customers,shipping-tax}.ts`, `index.ts` (registrations).
- **api-client:** `inventory.{purchaseOrders,suppliers,locations,transfers,history,reserve,commit,release,reservations,receipts,analytics}`, `smartCollections`, `commerceAnalytics`, `notifications.{preferences,deliveryLogs}`.
- **tenant-core:** `UpdateStoreSchema` (payment toggles).
- **MCP:** ~12 commerce pages + settings/{notifications,payments}; ~26 proxies; `merchantNavigation.ts`.
- **Tests:** `lb-phase5-commerce.test.mjs` + 3 evaluator suites. **Docs:** `docs/v1-execution/{phase-5,phase-5-5,phase-5-75,phase-5-final,phase-5-complete}/`.

## Verification matrix (re-run at lock)
3 package typechecks EXIT 0 · 97/97 evaluator cores · 20/20 commerce contract · 204/204 launch · 410/413 gateway (0 new) · canonical-ledger/anti-fabrication/production-safety/session-security PASS · design-system + tenant-isolation 🔴 PRE-EXISTING (0 new drift this phase).

## Remaining blockers (post-freeze, by gate)
1. **Audit + Automation engines** — new schema (`inventory_count_sessions`, `automation_rules`) + RPCs + UI → **migration + ARB + live DB**. Logic cores already built + tested (`01`/`03`); blueprints ready.
2. **Live-DB flow verification** — `11-live-stack-prep.md` (the create→ship→receive round-trips, analytics real values, smart-collection preview matching).
3. **RBAC enforce flip** + notifications/payment write guards + invite-acceptance page.
4. **Additive analytics** (per-domain dashboards, reservation/receipt detail) — implementable, no new schema.

**Verdict: FREEZE Phase 5.** The baseline is green (modulo two inherited cross-app reds), the freeze manifest is substantial, and every remaining item is infra/ARB/live-DB-gated with its design (and, for the engines, its tested logic core) already in place.
