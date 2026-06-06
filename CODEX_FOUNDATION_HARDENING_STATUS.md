# CODEX FOUNDATION-HARDENING STATUS

Started: 2026-06-05T13:54:14Z

## Current phase

- Phase: F7.3 INR currency formatting duplication collapse complete; continue F7.3 remaining duplication collapse.
- Findings resolved: 28/31 original Critical/High complete (`C-1`, `C-2`, `C-3`, `C-4`, `C-5`, `C-6`, `C-7`, `C-8`, `C-9`, `C-10`, `C-11`, `C-12`, `C-13`, `C-14`, `H-1`, `H-2`, `H-4`, `H-5`, `H-6`, `H-7`, `H-8`, `H-9`, `H-10`, `H-12`, `H-13`, `H-14`, `H-15`, `H-17`) plus 6/6 V2 regressions complete (`N-1` through `N-6`); `H-11` is SKIPPED -- NEEDS HUMAN for payout rail/policy/credentials, `H-16` is SKIPPED -- NEEDS HUMAN for ops SSO/IdP or a platform-session trust decision beyond the timing-safe static-token hardening, C-11 live real-stack journey execution is SKIPPED -- NEEDS HUMAN pending staging credentials/secrets, C-14 live observability rollout verification is SKIPPED -- NEEDS HUMAN pending deployed telemetry endpoints/credentials, H-15 live production deploy execution is SKIPPED -- NEEDS HUMAN pending protected environment approvals plus provider credentials, and legacy portfolio/resume reactivation is human-gated for named cohorts only.
- Current governance gate state: green after F7.3 INR currency formatting increment (`pnpm run validate:governance` -> 146/146 PASS).

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

## F3.6 theme-marketplace checkout evidence

- `apps/theme-marketplace/src/app/checkout/page.tsx` no longer links the Pay button directly to `/checkout/success`; success navigation now happens only after purchase creation and payment verification.
- Checkout starts a provider-backed theme purchase through the existing `/api/themes/[slug]` POST action proxy, loads Razorpay Checkout after the gateway returns an order, and posts Razorpay proof back for verification.
- `apps/theme-marketplace/src/app/api/themes/[slug]/route.ts` remains a thin proxy to `ThemeService.createThemePurchase` and `ThemeService.verifyThemePurchase`; it does not own server pricing, provider verification, or provider-specific proof field parsing.
- `packages/typescript/api-client` exposes `themes.purchase` and `themes.verifyPurchase`; the gateway-owned theme purchase route still derives amount from `letbuyy_price_inr`, returns `PAYMENT_UNAVAILABLE` when Razorpay env is absent, creates Razorpay orders when configured, and verifies signatures with `timingSafeEqualHex`.
- Coupon application is honest unsupported state (`Theme coupons are not configured`) rather than an inert fake apply path.
- Pre-change `pnpm run test:contracts`: FAIL - 69/72 at new `tests/contracts/theme-marketplace-checkout.test.ts` because the fake checkout path and missing client/proxy contracts were still present.
- Post-change `pnpm run test:contracts`: PASS - 72/72.
- `pnpm --filter @letbuyy/shared-types build`: PASS.
- `pnpm --filter @letbuyy/api-client typecheck`: PASS.
- `pnpm --filter @letbuyy/theme-marketplace typecheck`: PASS.
- `pnpm --filter @letbuyy/theme-marketplace lint`: PASS with existing warnings only.
- `node scripts/validators/domain-boundary-validator.mjs`: PASS after provider proof stayed opaque in app API/lib files.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.
- Staging Razorpay test checkout proof remains SKIPPED -- NEEDS HUMAN until staging merchant session, gateway Razorpay test credentials, a purchasable staging theme, and browser access to Razorpay checkout are provided.

## F3.7 demo-store isolation and theme table honesty evidence

- Real storefront `StoreService` reads no longer short-circuit `urban-kicks-demo` into tenant lookup paths; the Urban Kicks store fixture is available only through explicit demo helpers.
- Real storefront `ProductService` reads no longer load demo product fixtures by product id, store id, or subdomain.
- `/demo/urban-kicks` now redirects to `/preview?demo=urban-kicks&subdomain=urban-kicks-demo`; `apps/storefront-runtime/src/app/preview/page.tsx` loads demo store/products only when `demo=urban-kicks` is explicitly requested and no longer defaults missing preview subdomains to the demo tenant.
- The merchant theme editor no longer force-injects `REQUIRED_URBAN_KICKS_SECTIONS` into every theme.
- `docs/governance/theme-engine-governance.md` now records inactive normalized theme tables as schema-reserved, `theme_draft_patches` as a write-only audit trail, and `theme_reviews` as a catalog read model with no live submission surface.
- Pre-change `pnpm run test:contracts`: FAIL - 72/77 at new `tests/contracts/demo-store-isolation.test.ts`.
- Post-change `pnpm run test:contracts`: PASS - 77/77.
- `pnpm install --frozen-lockfile --force`: PASS to restore workspace dependency links after generated-artifact cleanup.
- `pnpm --filter @letbuyy/storefront-runtime typecheck`: PASS.
- `pnpm --filter @letbuyy/merchant-control-plane typecheck`: PASS.
- `pnpm --filter @letbuyy/storefront-runtime lint`: PASS with existing warnings only.
- `pnpm --filter @letbuyy/merchant-control-plane lint`: PASS with existing warnings only.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.

