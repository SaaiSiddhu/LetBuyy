# Executable Implementation Report

## 2026-06-08T08:27:10Z - Phase 1-4 Scaffold

Files Changed:

- `scripts/validators/source-ledger-residue-validator.mjs`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `EXECUTABLE_HUMAN_REQUIRED.md`
- `EXECUTABLE_IMPLEMENTATION_AUDIT.md`
- `EXECUTABLE_GAP_ANALYSIS.md`
- `EXECUTABLE_BUILD_PLAN.md`
- `tasks/executable/001-foundation.md` through `tasks/executable/016-observability.md`

Migrations:

- None created yet.
- Live tree already contains `138_mobile_store_metafields.sql`; new migrations for this run should start at `139_*` in this dirty worktree.

Tests Added:

- None yet.

Risks:

- Full mission scope is very large relative to a single unattended local run.
- Existing dirty/untracked changes are extensive and user-owned.
- Existing stale artifacts make governance red until cleaned or recorded as baseline pollution.
- Existing partition shadow migrations predate V1 and conflict with V1's "partitioning deferred" position; do not add new partitioning.

[HUMAN-REQUIRED]:

- Initial registry created in `EXECUTABLE_HUMAN_REQUIRED.md`.

Next Task:

- Run scoped post-scaffold governance checks, then start local Postgres and Task 001 F6/F1/F2/F5 implementation.

## 2026-06-08T08:53:51Z - Task 001 Foundation Spine

Files Changed:

- `packages/tenant-core/src/index.ts`
- `services/api-gateway/src/lib/tenant-context.ts`
- `packages/event-core/src/index.ts`
- `packages/event-core/test/event-core.test.ts`
- `packages/payments/src/index.ts`
- `packages/payments/test/payments.test.ts`
- `packages/shared-types/src/index.ts`
- `services/api-gateway/src/__tests__/tenant-isolation.test.ts`
- `services/api-gateway/src/__tests__/money.test.ts`
- `tests/executable/money-ledger-postgres.test.mjs`
- `tests/executable/human-required-live-paths.test.mjs`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `EXECUTABLE_IMPLEMENTATION_REPORT.md`

Migrations:

- Forward: `database/supabase/migrations/139_executable_foundation_ledger_core.sql`
- Rollback proof: `database/supabase/rollback/139_executable_foundation_ledger_core.rollback.sql`

Tests Added:

- Event catalog/outbox helper coverage in `packages/event-core/test/event-core.test.ts`.
- Ledger helper coverage in `packages/payments/test/payments.test.ts`.
- Static gateway foundation proofs in `tenant-isolation.test.ts` and `money.test.ts`.
- Real local Postgres F6 proof in `tests/executable/money-ledger-postgres.test.mjs`.
- `[HUMAN-REQUIRED]` skipped live-path assertions in `tests/executable/human-required-live-paths.test.mjs`.

Verification:

- `pnpm --filter @letbuyy/payments run test` PASS 3/3.
- `pnpm --filter @letbuyy/event-core run test` PASS 4/4.
- `pnpm --filter @letbuyy/shared-types run typecheck` PASS.
- `pnpm --filter @letbuyy/tenant-core run typecheck` PASS.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `node --test tests/executable/money-ledger-postgres.test.mjs` PASS 1/1 against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `node --test tests/executable/human-required-live-paths.test.mjs` PASS with 4 skipped `[HUMAN-REQUIRED]` assertions.
- `pnpm run test:unit:gateway` PASS 157/157.
- `pnpm turbo typecheck` PASS 59/59 after restoring workspace links; generated artifacts removed afterward.
- `node scripts/validate-governance.mjs` PASS 172 after cleanup.

Risks:

- Task 001 is not closed. F6 is real-green, but the full F1-F12 reference vertical slice still needs deeper relay/consumer tracing, audit correlation, mock KMS field encryption integration, and route-level query guard rollout.
- Existing mobile V2 money routes still read/write sandbox `payout_statements`, `wallet_ledger_entries`, and commission tables; Task 013 must reconcile them into the canonical ledger.

[HUMAN-REQUIRED]:

- `HR-KMS-LIVE`
- `HR-PROD-MIGRATE-DEPLOY`

Next Task:

- Continue Task 001 until the complete F1-F12 vertical slice is green before opening Task 002.

## 2026-06-08T09:11:37Z - Task 001 Foundation Closeout

Files Changed:

