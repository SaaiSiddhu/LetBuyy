# Task 014 - Billing
Status: done
DependsOn: [001]
Covers: plans, subscriptions, mandates, dunning
Conforms-to: V1 section 3, Appendix C row 014

## Goal

Implement subscription lifecycle, UPI AutoPay mock mandates, usage metering, dunning, merchant GST invoices, and remove GMV rake.

## Scope

In: mock AutoPay and 0% transaction fee on paid tiers. Out: live mandate until provider go-live.

## Reuse

`internal-billing.ts`, `packages/billing-core`, baseline plans/subscriptions/billing_history, merchant billing UI plan adapters, existing payment subscription execution adapter.

## Database

Forward: `database/supabase/migrations/152_executable_billing_autopay.sql`.

Rollback: `database/supabase/rollback/152_executable_billing_autopay.rollback.sql`.

Adds `billing_mandates`, `merchant_billing_invoices`, `billing_dunning_events`, `billing_usage_events`; extends `subscriptions` and `billing_history` with `site_id`, idempotency, mandate and dunning metadata; applies tenant-GUC RLS/FORCE; enforces `plans_store_zero_gmv_rake_check`.

## APIs

`POST /v1/billing/mandate`, `POST /v1/billing/subscribe`, `GET /v1/billing/invoices`.

## Events

Publishes `billing.charged`, `billing.failed`, and `billing.plan_changed` through the outbox. Usage metering is stored in `billing_usage_events` for the `order.created` subscription path.

## Acceptance

Subscription/dunning lifecycle works in mock mode; merchant billing invoice issued; `gmv_percentage` rake removed in package defaults, migration constraint, and merchant UI copy.

## Tests

PASS:

- `pnpm --filter @letbuyy/billing-core run typecheck`
- `pnpm --filter @letbuyy/billing-core run test` 10/10
- `pnpm --filter @letbuyy/merchant-control-plane run typecheck`
- `cd services/api-gateway && npx tsc --noEmit`
- `cd services/api-gateway && npx tsx --test src/__tests__/billing.test.ts` 4/4
- `node --test tests/executable/billing-postgres.test.mjs` real local Postgres proof
- `node --test tests/executable/human-required-live-paths.test.mjs` 11 skipped live assertions
- `pnpm run test:unit:gateway` 203/203
- `pnpm lint` PASS with existing warnings

## Rollback

Disable new billing flows and apply `database/supabase/rollback/152_executable_billing_autopay.rollback.sql`. The rollback removes the AutoPay tables/extensions; it does not restore non-zero GMV rake because V1 rejects that model.

## [HUMAN-REQUIRED]

`HR-AUTOPAY-LIVE`.