## F4.1 single merchant credential authority evidence

- `services/api-gateway/src/lib/merchant-password.ts` is the single merchant password hash/compare module and owns `MERCHANT_PASSWORD_BCRYPT_ROUNDS = 12`.
- `services/api-gateway/src/routes/auth.ts` adds signed-internal `/auth/custom/users/authenticate`, compares the password in the gateway, hashes plaintext passwords in `/auth/custom/users/set-password`, and changes `/auth/custom/users/by-email` to return `has_password` without returning the hash.
- Identity login now calls `/auth/custom/users/authenticate`; lookup consumes `has_password`; set/reset-password send plaintext only over the signed internal worker request; `apps/identity-platform/src/lib/auth/password.ts` only validates strength.
- `scripts/validators/domain-boundary-validator.mjs` now forbids password-hash handling in every app-local API/lib TS file, with no auth-owned whitelist.
- Pre-change `pnpm run test:contracts`: FAIL - 77/80 at new `tests/contracts/merchant-password-authority.test.ts`.
- Post-change `pnpm run test:contracts`: PASS - 80/80.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm install --frozen-lockfile --force`: PASS to restore workspace dependency links after generated-artifact cleanup.
- `pnpm --filter @letbuyy/identity-platform typecheck`: PASS.
- `pnpm --filter @letbuyy/identity-platform lint`: PASS with existing warnings only.
- `node scripts/validators/domain-boundary-validator.mjs`: PASS.
- `pnpm exec tsx --test apps/identity-platform/src/__tests__/*.test.ts`: PASS - 6/6 after rerun with host IPC.
- `node --test tests/auth/identity-password-intent.test.mjs`: PASS - 3/3.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.

## F4.2 ops-plane timing-safe compare evidence

- `services/api-gateway/src/lib/crypto.ts` now exports shared `timingSafeEqualText` and accepts nullable inputs for `timingSafeEqualHex`.
- Platform-console bearer checks in `services/api-gateway/src/routes/internal-console.ts`, internal API secret checks in `services/api-gateway/src/lib/internal-secret.ts`, export download token checks in `services/api-gateway/src/routes/export.ts`, and CSRF token checks in `services/api-gateway/src/middleware/security.ts` use the shared timing-safe text comparer.
- App OAuth access/bridge token-hash revocation checks in `services/api-gateway/src/middleware/app-auth.ts` and `services/api-gateway/src/routes/app-store/extension-routes.ts`, plus app authorization-code hash redemption checks in `services/api-gateway/src/routes/app-store/billing-oauth-routes.ts`, use `timingSafeEqualHex`.
- `tests/contracts/ops-plane-auth-hardening.test.ts` locks the invariant and records H-16's identity remainder.
- Pre-change `pnpm run test:contracts`: FAIL after rerun with host IPC - 80/83 pass, 3 new F4.2 assertions failed.
- `pnpm run test:contracts`: PASS - 83/83.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- Source scan for removed direct-comparison patterns: PASS - only the contract test's negative assertion text remains.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.
- SKIPPED -- NEEDS HUMAN: ops SSO/IdP or a security decision to share and validate platform-console session tokens inside the gateway worker, plus a token rotation/runbook, is required for true per-operator gateway-side ops identity. F4.2 hardens the current static-token compare but does not create a new identity authority.

## F4.3 storefront login abuse-control evidence

- Gateway customer login calls `enforceCustomerAuthRateLimit` with `operation: 'customer-login'` before Turnstile verification, DB lookup, and password comparison.
- `services/api-gateway/src/middleware/rateLimit.ts` now treats explicit `ENVIRONMENT`/`APP_ENV=production` as production and uses `NODE_ENV=production` only as a fail-closed fallback when no explicit runtime env is set.
- Storefront account login renders `TurnstileWidget`, passes the token through `customer-auth-context`, and `/api/customer/login` forwards `turnstile_token` to the gateway.
- The storefront login API now preserves gateway `LetbuyyApiError` 403/429/503 abuse-control responses for `TURNSTILE_REQUIRED`, `CUSTOMER_AUTH_RATE_LIMITED`, and rate-limit-unavailable states instead of converting them to a generic 500.
- Pre-change `pnpm run test:contracts`: FAIL - 84/87, with new F4.3 assertions failing on production rate-limit env detection, abuse-control status propagation, and an overly literal internal-secret contract assertion.
- `pnpm run test:contracts`: PASS - 87/87.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm install --frozen-lockfile --force`: PASS - restored workspace links after generated-artifact cleanup.
- `pnpm --filter @letbuyy/storefront-runtime typecheck`: PASS.
- `pnpm --filter @letbuyy/storefront-runtime lint`: PASS - existing warnings only.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.

## F4.4 scoped credentialed CORS evidence

- `services/api-gateway/src/lib/cors.ts` now owns credentialed CORS origin resolution, reflects only fixed platform origins or exact HTTPS origins configured in `CORS_CREDENTIAL_ORIGINS`, and rejects wildcard-style, path-bearing, non-HTTPS, query, hash, or credentialed origins.
- `services/api-gateway/src/index.ts` delegates CORS origin reflection through `resolveCredentialedCorsOrigin(origin, c.env)` and no longer has a wildcard `*.letbuyy.store` reflection branch.
- `config/env/templates/worker.env.example`, `config/env/schemas/worker.schema.json`, and `docs/governance/security-operations-governance.md` document the exact-origin credentialed CORS contract.
- Pre-change `pnpm run test:contracts`: FAIL - 87/88 because the new resolver module did not exist and the gateway still had wildcard tenant reflection.
- `pnpm run test:contracts`: PASS - 90/90.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 136/136 validators.

## F4.5 raw-error sanitizer evidence

- `services/api-gateway/src/lib/public-errors.ts` is the centralized public error allowlist, with fixed public messages for DB/auth/provider/server/export/import failures, preserved client-actionable validation-style codes, and debug-field stripping for sanitized codes.
- `services/api-gateway/src/middleware/security.ts` now routes outbound JSON error payloads through `sanitizePublicErrorPayload` instead of a local three-code map.
- `scripts/validators/raw-error-message-validator.mjs` is wired into `scripts/validate-governance.mjs`; it checks raw error-object `.message` responses and requires their codes to be covered by the public sanitizer.
- Pre-change `pnpm run test:contracts`: FAIL - 90/91 because the centralized sanitizer and validator were absent.
- `pnpm run test:contracts`: PASS - 93/93.
- `node scripts/validators/raw-error-message-validator.mjs`: PASS - 26 files with raw `error.message` responses checked.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 137/137 validators.

## F4.6 production-impossible dev bypass evidence

- `apps/identity-platform/src/lib/dev-auth-bypass.ts` is the identity runtime gate for dev OTP and Turnstile bypasses; it requires `NODE_ENV=development`, `LETBUYY_ENABLE_DEV_AUTH_BYPASS=true`, and no production `NODE_ENV`, `APP_ENV`, `VERCEL_ENV`, or `NEXT_PUBLIC_ENV` flag.
- Identity signup only includes `devOtp` through `canUseIdentityDevAuthBypass(process.env)`, so OTP echo is unavailable in staging or production runtime flags.
- Identity Turnstile `dev-bypass-token` and missing-secret paths now fail closed unless the same explicit development-only server flag is present; the client widget emits the dev token only when `NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS=true` in development.
- Platform-console `PLATFORM_CONSOLE_DEV_MFA_CODE` now requires `LETBUYY_ENABLE_DEV_AUTH_BYPASS=true` in a development build and is blocked by production runtime flags.
- `config/env/templates/next-app.env.example`, `config/env/schemas/next-app.schema.json`, and `docs/governance/security-operations-governance.md` document the dev-bypass flags and production-closed behavior.
- `scripts/validators/dev-auth-bypass-validator.mjs` is wired into `scripts/validate-governance.mjs`.
- Pre-change `pnpm run test:contracts`: FAIL - 93/97, then 96/97 while tightening the source assertion.
- `pnpm run test:contracts`: PASS - 97/97.
- `node scripts/validators/dev-auth-bypass-validator.mjs`: PASS.
- `pnpm install --frozen-lockfile --force`: PASS - restored workspace links after generated-artifact cleanup.
- `pnpm --filter @letbuyy/identity-platform typecheck`: PASS.
- `pnpm --filter @letbuyy/platform-console typecheck`: PASS.
- `pnpm --filter @letbuyy/identity-platform lint`: PASS with existing warnings only.
- `pnpm --filter @letbuyy/platform-console lint`: PASS.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 138/138 validators.

## F5.1 real deployable workspace test scripts evidence

- Nine deployable web app workspaces no longer use `echo "No tests yet"` as their `test` script; app-marketplace, developer-portal, identity-platform, marketing-site, merchant-control-plane, platform-console, platform-operations-portal, storefront-runtime, and theme-marketplace now run real root/app-local `node --test` or `tsx --test` suites.
- The three deployable service workspaces remain real-test runners, so all 12 deployable workspaces are covered by the no-op script invariant.
- `tests/federation/marketing-site-auth-boundary.test.mjs` locks marketing-site as redirect-only for auth/signup creation and forbids local credential/session/auth-core ownership.
- `tests/contracts/workspace-test-runner.test.ts` verifies the 12 deployable workspace scripts, root `test:contracts`, and Turbo workspace test wiring.
- `tests/helpers/app-store-route-source.mjs` and the new workspace-runner contract resolve repository paths from their own file locations so root contract tests pass when invoked from workspace cwd by Turbo.
- `scripts/validators/no-noop-test-script-validator.mjs` is wired into `scripts/validate-governance.mjs`.
- `node scripts/validators/no-noop-test-script-validator.mjs`: PASS - 12 deployable workspace test scripts checked.
- `node --test tests/federation/marketing-site-auth-boundary.test.mjs`: PASS - 2/2.
- `pnpm run test:contracts`: PASS - 99/99.
- `pnpm --filter @letbuyy/storefront-runtime test`: PASS - 17/17.
- `pnpm --filter @letbuyy/merchant-control-plane test`: PASS - 15/15.
- `pnpm --filter @letbuyy/platform-console test`: PASS - 10/10.
- `pnpm --filter @letbuyy/identity-platform test`: PASS - 12/12 across app-local TS and root federation/auth tests.
- `pnpm turbo test --output-logs=errors-only --log-order=grouped`: PASS - 60/60 tasks.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 139/139 validators.

## F5.2 security-critical package invariant test evidence

- `@letbuyy/auth-core` now has package-local unit coverage for signed customer gateway session secret enforcement, tamper rejection, expiry rejection, and password complexity constraints.
- `@letbuyy/billing-core` now has unit coverage for INR/idempotent app billing charge inputs, India payout revenue-share/GST/provider-mode planning, and Razorpay billing signature proof payload selection.
- `@letbuyy/payments` now has unit coverage for INR minor-unit conversions, INR-only payment money normalization, and bounded idempotency-key normalization.
- `@letbuyy/checkout-core` now has unit coverage for storefront checkout idempotency/cart-line bounds and GST invoice CGST/SGST versus IGST calculation.
- `@letbuyy/theme-engine` now has unit coverage for draft/preview template scoping, bounded preview TTL/base versions, and unsafe theme JSON/unknown section/unsafe URL rejection.
- `@letbuyy/app-engine` now has unit coverage for manifest HTTPS source requirements, bounded Wasm timeout/memory normalization, extension registry install records, and app-function runtime output fail-closed behavior.
- `@letbuyy/event-core` now has unit coverage for every accepted domain event having a contract, payout release/failure remaining human-gated, and payment event envelope/payload rejection on aggregate/schema/payload mismatch.
- Direct package tests: `pnpm --filter @letbuyy/auth-core test` PASS - 2/2; `pnpm --filter @letbuyy/billing-core test` PASS - 3/3; `pnpm --filter @letbuyy/payments test` PASS - 2/2; `pnpm --filter @letbuyy/checkout-core test` PASS - 2/2; `pnpm --filter @letbuyy/theme-engine test` PASS - 2/2; `pnpm --filter @letbuyy/app-engine test` PASS - 2/2 after one assertion-order correction; `pnpm --filter @letbuyy/event-core test` PASS - 2/2.
- `pnpm turbo test --output-logs=errors-only --log-order=grouped`: PASS - 67/67 tasks.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 139/139 validators.

## F5.3 behavioral CI and inherited RBAC evidence

- The inherited `tests/auth/rbac-categories.test.mjs` load failure is resolved; direct proof: `node --test tests/auth/rbac-categories.test.mjs` PASS - 3/3.
- The root behavioral source sweep now has an explicit runner: `test:behavioral` -> `node --test tests/*/*.test.mjs`.
- `.github/workflows/ci.yml` now runs `pnpm run test:behavioral` before filtered Turbo workspace tests so root behavioral/federation/governance tests are not skipped by workspace filters.
- `tests/contracts/workspace-test-runner.test.ts` verifies the deployable workspace runners, root `test`/`test:behavioral`/`test:contracts` wiring, and the CI behavioral gate order.
- Post-F1.6 split source tests now read the effective split storefront route source through `tests/helpers/app-store-route-source.mjs`, preserving the existing assertions after `storefront.ts` was decomposed.
- `tests/federation/final-e2e-suite-contract.test.mjs` remains inside the behavioral sweep and verifies the J1-J5 Playwright specs require `requireRealStack(request)`, call the staging gateway, avoid request interception/mocks, and record screenshot evidence.
- `pnpm run test:behavioral`: PASS - 447/447.
- `node --test tests/auth/rbac-categories.test.mjs`: PASS - 3/3.
- `pnpm run test:contracts`: PASS - 100/100 after host IPC escalation for TSX.
- `node scripts/validators/test-coverage-governance-validator.mjs`: PASS - 89 required enterprise test proof files checked.
- `pnpm turbo test --output-logs=errors-only --log-order=grouped`: PASS - 67/67 tasks.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 139/139 validators.
- Live/staging execution of the J1-J5 Playwright suite and the new app/theme/cart paths remains SKIPPED -- NEEDS HUMAN until staging URLs, seeded data, internal/customer session secrets, merchant/developer/operator/customer credentials, and a CI approval to run mutating real-stack journeys are available.

## F5.4 plan/live evidence naming evidence

- Root plan-mode operational scripts now name plan surfaces explicitly: `load:plan`, `chaos:plan`, `survivability:plan`, and `certify:production:plan-report`.
- The retired ambiguous `certify:production:report` root script was removed; the production plan report command still runs `generate-certification-report.mjs --environment=production --mode=plan`.
- Staging and survivability runbooks now point to plan-only proof surfaces and no longer reference the removed `proof:local` / `run-local-operational-proof` path.
- `docs/governance/operational-resilience-governance.md` now describes plan-mode operational certification as non-recording and staging executable certification as `certification: false`.
- `docs/architecture/master-system-intelligence.md` script inventory was reconciled to the renamed `certify:production:plan-report` script.
- `tests/survivability/operational-proof-surface.test.mjs` now asserts plan-mode script names, absence of the retired script/local-proof alias in active runbooks/governance docs, and that the production plan report emits `requested_mode: "plan"`, `status: "credential-gated"`, `live_certified: false`, zero evidence records, and an unclaimed conclusion.
- `node --test tests/survivability/operational-proof-surface.test.mjs`: PASS - 6/6.
- `node scripts/validators/operational-proof-validator.mjs`: PASS - 9 load scenarios and 9 chaos experiments checked.
- `node scripts/validators/survivability-governance-validator.mjs`: PASS - survivability contracts, evidence policy, observability, multi-region, and CI gates checked.
- `node --test tests/production-certification/provider-production-certification.test.mjs tests/survivability/survivability-governance.test.mjs tests/survivability/operational-certification-harness.test.mjs tests/survivability/operational-evidence-governance.test.mjs`: PASS - 18/18.
- `pnpm run test:behavioral`: PASS - 449/449.
- `pnpm turbo test --output-logs=errors-only --log-order=grouped`: PASS - 67/67.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 139/139 validators.

## F6.1 observability producer evidence

- Added `@letbuyy/infrastructure/runtime-telemetry-adapter` to build bounded Workers Analytics Engine data points with stable `blobs`, `doubles`, and `indexes`.
- API Gateway request middleware now emits `letbuyy.runtime.request` to `RUNTIME_TELEMETRY` and persists the same metric to `runtime_telemetry_metrics` for each non-GraphQL-shim request, carrying request id, trace id, site id, runtime, status class, and latency dimensions.
- API Gateway scheduled dispatch now records `letbuyy.replay.lag.seconds` from active `replay_operation_schedules`; idle replay state emits a zero-lag heartbeat instead of leaving the dashboard dark.
- Queue Workers now persist and emit `letbuyy.queue.delivery.batch` plus `letbuyy.queue.dead_letter.total` through `runtime_telemetry_metrics` and the optional `RUNTIME_TELEMETRY` binding.
- Runtime, queue, replay, and SRE Grafana dashboards now query emitted Supabase operational projections instead of unproduced queue-depth/provider-health/Prometheus-only expressions.
- Observability governance now names Cloudflare Workers Analytics Engine plus `runtime_telemetry_metrics` as the live producer surfaces; Prometheus remains the rollout alert target that requires execute-mode health gates.
- Added `scripts/validators/observability-producer-validator.mjs` and wired it into `scripts/validate-governance.mjs`, raising the governance count to 140.
- `npx tsx --test tests/contracts/runtime-telemetry-adapter.test.ts`: PASS - 3/3.
- `node --test tests/operations/queue-bulk-cost.test.mjs tests/survivability/telemetry-pipeline.test.mjs`: PASS - 6/6.
- `pnpm run test:contracts`: PASS - 103/103 after host IPC escalation for TSX.
- `pnpm run test:behavioral`: PASS - 450/450.
- `pnpm turbo typecheck --filter=@letbuyy/infrastructure --filter=@letbuyy/api-gateway --filter=@letbuyy/queue-workers --output-logs=errors-only --log-order=grouped`: PASS - 40/40.
- `pnpm turbo typecheck`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- `pnpm turbo test --output-logs=errors-only --log-order=grouped`: PASS - 67/67 after host IPC escalation for TSX.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 140/140 validators.
- Live observability rollout proof remains SKIPPED -- NEEDS HUMAN until deployed Cloudflare Workers with `RUNTIME_TELEMETRY`, Supabase operations access, Prometheus/Grafana/OTel health endpoints, and provider credentials are available.

## F6.2 production deploy path evidence

- Removed the duplicate push-to-main `.github/workflows/deploy-production.yml` workflow.
- `.github/workflows/production-deploy.yml` is the only push-to-main production deploy path and uses `production-release-production` as its concurrency group.
- `.github/workflows/production-deploy.yml` now orders release credential preflight -> `migration-preflight` (`validate:migrations` plus production diff artifact) -> staging E2E -> production backup plus `supabase db push` -> Worker deploy -> app deploy -> required-job success gate -> production smoke.
- `.github/workflows/production-rollout.yml` uses `production-release-${{ inputs.environment }}`, so manual production rollout shares the same `production-release-production` lock as push deploys.
- `scripts/validators/deployment-safety-validator.mjs` now fails if the retired workflow returns, if another push-to-main production deploy workflow appears, if the shared lock changes, or if app deployment can run before production migration.
- Active deployment setup docs now point to `.github/workflows/production-deploy.yml`, not the retired workflow.
- `node --test tests/operations/production-deploy-workflow.test.mjs tests/operations/release-smoke-suite.test.mjs tests/operations/deployment-safety.test.mjs`: PASS - 13/13.
- `node scripts/validators/deployment-safety-validator.mjs`: PASS.
- `pnpm run validate:governance`: PASS - 140/140 validators.
- `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Live production execution proof remains SKIPPED -- NEEDS HUMAN until protected GitHub environment approvals plus staging/production Supabase, Cloudflare, Vercel, Playwright, and backup credentials are available.

