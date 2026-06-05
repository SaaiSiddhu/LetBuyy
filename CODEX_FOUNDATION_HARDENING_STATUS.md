# CODEX FOUNDATION-HARDENING STATUS

Started: 2026-06-05T13:54:14Z

## Current phase

- Phase: F3.5 server-side cart complete locally; continue F3.6 theme-marketplace checkout.
- Findings resolved: 19/31 original Critical/High complete (`C-1`, `C-2`, `C-3`, `C-4`, `C-5`, `C-6`, `C-7`, `C-8`, `C-9`, `C-10`, `C-12`, `C-13`, `H-1`, `H-5`, `H-6`, `H-9`, `H-10`, `H-12`, `H-13`) plus 6/6 V2 regressions complete (`N-1` through `N-6`); `H-11` is SKIPPED -- NEEDS HUMAN for payout rail/policy/credentials.
- Current governance gate state: green after F3.5 (`pnpm run validate:governance` -> 136/136 PASS).

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

## F2.5 app function Wasm limits evidence

- `services/api-gateway/src/extensions/app-functions-runtime.ts` now validates app-function Wasm modules before compilation for module byte size, host import sections, declared memory min/max pages against `memory_limit_kb`, per-function code body size, and loop/branch/call/`memory.grow`-capable opcodes.
- Runtime execution checks exported memory bounds at instantiate, input allocation, execution, and output read phases, keeping checkout functions inside the registered memory budget even if module metadata is misleading.
- The accepted Wasm subset remains deliberately bounded and host-import-free; synchronous loop-capable control flow is rejected statically because a same-thread Wasm loop cannot be preempted by a JavaScript `Promise.race` timeout.
- `tests/contracts/app-function-wasm-limits.test.ts` covers declared memory overrun rejection, host import rejection, loop-capable body rejection, memory-budget math, and source guards for size, opcode, runtime memory, and timeout checks.
- `pnpm run test:contracts`: PASS - 44/44.
- `node --test tests/app-platform/*.test.mjs`: PASS - 16/16.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `node --test tests/app-platform/*.test.mjs tests/federation/*.test.mjs`: PASS - 108/108.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.

## F2.6 developer tooling no-credential evidence

