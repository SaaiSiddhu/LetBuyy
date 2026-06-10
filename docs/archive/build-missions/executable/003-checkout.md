# Task 003 - Checkout
Status: done
DependsOn: [001,002,004,006,007,008,009]
Covers: in-monolith checkout state machine
Conforms-to: V1 sections 3, 9, Appendix C row 003

## Goal

Implement contact -> delivery -> payment-intent -> confirm checkout session with idempotent confirm and scoped compensation.

## Scope

In: monolith routes and hosted-origin readiness. Out: `checkout-runtime` or checkout-edge service.

## Reuse

`packages/checkout-core`, storefront checkout routes, payment/inventory/discount/tax/shipping routes.

## Files

Create: `services/api-gateway/src/routes/checkout.ts`, `tests/executable/checkout-postgres.test.mjs`, `services/api-gateway/src/__tests__/checkout.test.ts`.
Modify: `packages/checkout-core/src/index.ts`, `packages/checkout-core/test/checkout-core.test.ts`, `services/api-gateway/src/index.ts`, `tests/executable/human-required-live-paths.test.mjs`.

## Database

Migration `146_executable_checkout_state_machine.sql` extends `checkout_sessions` with cart/channel/state/contact/delivery/payment-intent fields and adds data-only `store_branding`. Rollback: `database/supabase/rollback/146_executable_checkout_state_machine.rollback.sql`. RLS+FORCE+GUC applied to checkout sessions and store branding.

## APIs

`POST /checkout/:cartId/contact`, `/delivery`, `/payment-intent`, `/confirm`; `GET /checkout/:id`; `GET/PUT /stores/:id/branding`.

## Events

`checkout.started.v1`, `checkout.completed.v1`, `checkout.failed.v1`.

## Acceptance

Inventory reservations and discount codes are revalidated at confirm; branding is data only; failed confirm after a payment intent records a scoped `checkout_confirm` compensation action.

## Tests

PASS: checkout-core lifecycle tests; gateway static/route contract tests; real local Postgres migration/RLS/rollback proof; gateway typecheck; gateway unit suite; governance and architecture validation.

## Rollback

Disable hosted checkout flag and rollback checkout migrations.

## [HUMAN-REQUIRED]

`HR-DNS-CHECKOUT`.