## F6.3 migration root and partition driver evidence

- Archived the retired root-level Supabase PG15 config to `docs/archive/supabase-root-config/2026-06-06-supabase-config.toml`.
- Removed active root-level `supabase/config.toml`; `database/supabase/config.toml` and `database/supabase/migrations` are the only active Supabase source/config roots.
- Added `scripts/migration/run-hot-table-partition-maintenance.mjs` to plan or execute `public.ensure_next_hot_table_partitions(3)` plus `public.detach_expired_hot_table_partitions()` through `psql`, parsing DB URLs into `PG*` env vars so credentials are not printed or passed as a process argument.
- Added `.github/workflows/hot-table-partition-maintenance.yml` on monthly schedule plus manual dispatch; staging uses `STAGING_DB_CONNECTION_STRING`, production uses protected `production-migrations` plus `PRODUCTION_DB_CONNECTION_STRING`.
- Extended `scripts/validators/migration-safety-validator.mjs` to enforce the canonical root and partition driver/workflow.
- `node --test tests/migrations/hot-table-partition-driver.test.mjs tests/performance/partition-retention.test.mjs`: PASS - 9/9.
- `node scripts/validators/migration-safety-validator.mjs`: PASS.
- `node scripts/migration/run-hot-table-partition-maintenance.mjs --environment=staging --months-ahead=3`: PASS - plan mode.
- `pnpm run test:behavioral`: PASS - 456/456.
- `pnpm run validate:governance`: PASS - 140/140 after generated artifact cleanup.
- `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Live partition maintenance execution remains SKIPPED -- NEEDS HUMAN until staging/production DB connection strings and protected environment approvals are available.

## F6.4 environment honesty evidence

- Removed silent staging and retired `.com` LetBuyy URL/email defaults from active app/package/service source; active defaults now use canonical `.store`, explicit env overrides, relative local URLs, or fail-loud errors.
- Identity and platform-operations API clients throw outside production when API base URLs are missing; upload with R2 configured returns `STORAGE_UNAVAILABLE` unless `ASSET_PUBLIC_BASE_URL` is configured.
- Gateway credentialed CORS no longer includes hardcoded staging origins; storefront frame ancestors are env-owned through `STOREFRONT_FRAME_ANCESTORS`.
- Added mobile Gemini entries to mobile templates/schemas and documented the public URL, frame ancestor, asset URL, CORS, and Gemini env contracts.
- Added `scripts/validators/environment-honesty-validator.mjs`, wired it into governance, and added `tests/security/environment-honesty.test.mjs`.
- `node scripts/validators/environment-honesty-validator.mjs`: PASS.
- `node --test tests/security/environment-honesty.test.mjs`: PASS - 3/3.
- `pnpm run test:contracts`: PASS - 103/103 after host IPC escalation for TSX.
- `flutter analyze apps/mobile/merchant-app packages/dart/models packages/dart/core`: PASS - no issues.
- `pnpm run test:behavioral`: PASS - 459/459.
- Affected `pnpm turbo typecheck --filter=@letbuyy/identity-platform --filter=@letbuyy/marketing-site --filter=@letbuyy/merchant-control-plane --filter=@letbuyy/platform-operations-portal --filter=@letbuyy/storefront-runtime --filter=@letbuyy/theme-marketplace --filter=@letbuyy/api-gateway --filter=@letbuyy/theme-engine --output-logs=errors-only --log-order=grouped`: PASS - 49/49.
- Full `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- `pnpm turbo test --output-logs=errors-only --log-order=grouped`: PASS - 67/67 after host IPC escalation for TSX.
- Affected build: non-theme-marketplace tasks completed before `ENOSPC`; `pnpm turbo build --filter=@letbuyy/theme-marketplace --output-logs=errors-only --log-order=grouped`: PASS - 17/17 with exit 0, despite a post-task Turbo crash report.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 141/141 validators.
- Live/staging env value rollout remains SKIPPED -- NEEDS HUMAN until Vercel, Cloudflare, CDN/R2, and mobile provider-restricted values are configured.

