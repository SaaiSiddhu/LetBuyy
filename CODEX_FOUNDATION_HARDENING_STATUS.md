# CODEX FOUNDATION-HARDENING STATUS

Started: 2026-06-05T13:54:14Z

## Current phase

- Phase: F2.4 app billing honest provider activation complete and committed next; continue F2.5 Wasm limits.
- Findings resolved: 12/31 original Critical/High complete (`C-1`, `C-2`, `C-3`, `C-4`, `C-5`, `C-12`, `C-13`, `H-1`, `H-6`, `H-9`, `H-10`, `H-12`) plus 6/6 V2 regressions complete (`N-1` through `N-6`); `H-11` is SKIPPED -- NEEDS HUMAN for payout rail/policy/credentials.
- Current governance gate state: green after F2.4 (`pnpm run validate:governance` -> 136/136 PASS).

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
- Checkout order creation and Razorpay/Cashfree/Stripe/PayPal storefront payment routes moved from `services/api-gateway/src/routes/storefront.ts` into `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts`.
- `tests/contracts/storefront-checkout-payment-routes.test.ts`: added before extraction and kept green after extraction; it verifies the route list, route order, and insertion point before catalog routes.
- Pre-split `pnpm run test:contracts`: PASS - 22/22.
- Post-split `pnpm run test:contracts`: PASS - 22/22.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `wc -l services/api-gateway/src/routes/storefront.ts services/api-gateway/src/routes/storefront/checkout-payment-routes.ts`: `storefront.ts` 2,206 lines; extracted module 1,223 lines.
- Remaining public storefront lookup/directory/store/bootstrap/status/catalog/CMS/blog/contact routes moved from `services/api-gateway/src/routes/storefront.ts` into `services/api-gateway/src/routes/storefront/public-routes.ts`.
- `tests/contracts/storefront-public-routes.test.ts`: added before extraction and kept green after extraction; it verifies the remaining public route list, route order, and insertion point after internal routes.
- Pre-split `pnpm run test:contracts`: PASS - 25/25.
- Post-split `pnpm run test:contracts`: PASS - 25/25.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `wc -l services/api-gateway/src/routes/storefront.ts services/api-gateway/src/routes/storefront/public-routes.ts services/api-gateway/src/routes/storefront/checkout-payment-routes.ts services/api-gateway/src/routes/storefront/customer-engagement-routes.ts services/api-gateway/src/routes/storefront/internal-payment-routes.ts`: `storefront.ts` 1,330 lines; public module 992 lines; checkout module 1,223 lines; customer module 1,500 lines; internal payment module 231 lines.
- App-store routes moved from `services/api-gateway/src/routes/app-store.ts` into `services/api-gateway/src/routes/app-store/extension-routes.ts`, `billing-oauth-routes.ts`, `install-lifecycle-routes.ts`, `developer-routes.ts`, and `shared.ts`; root `app-store.ts` now only owns marketplace catalog/review routes and registration order.
- `tests/contracts/app-store-route-split.test.ts`: added before extraction and kept green after extraction; it verifies app-store route order and critical install/bridge/event/partner safeguards.
- Existing app-platform/federation source tests now read combined effective app-store/storefront route sources after route modules are introduced.
- Post-split `pnpm run test:contracts`: PASS - 28/28.
- Post-split `node --test tests/app-platform/*.test.mjs tests/federation/*.test.mjs`: PASS - 106/106.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `find services/api-gateway/src/routes -name '*.ts' -type f -print0 | xargs -0 wc -l | sort -nr | head`: largest route file is `services/api-gateway/src/routes/storefront/customer-engagement-routes.ts` at 1,500 lines; all API gateway route files are <=1,500.
- `node scripts/validators/route-line-count-validator.mjs`: PASS - 42 api-gateway route files checked at <=1,500 lines.
- `pnpm turbo typecheck`: PASS - 60/60 tasks.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators, including `route-line-count-validator.mjs`.
- H-9 is DONE for F1.6 after route-size governance is locked by `route-line-count-validator.mjs`.

## F2.1 scoped app API evidence

