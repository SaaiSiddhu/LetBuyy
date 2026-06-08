# Task 002 - Cart
Status: done
DependsOn: [001]
Covers: server-authoritative cart
Conforms-to: V1 sections 3, 9, Appendix C row 002

## Goal

Persist server-authoritative carts with channel, email capture, discount code attachment, signed checkout handoff, and abandonment enqueue.

## Scope

In: cart APIs and storefront cart replacement. Out: checkout-runtime service.

## Reuse

`services/api-gateway/src/routes/storefront/cart-routes.ts`, baseline `carts`, `platform_queue_jobs`, `outbox_events`, `packages/checkout-core`, `packages/shared-types`.

## Files

Create: `database/supabase/migrations/156_executable_cart_channel_handoff.sql`, `database/supabase/rollback/156_executable_cart_channel_handoff.rollback.sql`, `services/api-gateway/src/__tests__/cart.test.ts`.

Modify: `services/api-gateway/src/routes/storefront/cart-routes.ts`, `services/api-gateway/src/index.ts`, `packages/shared-types/src/index.ts`, status/ledger/report files.

## Database

Migrations: `156_executable_cart_channel_handoff.sql` plus rollback proof. Adds `channel`, `buyer_email`, `buyer_identity`, `checkout_handoff`, `abandonment_enqueued_at`, indexes, `FORCE ROW LEVEL SECURITY`, and tenant-GUC policy. Partition: none.

## APIs

Implemented on the existing public storefront cart API: `POST /storefront/:subdomain/cart`, `PATCH /storefront/:subdomain/cart/:cartToken`, `PUT /storefront/:subdomain/cart/:cartToken/buyer-identity`, `POST /storefront/:subdomain/cart/:cartToken/discount-codes`, `GET /storefront/:subdomain/cart/:cartToken/checkout-url`.

## Events

`cart.created`, `cart.email_captured`, `cart.abandoned` via the governed outbox event catalog.

## Acceptance

Cart persists across navigation; handoff signature verifies; abandoned cart job enqueued.

Current evidence:

- Server cart persists in `public.carts` and now carries channel + buyer email.
- Signed checkout handoff uses `hmacSha256Hex` from the single-source crypto helper and stores `checkout_handoff`.
- Email capture emits `cart.email_captured` and enqueues `platform_queue_jobs` `cart.abandonment_check`; `cart.abandoned` is emitted with `reason=abandonment_check_enqueued`.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `pnpm run test:unit:gateway` PASS 165/165.
- `pnpm --filter @letbuyy/shared-types run typecheck` PASS after temporary workspace-link restore and generated artifact cleanup.
- `node scripts/validate-governance.mjs` PASS 172.

## Tests

Unit/static route contract tests in `cart.test.ts`, gateway unit suite, shared-types typecheck, governance.

## Rollback

Flag off server handoff and rollback cart migration.

## [HUMAN-REQUIRED]

None.
