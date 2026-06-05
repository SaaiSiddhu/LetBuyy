# CODEX FOUNDATION-HARDENING STATUS

Started: 2026-06-05T13:54:14Z

## Current phase

- Phase: F1 - Backend integrity; F1.6 storefront god-file split in progress.
- Findings resolved: 6/31 Critical/High complete (`C-2`, `C-12`, `C-13`, `H-1`, `H-10`, `H-12`); `H-11` is SKIPPED -- NEEDS HUMAN for payout rail/policy/credentials.
- Current governance gate state: green after F1.6 internal payment route split (`pnpm run validate:governance` -> 129/129 PASS).

## Baseline gates

- `pnpm turbo typecheck`: FAIL - missing workspace dependency resolution for `apps/developer-portal` and `packages/shared-types`.
- `pnpm run validate:governance`: FAIL - stale generated artifacts produced by baseline commands; artifacts removed after capture.
- `pnpm lint`: FAIL - missing `eslint` in several workspaces due absent local installs.
- `pnpm turbo build`: FAIL - missing `next` in `apps/developer-portal`.
- `node --test tests/*/*.test.mjs`: FAIL - 431/432 pass; `tests/auth/rbac-categories.test.mjs` cannot load `./customer-session` in its VM require shim.

## F0 gate evidence

- `pnpm install --frozen-lockfile --force`: PASS after offline store miss for `jose@6.1.3`; restored workspace links from lockfile.
- `pnpm turbo typecheck`: PASS - 60/60 tasks.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Recursive cleanup removed workspace-local `node_modules`, `.turbo`, `dist`, and `.next` artifacts under `apps/`, `packages/`, and `services/`.
- `pnpm run validate:governance`: PASS - 128/128 validators.

## F1.1 gate evidence

- `services/webhook-service` no longer writes `orders` or `products` directly in payment webhook flows; paid/failed/refunded/partial-refund outcomes call gateway-owned internal payment endpoints.
- `services/api-gateway` now owns the partial payment-event marker endpoint and the JSON-only legacy product-stock fallback.
- `node scripts/validators/single-writer-ownership-validator.mjs`: PASS.
- `pnpm --filter @letbuyy/webhook-service test`: PASS - 5/5 behavior tests for the gateway transition client.
- `pnpm --filter @letbuyy/webhook-service typecheck`: PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm turbo typecheck`: PASS - 60/60 tasks.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- `pnpm run validate:governance`: PASS - 129/129 validators.

## F1.2 gate evidence

- `services/webhook-service` no longer writes `subscriptions`, `sites`, or `billing_history` directly; subscription activation/status/invoice outcomes call gateway-owned internal billing endpoints.
- `services/api-gateway` now owns `SubscriptionExecutionAdapter` plus `/v1/internal/billing/subscriptions/{activate,sync,invoice}`.
- `node scripts/validators/single-writer-ownership-validator.mjs`: PASS with `orders`, `products`, `subscriptions`, `sites`, and `billing_history`.
- `pnpm --filter @letbuyy/webhook-service test`: PASS - 9/9 behavior tests for order and billing transition clients.
- `pnpm --filter @letbuyy/webhook-service typecheck`: PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm turbo typecheck`: PASS - 60/60 tasks.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- `pnpm run validate:governance`: PASS - 129/129 validators.

## F1.3 gate evidence