- `services/api-gateway/src/lib/crypto.ts`
- `services/api-gateway/src/lib/foundation-observability.ts`
- `services/api-gateway/src/__tests__/security.test.ts`
- `services/api-gateway/src/__tests__/observability.test.ts`
- `tests/executable/foundation-reference-postgres.test.mjs`
- `database/supabase/migrations/139_executable_foundation_ledger_core.sql`
- `database/supabase/rollback/139_executable_foundation_ledger_core.rollback.sql`
- `tasks/executable/001-foundation.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `139_executable_foundation_ledger_core.sql` now also adds `outbox_events.published_at` and an index when the existing outbox table is present.
- Rollback proof: `139_executable_foundation_ledger_core.rollback.sql` drops the proof outbox column/index plus foundation ledger objects in the isolated local rollback harness.

Tests Added:

- Mock KMS PII field encryption round-trip and live-mode `[HUMAN-REQUIRED]` guard in `security.test.ts`.
- Redacted trace/audit/metrics coverage in `observability.test.ts`.
- Real local Postgres Task 001 reference slice in `tests/executable/foundation-reference-postgres.test.mjs`.

Verification:

- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `pnpm run test:unit:gateway` PASS 162/162.
- `node --test tests/executable/money-ledger-postgres.test.mjs` PASS 1/1 against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `node --test tests/executable/foundation-reference-postgres.test.mjs tests/executable/human-required-live-paths.test.mjs` PASS 1/1 with 4 skipped `[HUMAN-REQUIRED]` assertions.
- `pnpm --filter @letbuyy/payments run test` PASS 3/3.
- `pnpm --filter @letbuyy/event-core run test` PASS 4/4.
- `pnpm --filter @letbuyy/shared-types run typecheck` PASS.
- `pnpm --filter @letbuyy/tenant-core run typecheck` PASS.
- `node scripts/validate-governance.mjs` PASS 172.
- `node scripts/validate-architecture.mjs` PASS.

Risks:

- Combined Docker proof files reset the same isolated schema, so they must run sequentially or in separate databases.
- Existing mobile V2 money surfaces still need Task 013 reconciliation into the canonical F6 ledger.

[HUMAN-REQUIRED]:

- `HR-KMS-LIVE`
- `HR-PROD-MIGRATE-DEPLOY`

Next Task:

- Start Task 002 cart and the first dependency wave (`004`, `006`, `007`, `008`, `009`) now that foundation is green.

## 2026-06-08T09:21:22Z - Task 002 Cart

Files Changed:

- `services/api-gateway/src/routes/storefront/cart-routes.ts`
- `services/api-gateway/src/index.ts`
- `packages/shared-types/src/index.ts`
- `services/api-gateway/src/__tests__/cart.test.ts`
- `database/supabase/migrations/156_executable_cart_channel_handoff.sql`
- `database/supabase/rollback/156_executable_cart_channel_handoff.rollback.sql`
- `tasks/executable/002-cart.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `156_executable_cart_channel_handoff.sql` adds cart `channel`, `buyer_email`, `buyer_identity`, `checkout_handoff`, `abandonment_enqueued_at`, indexes, and tenant-GUC `FORCE ROW LEVEL SECURITY`.
- Rollback proof: `156_executable_cart_channel_handoff.rollback.sql`.

Tests Added:

- `services/api-gateway/src/__tests__/cart.test.ts` covers migration shape, route endpoints, outbox events, signed checkout URL, abandonment enqueue marker, and shared cart contract fields.

Verification:

- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `pnpm run test:unit:gateway` PASS 165/165.
- `pnpm --filter @letbuyy/shared-types run typecheck` PASS after restoring workspace links.
- `node scripts/validators/stale-artifact-validator.mjs` PASS after cleanup.
- `node scripts/validate-governance.mjs` PASS 172.

Risks:

- Existing public API shape remains storefront-scoped (`/v1/storefront/:subdomain/cart...`) rather than adding a duplicate top-level `/v1/carts` router.

[HUMAN-REQUIRED]:

- None.

Next Task:

- Continue the dependency wave with Task 006 inventory.

## 2026-06-08T09:33:11Z - Task 006 Inventory

Files Changed:

- `packages/commerce-core/src/index.ts`
- `services/api-gateway/src/routes/inventory.ts`
- `services/api-gateway/src/__tests__/inventory-reservations.test.ts`
- `tests/executable/inventory-postgres.test.mjs`
- `database/supabase/migrations/141_executable_inventory_reservations.sql`
- `database/supabase/rollback/141_executable_inventory_reservations.rollback.sql`
- `tasks/executable/006-inventory.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `141_executable_inventory_reservations.sql` adds inventory-level version/idempotency fields, tenant-GUC `FORCE ROW LEVEL SECURITY`, and RPC writers for reserve, commit, release, and expiration.
- Rollback proof: `141_executable_inventory_reservations.rollback.sql`.

Tests Added:

- `tests/executable/inventory-postgres.test.mjs` proves concurrent last-unit reserve, idempotent retry, commit/release accounting, expiration sweep, and rollback on real local Postgres.
- `services/api-gateway/src/__tests__/inventory-reservations.test.ts` covers migration shape, route endpoints, event emission, and commerce-core schemas.

Verification:

- `node --test tests/executable/inventory-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `pnpm run test:unit:gateway` PASS 170/170.
- `pnpm --filter @letbuyy/commerce-core run typecheck` PASS.
- `node scripts/validators/stale-artifact-validator.mjs` PASS after cleanup.
- `node scripts/validate-architecture.mjs` PASS.
- `node scripts/validate-governance.mjs` PASS 172.

Risks:

- Inventory reservations use existing table names and additive RPCs; callers that still mutate `inventory_levels` directly must be migrated in downstream checkout/order tasks.

[HUMAN-REQUIRED]:

- None.

Next Task:

- Continue the dependency wave with Task 004 payment.

## 2026-06-08T09:53:40Z - Task 004 Payment

Files Changed:

- `packages/payments/src/index.ts`
- `packages/payments/test/payments.test.ts`
- `services/api-gateway/src/routes/payments.ts`
- `services/api-gateway/src/schemas/payment.schema.ts`
- `services/api-gateway/src/__tests__/payments.test.ts`
- `services/api-gateway/src/index.ts`
- `services/api-gateway/package.json`
- `services/api-gateway/runtime.manifest.json`
- `pnpm-lock.yaml`
- `tests/executable/payment-postgres.test.mjs`
- `database/supabase/migrations/142_executable_payment_sessions.sql`
- `database/supabase/rollback/142_executable_payment_sessions.rollback.sql`
- `tasks/executable/004-payment.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `142_executable_payment_sessions.sql` adds canonical `payments`, `payment_credentials`, `payment_tokens`, provider-mode constraints, `upi`/`refund` attempt support, provider-payment uniqueness, and tenant-GUC RLS/FORCE.
- Rollback proof: `142_executable_payment_sessions.rollback.sql`.

Tests Added:

- `tests/executable/payment-postgres.test.mjs` proves migration apply, tenant-GUC RLS, UPI/refund constraint widening, and rollback on real local Postgres.
- `packages/payments/test/payments.test.ts` covers mock-first session planning and live credential guard helpers.
- `services/api-gateway/src/__tests__/payments.test.ts` covers route, migration, schema, human-required, and webhook-centralization shape.

Verification:

- `node --test tests/executable/payment-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `pnpm --filter @letbuyy/payments run test` PASS 4/4.
- `pnpm --filter @letbuyy/payments run typecheck` PASS after building shared-types declarations.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `pnpm run test:unit:gateway` PASS 171/171.
- `node scripts/validators/stale-artifact-validator.mjs` PASS after cleanup.
- `node scripts/validate-architecture.mjs` PASS.
- `node scripts/validate-governance.mjs` PASS 172.

Risks:

- Live PSP and PA split execution remain intentionally guarded and mock-by-default. Task 013 must post settlement/payout truth into the F6 ledger.
- Provider webhooks remain in `services/webhook-service`; Task 004 did not add a duplicate gateway webhook route.

[HUMAN-REQUIRED]:

- `HR-MERCHANT-PSP-LIVE`
- `HR-PA-SPLIT-LIVE`

Next Task:

- Continue the dependency wave with Task 007 discount.

## 2026-06-08T10:04:37Z - Task 007 Discount

Files Changed:

- `packages/checkout-core/src/index.ts`
- `packages/checkout-core/test/checkout-core.test.ts`
- `services/api-gateway/src/routes/coupons.ts`
- `services/api-gateway/src/index.ts`
- `services/api-gateway/src/__tests__/discounts.test.ts`
- `tests/executable/discount-postgres.test.mjs`
- `database/supabase/migrations/143_executable_discount_stack.sql`
- `database/supabase/rollback/143_executable_discount_stack.rollback.sql`
- `tasks/executable/007-discount.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `143_executable_discount_stack.sql` adds discount class/combination metadata to `coupons` and creates `discount_allocations` with tenant-GUC RLS/FORCE.
- Rollback proof: `143_executable_discount_stack.rollback.sql`.

Tests Added:

- `tests/executable/discount-postgres.test.mjs` proves migration apply, allocation isolation, tenant fail-closed reads, and rollback on real local Postgres.
- `services/api-gateway/src/__tests__/discounts.test.ts` covers route aliasing, migration shape, rollback, and planner exposure.
- `packages/checkout-core/test/checkout-core.test.ts` covers deterministic product/order/shipping stacking and non-combinable rejection.

Verification:

- `pnpm --filter @letbuyy/checkout-core run test` PASS 4/4.
- `pnpm --filter @letbuyy/checkout-core run typecheck` PASS.
- `node --test tests/executable/discount-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `pnpm run test:unit:gateway` PASS 173/173.
- `node scripts/validate-architecture.mjs` PASS.
- `node scripts/validate-governance.mjs` PASS 172.

Risks:

- Reseller attribution remains explicitly deferred/rejected for this run; no reseller discount topology was added.

[HUMAN-REQUIRED]:

- None.

Next Task:

- Continue the dependency wave with Task 008 tax.

## 2026-06-08T10:14:21Z - Task 008 Tax

Files Changed:

- `packages/checkout-core/src/index.ts`
- `packages/checkout-core/test/checkout-core.test.ts`
- `services/api-gateway/src/routes/tax.ts`
- `services/api-gateway/src/index.ts`
- `services/api-gateway/src/__tests__/tax.test.ts`
- `tests/executable/tax-postgres.test.mjs`
- `tests/executable/human-required-live-paths.test.mjs`
- `database/supabase/migrations/144_executable_tax_gst_invoices.sql`
- `database/supabase/rollback/144_executable_tax_gst_invoices.rollback.sql`
- `tasks/executable/008-tax.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `144_executable_tax_gst_invoices.sql` creates tenant-owned tax registrations, HSN rates, tax overrides, and immutable GST invoices with mock IRP metadata.
- Rollback proof: `144_executable_tax_gst_invoices.rollback.sql`.

Tests Added:

- `tests/executable/tax-postgres.test.mjs` proves migration apply, tenant fail-closed reads, immutable invoice UPDATE/DELETE rejection, and rollback on real local Postgres.
- `services/api-gateway/src/__tests__/tax.test.ts` covers route mount, live IRP guard, schema usage, immutable migration shape, and rollback.
- `packages/checkout-core/test/checkout-core.test.ts` now asserts marketplace TCS and mock IRP metadata.

Verification:

- `pnpm --filter @letbuyy/checkout-core run test` PASS 4/4.
- `pnpm --filter @letbuyy/checkout-core run typecheck` PASS after upstream declaration builds.
- `node --test tests/executable/tax-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `pnpm run test:unit:gateway` PASS 177/177.
- `node scripts/validators/stale-artifact-validator.mjs` PASS after cleanup.
- `node scripts/validate-architecture.mjs` PASS.
- `node scripts/validate-governance.mjs` PASS 172.

Risks:

- Order-created invoice persistence remains the downstream order/checkout integration point. This task added the canonical immutable table and read/calculation APIs.

[HUMAN-REQUIRED]:

- `HR-GST-IRP-LIVE`

Next Task:

- Continue the dependency wave with Task 009 shipping.

## 2026-06-08T10:25:00Z - Task 009 Shipping