- `packages/app-engine` now validates submitted LetBuyy app manifests, rejects listing/manifest slug drift, and plans extension/function registry records from package-owned contracts.
- `POST /v1/app-store/developers/apps/manifest/validate` validates manifests for authenticated developers without persisting an app.
- `POST /v1/app-store/developers/apps` accepts an optional manifest, persists the normalized extension/function records into existing app extension storage, and issues show-once OAuth/API credentials while persisting only SHA-256 hashes and non-secret metadata.
- `POST /v1/app-store/developers/apps/:id/api-key` rotates a show-once API key for developer-owned apps and keeps persisted credential state hash-only.
- `packages/typescript/api-client` exposes `validateDeveloperAppManifest`, `rotateDeveloperAppKey`, and a minimal `createLetbuyyAppSdk` wrapper over scoped app API products, orders, and installation-metadata calls.
- `apps/developer-portal` documents the implemented manifest validation, hash-only credential issuance, key rotation backend, and minimal SDK honestly; full CLI/dedicated browser bridge SDK remains future work.
- `pnpm run test:contracts`: PASS - 49/49, including `tests/contracts/developer-tooling-no-cred.test.ts`.
- `node --test tests/federation/marketplace-submission-review.test.mjs`: PASS - 4/4 after updating source-shape expectations for credential and manifest response fields.
- `pnpm --filter @letbuyy/shared-types build`: PASS.
- `pnpm --filter @letbuyy/app-engine typecheck`: PASS.
- `pnpm --filter @letbuyy/api-client typecheck`: PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm --filter @letbuyy/developer-portal typecheck`: PASS.
- `node --test tests/app-platform/*.test.mjs tests/federation/*.test.mjs`: PASS - 108/108.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.

## F3.1 web theme editor live preview evidence

- The web theme editor no longer renders the local `PREVIEW_PRODUCTS`/`PreviewCanvas` mock path; `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` mounts `CenterPanel` for the center preview.
- Preview refresh now persists the selected-template draft through `/api/themes/:themeId/editor/draft` before minting `/api/themes/:themeId/preview-session`, then passes the returned `preview_token` into the iframe.
- `apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx` targets the storefront runtime `/preview` route with `subdomain`, `viewport`, and `theme_preview_token`, and keeps section-selection bridge messages wired.
- Browser plugin proof against `localhost`/`127.0.0.1` was blocked by `net::ERR_BLOCKED_BY_CLIENT`; local Playwright fallback started a mock gateway plus merchant/storefront dev servers and verified the real iframe route.
- Playwright proof: iframe URL `http://127.0.0.1:3200/preview?subdomain=local-kicks&editor=1&viewport=desktop&theme_preview_token=local.preview.token`; iframe contained `[data-letbuyy-preview-route="true"]`, `Local Kicks Preview`, `Preview products`, and product `Canvas Runner`; legacy mock text count was 0.
- Screenshot evidence: `/tmp/letbuyy-f3-editor-preview-settled.png`.
- `pnpm run test:contracts`: PASS - 53/53, including `tests/contracts/theme-editor-real-preview.test.ts`.
- `pnpm --filter @letbuyy/merchant-control-plane typecheck`: PASS.
- `pnpm --filter @letbuyy/merchant-control-plane lint`: PASS with 6 existing warnings outside the edited editor file.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.
- Staging proof remains SKIPPED -- NEEDS HUMAN until staging merchant/session/store/theme credentials are provided.

## F3.2 publish separation and template-scoped preview evidence

- `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/route.ts` now publishes an already-saved draft through `api.themes.publish`; it no longer saves inline `templateConfig` during publish.
- Draft saves and preview syncs forward `baseVersion` from the editor `draftVersion`, and the editor blocks publish while the current template has unsaved changes.
- `apps/merchant-control-plane/src/app/api/themes/[themeId]/preview-session/route.ts` forwards `template_key`, and `packages/theme-engine`, `packages/shared-types`, and `packages/typescript/api-client` expose the same template-key preview-session contract.
- `services/api-gateway/src/execution/theme-execution.adapter.ts` now scopes preview-session draft lookup through `loadEditorDraft(store, theme, templateKey)`, returns/records `template_key`, and no longer uses an unscoped `.maybeSingle()` on `theme_editor_drafts` in `createPreviewSession`.
- Theme-instance draft snapshots merge all template-scoped editor drafts before writing the release-engine draft so saving one template no longer overwrites the other template draft.
- `pnpm run test:contracts`: PASS - 58/58, including `tests/contracts/theme-editor-publish-separation.test.ts`.
- `pnpm --filter @letbuyy/shared-types build`: PASS after generated declarations had been cleaned.
- `pnpm --filter @letbuyy/theme-engine typecheck`: PASS.
- `pnpm --filter @letbuyy/shared-types typecheck`: PASS.
- `pnpm --filter @letbuyy/api-client typecheck`: PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm --filter @letbuyy/merchant-control-plane typecheck`: PASS.
- `pnpm --filter @letbuyy/merchant-control-plane lint`: PASS with existing warnings outside this slice.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.
- Staging proof remains SKIPPED -- NEEDS HUMAN until staging merchant/session/store/theme credentials are provided.

## F3.3 data-driven section registry evidence

- `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx` continues to use `SECTION_RENDERER_DEFINITIONS` plus derived compatibility maps instead of a `switch` on section type.
- Manifest-declared `rendererKey` and `settings.rendererKey` still resolve through the approved first-party renderer key map.
- `apps/storefront-runtime/src/lib/store-service.ts` preserves section-definition `renderer_key` from JSON bundle manifests into `SectionModel.rendererKey`, so new manifest-declared JSON section types can reuse approved first-party renderers without a storefront switch edit.
- Unknown or unsupported JSON section renderers now return `UnknownSectionFallback` with `data-theme-section-fallback`, `data-section-type`, and `data-renderer-key` instead of silently returning `null`.
- Third-party section upload/runtime remains SKIPPED -- NEEDS HUMAN under the mission architecture fork; this increment implements the data-driven first-party default only.
- Pre-change `pnpm run test:contracts`: FAIL at new `tests/contracts/theme-section-registry.test.ts` because `UnknownSectionFallback` was absent.
- Post-change `pnpm run test:contracts`: PASS - 61/61.
- `pnpm install --frozen-lockfile --force`: PASS to restore workspace dependency links after generated artifact cleanup.
- `pnpm --filter @letbuyy/storefront-runtime typecheck`: PASS.
- `pnpm --filter @letbuyy/storefront-runtime lint`: PASS with existing warnings only.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.

## F3.4 Liquid embeds and commerce drops evidence

- `packages/theme-engine/src/theme-renderer.ts` accepts `liquidAppEmbeds` and typed `LiquidCommerceDrops`.
- Liquid layout scope and engine globals now receive sanitized `content_for_header` and `content_for_footer` instead of hardcoded empty strings.
- Bounded `product`, `collection`, `collections`, `cart`, `customer`, and `shop` drops are exposed through a recursive sanitizer that strips dangerous keys and caps depth, array items, and object keys.
- Safe Liquid filters are registered for `money`, `money_with_currency`, `json`, `asset_url`, and `image_url`.
- `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx` maps installed app-block records with explicit header/footer embed slots into Liquid embed regions and builds commerce drops from already-loaded section data.
- Pre-change `pnpm run test:contracts`: FAIL - 61/63 at new `tests/contracts/liquid-commerce-embeds.test.ts` because the money filter, drop interfaces, and composition wiring were absent.
- Post-change `pnpm run test:contracts`: PASS - 63/63, including real Liquid renderer execution proving sanitized header/footer embeds and product/collection/cart/customer/shop output.
- `pnpm --filter @letbuyy/shared-types build`: PASS after generated declarations had been cleaned.
- `pnpm --filter @letbuyy/theme-engine typecheck`: PASS.
- `pnpm --filter @letbuyy/storefront-runtime typecheck`: PASS.
- `pnpm --filter @letbuyy/storefront-runtime lint`: PASS with existing warnings only.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.

## F3.5 server-side cart evidence

- `services/api-gateway/src/routes/storefront/cart-routes.ts` adds gateway-owned persisted cart routes for `POST /:subdomain/cart`, `GET|PATCH|DELETE /:subdomain/cart/:cartToken`.
- Cart tokens are opaque `ct_*` values stored in `public.carts.session_id`; cart lines are rehydrated through existing published product reads and totals are rebuilt from product price data.
- Storefront GraphQL `cart` no longer throws `CART_NOT_SUPPORTED`; token-based reads delegate to the same persisted cart REST endpoint.
- `apps/storefront-runtime/src/context/cart-context.tsx` stores `lb_cart_token`, syncs cart mutations to the gateway, and keeps localStorage only as a cache.
- Liquid add-to-cart hydration islands sync through the same cart API and preserve `lb_cart_token`.
- Developer portal API/GraphQL docs now describe the active persisted cart-token contract.
- Pre-change `pnpm run test:contracts`: FAIL - 63/68 at new `tests/contracts/server-side-cart.test.ts` because cart routes, GraphQL delegation, runtime sync, Liquid sync, and docs were absent.
- Post-change `pnpm run test:contracts`: PASS - 68/68.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm install --frozen-lockfile --force`: PASS to restore workspace dependency links after generated artifact cleanup.
- `pnpm --filter @letbuyy/storefront-runtime typecheck`: PASS.
- `pnpm --filter @letbuyy/developer-portal typecheck`: PASS.
- `pnpm --filter @letbuyy/storefront-runtime lint`: PASS with existing warnings only.
- `pnpm --filter @letbuyy/developer-portal lint`: PASS.
- `node --test tests/api-graphql/schema-contract.test.mjs tests/federation/developer-portal-capability-messaging.test.mjs`: PASS - 15/15.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.
- Staging proof remains SKIPPED -- NEEDS HUMAN until staging storefront/store/product/customer/gateway credentials are provided.

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
- H-13 staging proof that a developer registers an app, receives credentials, installs/exchanges for an app access token, and calls the SDK requires staging merchant/developer credentials plus staging gateway/session access. Exact proof path once supplied: authenticate a staging merchant/developer, `POST /v1/app-store/developers/register`, `POST /v1/app-store/developers/apps/manifest/validate`, `POST /v1/app-store/developers/apps`, complete the app install/OAuth token flow, then call `createLetbuyyAppSdk({ baseUrl: "https://api.staging.letbuyy.store", accessToken }).products()`.
- C-6 staging proof that the web theme editor iframe renders edited sections through the real staging storefront preview route requires staging merchant/session/store/theme credentials and staging gateway/storefront URLs. Exact proof path once supplied: authenticate to staging merchant, open `/[store]/online-store/themes/[themeId]/editor`, edit a section, confirm the iframe URL includes `theme_preview_token`, and verify the storefront preview route renders the edited section.
- C-8/B-6 staging proof that stale editor saves conflict and preview sessions are template-scoped requires staging merchant/session/store/theme credentials and staging gateway/storefront URLs. Exact proof path once supplied: open two editor sessions for the same theme/template, save one draft, verify the stale `base_version` save conflicts in the second, publish only the clean saved draft, and mint preview sessions for two templates to verify each returns the requested `template_key` and renders the matching draft.
- C-10 staging proof that server-side cart persists across devices and checkout requires staging storefront/store/product/customer/gateway credentials. Exact proof path once supplied: add a product to cart in one browser, capture `lb_cart_token`, open the same store in a second browser/session with that token, verify `GET /v1/storefront/:subdomain/cart/:cartToken` returns the same lines/totals, then complete checkout using the synced cart items.

## Next work

- Continue to F3.6 theme-marketplace checkout.
- Keep inherited broader test-realism work for F5 unless it blocks a phase gate.
