# Order item references — acceptance dependency

The source-owned API projection is `packages/checkout-core/src/index.ts`, normalizeOrderItemRecord/normalizeOrderRecord, reached by GET order list/detail in `services/api-gateway/src/routes/orders.ts` after `hydrateOrderItems` in `lib/order-read-compat.ts`.

The hydrated database rows include order item IDs, but normalizeOrderItemRecord's normalized item object omits `id` and `order_id`; normalizeOrderRecord replaces the array with those normalized objects. It emits `item_count`, `items` and `order_items`. Current Dart OrderContract.lineItems expects `line_items`, and original edit/refund commands require immutable order-line IDs. Product IDs cannot substitute for order-line IDs.

Within the current frontend-only assignment, the list reads the existing server count, and Detail can inspect current item values through a view-only adapter without modifying shared DTOs/cache/commands. Unsupported edit references remain unavailable. Refund intent recovery retains its existing rules; no fresh financial command is authorized by a rendered item or a fixture.

Completing line edit/item-refund acceptance requires a separately authorized backend/shared-contract repair that preserves the canonical order item identity, exact values/units/currency, site ownership, existing keys/proofs and original retry behavior. That repair and its database/contract/web/mobile acceptance are pending. No server code, endpoint semantics, model, migration, policy or provider behavior was changed here.

Evidence: native23's retained one-line canonical COD prerequisite and false0 native list; focused actual service/model UI regression using the current normalized array shape; current CustomerCreate3 broad gates/native24 are recorded separately. The native23 compound run failed and its original owned database was removed. Do not present it as passing Detail/Returns or complete commerce acceptance.
