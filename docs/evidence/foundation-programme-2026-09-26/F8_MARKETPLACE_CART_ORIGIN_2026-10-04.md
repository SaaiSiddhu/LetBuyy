# F8.1 marketplace cart identity and sales-origin boundary — 4 October 2026

## Delivered locally

Migration 277 adds a constrained `sales_origin` to server carts and checkout sessions, separate from `channel`, which continues to mean entry method (`web`, WhatsApp, POS, and related channels). The storefront cart route always writes `storefront`; a dedicated seller-bound marketplace cart route writes `marketplace`. Cart origin cannot be changed when a token is reused.

Marketplace cart lines carry both the catalog `product_id` and `marketplace_listing_id`. Before persisting a marketplace cart, the Gateway calls the canonical `marketplace_listing_detail` RPC for each listing and checks that the currently public, approved listing resolves to the same product and seller as the cart route. The server hydrates price and product display fields from its normal public product query. Client totals are not accepted.

The cart's sales origin and listing identity are part of the canonical signed cart digest; checkout re-reads them from the server cart and verifies the signature. The current order adapter/RPC cannot yet atomically validate marketplace eligibility or preserve marketplace origin on the parent purchase. Hosted checkout therefore returns `MARKETPLACE_ORDER_FLOW_PENDING` before creating a storefront order. This is a deliberate fail-closed boundary while that transaction is unfinished.

## Verification

| Check | Result |
|---|---|
| Owned production-worker Postgres suite `marketplace-cart-origin.postgres.test.ts` | 4/4 passed: valid approved listing, cart readback, product substitution, pending listing, seller substitution, storefront-origin injection/conversion, signed hosted handoff origin and no order fallthrough |
| Checkout-core and handoff tests | 19/19 passed |
| Server-side cart contract | 5/5 passed |
| API Gateway typecheck | Passed |
| Migration safety validator | Passed |
| `git diff --check` | Passed |

The Postgres lane used one runner-owned disposable cluster and removed its resources. Migration 277 was exercised only in that isolated lane; no restored, shared or hosted database was migrated. No browser/mobile checkout, provider transaction, deployment or live order was attempted.

## Remaining Phase 8 work

This creates a verified marketplace server cart, not an order flow. Implement the atomic marketplace order transaction that revalidates listing status/revision and seller/product/variant mapping, records listing identity in immutable order snapshots, groups a multi-seller purchase under the accepted parent model, and rechecks eligibility at the correct payment boundary. Then connect the normal marketplace mobile/web cart and checkout UI, including an explicit withdrawn-listing/recovery state. F6.5 and F8 remain open.

## Superseding implementation record — 4 October 2026

The former order-flow blocker is resolved for one seller-bound purchase path by [F8.2 marketplace order binding](F8_MARKETPLACE_ORDER_BINDING_2026-10-04.md). Cross-seller allocations, marketplace provider eligibility, mobile/web checkout integration, capture recovery and full Phase 8 acceptance remain open.
