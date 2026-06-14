# LCIS v2 — SQL Intelligence Report (Phase 2)

Lineage over the data layer. Live queries: `pnpm graph:intel {rpc,table,policy,payment,refund,payout,tenant}` · `/api/{table,rpc,policy}`.

## Lineage capabilities
| Lineage | Query | Example result |
|---------|-------|----------------|
| **RPC lineage** | `graph:intel rpc create_checkout_order` | SD✓ idem✓ lock✓ → 19 tables (orders, order_items, gift_card_*, payment_transactions, shipping_*, promotion_*, inventory_*) ← order-execution.adapter.ts |
| **Table lineage** | `graph:intel table orders` | RLS✓ tenant✓ money✓ · 5 policies · touched by 18 RPCs · reached by 3 routes |
| **Table lineage** | `graph:intel table gift_card_accounts` | touched by 7 RPCs (issue/redeem/restore/status/balance/transactions) |
| **Policy lineage** | `graph:intel policy gift_card_accounts` | the RLS policies on that table |
| **Money lineage** | `graph:intel payment` | 34 money RPCs, all SECURITY DEFINER + idempotent + row-locked |
| **Refund lineage** | `graph:intel refund` | complete_order_refund, create_order_return_and_refund, restore_gift_card_on_refund |
| **Payout lineage** | `graph:intel payout` | settlement/commission/payout RPCs |
| **Tenant lineage** | `graph:intel tenant` | 255 tenant tables, 235 with RLS |
| **Index/trigger lineage** | `graph:intel table T` | per-table index + trigger counts |

## Hub tables (most-touched by RPCs)
- `orders` — 18 RPCs, 5 policies (the order spine).
- `gift_card_accounts` / `gift_card_ledger_entries` — 7 RPCs (the gift-card ledger).
- `payment_transactions`, `inventory_levels`, `order_items` — high RPC fan-in.

## Money lineage integrity
All 34 money RPCs are SECURITY DEFINER; the core (create_checkout_order, complete_order_refund, confirm_order_payment_with_ledger, restore_gift_card_on_refund) are idempotent + `FOR UPDATE`-locked. The `canonical-ledger-only-validator` enforces that TS never writes money tables directly. ✅

## Use it
"What touches table X / what does RPC Y do / which policies guard Z" — answer with one `graph:intel` call, no repo scan.
