# Task 007 - Discount
Status: done
DependsOn: [001]
Covers: discounts
Conforms-to: V1 section 3, Appendix C row 007

## Goal

Implement code and automatic discounts with deterministic combine rules and usage limits.

## Scope

In: 3-class `combines_with`, product/order/shipping allocation. Out: reseller attribution.

## Reuse

`services/api-gateway/src/routes/coupons.ts`, `packages/checkout-core`.

## Database

Migration `143_executable_discount_stack.sql` extends `coupons` with class/combination metadata and creates `discount_allocations` with tenant RLS+FORCE+GUC. Rollback: `database/supabase/rollback/143_executable_discount_stack.rollback.sql`.

## APIs

`POST /discounts`, `POST /discounts/validate` through the existing coupons route mounted at `/discounts`.

## Events

`discount.redeemed.v1`; subscribes to `order.created.v1`.

## Acceptance

Stacking and caps are deterministic; product/order/shipping allocation order is stable; non-combinable discounts are rejected rather than reordered; allocations are tenant-isolated on real Postgres.

## Tests

PASS: `pnpm --filter @letbuyy/checkout-core run test` 4/4; `pnpm --filter @letbuyy/checkout-core run typecheck`; `node --test tests/executable/discount-postgres.test.mjs` on Docker Postgres; `cd services/api-gateway && npx tsc --noEmit`; `pnpm run test:unit:gateway` 173/173; governance 172.

## Rollback

Flag off automatic discounts and run `database/supabase/rollback/143_executable_discount_stack.rollback.sql`.

## [HUMAN-REQUIRED]

None.