- `services/api-gateway/src/middleware/app-auth.ts` verifies scoped app JWTs against `@letbuyy/auth-core`, requires configured app-token secrets, checks active `app_installations`, enforces granted-scope containment, and rejects revoked/replaced token hashes.
- `/v1/app/products` requires `read_products` and is store-bound to the token installation.
- `/v1/app/orders` requires `read_orders` and is store-bound to the token installation.
- `/v1/app/installation/metadata` requires `write_app_metadata`, updates only app-owned installation metadata, and rejects token/secret/password/private-key-like metadata keys.
- `/v1/app` is mounted before merchant `authMiddleware`, so app JWTs cannot satisfy merchant dashboard routes by accident.
- `packages/typescript/api-client` exposes `appApi.products`, `appApi.orders`, and `appApi.updateInstallationMetadata` using shared `Product` and `Order` contracts.
- `apps/developer-portal/src/lib/developer-surface.ts` documents the scoped app API as available and source-derived from `services/api-gateway/src/routes/app-api.ts`.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm run test:contracts`: PASS - 31/31, including app token allow/deny, missing-scope, revoked-token, inactive-installation, route mount, API client, and docs checks.
- `node --test tests/app-platform/*.test.mjs tests/federation/*.test.mjs`: PASS - 106/106.
- `pnpm install --frozen-lockfile --force`: PASS after escalated registry access restored missing workspace links needed for cache-miss developer-portal checks.
- `pnpm --filter @letbuyy/developer-portal typecheck`: PASS.
- `pnpm turbo typecheck`: PASS - 60/60 tasks.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.

## F2.2 OAuth PKCE and refresh evidence

- `/v1/app-store/apps/:id/oauth/authorize` now requires a PKCE S256 `code_challenge` and stores only the authorization-code hash plus challenge under `app_installations.config.oauth.authorization_code`.
- `/v1/app-store/oauth/token` with `grant_type=authorization_code` requires `code_verifier`, validates the signed code, checks client/redirect match, verifies PKCE, rejects redeemed-code replay, and stores only access/refresh token hashes.
- `/v1/app-store/oauth/token` with `grant_type=refresh_token` looks up the hashed refresh token on an active installation, checks client id and expiry, enforces scope containment, and rotates `refresh_token_hash`.
- `packages/shared-types`, `packages/typescript/api-client`, `apps/developer-portal/src/lib/developer-surface.ts`, and `apps/developer-portal/src/lib/reference.ts` now expose the PKCE and refresh-token contract.
- `tests/contracts/app-oauth-pkce-refresh.test.ts` covers PKCE S256 normalization/verification, refresh-token hash persistence, route source requirements, replay guard markers, API client types, shared schema, and developer docs.
- `pnpm run test:contracts`: PASS - 35/35.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm --filter @letbuyy/shared-types typecheck`: PASS.
- `pnpm --filter @letbuyy/developer-portal typecheck`: PASS.
- `pnpm --filter @letbuyy/shared-types build` then `pnpm --filter @letbuyy/api-client typecheck`: PASS.
- `node --test tests/app-platform/*.test.mjs tests/federation/*.test.mjs`: PASS - 106/106.
- `pnpm turbo typecheck`: PASS - 60/60 tasks.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.

## F2.3 compliance webhook producer evidence

- `services/api-gateway/src/routes/app-store/compliance-routes.ts` adds merchant-authenticated, store-owned producer routes for `POST /v1/app-store/compliance/customers/data-request`, `POST /v1/app-store/compliance/customers/redact`, and `POST /v1/app-store/compliance/shop/redact`.
- Producer routes validate payloads with Zod, require `X-Idempotency-Key` or `idempotency_key`, select active app-platform webhook subscriptions whose `event_types` contain the mandatory compliance topic, and fail loud when delivery is unconfigured while subscriptions exist.
- The producer path dispatches through the existing `WEBHOOK_SERVICE` binding and `X-LetBuyy-Internal-Secret`; no UI runtime owns outbound webhook delivery.
- App uninstall now emits `shop/redact` before disabling app webhook subscriptions, then emits `app.uninstalled`.
- `apps/developer-portal/src/lib/developer-surface.ts` and `apps/developer-portal/src/lib/reference.ts` now document emitted compliance topics and trigger routes.
- `pnpm run test:contracts`: PASS - 39/39, including compliance dispatch to a fake webhook-service binding, route/source safeguards, uninstall ordering, and docs checks.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm --filter @letbuyy/developer-portal typecheck`: PASS.
- `node --test tests/app-platform/*.test.mjs tests/federation/*.test.mjs`: PASS - 107/107.
- `pnpm turbo typecheck`: PASS - 60/60 tasks.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.

## F2.4 app billing provider evidence

- App charge approval no longer fabricates `rzp_route_test_*` provider references and no longer marks merchant approval as an active charge by itself.
- `POST /v1/app-store/charges/:id/approve` now creates or returns a Razorpay payment order when `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are configured, stores the charge as `approved`, and returns `payment_required` without emitting `app.charge.activated`.
- When provider credentials are absent, the route records an honest `approved`/unconfigured state with `activated: false`, `APP_BILLING_PROVIDER_UNCONFIGURED`, and no payout ledger event.
- Activation now requires provider proof: provider order reference, provider payment id, provider signature, valid Razorpay HMAC, and provider order notes linked to the app charge id.
- App charge domain event payloads carry `provider_reference` and `provider_mode`; both queue payout ledger consumers now copy the verified provider mode instead of hardcoding `test`.
- Live partner payout release remains human-gated under H-11; this increment creates payout ledger entries only after provider-verified activation and does not claim funds release.
- `pnpm run test:contracts`: PASS - 41/41, including `tests/contracts/app-billing-provider-proof.test.ts`.
- `node --test tests/federation/app-billing-payout.test.mjs`: PASS - 5/5.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm --filter @letbuyy/queue-workers typecheck`: PASS.
- `pnpm --filter @letbuyy/developer-portal typecheck`: PASS.
- `node --test tests/app-platform/*.test.mjs tests/federation/*.test.mjs`: PASS - 108/108.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.

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
- C-5 live app-charge payout release requires the same payout rail/policy/credentials; provider-verified app charge activation is implemented, but fund release remains human-gated.

## Next work

- Commit the completed F2.4 app billing provider-proof increment.
- Continue to F2.5 Wasm limits.
- Keep inherited broader test-realism work for F5 unless it blocks a phase gate.