## F7.1 legacy portfolio/resume evidence

- `packages/tenant-core` now separates active acquisition site types (`store`, `blog`, `landing`) from legacy site types (`portfolio`, `resume`) while preserving the full stored `SiteType` union for existing records.
- API gateway store creation and onboarding start/step/complete paths reject new portfolio/resume creation by default with `LEGACY_SITE_TYPE_DISABLED` unless `LETBUYY_ENABLE_LEGACY_SITE_TYPES=true`; legacy template listing returns `[]` while disabled.
- Identity create-store rejects legacy site types by default; identity onboarding plus marketing create/capability surfaces hide portfolio/resume unless `NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES=true`.
- Public marketing copy no longer advertises portfolio/resume as active default products; developer portal marks `/v1/portfolio` and `/v1/resume` as legacy site-type surfaces only.
- Feature-flag/domain governance and env templates/schemas document the default-off flag and schema-retention posture.
- Added `scripts/validators/legacy-site-type-validator.mjs`, wired it into governance, and added `tests/contracts/legacy-site-type-gating.test.ts`.
- `node scripts/validators/legacy-site-type-validator.mjs`: PASS.
- `npx tsx --test tests/contracts/legacy-site-type-gating.test.ts`: PASS - 4/4.
- `pnpm run test:contracts`: PASS - 107/107 after host IPC escalation for TSX.
- Affected `pnpm turbo typecheck --filter=@letbuyy/tenant-core --filter=@letbuyy/api-gateway --filter=@letbuyy/identity-platform --filter=@letbuyy/marketing-site --filter=@letbuyy/developer-portal --output-logs=errors-only --log-order=grouped`: PASS - 45/45 after `pnpm install --frozen-lockfile --force` restored workspace dependency links.
- Full `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped`: PASS - 60/60.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 142/142 validators.

