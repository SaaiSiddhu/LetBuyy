# Task 005 - Order
Status: done
DependsOn: [001,003,004,006]
Covers: immutable order and heuristic risk
Conforms-to: V1 sections 3, 9, 11, Appendix C row 005

## Goal

Make orders immutable, checkout-created only, with financial/fulfillment state machines and COD/RTO heuristic.

## Scope

In: order state, FulfillmentOrder per location, returns/RTO, COD confirm integration. Out: fraud ML.

## Reuse

`services/api-gateway/src/routes/orders.ts`, returns routes, migrations `130`, existing WhatsApp route.

## Database

Migration `147_executable_order_state_risk.sql` adds immutable checkout-order state columns, risk assessments, COD confirmation requests, RTO fields, and tenant-GUC RLS/FORCE on orders, fulfillment orders, returns, risk, and COD tables. No partitioning.

## APIs

Existing `POST /orders`, `GET /orders`, `GET /orders/:id`, edit/fulfill/refund endpoints remain in the orders router. New `/risk/assess` and `/orders/:id/cod/{confirm,timeout}` endpoints live in `services/api-gateway/src/routes/order-risk.ts` and are mounted in the monolith.

## Events

`order.created.v1`, `order.paid.v1`, `order.confirmed_cod.v1`, `order.fulfilled.v1`, `order.delivered.v1`, `order.cancelled.v1`, `order.rto.v1`, `order.returned.v1`, `order.risk_assessed.v1`.

## Acceptance

Order invariants hold; checkout-created commercial fields are immutable at the database layer; heuristic risk can request mock WhatsApp COD confirmation; no-confirm COD auto-cancel/hold works in mock; all route files remain <=1500 lines.

## Tests

PASS: `pnpm --filter @letbuyy/checkout-core run test` 8/8; `pnpm --filter @letbuyy/checkout-core run typecheck`; `node --test tests/executable/order-postgres.test.mjs`; `cd services/api-gateway && npx tsc --noEmit`; `pnpm run test:unit:gateway` 190/190; route-line validator; stale-artifact validator; `validate-architecture.mjs`; `validate-governance.mjs` 172.

## Rollback

Run `database/supabase/rollback/147_executable_order_state_risk.rollback.sql` to remove the additive state/risk/COD schema and map `pending_cod`/`rto` statuses back to the legacy status domain.

## [HUMAN-REQUIRED]

`HR-WHATSAPP-LIVE`.
