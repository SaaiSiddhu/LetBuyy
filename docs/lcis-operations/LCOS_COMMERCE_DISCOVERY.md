# LCOS Commerce Discovery

**Source artifacts:** `revenue-intelligence-v2.json`, `revenue-intelligence.json`, `commerce-control-intel.json`, `db-intel.json`
**Generated:** 2026-06-21 (artifacts dated 2026-06-14)
**Reuse points:** `lcis-core` ArtifactStore, `lcis-execution` (plans), `lcis-governance` (drift R001-R008)

---

## 1. Canonical Ledger Model

LetBuyy uses an **append-only double-entry ledger**. No TS code may do `.from(money_table).insert/update` — all money mutations are `SECURITY DEFINER` Postgres RPCs called via `db.rpc`. Two invariants enforced in-schema:

- `enforce_ledger_transaction_balance` — trigger function; every `ledger_transaction` row must have entries summing to zero
- `CHECK balances >= 0` on balance columns
- `ledger_entries_reject_update` / `ledger_entries_reject_delete` — triggers make `ledger_entries` and `ledger_transactions` immutable after insert
- `gst_invoices_reject_update` / `gst_invoices_reject_delete` — GST invoices immutable
- `prevent_checkout_order_immutable_update` — trigger `trg_orders_checkout_immutable` blocks checkout-state tampering

Money amounts are stored as `*_minor bigint` (paise). All amounts in live Supabase rows — **NOT_CONNECTED** in this environment.

---

## 2. Money Table Inventory (18 canonical + 26 adjacent)

Source: `db-intel.json` (417 tables total; 44 money-related matched).

### Core ledger tables — DETECTABLE (structure known)

| Table | Migration | RLS | key notes |
|---|---|---|---|
| `ledger_accounts` | `139_executable_foundation_ledger_core.sql` | false | site-scoped; no RLS — service-role only |
| `ledger_transactions` | `139_executable_foundation_ledger_core.sql` | false | immutable (reject_update + reject_delete triggers) |
| `ledger_entries` | `139_executable_foundation_ledger_core.sql` | false | immutable; double-entry lines |
| `money_ledger_site_reconciliations` | `160_foundation_money_ledger_authority.sql` | true | per-site reconciliation snapshots |
| `wallet_ledger_entries` | `119_mobile_money_ledgers.sql` | true | trigger: `sync_wallet_ledger_money_bigint` |
| `store_credit_ledger_entries` | `153_executable_identity_security.sql` | false | no RLS — service-role only |

### Orders tables — DETECTABLE

| Table | Migration | RLS | notes |
|---|---|---|---|
| `orders` | `000_baseline.sql` | true + force | 51 cols; 8 triggers; 15 indexes; money=true; `trg_orders_checkout_immutable` |
| `order_items` | `000_baseline.sql` | true | 31 cols; no site_id direct (tenant synced via triggers) |
| `order_line_adjustments` | `000_baseline.sql` | true | discount/promotion line amounts |
| `order_shipping_lines` | `000_baseline.sql` | true | shipping amount per order |
| `order_tax_lines` | `000_baseline.sql` | true | GST line items |
| `draft_orders` | `116_mobile_draft_orders.sql` | true | 27 cols; 3 indexes |
| `fulfillment_orders` | `000_baseline.sql` | true + force | 20 cols; RLS policy `fulfillment_orders_tenant_site_guc` |
| `gst_invoices` | `144_executable_tax_gst_invoices.sql` | true + force | 33 cols; immutable (reject triggers) |
| `merchant_billing_invoices` | `152_executable_billing_autopay.sql` | false | 32 cols; no RLS |

### Payment tables — DETECTABLE

| Table | Migration | RLS | notes |
|---|---|---|---|
| `payment_transactions` | `000_baseline.sql` | true + force | 30 cols; 9 indexes; policy `payment_transactions_tenant_site_guc`; money=true |
| `payment_attempts` | `000_baseline.sql` | true + force | 24 cols; policy `payment_attempts_tenant_site_guc`; money=false (status tracking) |
| `payment_webhook_events` | `000_baseline.sql` | true | no site_id; `service_role_all` policy only |
| `payments` | `142_executable_payment_sessions.sql` | true + force | 30 cols; policy `payments_tenant_site_guc`; money=true |
| `payment_credentials` | `142_executable_payment_sessions.sql` | true + force | 15 cols; policy `payment_credentials_tenant_site_guc` |
| `payment_tokens` | `142_executable_payment_sessions.sql` | true + force | 15 cols; policy `payment_tokens_tenant_site_guc` |