Files Changed:

- `packages/checkout-core/src/index.ts`
- `packages/checkout-core/test/checkout-core.test.ts`
- `services/api-gateway/src/routes/shipping.ts`
- `services/api-gateway/src/index.ts`
- `services/api-gateway/src/__tests__/shipping.test.ts`
- `tests/executable/shipping-postgres.test.mjs`
- `tests/executable/human-required-live-paths.test.mjs`
- `database/supabase/migrations/145_executable_shipping_serviceability.sql`
- `database/supabase/rollback/145_executable_shipping_serviceability.rollback.sql`
- `tasks/executable/009-shipping.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `145_executable_shipping_serviceability.sql` adds tenant-owned shipping profiles and pincode/COD serviceability rules, extends shipping zones/rates with site and COD metadata, and adds shipment provider/AWB/tracking fields with tenant-GUC RLS/FORCE.
- Rollback proof: `145_executable_shipping_serviceability.rollback.sql`.

Tests Added:

- `tests/executable/shipping-postgres.test.mjs` proves migration apply, tenant fail-closed serviceability reads, shipment tracking field writes, and rollback on real local Postgres.
- `services/api-gateway/src/__tests__/shipping.test.ts` covers route mount, ownership guard, live carrier guard, logistics adapter use, migration shape, and rollback.
- `packages/checkout-core/test/checkout-core.test.ts` covers deterministic pincode/COD serviceability planning.

Verification:

- `pnpm --filter @letbuyy/checkout-core run test` PASS 5/5.
- `pnpm --filter @letbuyy/checkout-core run typecheck` PASS after upstream declaration builds.
- `node --test tests/executable/shipping-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `pnpm run test:unit:gateway` PASS 181/181.
- `node scripts/validators/stale-artifact-validator.mjs` PASS after cleanup.
- `node scripts/validate-architecture.mjs` PASS.
- `node scripts/validate-governance.mjs` PASS 172.

Risks:

- Carrier label buying and manifesting remain on the existing shipping-labels surface. This task added V1 serviceability/rates/tracking and the shipment storage seam.

[HUMAN-REQUIRED]:

- `HR-CARRIER-LIVE`

Next Task:

- Start Task 003 checkout now that its dependencies are green.

## 2026-06-08T10:40:33Z - Task 003 Checkout

Files Changed:

- `packages/checkout-core/src/index.ts`
- `packages/checkout-core/test/checkout-core.test.ts`
- `services/api-gateway/src/routes/checkout.ts`
- `services/api-gateway/src/index.ts`
- `services/api-gateway/src/__tests__/checkout.test.ts`
- `tests/executable/checkout-postgres.test.mjs`
- `tests/executable/human-required-live-paths.test.mjs`
- `database/supabase/migrations/146_executable_checkout_state_machine.sql`
- `database/supabase/rollback/146_executable_checkout_state_machine.rollback.sql`
- `tasks/executable/003-checkout.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `146_executable_checkout_state_machine.sql` extends `checkout_sessions` with cart/channel/lifecycle/contact/delivery/payment-intent fields and creates data-only `store_branding` with tenant-GUC RLS/FORCE.
- Rollback proof: `146_executable_checkout_state_machine.rollback.sql`.

Tests Added:

- `tests/executable/checkout-postgres.test.mjs` proves migration apply, fail-closed tenant reads, branding data-only rejection, and rollback on real local Postgres.
- `services/api-gateway/src/__tests__/checkout.test.ts` covers route mounts, signed handoff, idempotency, confirm revalidation, compensation, branding, migration shape, and human DNS guard.
- `packages/checkout-core/test/checkout-core.test.ts` covers checkout state transitions and data-only branding.

Verification:

- `pnpm --filter @letbuyy/checkout-core run test` PASS 7/7.
- `pnpm --filter @letbuyy/checkout-core run typecheck` PASS after upstream declaration builds.
- `node --test tests/executable/checkout-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `pnpm run test:unit:gateway` PASS 186/186.
- `node scripts/validators/stale-artifact-validator.mjs` PASS after cleanup.
- `node scripts/validate-architecture.mjs` PASS.
- `node scripts/validate-governance.mjs` PASS 172.

Risks:

- Immutable order creation is deliberately deferred to Task 005, which depends on this checkout confirm surface.

[HUMAN-REQUIRED]:

- `HR-DNS-CHECKOUT`

Next Task:

- Start Task 005 order.

## 2026-06-08T11:24:50Z - Task 005 Order

Files Changed:

- `packages/checkout-core/src/index.ts`
- `packages/checkout-core/test/checkout-core.test.ts`
- `services/api-gateway/src/routes/orders.ts`
- `services/api-gateway/src/routes/order-risk.ts`
- `services/api-gateway/src/index.ts`
- `services/api-gateway/src/schemas/order.schema.ts`
- `services/api-gateway/src/__tests__/orders-v1.test.ts`
- `tests/executable/order-postgres.test.mjs`
- `tests/executable/human-required-live-paths.test.mjs`
- `database/supabase/migrations/147_executable_order_state_risk.sql`
- `database/supabase/rollback/147_executable_order_state_risk.rollback.sql`
- `tasks/executable/005-order.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `147_executable_order_state_risk.sql` adds immutable checkout-order state columns, risk assessments, COD confirmation requests, RTO fields, updated order status constraints, tenant-GUC RLS/FORCE policies, and an immutable commercial-field trigger.
- Rollback proof: `147_executable_order_state_risk.rollback.sql`.

Tests Added:

- `tests/executable/order-postgres.test.mjs` proves migration apply, checkout-order immutability, fail-closed tenant reads, COD request isolation, fulfillment-order isolation, rollback, and status remapping on real local Postgres.
- `services/api-gateway/src/__tests__/orders-v1.test.ts` covers route mounts, heuristic-only risk, mock WhatsApp gating, schema facade exports, migration shape, rollback, and no partitioning.
- `packages/checkout-core/test/checkout-core.test.ts` covers deterministic COD/RTO heuristic risk planning without fraud ML.

Verification:

- `pnpm --filter @letbuyy/checkout-core run test` PASS 8/8.
- `pnpm --filter @letbuyy/checkout-core run typecheck` PASS after upstream declaration builds.
- `node --test tests/executable/order-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `pnpm run test:unit:gateway` PASS 190/190.
- `node scripts/validators/route-line-count-validator.mjs` PASS.
- `node scripts/validators/stale-artifact-validator.mjs` PASS after cleanup.
- `node scripts/validate-architecture.mjs` PASS.
- `node scripts/validate-governance.mjs` PASS 172.