## F7.2 @letbuyy/utils service-role edge evidence

- Removed `@letbuyy/utils` from the eight web app package manifests and matching runtime manifest `allowedDependencies.workspacePackages` entries.
- Retired active `packages/typescript/utils` from governed package roots and the repository-intelligence generator so future generated intelligence will not recreate the package.
- Archived the retired package boundary at `docs/archive/legacy-packages/typescript-utils/AGENTS.md`; the old package exported `getSupabaseAdmin()` through `SUPABASE_SERVICE_ROLE_KEY` but had zero active source importers.
- Added `scripts/validators/app-utils-service-role-edge-validator.mjs`, wired it into governance, and added `tests/contracts/app-utils-service-role-edge.test.ts`.
- `node scripts/validators/app-utils-service-role-edge-validator.mjs`: PASS.
- `npx tsx --test tests/contracts/app-utils-service-role-edge.test.ts`: PASS - 3/3.
- `pnpm install --lockfile-only --no-frozen-lockfile`: PASS, updating `pnpm-lock.yaml` after the dependency removals.
- `pnpm install --frozen-lockfile --force`: PASS after sandbox DNS failure and escalated retry restored workspace dependency links for verification.
- `pnpm run test:contracts`: PASS - 110/110 after host IPC escalation for TSX.
- Full `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped`: PASS - 58/58.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 143/143 validators.