### Refund tables — DETECTABLE

| Table | Migration | RLS | notes |
|---|---|---|---|
| `refunds` | `000_baseline.sql` | true | 24 cols; money=true |
| `refund_transactions` | `000_baseline.sql` | true | 22 cols; `refund_transactions_service_all` policy |
| `refund_attempts` | `000_baseline.sql` | true | 18 cols; `refund_attempts_service_all` policy |
| `refund_lines` | `000_baseline.sql` | true | 15 cols |
| `return_requests` / `returns` / `return_lines` | `000_baseline.sql` | true | return workflow tables |
| `theme_refund_requests` | `091_theme_marketplace_stepup.sql` | true | no site_id; no policies — theme-marketplace scoped |

### Gift Card tables — DETECTABLE

| Table | Migration | RLS | notes |
|---|---|---|---|
| `gift_card_accounts` | `000_baseline.sql` | true | 20 cols; money=true; balance = ledger projection |
| `gift_card_ledger_entries` | `000_baseline.sql` | true | 18 cols; `gift_card_ledger_entries_service_all`; money=true |
| `gift_card_redemptions` | `000_baseline.sql` | true | 16 cols; `gift_card_redemptions_service_all`; money=true |
| `gift_cards` | `000_baseline.sql` | true | 13 cols; `store_id` (not `site_id`); `service_role_gift_cards` |

### Payout tables — DETECTABLE

| Table | Migration | RLS | notes |
|---|---|---|---|
| `payout_statements` | `119_mobile_money_ledgers.sql` | true | 34 cols; trigger `sync_payout_statement_money_bigint`; money=true |
| `payout_reconciliation_records` | `134_internal_os_developer_360_payout_reconciliation.sql` | true | 26 cols; 3 policies (developer_owner_read, operator_assignee_read, service_role_all) |
| `payout_disputes` | `134_internal_os_developer_360_payout_reconciliation.sql` | true | 23 cols; no site_id |
| `partner_payout_ledger_entries` | `000_baseline.sql` | true | 29 cols; money=true; 4 indexes |
| `payouts` | `151_executable_settlement_ledger.sql` | **false** | 33 cols; **no RLS** — service-role only |
| `payout_items` | `151_executable_settlement_ledger.sql` | **false** | 20 cols; **no RLS** |
| `commission_schedules` | baseline | true | payout accrual rates |
| `commission_reconciliation_entries` | baseline | true | per-merchant commission tracking |
| `settlements` | baseline | true | settlement aggregation |
| `theme_developer_payout_accounts` | `091_theme_marketplace_stepup.sql` | true | no site_id; no policies |

---

## 3. Canonical Mutation RPCs (34 total; 15 canonical mutators)

Source: `revenue-intelligence.json` → `flow.*`, `db-intel.json` → `functions`.

### The 6 canonical write paths (SECURITY DEFINER + idempotency_key)

| RPC | Migration | FOR UPDATE | Primary tables touched | TS caller |
|---|---|---|---|---|
| `create_checkout_order` | `170_v1_shipping_rates_gst.sql` | yes | orders, order_items, payment_transactions, gift_card_ledger_entries, gift_card_redemptions, inventory_reservations, inventory_levels, promotion_redemptions, checkout_sessions, outbox_events | `services/api-gateway/src/execution/order-execution.adapter.ts` |
| `confirm_order_payment_with_ledger` | `168_b1_b2_capture_refund_ledgering.sql` | yes | orders, payment_transactions, payment_attempts | `services/api-gateway/src/execution/payment-execution.adapter.ts` |
| `complete_order_refund` | `168_b1_b2_capture_refund_ledgering.sql` | yes | refunds, orders, refund_transactions, refund_attempts, payment_transactions, returns, outbox_events | `services/api-gateway/src/routes/returns.ts`, `order-execution.adapter.ts` |
| `create_order_return_and_refund` | `000_baseline.sql` | yes | orders, returns, return_lines, payment_transactions, order_items, refunds, refund_lines, refund_transactions, inventory_levels, outbox_events | `order-execution.adapter.ts` |
| `restore_gift_card_on_refund` | `174_v1_gift_card_refund_restore.sql` | yes | gift_card_redemptions, gift_card_ledger_entries | `services/api-gateway/src/routes/orders.ts` |
| `issue_gift_card` | `173_v1_gift_card_issuance_lifecycle.sql` | yes | gift_card_accounts, gift_card_ledger_entries | `services/api-gateway/src/routes/gift-cards.ts` |
| `set_gift_card_status` | `173_v1_gift_card_issuance_lifecycle.sql` | yes | gift_card_accounts, gift_card_ledger_entries | `services/api-gateway/src/routes/gift-cards.ts` |
| `claim_payout_statement_release` | `160_foundation_money_ledger_authority.sql` | yes | payout_statements | `services/api-gateway/src/routes/payouts.ts` |

