# 01 — Commerce Truth Map (source of truth, evidence-based)

**Date:** 2026-06-19. Built from `database/supabase/migrations/*` + `services/api-gateway/src/routes/*` + `packages/typescript/api-client/src/index.ts`. **Purpose:** reuse, don't duplicate. **Headline: the commerce-operations BACKEND is overwhelmingly REAL** (tables + RLS + `SECURITY DEFINER` RPCs + gateway routes). The Phase-5 gap is **exposure** (typed api-client + merchant proxies + UI), not new schema — except the automation rule engine.

## Subsystem reality
| # | Subsystem | Backend (tables + RPCs + gateway route) | Typed api-client | Merchant UI | Real gap |
|---|---|---|---|---|---|
| 1 | **Inventory ledger** | ✅ REAL — `inventory_levels/reservations/adjustments/events`; `reserve_inventory`, `commit_inventory_reservation`, `release_inventory_reservation`, `expire_inventory_reservations`, `adjust_inventory_level`, `release_order_inventory_with_ledger` (all SD); `/inventory/levels,/adjust,/bulk-adjust,/history,/reserve,/commit,/release` | ⚠️ only `levels()`,`adjust()` | ⚠️ view+adjust only | client methods + history/movements/reservations UI |
| 2 | **Warehouses/locations** | ✅ REAL — `inventory_locations` + `ensure_default_inventory_location`; `/inventory/locations` GET/POST | ❌ none | ❌ none | client + proxy + UI |
| 3 | **Vendors/suppliers** | ✅ REAL — `suppliers` (RLS); `/inventory/suppliers` GET/POST | ❌ none | ❌ none | client + proxy + UI |
| 4 | **Purchase orders** | ✅ REAL — `purchase_orders/_lines/_receipts`; `create_purchase_order_with_lines`, `receive_purchase_order`, `receive_purchase_order_line` (SD); `/inventory/purchase-orders` + `/:id/receive` | ❌ none | ❌ stub | client + proxy + UI |
| 5 | **Transfers** | ✅ REAL — `inventory_transfers/_lines/_receipts`; `create_inventory_transfer_with_lines`, `ship_inventory_transfer`, `receive_inventory_transfer(_line)` (SD); `/inventory/transfers` + `/:id/ship` + `/:id/receive` | ❌ none | ❌ stub | client + proxy + UI |
| 6 | **Smart collections** | ⚠️ PARTIAL — `smart_collections` table (`conditions` jsonb + `match_type` all/any) exists; **no route, no eval RPC** | ❌ none | ❌ none | gateway eval route + client + proxy + UI (eval is TS over the existing table) |
| 7 | **Automation/workflows** | ⚠️ PARTIAL — event backbone REAL (`outbox_events`, `platform_queue_jobs`, `webhook_subscriptions`, `workflow_lifecycle`); **no merchant-configurable `automation_rules`** | webhook CRUD only | ❌ none | **net-new `automation_rules` schema** (blueprint) + engine + UI |
| 8 | **Notifications** | ✅ REAL — `notifications/_preferences/_logs/_suppressions`, `email_logs`; `create_notification` (SD); `/notifications/*`, `/email/*` | ✅ inbox/prefs/device | ⚠️ partial | ops/preferences UI |
| 9 | **Payment configuration** | ✅ REAL — `sites.cod_enabled/online_payment_enabled/payment_settings`; `cod_reconciliation_entries`; `/stores/:id/payment-config`, `/cod/*` | ✅ `paymentConfig`,`cod` | ⚠️ display-only toggles | wire functional toggles (backend exists) |

## Consequence for Phase 5
- **Reuse, do not rebuild:** every inventory/warehouse/vendor/PO/transfer table + RPC + route already exists. Building a "new" ledger/PO/transfer engine would create the **duplicate systems** the mission forbids.
- **Verifiable Phase-5 work (compile + contract, like 4.5/4.75):** extend the typed api-client to expose the existing gateway routes → add merchant proxies → build the merchant UI. No new money/ledger migrations.
- **Net-new schema (blueprint only — needs migration + ARB + live DB):** the **automation rule engine** (`automation_rules/triggers/conditions/actions`). This is the one genuinely-absent engine.
- **Smart collections:** the table exists; the eval can be TS in the gateway over `conditions` jsonb (no new table) → mostly verifiable.

**Verification note:** every claim above is grounded in a real migration/route/file; nothing is invented. Blueprints (`02`–`11`) build strictly on these existing primitives.