Risks:

- Checkout confirm still uses the existing order creation path; this task adds the immutable schema/state/COD risk layer and leaves full WhatsApp lifecycle messaging for Task 012.

[HUMAN-REQUIRED]:

- `HR-WHATSAPP-LIVE`

Next Task:

- Start Task 010 notifications.

## 2026-06-08T11:38:59Z - Task 010 Notifications

Files Changed:

- `packages/notification-core/src/index.ts`
- `services/api-gateway/src/routes/notifications.ts`
- `services/api-gateway/src/__tests__/notifications.test.ts`
- `services/webhook-service/src/app-lifecycle-dispatch.ts`
- `tests/executable/notifications-postgres.test.mjs`
- `tests/executable/human-required-live-paths.test.mjs`
- `EXECUTABLE_HUMAN_REQUIRED.md`
- `database/supabase/migrations/148_executable_notifications_router.sql`
- `database/supabase/rollback/148_executable_notifications_router.rollback.sql`
- `tasks/executable/010-notifications.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `148_executable_notifications_router.sql` creates `notification_logs` and `notification_suppressions`, adds webhook replay-window/nonce/DLQ metadata, enforces nonce population, and applies tenant-GUC RLS/FORCE.
- Rollback proof: `148_executable_notifications_router.rollback.sql`.

Tests Added:

- `tests/executable/notifications-postgres.test.mjs` proves migration apply, fail-closed tenant reads, webhook replay metadata, nonce trigger, and rollback on real local Postgres.
- `services/api-gateway/src/__tests__/notifications.test.ts` covers `/notifications/send`, suppression/preference use, outbox event emission, webhook CRUD, HTTPS target validation, nonce/timestamp signing headers, migration shape, and no partitioning.

Verification:

- `pnpm --filter @letbuyy/notification-core run typecheck` PASS after upstream declaration builds.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `pnpm --filter @letbuyy/webhook-service run typecheck` PASS.
- `pnpm --filter @letbuyy/webhook-service run test` PASS 12/12.
- `node --test tests/executable/notifications-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `cd services/api-gateway && npx tsx --test src/__tests__/notifications.test.ts` PASS 4/4.
- `pnpm run test:unit:gateway` PASS 192/192.
- `node scripts/validators/route-line-count-validator.mjs` PASS.
- `node scripts/validators/stale-artifact-validator.mjs` PASS after cleanup.
- `node scripts/validate-architecture.mjs` PASS.
- `node scripts/validate-governance.mjs` PASS 172.

Risks:

- Live SMS/WhatsApp sends remain provider-gated. Local behavior records delivery intent and emits notification outcome events in mock mode.

[HUMAN-REQUIRED]:

- `HR-DLT-TRAI-LIVE`

Next Task:

- Start Task 011 email.

## 2026-06-08T11:49:47Z - Task 011 Email

Files Changed:

- `packages/notification-core/src/index.ts`
- `packages/event-core/src/index.ts`
- `services/api-gateway/src/routes/email.ts`
- `services/api-gateway/src/index.ts`
- `services/api-gateway/src/__tests__/email.test.ts`
- `tests/executable/email-postgres.test.mjs`
- `tests/executable/human-required-live-paths.test.mjs`
- `database/supabase/migrations/149_executable_email_delivery.sql`
- `database/supabase/rollback/149_executable_email_delivery.rollback.sql`
- `tasks/executable/011-email.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `149_executable_email_delivery.sql` extends existing `email_logs` with `site_id`, template, hash, provider, idempotency, and audit fields, creates `email_suppressions` and `sender_domains`, and applies tenant-GUC RLS/FORCE.
- Rollback proof: `149_executable_email_delivery.rollback.sql`.

Tests Added:

- `services/api-gateway/src/__tests__/email.test.ts` covers the mounted `/email` route, render/send contracts, suppression/domain usage, email events, migration shape, rollback, no partitioning, and no notification-service activation.
- `tests/executable/email-postgres.test.mjs` proves migration apply, fail-closed tenant reads, sender-domain and suppression storage, and rollback on real local Postgres.

Verification:

- `pnpm --filter @letbuyy/notification-core run typecheck` PASS.
- `pnpm --filter @letbuyy/event-core run typecheck` PASS.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `cd services/api-gateway && npx tsx --test src/__tests__/email.test.ts` PASS 1/1.
- `node --test tests/executable/email-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `node --test tests/executable/human-required-live-paths.test.mjs` PASS with 10 skipped live assertions.
- `pnpm run test:unit:gateway` PASS 195/195.
- `pnpm lint` PASS with existing warnings.
- `node scripts/validate-architecture.mjs` PASS.
- `node scripts/validate-governance.mjs` PASS 172.