### High-risk paths — DETECTABLE (structure known; missing FOR UPDATE or idempotency)

| RPC | Issue | TS caller |
|---|---|---|
| `attach_order_payment_reference_with_ledger` | SD=true, idempotency=true, **no FOR UPDATE** | `payment-execution.adapter.ts` |
| `release_order_inventory_with_ledger` | SD=true, idempotency=true, **no FOR UPDATE** | `order-execution.adapter.ts` |
| `post_ledger_transaction` | SD=true, idempotency=true, **no FOR UPDATE** | no TS callers tracked |
| `enforce_ledger_transaction_balance` | not SD, no idempotency, no FOR UPDATE (trigger fn — expected) | trigger function |
| `ledger_balance_breaks` | not SD, no idempotency, no FOR UPDATE (read helper) | trigger function |
| `refresh_money_ledger_site_reconciliation` | SD=true, **no idempotency**, no FOR UPDATE | `routes/internal-console/money-reconciliation.ts`, `queue-workers/money-ledger-reconciliation.ts` |

### Reconciliation / leakage detection RPCs — DETECTABLE

From `revenue-intelligence-v2.json` → `models.leakageDetection.rpcs`:

- `record_dual_model_reconciliation_report`
- `report_orders_items_reconciliation`
- `reconcile_orders_items_dual_model`
- `report_products_variants_reconciliation`
- `reconcile_products_variants_dual_model`
- `enforce_ledger_transaction_balance`
- `ledger_balance_breaks`
- `sync_commission_reconciliation_money_bigint`
- `refresh_money_ledger_site_reconciliation`
- `assert_money_ledger_site_reconciliation`
- `sync_cod_reconciliation_money_bigint`
- `reconcile_cod_remittance_with_ledger`

---

## 4. Revenue Funnel — DETECTABLE topology, NOT_CONNECTED amounts

Source: `revenue-intelligence-v2.json` → `models.funnel`

```
GMV → captured → net revenue → payout
 │        │             │            │
orders  payment_     ledger_     payout_
        transactions  entries    statements
```

**Metric sources (all `value: "live-query-required"` / NOT_CONNECTED):**

| Metric | Source table(s) | Source RPC | Signal class |
|---|---|---|---|
| Gross Merchandise Value (GMV) | `orders.total_minor` grouped by `site_id` | none (direct query) | NOT_CONNECTED — Supabase rows |
| Captured revenue | `payment_transactions` where status=captured | `confirm_order_payment_with_ledger` | NOT_CONNECTED |
| Net revenue (after refunds) | `ledger_entries` debit/credit sum per site | `ledger_account_balance_minor` | NOT_CONNECTED |
| Payout amount | `payout_statements.amount_minor` | `claim_payout_statement_release` | NOT_CONNECTED |
| Revenue by channel | `promotion_redemptions`, `gift_card_redemptions`, `orders` | none | NOT_CONNECTED |
| Gift-card liability | `gift_card_ledger_entries` outstanding balance | `gift_card_available_balance` | NOT_CONNECTED |
| Refund magnitude | `refunds` + `refund_transactions` | `complete_order_refund` | NOT_CONNECTED |
| Ledger balance breaks | `ledger_entries` double-entry sum != 0 | `ledger_balance_breaks` | NOT_CONNECTED |
| Per-site reconciliation drift | `money_ledger_site_reconciliations` | `refresh_money_ledger_site_reconciliation` | NOT_CONNECTED |

---

## 5. Commerce Domains Overview

Source: `commerce-control-intel.json` → `domains`

