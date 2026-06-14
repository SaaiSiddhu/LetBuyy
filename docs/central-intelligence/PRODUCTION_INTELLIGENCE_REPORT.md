# LCIS — Production Intelligence Report (Phase 13)

Derived from the intelligence engine (`pnpm graph:intel`) + DB intel.

## Critical systems (highest blast radius)
Changing these impacts the most of the codebase — review them with the most care.

| Symbol | File | Impact (blast radius) |
|--------|------|----------------------:|
| `getSupabaseAdmin()` | `services/api-gateway/src/lib/supabase.ts` | **197 nodes / 115 files** |
| `@letbuyy/shared-types` index | `packages/shared-types/src/index.ts` | degree 806 (the type spine) |
| `@letbuyy/api-client` index | `packages/typescript/api-client/src/index.ts` | degree 669 (every app proxy) |
| `@letbuyy/checkout-core` index | `packages/checkout-core/src/index.ts` | degree 227 |
| `api_client.dart` | `packages/dart/api_client/lib/src/api_client.dart` | degree 358 (mobile spine) |

`getSupabaseAdmin` is the **single highest-leverage runtime symbol** — the service-role DB client behind every gateway money/tenant operation. Any change there is a 115-file blast.

## Single points of failure
- **api-gateway** — every app path terminates here; it is the only writer of money/tenant data. (By design — concentrated, audited, RLS-backed.)
- **shared-types / api-client** — a breaking change ripples to all apps; mitigated by typecheck + the federation route-ownership lockstep.
- **`create_checkout_order`** — the one server-side order RPC; touches `orders`, `order_items`, `gift_card_*`, `payment_transactions`. A regression here affects all checkout.

## Money-path integrity (from DB intel)
34 money RPCs; spot-check of the core set — all SECURITY DEFINER, idempotent, row-locked:
- `create_checkout_order` — SD ✓ idem ✓ lock ✓ → orders, order_items, gift_card_accounts/ledger/redemptions, payment_transactions
- `complete_order_refund` — SD ✓ idem ✓ lock ✓ → refunds, refund_transactions, orders, payment_transactions
- `confirm_order_payment_with_ledger` — SD ✓ idem ✓ lock ✓
- `restore_gift_card_on_refund` — SD ✓ idem ✓ (gift-card refund restore)

## Deployment / security risks (cross-ref)
- App production builds + 209-commit-unpushed + ESP-live are tracked in `docs/implementation/DEPLOYMENT_GAP_REPORT.md` (operator-gated).
- RLS / canonical-ledger / single-issuer enforced by deterministic validators (all green).

## Recommendation
Treat `getSupabaseAdmin`, `shared-types`, `api-client`, and `create_checkout_order` as **change-control hotspots** — require a `pnpm graph:intel blast <symbol>` review on any PR touching them.