Risks:

- Live ESP sends remain disabled until sender domains and provider credentials are configured. Mock mode records delivery and emits typed email outcome events.

[HUMAN-REQUIRED]:

- `HR-ESP-LIVE`

Next Task:

- Start Task 012 WhatsApp scoped.

## 2026-06-08T12:04:18Z - Task 012 WhatsApp Scoped

Files Changed:

- `packages/infrastructure/whatsapp-commerce-adapter/index.ts`
- `packages/shared-types/src/index.ts`
- `packages/event-core/src/index.ts`
- `services/api-gateway/src/routes/whatsapp.ts`
- `services/api-gateway/src/index.ts`
- `services/api-gateway/src/__tests__/whatsapp.test.ts`
- `tests/executable/whatsapp-postgres.test.mjs`
- `packages/tenant-core/src/index.ts`
- `apps/identity-platform/src/app/api/auth/create-store/route.ts`
- `database/supabase/migrations/150_executable_whatsapp_scoped.sql`
- `database/supabase/rollback/150_executable_whatsapp_scoped.rollback.sql`
- `tasks/executable/012-whatsapp-scoped.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `150_executable_whatsapp_scoped.sql` adds scoped utility templates, `wa_optins`, `wa_sessions`, and `whatsapp_messages`, updates WhatsApp message template constraints, and applies tenant-GUC RLS/FORCE.
- Rollback proof: `150_executable_whatsapp_scoped.rollback.sql`.

Tests Added:

- `services/api-gateway/src/__tests__/whatsapp.test.ts` covers `/wa` aliases, consent-gated sends, opt-ins, lifecycle/COD sessions, idempotent inbound webhook handling, COD reply-to-confirm, event emission, migration shape, and no full-commerce/AI surfaces.
- `tests/executable/whatsapp-postgres.test.mjs` proves migration apply, tenant fail-closed reads, scoped WhatsApp storage, and rollback on real local Postgres.

Verification:

- `pnpm --filter @letbuyy/shared-types run typecheck` PASS.
- `pnpm --filter @letbuyy/infrastructure run typecheck` PASS.
- `pnpm --filter @letbuyy/event-core run typecheck` PASS.
- `pnpm --filter @letbuyy/event-core run test` PASS 4/4.
- `pnpm --filter @letbuyy/tenant-core run typecheck` PASS.
- `pnpm --filter @letbuyy/identity-platform run typecheck` PASS.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `cd services/api-gateway && npx tsx --test src/__tests__/whatsapp.test.ts` PASS 6/6.
- `node --test tests/executable/whatsapp-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `pnpm run test:unit:gateway` PASS 196/196.
- `pnpm lint` PASS with existing warnings.
- `node scripts/validators/stale-artifact-validator.mjs` PASS after cleanup.
- `node scripts/validate-architecture.mjs` PASS.
- `node scripts/validate-governance.mjs` PASS 172.

Risks:

- Live WABA/BSP/HSM sends remain provider-gated. Local behavior is complete in mock mode and does not add V1-rejected WhatsApp commerce, support inbox, campaign, catalog sync, or AI/NLU behavior.

[HUMAN-REQUIRED]:

- `HR-WHATSAPP-LIVE`
- `HR-LEGAL-DPDP-PA`

Next Task:

- Start Task 013 settlement.

## 2026-06-08T12:19:21Z - Task 013 Settlement

Files Changed:

- `packages/billing-core/src/index.ts`
- `packages/billing-core/test/billing-core.test.ts`
- `services/api-gateway/src/routes/settlements.ts`
- `services/api-gateway/src/routes/payouts.ts`
- `services/api-gateway/src/routes/wallet.ts`
- `services/api-gateway/src/routes/commission.ts`
- `services/api-gateway/src/index.ts`
- `services/api-gateway/src/__tests__/settlements.test.ts`
- `tests/executable/settlement-postgres.test.mjs`
- `EXECUTABLE_HUMAN_REQUIRED.md`
- `database/supabase/migrations/151_executable_settlement_ledger.sql`
- `database/supabase/rollback/151_executable_settlement_ledger.rollback.sql`
- `tasks/executable/013-settlement.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `151_executable_settlement_ledger.sql` creates `settlements`, `reserves`, `payouts`, `payout_items`, `recon_breaks`, adds canonical ledger transaction links to mobile V2 money tables, adds the `post_settlement_ledger_transaction` wrapper over F6 posting, and applies tenant-GUC RLS/FORCE.
- Rollback proof: `151_executable_settlement_ledger.rollback.sql`.

Tests Added:

- `packages/billing-core/test/billing-core.test.ts` covers PA/COD settlement ledger planning, reserve-explained breaks, and payout release ledger planning.
- `services/api-gateway/src/__tests__/settlements.test.ts` covers route mount, billing-core ownership, F6 ledger RPC use, compatibility-table ledger links, human live guard, and no rejected service topology.
- `tests/executable/settlement-postgres.test.mjs` proves migration apply, balanced PA and COD postings, reserve-backed recon break, compatibility wallet ledger link, RLS fail-closed, idempotent ledger replay, and rollback on real local Postgres.

Verification:

- `pnpm --filter @letbuyy/billing-core run typecheck` PASS.
- `pnpm --filter @letbuyy/billing-core run test` PASS 8/8.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `cd services/api-gateway && npx tsx --test src/__tests__/settlements.test.ts` PASS 3/3.
- `node --test tests/executable/settlement-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `node --test tests/executable/human-required-live-paths.test.mjs` PASS with 10 skipped live assertions.
- `pnpm run test:unit:gateway` PASS 199/199.
- `pnpm lint` PASS with existing warnings.
- `node scripts/validators/stale-artifact-validator.mjs` PASS after cleanup.
- `node scripts/validate-architecture.mjs` PASS.
- `node scripts/validate-governance.mjs` PASS 172.