| Domain | Routes | RPCs | Tables | Money |
|---|---|---|---|---|
| Merchant | 5 | 4 | 20 | no |
| Storefront | 14 | 4 | 21 | no |
| Orders | 3 | 12 | 10 | **yes** |
| Products | 2 | 5 | 10 | no |
| Collections | 1 | 0 | 4 | no |
| Inventory | 1 | 18 | 9 | **yes** |
| Payments | 3 | 18 | 11 | **yes** |
| Refunds | 1 | 2 | 7 | **yes** |
| Payouts | 4 | 5 | 10 | **yes** |
| Gift Cards | 2 | 7 | 5 | **yes** |
| Discounts | 2 | 2 | 11 | no |
| GST & Tax | 1 | 1 | 6 | no |
| Shipping | 3 | 1 | 10 | **yes** |
| Analytics | 4 | 13 | 36 | no |

---

## 6. Canonical Journey Flows

Source: `commerce-control-intel.json` → `journeys`

### Order journey
`Cart → Checkout → create_checkout_order → Inventory reserved → Fulfillment → Shipped → Delivered`

### Payment journey
`Checkout → Razorpay/COD → Signature verify → confirm_order_payment_with_ledger → Ledger posted → Payout accrues`

### Refund journey
`Return requested → Step-up HMAC → complete_order_refund → Ledger reversal → restore_gift_card_on_refund → Customer notified`

### Inventory journey
`Stock set → Reserved at checkout → Decremented on fulfillment → Adjusted/transferred → Reconciled`

---

## 7. Subscriptions — HONESTLY NOT IMPLEMENTED

Source: `commerce-control-intel.json` (no subscriptions domain listed), `merchant-intelligence.json` → `lifecycle.transitions` (At Risk and Churned states reference `subscriptions` table as signal source, but subscription processing is absent from the commerce domain map).

**Status:** The `subscriptions` table exists in the schema (referenced as churn signal), but there is no subscriptions commerce domain, no subscription-payment RPC, and no subscription journey in the commerce-control-intel artifact. The founding merchant program uses Razorpay subscription webhooks as a proxy, but recurring subscription billing as a merchant feature is **NOT IMPLEMENTED**.

---

## 8. Reuse Points

| Layer | Asset | What LCOS hooks into |
|---|---|---|
| `lcis-core` | `ArtifactStore` | Load `revenue-intelligence-v2.json`, `commerce-control-intel.json`, `revenue-intelligence.json` at boot |
| `lcis-core` | `BlastRadiusService` | `blast("create_checkout_order")` → 19+ downstream tables |
| `lcis-execution` | Change plans | Any PR touching money RPCs → auto-generate migration+test+rollback plan |
| `lcis-governance` | R001 (canonical-ledger-only) | Scan for `.from(money_table).insert/update` in TS |
| `lcis-governance` | R005 (RLS coverage) | Flag `payouts` and `payout_items` (no RLS) — intentional service-role pattern, document not flag |
| `lcis-live` | `lcis-live` adapters | Wire `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → connect `NOT_CONNECTED` revenue metrics |

---

## 9. Signal Classification Summary

| Signal | Class | Exact source |
|---|---|---|
| Ledger topology (tables, RPCs, triggers, invariants) | **DETECTABLE** | `db-intel.json` + migration files |
| Revenue funnel model (stages, RPC chain) | **DETECTABLE** | `revenue-intelligence-v2.json` → `models.funnel` |
| High-risk path inventory | **DETECTABLE** | `revenue-intelligence.json` → `highRiskPaths` |
| Leakage detector RPC list | **DETECTABLE** | `revenue-intelligence-v2.json` → `models.leakageDetection.rpcs` |
| GMV amounts | **NOT_CONNECTED** | `orders.total_minor` — Supabase prod DB |
| Captured revenue amount | **NOT_CONNECTED** | `payment_transactions` — Supabase prod DB |
| Net revenue / ledger balance | **NOT_CONNECTED** | `ledger_account_balance_minor` RPC — Supabase prod DB |
| Gift-card liability balance | **NOT_CONNECTED** | `gift_card_available_balance` RPC — Supabase prod DB |
| Payout amount outstanding | **NOT_CONNECTED** | `payout_statements.amount_minor` — Supabase prod DB |
| Refund value | **NOT_CONNECTED** | `refunds` + `refund_transactions` — Supabase prod DB |
| Per-site reconciliation drift | **NOT_CONNECTED** | `money_ledger_site_reconciliations` — Supabase prod DB |
| Subscriptions domain | **NOT IMPLEMENTED** | No commerce domain; `subscriptions` table exists as churn signal only |