- `services/api-gateway` scheduled dispatch now produces Cloudflare queue triggers for `EVENT_QUEUE`, `RUNTIME_QUEUE`, and, when platform queue work exists, `ANALYTICS_QUEUE`, `SEARCH_QUEUE`, and `NOTIFICATION_QUEUE`.
- `packages/infrastructure/queue-adapter` now preserves `jobType` so queue-worker deliveries see the intended drain trigger type.
- `scripts/validators/queue-lifecycle-validator.mjs`: PASS with source send-plan checks for all 5 queue producer bindings.
- `npx tsx --test services/api-gateway/src/__tests__/cloudflare-queue-triggers.test.ts`: PASS - 3/3 behavior tests.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm turbo typecheck`: PASS - 60/60 tasks.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- `pnpm run validate:governance`: PASS - 129/129 validators.

## F1.5 gate evidence

- `packages/event-core` now registers contracts for emitted `theme.purchase.payment_order_created`, `theme.purchase.completed`, `theme.draft.saved`, and `theme.draft.discarded` events.
- `payout.released` and `payout.failed` stay in the domain registry but are explicitly marked `reserved-human-gated` because no payout release/failure rail or operations approval transition exists to emit them from yet.
- `node scripts/validators/event-schema-validator.mjs`: PASS with theme event contract checks and payout reserved-status checks.
- `npx tsx --test tests/contracts/domain-event-contracts.test.ts`: PASS - 3/3 contract behavior tests.
- `node --test tests/federation/event-spine-contracts.test.mjs`: PASS - 14/14 federation event-spine tests.
- `pnpm --filter @letbuyy/event-core typecheck`: PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- `pnpm turbo typecheck`: PASS - 60/60 tasks.
- `pnpm run validate:governance`: PASS - 129/129 validators.

## H-1 final gate evidence

- `orders`, `products`, `subscriptions`, `sites`, and `billing_history` remain gateway-owned after the previous webhook transition increments.
- `outbox_events` is now gateway-owned: webhook-service and queue-workers call `/v1/internal/events/domain` instead of writing the table directly.
- `payment_webhook_events` remains webhook-service-owned for provider webhook receipt/idempotency state; api-gateway and queue-workers are validator-guarded from writing it.
- `pnpm --filter @letbuyy/webhook-service test`: PASS - 12/12 behavior tests.
- `pnpm --filter @letbuyy/queue-workers test`: PASS - 2/2 behavior tests.
- `npx tsx --test services/api-gateway/src/__tests__/payments.test.ts`: PASS - 7/7 payment architecture tests.
- `node scripts/validators/single-writer-ownership-validator.mjs`: PASS - 106 source files checked.
- `pnpm --filter @letbuyy/webhook-service typecheck`: PASS.
- `pnpm --filter @letbuyy/queue-workers typecheck`: PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm turbo typecheck`: PASS - 60/60 tasks.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- `pnpm run validate:governance`: PASS - 129/129 validators.

## F1.6 partial split evidence

- Internal payment endpoints moved from `services/api-gateway/src/routes/storefront.ts` into `services/api-gateway/src/routes/storefront/internal-payment-routes.ts` with a registration function preserving route order.
- `tests/contracts/storefront-internal-payment-routes.test.ts` characterizes fail-closed 403 behavior for the internal payable/reference/confirm/failure/event routes.
- Pre-split `npx tsx --test tests/contracts/storefront-internal-payment-routes.test.ts`: PASS - 5/5.
- Post-split `npx tsx --test tests/contracts/storefront-internal-payment-routes.test.ts`: PASS - 5/5.
- `npx tsx --test services/api-gateway/src/__tests__/payments.test.ts`: PASS - 7/7.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `wc -l services/api-gateway/src/routes/storefront.ts services/api-gateway/src/routes/storefront/internal-payment-routes.ts`: `storefront.ts` 4,833 lines; internal payment module 233 lines.
- `pnpm turbo typecheck`: PASS - 60/60 tasks.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- `pnpm run validate:governance`: PASS - 129/129 validators.
- H-9 remains in progress because `storefront.ts` is still above the 1,500-line target.

## Human-gated remainder

- C-1 extraction of six service roots from the modular monolith requires an architecture decision.
- C-7 third-party section runtime/upload model requires product and sandbox scope decisions.
- H-11 live payout release/failure emitters require payout policy, Razorpay Route/RazorpayX credentials, and an operations approval/runbook for release/failure transitions.

## Next work

- Commit F1.6 internal payment route split.
- Continue F1.6 by extracting the next cohesive storefront route group, likely customer auth/account routes, under characterization coverage.
- Keep inherited root `node --test tests/*/*.test.mjs` failure separate until F5 unless it blocks a phase gate.