Risks:

- Live PA settlement feeds and Route/Easy-Split payout rails remain disabled until provider/legal onboarding is complete. Mock/local behavior records no-custody payout instructions and does not self-custody funds.

[HUMAN-REQUIRED]:

- `HR-PA-SPLIT-LIVE`
- `HR-LEGAL-DPDP-PA`

Next Task:

- Start Task 014 billing.

## 2026-06-08T12:34:22Z - Task 014 Billing

Files Changed:

- `packages/billing-core/src/index.ts`
- `packages/billing-core/test/billing-core.test.ts`
- `services/api-gateway/src/routes/billing.ts`
- `services/api-gateway/src/execution/subscription-execution.adapter.ts`
- `services/api-gateway/src/index.ts`
- `services/api-gateway/src/__tests__/billing.test.ts`
- `apps/merchant-control-plane/src/lib/billing/plan-ui.ts`
- `apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/SelectPlanClient.tsx`
- `apps/merchant-control-plane/src/app/[store]/settings/subscribe/checkout/SubscribeCheckoutClient.tsx`
- `tests/executable/billing-postgres.test.mjs`
- `tests/executable/human-required-live-paths.test.mjs`
- `EXECUTABLE_HUMAN_REQUIRED.md`
- `database/supabase/migrations/152_executable_billing_autopay.sql`
- `database/supabase/rollback/152_executable_billing_autopay.rollback.sql`
- `tasks/executable/014-billing.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `152_executable_billing_autopay.sql` creates mock AutoPay mandates, merchant billing invoices, dunning events, usage metering rows, extends `subscriptions`/`billing_history` with `site_id` and mandate/dunning metadata, applies tenant-GUC RLS/FORCE, and adds `plans_store_zero_gmv_rake_check`.
- Rollback proof: `152_executable_billing_autopay.rollback.sql`.

Tests Added:

- `packages/billing-core/test/billing-core.test.ts` covers zero GMV rake defaults, mock UPI AutoPay mandate planning, and dunning planning.
- `services/api-gateway/src/__tests__/billing.test.ts` covers route mount, billing-core contract use, migration/rollback shape, UI rake removal, and live AutoPay human gating.
- `tests/executable/billing-postgres.test.mjs` proves migration apply, zero-rake constraint, mock billing rows, tenant fail-closed reads, cross-tenant denial, and rollback on real local Postgres.

Verification:

- `pnpm --filter @letbuyy/billing-core run typecheck` PASS.
- `pnpm --filter @letbuyy/billing-core run test` PASS 10/10.
- `pnpm --filter @letbuyy/merchant-control-plane run typecheck` PASS.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `cd services/api-gateway && npx tsx --test src/__tests__/billing.test.ts` PASS 4/4.
- `node --test tests/executable/billing-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `node --test tests/executable/human-required-live-paths.test.mjs` PASS with 11 skipped live assertions.
- `pnpm run test:unit:gateway` PASS 203/203.
- `pnpm lint` PASS with existing warnings.

Risks:

- Live UPI AutoPay/NPCI mandate rails remain disabled until provider onboarding and credentials are installed. Mock/local behavior is complete and does not restore the rejected 2.5% GMV rake.

[HUMAN-REQUIRED]:

- `HR-AUTOPAY-LIVE`

Next Task:

- Start Task 015 security.

## 2026-06-08T12:47:38Z - Task 015 Security

Files Changed:

- `services/api-gateway/src/lib/security-controls.ts`
- `services/api-gateway/src/routes/security.ts`
- `services/api-gateway/src/routes/payments.ts`
- `services/api-gateway/src/routes/payouts.ts`
- `services/api-gateway/src/index.ts`
- `packages/event-core/src/index.ts`
- `services/api-gateway/src/__tests__/security-v1.test.ts`
- `tests/executable/security-postgres.test.mjs`
- `tests/executable/human-required-live-paths.test.mjs`
- `EXECUTABLE_HUMAN_REQUIRED.md`
- `database/supabase/migrations/153_executable_identity_security.sql`
- `database/supabase/rollback/153_executable_identity_security.rollback.sql`
- `tasks/executable/015-security.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `153_executable_identity_security.sql` creates consent, store-credit, DSR export, step-up, and sensitive-action approval tables; adds encrypted PII columns to existing customer tables; and applies tenant-GUC RLS/FORCE to new and relevant existing PII tables.
- Rollback proof: `153_executable_identity_security.rollback.sql`.

Tests Added:

- `services/api-gateway/src/__tests__/security-v1.test.ts` covers route mount, DSR APIs, mock KMS use, step-up guards, auth/security events, human-required registry rows, migration/rollback shape, and the date-helper single-source fix.
- `tests/executable/security-postgres.test.mjs` proves migration apply, encrypted-column presence, maker-checker self-approval rejection, RLS fail-closed reads, tenant-scoped reads, and rollback on real local Postgres.

Verification:

- `cd services/api-gateway && npx tsx --test src/__tests__/security-v1.test.ts` PASS 4/4.
- `node --test tests/executable/security-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `pnpm --filter @letbuyy/event-core run typecheck` PASS.
- `pnpm --filter @letbuyy/event-core run test` PASS 4/4.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `node --test tests/executable/human-required-live-paths.test.mjs` PASS with 13 skipped live assertions.
- `node scripts/validators/route-line-count-validator.mjs` PASS.
- `pnpm run test:unit:gateway` PASS 207/207.
- `pnpm lint` PASS with existing warnings.
- `node scripts/validators/stale-artifact-validator.mjs` PASS after cleanup.
- `node scripts/validate-architecture.mjs` PASS.
- `node scripts/validate-governance.mjs` PASS 172.