## F7.3 crypto single-source evidence

- Added `sha256Hex` to `services/api-gateway/src/lib/crypto.ts`, alongside the existing `timingSafeEqualText`, `timingSafeEqualHex`, and `hmacSha256Hex` helpers.
- Removed dead local `hexToBytes`, `timingSafeEqualHex`, and `sha256Hex` declarations from the storefront route root.
- Replaced storefront sub-route local `sha256Hex` and `hmacSha256Hex` copies with imports from the shared API gateway crypto module.
- Added `scripts/validators/single-source-crypto-validator.mjs`, wired it into governance, and added `tests/contracts/single-source-crypto.test.ts`.
- `node scripts/validators/single-source-crypto-validator.mjs`: PASS.
- `npx tsx --test tests/contracts/single-source-crypto.test.ts`: PASS - 3/3.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm run test:contracts`: PASS - 113/113 after host IPC escalation for TSX.
- Full `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped`: PASS - 58/58.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 144/144 validators.

## F7.3 CMS slugify single-source evidence

- `packages/cms-core` owns the canonical `slugifyCmsTitle()` helper.
- Merchant CMS post/page/online-store page routes now import `slugifyCmsTitle as slugify` from `@letbuyy/cms-core` instead of declaring app-local slug helpers.
- `apps/merchant-control-plane/package.json` and `runtime.manifest.json` declare the `@letbuyy/cms-core` workspace dependency explicitly.
- Added `scripts/validators/cms-slugify-validator.mjs`, wired it into governance, and added `tests/contracts/cms-slugify-single-source.test.ts`.
- `node scripts/validators/cms-slugify-validator.mjs`: PASS.
- `npx tsx --test tests/contracts/cms-slugify-single-source.test.ts`: PASS - 4/4.
- `node scripts/validators/runtime-manifest-validator.mjs`: PASS.
- `node scripts/validators/dependency-manifest-validator.mjs`: PASS.
- `pnpm --filter @letbuyy/merchant-control-plane typecheck`: PASS.
- `pnpm --filter @letbuyy/shared-types build` then `pnpm --filter @letbuyy/cms-core typecheck`: PASS.
- `pnpm run test:contracts`: PASS - 117/117 after host IPC escalation for TSX.
- Full `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped`: PASS - 58/58.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 145/145 validators.

## F7.3 INR currency formatting single-source evidence

- Added browser-safe `@letbuyy/ui/formatting` with canonical `formatInrCurrency()` for India-first INR display formatting.
- Merchant customers, analytics, dashboard, dashboard client, gift-card surfaces, and app-marketplace app detail pricing now import `formatInrCurrency` instead of declaring app-local `formatCurrency` helpers.
- Added `scripts/validators/inr-currency-format-validator.mjs`, wired it into governance, and added `tests/contracts/inr-currency-format-single-source.test.ts`.
- `node scripts/validators/inr-currency-format-validator.mjs`: PASS.
- `npx tsx --test tests/contracts/inr-currency-format-single-source.test.ts`: PASS - 3/3.
- `node scripts/validators/package-export-validator.mjs`: PASS.
- `node scripts/validators/dependency-manifest-validator.mjs`: PASS.
- `pnpm --filter @letbuyy/ui typecheck`: PASS after restoring workspace dependency links.
- `pnpm --filter @letbuyy/merchant-control-plane typecheck`: PASS after restoring workspace dependency links.
- `pnpm --filter @letbuyy/app-marketplace typecheck`: PASS after restoring workspace dependency links.
- `pnpm run test:contracts`: PASS - 120/120 after host IPC escalation for TSX.
- Full `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped`: PASS - 58/58.
- `pnpm lint`: PASS - 9/9 tasks, existing warnings only.
- Generated workspace artifacts were removed after verification.
- `pnpm run validate:governance`: PASS - 146/146 validators.

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
- C-11 live behavioral proof requires staging URLs, seeded app/theme/store/cart data, internal/customer session secrets, merchant/developer/operator/customer credentials, and CI approval to run mutating real-stack journeys. Exact proof path once supplied: set `LETBUYY_E2E_REQUIRE_REAL_STACK=1`, configure the `LETBUYY_E2E_*` staging URLs/secrets used by `tests/e2e/federation/real-stack.ts`, then run `pnpm exec playwright test tests/e2e/federation tests/e2e/customer-journey.spec.ts tests/e2e/merchant-journey.spec.ts`.
- C-8/B-6 staging proof that stale editor saves conflict and preview sessions are template-scoped requires staging merchant/session/store/theme credentials and staging gateway/storefront URLs. Exact proof path once supplied: open two editor sessions for the same theme/template, save one draft, verify the stale `base_version` save conflicts in the second, publish only the clean saved draft, and mint preview sessions for two templates to verify each returns the requested `template_key` and renders the matching draft.
- C-10 staging proof that server-side cart persists across devices and checkout requires staging storefront/store/product/customer/gateway credentials. Exact proof path once supplied: add a product to cart in one browser, capture `lb_cart_token`, open the same store in a second browser/session with that token, verify `GET /v1/storefront/:subdomain/cart/:cartToken` returns the same lines/totals, then complete checkout using the synced cart items.
- H-4 staging proof that theme-marketplace checkout creates a real Razorpay test order and succeeds only after provider verification requires staging merchant session, gateway Razorpay test credentials, a purchasable staging theme with INR pricing, and browser access to Razorpay checkout. Exact proof path once supplied: authenticate to staging theme marketplace, open `/checkout?theme=<slug>`, start checkout, verify the gateway returns a Razorpay order from `POST /v1/themes/<slug>/purchase`, complete test payment in Razorpay Checkout, verify `/v1/themes/<slug>/purchase/verify` records the purchase, and confirm the success page is reached only after verification.
- H-16 per-operator gateway-side ops identity requires ops SSO/IdP or a security decision to share and validate platform-console session tokens inside the gateway worker, plus a rotation/runbook for `PLATFORM_CONSOLE_API_TOKEN`. Current static-token auth is timing-safe hardened but remains a human-gated identity architecture decision.
- C-14 live observability rollout verification requires deployed staging/production Cloudflare Workers with `RUNTIME_TELEMETRY`, Supabase operations credentials, Prometheus/Grafana/OpenTelemetry health URLs, and provider tokens. Exact proof path once supplied: set `PROMETHEUS_URL`, `GRAFANA_URL`, `GRAFANA_TOKEN`, and `OTEL_COLLECTOR_HEALTH_URL`, then run `node infrastructure/scripts/observability/verify-observability-rollout.mjs --environment=staging --execute`; repeat for production only after deployment approval.
- H-15 live production deploy proof requires protected GitHub environment approvals plus staging/production Supabase, Cloudflare, Vercel, Playwright, and backup credentials. Exact proof path once supplied: `gh workflow run production-deploy.yml --ref main`, approve `production-migrations`, `staging`, and `production`, then verify `migration-preflight`, `staging-e2e`, `migrate-production`, `deploy-workers-production`, `deploy-apps-production`, and `smoke-test-production` all succeed without skipped required jobs.
- F6.3 live hot-table partition maintenance proof requires staging/production Supabase DB connection strings and protected environment approvals. Exact proof path once supplied: `gh workflow run hot-table-partition-maintenance.yml --ref main -f environment=staging -f execute=true`, verify JSON output from `ensure_next_hot_table_partitions` and `detach_expired_hot_table_partitions`, then approve the production `production-migrations` run.
- F6.4 live environment value rollout requires Vercel project env access, Cloudflare Worker env/secret access, CDN/R2 public asset-domain decision, and provider-restricted mobile Gemini credentials. Exact proof path once supplied: configure `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_ACCOUNTS_URL`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_STOREFRONT_URL`, `NEXT_PUBLIC_THEME_MARKETPLACE_URL`, API base URLs, and `STOREFRONT_FRAME_ANCESTORS` in Vercel; configure `CORS_CREDENTIAL_ORIGINS` and `ASSET_PUBLIC_BASE_URL` in Cloudflare; configure mobile release builds with `--dart-define=GEMINI_API_KEY=... --dart-define=GEMINI_BASE_URL=... --dart-define=GEMINI_MODEL=...`; then run `pnpm run validate:governance`, affected deploy smoke tests, and mobile release smoke.
- F7.1 portfolio/resume acquisition reactivation requires human product approval for a named legacy cohort plus matching gateway/public env rollout: `LETBUYY_ENABLE_LEGACY_SITE_TYPES=true` and `NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES=true`. Default acquisition remains off and validator-guarded.

- Continue to F7.3 collapse duplicated utility/API-client wrappers and dead twins.
- Keep inherited broader test-realism work for F5 unless it blocks a phase gate.
