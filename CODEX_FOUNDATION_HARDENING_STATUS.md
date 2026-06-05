# CODEX FOUNDATION-HARDENING STATUS

Started: 2026-06-05T13:54:14Z

## Current phase

- Phase: V2 P-1 regression gate complete; resume F1.6 storefront god-file split next.
- Findings resolved: 6/31 original Critical/High complete (`C-2`, `C-12`, `C-13`, `H-1`, `H-10`, `H-12`) plus 6/6 V2 regressions complete (`N-1` through `N-6`); `H-11` is SKIPPED -- NEEDS HUMAN for payout rail/policy/credentials.
- Current governance gate state: green after V2 P-1 (`pnpm run validate:governance` -> 135/135 PASS).

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
- Customer/password/login/order-credential/wishlist/order-contact/review/address routes moved from `services/api-gateway/src/routes/storefront.ts` into `services/api-gateway/src/routes/storefront/customer-engagement-routes.ts` with a registration function preserving the route band before blog routes.
- `tests/contracts/storefront-customer-engagement-routes.test.ts`: added before extraction and kept green after extraction; it verifies the route list, route order, and insertion point.
- Pre-split `pnpm run test:contracts`: PASS - 19/19.
- Post-split `pnpm run test:contracts`: PASS - 19/19.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `wc -l services/api-gateway/src/routes/storefront.ts services/api-gateway/src/routes/storefront/customer-engagement-routes.ts`: `storefront.ts` 3,372 lines; extracted module 1,500 lines.
- H-9 remains in progress because `storefront.ts` and `app-store.ts` are still above the 1,500-line target.

## V2 P-1 gate evidence

- N-1: internal API secret guard now fails closed whenever `INTERNAL_API_SECRET` is unset in every environment; internal payment, billing, and events routes share `services/api-gateway/src/lib/internal-secret.ts`.
- N-2: idempotency completion persists a recursively redacted response body, so `access_token`, `refresh_token`, `signing_secret`, and client-secret shapes are not replayable from `idempotency_keys.response_body`.
- N-3: root `test` and `test:governance` invoke `test:contracts`, and api-gateway `test` runs `tsx --test ../../tests/contracts/*.test.ts`; Turbo now executes the TS contract suite.
- N-4: payment/refund/subscription webhook event topics are registered in `@letbuyy/event-core`, provider events are normalized before emission, and api-gateway internal event ingress rejects uncontracted event types.
- N-5: webhook-service and queue-workers now share `@letbuyy/infrastructure/gateway-events-adapter`; duplicate service-local `gateway-events.ts` files were removed.
- N-6: historical `CODEX*.md` residue was archived under `docs/archive/root-residue/2026-06-06-foundation-v2/`, no runtime/package source tree contains CODEX ledger files, and the orphan `webhook-deliveries` queue producer was removed.
- `pnpm run test:contracts`: PASS - 16/16 TS contract tests.
- `pnpm turbo test --filter @letbuyy/api-gateway`: PASS - 41/41 Turbo tasks; api-gateway contract suite 16/16 PASS, including staging no-secret -> 403 and production no-secret -> 403 cases.
- `pnpm --filter @letbuyy/webhook-service test`: PASS - 12/12.
- `pnpm --filter @letbuyy/queue-workers test`: PASS - 2/2.
- `pnpm turbo typecheck`: PASS - 60/60 tasks.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 135/135 validators, including new fail-closed internal routes, replayable-secret persistence, contracted-domain-event ingress, shared gateway-events client, orphan webhook-deliveries queue, and source-ledger residue validators.

## Human-gated remainder

- C-1 extraction of six service roots from the modular monolith requires an architecture decision.
- C-7 third-party section runtime/upload model requires product and sandbox scope decisions.
- H-11 live payout release/failure emitters require payout policy, Razorpay Route/RazorpayX credentials, and an operations approval/runbook for release/failure transitions.

## Next work

- Commit the F1.6 customer engagement route split.
- Continue F1.6 by extracting the next cohesive storefront route group, likely checkout/payment routes or catalog/search routes, under characterization coverage.
- Keep inherited root `node --test tests/*/*.test.mjs` failure separate until F5 unless it blocks a phase gate.