Risks:

- Live KMS, Turnstile, SSO, and legal DPDP/PA sign-off remain disabled until humans install credentials and approve policy. Local behavior is complete in mock mode and returns sanitized errors for guarded live paths.

[HUMAN-REQUIRED]:

- `HR-KMS-LIVE`
- `HR-TURNSTILE-LIVE`
- `HR-LEGAL-DPDP-PA`

Next Task:

- Start Task 016 observability, analytics rollups, media module, and AI seam.

## 2026-06-08T13:06:53Z - Task 016 Observability

Files Changed:

- `packages/event-core/src/index.ts`
- `packages/event-core/test/event-core.test.ts`
- `packages/runtime-composition/src/search-projection-runtime.ts`
- `packages/infrastructure/storage-adapter/index.ts`
- `packages/infrastructure/ai-generation-adapter/index.ts`
- `services/api-gateway/src/routes/analytics.ts`
- `services/api-gateway/src/routes/media.ts`
- `services/api-gateway/src/routes/ai.ts`
- `services/api-gateway/src/index.ts`
- `services/api-gateway/src/__tests__/observability-analytics-media.test.ts`
- `tests/executable/observability-analytics-media-postgres.test.mjs`
- `tests/executable/human-required-live-paths.test.mjs`
- `apps/identity-platform/src/components/OAuthBrandIcon.tsx`
- `EXECUTABLE_HUMAN_REQUIRED.md`
- `database/supabase/migrations/154_executable_analytics_media_ai_seam.sql`
- `database/supabase/rollback/154_executable_analytics_media_ai_seam.rollback.sql`
- `tasks/executable/016-observability.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`

Migrations:

- Forward: `154_executable_analytics_media_ai_seam.sql` extends `media_assets`, enables tenant-GUC RLS/FORCE on media and analytics rollups, creates `commerce_analytics_daily_mv`, creates `refresh_commerce_analytics_daily_mv()`, and creates `ai_capability_seams` with model calls disabled.
- Rollback proof: `154_executable_analytics_media_ai_seam.rollback.sql`.

Tests Added:

- `services/api-gateway/src/__tests__/observability-analytics-media.test.ts` covers the analytics MV route, media signed-upload/outbox event wiring, and AI seam no-model policy.
- `tests/executable/observability-analytics-media-postgres.test.mjs` proves migration apply, MV refresh/read behavior, media and AI seam tenant isolation, model-call rejection, and rollback on real local Postgres.
- `tests/executable/human-required-live-paths.test.mjs` now includes live warehouse and AI model live-path skips.

Verification:

- `pnpm --filter @letbuyy/event-core run typecheck` PASS.
- `pnpm --filter @letbuyy/event-core run test` PASS 4/4.
- `pnpm --filter @letbuyy/runtime-composition run typecheck` PASS.
- `pnpm --filter @letbuyy/infrastructure run typecheck` PASS.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `cd services/api-gateway && npx tsx --test src/__tests__/observability-analytics-media.test.ts` PASS 3/3.
- `node --test tests/executable/observability-analytics-media-postgres.test.mjs` PASS against Docker Postgres `letbuyy-executable-pg` on host port `54339`.
- `node --test tests/executable/human-required-live-paths.test.mjs` PASS with 15 skipped live assertions.
- `pnpm run test:unit:gateway` PASS 210/210.
- `pnpm lint` PASS with existing warnings.
- `pnpm turbo typecheck` PASS 59/59.
- `pnpm run test:behavioral` PASS 505 tests, 490 pass, 15 skipped.
- `pnpm run test:contracts` PASS 197/197.
- `pnpm turbo test` PASS 67/67 tasks.

Risks:

- Live warehouse export and AI model execution remain disabled until humans choose providers, install credentials, and approve live policies. Local behavior is complete in mock mode and no V1-rejected analytics-pipeline/media-service/AI runtime was activated.

[HUMAN-REQUIRED]:

- `HR-WAREHOUSE-LIVE`
- `HR-AI-MODEL-LIVE`

Next Task:

- Final cleanup, repository intelligence regeneration, stale-artifact validation, architecture validation, and governance validation.

## 2026-06-08T13:09:46Z - Final Validation

Files Changed:

- `AGENTS.md`
- `docs/architecture/master-system-intelligence.md`
- `CODEX_EXECUTABLE_BUILD_STATUS.md`
- `CODEX_EXECUTABLE_BUILD_LEDGER.md`
- `EXECUTABLE_IMPLEMENTATION_REPORT.md`

Verification:

- `node scripts/generate-repository-intelligence.mjs` PASS.
- `node scripts/validators/stale-artifact-validator.mjs` PASS.
- `node scripts/validators/route-line-count-validator.mjs` PASS, 82 api-gateway route files checked.
- `node scripts/validate-architecture.mjs` PASS.
- `node scripts/validate-governance.mjs` PASS 172 validators.

Completion:

- Tasks `001` through `016` are marked `done`.
- Live provider, DNS/cert, deploy, warehouse/model, and legal steps remain logged in `EXECUTABLE_HUMAN_REQUIRED.md` and are guarded behind mock-default local behavior.
