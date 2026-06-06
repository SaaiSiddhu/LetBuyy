# CODEX WS10 Ledger

## D0 - 2026-06-03

- Worktree: `/Users/saai_sidd/Git/lb-ws10`.
- Branch: `stream/WS10-devportal`.
- Ownership followed: edits are limited to `apps/developer-portal/**`.
- Mission file gap: `docs/Codex_waves/CODEX_DEVELOPER_ECOSYSTEM_MISSION.md` does not exist in this branch. The pasted WS10 goal is treated as the active mission.
- Scaffolded a new Next.js app for `developers.letbuyy.store` using `@letbuyy/ui` primitives and local app CSS only.
- Documented current real surfaces from source:
  - API gateway base path and middleware from `services/api-gateway/src/index.ts`.
  - App marketplace/OAuth/bridge/developer routes from `services/api-gateway/src/routes/app-store.ts`.
  - Theme catalog/editor/package routes from `services/api-gateway/src/routes/themes.ts`.
  - Theme JSON-contract bundle schema from `packages/theme-engine/src/theme-bundle.ts`.
  - App scopes, webhooks, admin embed, app blocks, and compliance topics from `packages/app-engine/src/index.ts`.
  - HMAC webhook signing headers/retry behavior from `services/webhook-service/src/app-lifecycle-dispatch.ts` and `services/webhook-service/src/index.ts`.
- Marked absent SDK/CLI/OpenAPI/testing tooling as `[SKIP — NEEDS BACKEND/SDK]`.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` completed without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed.
  - `rg "console\\.log|style=|localStorage|SUPABASE_SERVICE_ROLE|service_role|\\bany\\b" apps/developer-portal` found no production source violations; matches were limited to lint config text and an AGENTS.md instruction.
  - `node scripts/validate-governance.mjs` passed architecture validation, then stopped at the known runtime-root allowlist conflict.
  - Browser verification ran against `http://localhost:3012` with desktop `1440x1100` and mobile `390x844` viewports. Screenshots were captured at `/private/tmp/ws10-developer-portal-desktop.png` and `/private/tmp/ws10-developer-portal-mobile.png`.
  - Screenshot metrics showed no horizontal overflow in either viewport, no captured console warnings/errors, and page title `LetBuyy Developer Portal`.
  - After browser verification, the dev server was stopped and generated local artifacts were removed: `apps/developer-portal/.next`, `apps/developer-portal/node_modules`, `apps/developer-portal/tsconfig.tsbuildinfo`, and the temporary `packages/typescript/ui/node_modules` created by filtered dependency linking.

## Known Validation Conflicts

- `scripts/validators/runtime-validator.mjs` hardcodes canonical app roots in `scripts/validators/governance-common.mjs`. A new `apps/developer-portal` root will be reported as an unexpected app runtime root until governance ownership is updated by the owning terminal.
- Adding a workspace app normally requires a root `pnpm-lock.yaml` importer update. WS10 ownership forbids root lockfile edits, so this app keeps dependencies aligned with existing workspace versions but does not modify the lockfile.

## D1 - 2026-06-03

- Added a source-backed Contract Notes section to the portal without editing backend, packages, database, or governance.
- Documented real request and validation contracts from source:
  - Developer registration fields from `packages/app-engine/src/index.ts`.
  - Marketplace app submission fields, draft/in_review behavior, slug handling, and review record creation from `packages/app-engine/src/index.ts` and `services/api-gateway/src/routes/app-store.ts`.
  - Built-for-LetBuyy quality gate checks from `packages/app-engine/src/index.ts`.
  - OAuth code, token-exchange, bridge token, and direct install token lifetimes from `services/api-gateway/src/routes/app-store.ts`.
  - App bridge GET-only path and scope limits from `services/api-gateway/src/routes/app-store.ts`.
  - Theme package body and JSON-contract validation rules from `packages/theme-engine/src/theme-bundle.ts` and `services/api-gateway/src/routes/themes.ts`.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed.
  - In-app browser verification against `http://localhost:3012` found six contract cards, no horizontal overflow, no captured console warnings/errors, and page title `LetBuyy Developer Portal`.
  - Desktop and mobile screenshots were captured at `/private/tmp/ws10-developer-portal-d1-desktop.png` and `/private/tmp/ws10-developer-portal-d1-mobile.png`.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.
  - After browser verification, the dev server was stopped and generated local artifacts were removed again.

## D2 - 2026-06-03

- Added a routable static developer dashboard shell at `/dashboard`.
- Kept the dashboard source-honest:
  - API-ready tiles map to existing developer profile, app listings, review records, and partner dashboard route surfaces.
  - Webhook delivery UI, API credentials, public test sender, SDK packages, and OpenAPI export remain marked as `[SKIP — NEEDS BACKEND/SDK]`.
  - Launch checklist and contract readiness cards reuse the same source-backed D1 contract data rather than inventing live adapters.
- Updated the landing page dashboard action and nav to point to `/dashboard`.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, and `/dashboard`.
  - In-app browser verification against `http://localhost:3012/dashboard` found four metric cards, six API tiles, six contract rows, no horizontal overflow, no captured console warnings/errors, and heading `Developer workspace`.
  - Desktop and mobile dashboard screenshots were captured at `/private/tmp/ws10-developer-portal-d2-dashboard-desktop.png` and `/private/tmp/ws10-developer-portal-d2-dashboard-mobile.png`.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.
  - After browser verification, the dev server was stopped and generated local artifacts were removed again.

## D3 - 2026-06-03

- Added direct source-backed docs routes:
  - `/api-reference` for gateway rules, app platform routes, theme platform routes, webhook service routes, and validation contract notes.
  - `/oauth` for authorization-code install, OAuth token exchange, merchant-session token exchange, app bridge sessions, scopes, and GET-only bridge fetch limits.
  - `/webhooks` for HMAC delivery using `X-LetBuyy-Hmac-SHA256`, timestamped payload signing, retry behavior, mandatory compliance topics, and current service endpoints.
  - `/sdks` for the real theme JSON-contract package shape and the current app bridge contract, while leaving absent SDK packages, CLIs, OpenAPI generation, test senders, credential UI, and webhook delivery UI marked as `[SKIP — NEEDS BACKEND/SDK]`.
- Added `src/components/_local-ui/developer-docs.tsx` for portal-specific docs header, endpoint table, status badges, contract cards, fact lists, and skip ledger UI. This is marked `[CONSOLIDATE]` because no existing `@letbuyy/ui` docs table/card composition exists yet, and WS10 did not edit the shared UI package.
- Updated landing navigation and calls to action so the scaffold has routable docs for API reference, validation contracts, OAuth, webhooks, SDK quick-starts, and dashboard shell.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - HTTP checks against `http://localhost:3012/api-reference`, `/oauth`, `/webhooks`, and `/sdks` returned `200 OK`.
  - Browser verification covered desktop `1440x1100` and mobile `390x844` viewports for `/api-reference`, `/oauth`, `/webhooks`, and `/sdks`; it found no horizontal overflow and no captured console warnings/errors.
  - Screenshot evidence was captured at `/private/tmp/ws10-developer-portal-d3-api-reference-desktop.png` and `/private/tmp/ws10-developer-portal-d3-sdks-mobile.png`.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.
  - Final hygiene checks found no `pnpm-lock.yaml` diff, no generated local artifacts under `apps/developer-portal` or `packages/typescript/ui`, and no production source matches for `console.log`, inline styles, secret-role strings, or token storage patterns.
  - After verification, the dev server was stopped and generated local artifacts were removed again.

## D4 - 2026-06-03

- Expanded `/api-reference` with a source-backed Gateway Route Groups matrix.
- Documented the full mounted `/v1` gateway surface from `services/api-gateway/src/index.ts`, including public mounts, internal-console token surface, and protected merchant-session route groups.
- Counted Hono router declarations from the real route modules and recorded them as route-group counts, not generated OpenAPI operations.
- Added a local `RouteGroupMatrix` docs component under `src/components/_local-ui/developer-docs.tsx` and kept it marked under the existing `[CONSOLIDATE]` local docs UI path.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - `curl -I http://localhost:3012/api-reference` returned `200 OK`.
  - Rendered HTML for `/api-reference` included the new `Gateway Route Groups` section and `.route-matrix` table.
  - In-app browser verification was attempted with the Browser plugin, but Browser Use blocked `http://localhost:3012/api-reference` under its URL policy. No alternate browser surface was used for the same visual check.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.
  - Final hygiene checks found no `pnpm-lock.yaml` diff and no production source matches for `console.log`, inline styles, secret-role strings, or token storage patterns.
  - After verification, the dev server was stopped and generated local artifacts were removed again.

## D5 - 2026-06-03

- Expanded `/api-reference` again with source-backed endpoint highlight tables for:
  - Protected commerce/admin commerce routes: products, orders, customers, inventory, merchant payments, subscription plans, Razorpay, and Stripe checkout.
  - Public storefront routes: store lookup, directory, public store payloads, status, checkout order creation, Razorpay storefront payments, catalog, coupons, categories, navigation, pages, policies, and reviews.
- Kept the detail level honest: these are curated endpoint highlights from real Hono route declarations, not generated OpenAPI schemas.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - `curl -I http://localhost:3012/api-reference` returned `200 OK`.
  - Rendered HTML for `/api-reference` included `Commerce Endpoint Highlights`, `Storefront Endpoint Highlights`, and `Gateway Route Groups`.
  - Rendered HTML contained five `.endpoint-table` tables and one `.route-matrix` table.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.
  - Final hygiene checks found no `pnpm-lock.yaml` diff and no production source matches for `console.log`, inline styles, secret-role strings, or token storage patterns.
  - After verification, the dev server was stopped and generated local artifacts were removed again.

## D6 - 2026-06-03

- Added source-backed request/response examples to the direct docs pages:
  - `/oauth` now shows real authorize, token-exchange, merchant-session exchange, and app bridge response examples from `services/api-gateway/src/routes/app-store.ts`.
  - `/webhooks` now shows real outbound header, body, and signing-payload examples from `services/webhook-service/src/app-lifecycle-dispatch.ts`.
  - `/sdks` now shows real theme upload, theme validation response, app-block section, and bridge fetch envelope examples from `packages/theme-engine/src/theme-bundle.ts` and `services/api-gateway/src/routes/app-store.ts`.
- Added a local `ExampleCards` docs component under `src/components/_local-ui/developer-docs.tsx`; this remains `[CONSOLIDATE]` because shared docs/example UI does not exist yet and WS10 did not edit `@letbuyy/ui`.
- Kept absent SDK packages, CLIs, OpenAPI export, webhook sender tooling, credential UI, and dashboard live adapters marked as `[SKIP — NEEDS BACKEND/SDK]`.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - `curl -I` checks against `/oauth`, `/webhooks`, and `/sdks` returned `200 OK`.
  - Rendered HTML for `/oauth`, `/webhooks`, and `/sdks` included the new example sections and 13 total `.example-card` entries.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.
  - Final hygiene checks found no `pnpm-lock.yaml` diff and no production source matches for `console.log`, inline styles, secret-role strings, or token storage patterns.
  - After verification, the dev server was stopped and generated local artifacts were removed again.

## D7 - 2026-06-03

- Expanded `/api-reference` with a source-backed Schema Facades matrix.
- Documented gateway schema modules as compatibility facades and named their canonical package sources instead of inventing generated OpenAPI definitions:
  - `auth.schema.ts` from `@letbuyy/auth-core`.
  - `store.schema.ts` from `@letbuyy/shared-types` and `@letbuyy/tenant-core`.
  - `product.schema.ts` and `customer.schema.ts` from `@letbuyy/shared-types` and `@letbuyy/commerce-core`.
  - `order.schema.ts` and `coupon.schema.ts` from `@letbuyy/shared-types` and `@letbuyy/checkout-core`.
  - `theme.schema.ts` from `@letbuyy/shared-types` and `@letbuyy/theme-engine`.
  - `operations.schema.ts` from `@letbuyy/event-core`.
- Added a local `SchemaFacadeMatrix` docs component under `src/components/_local-ui/developer-docs.tsx`; this remains `[CONSOLIDATE]` with the rest of the portal-specific docs UI.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed after allowing TypeScript to write `tsconfig.tsbuildinfo`; the first sandboxed attempt failed only with an EPERM write error.
  - `pnpm --filter @letbuyy/developer-portal build` passed after allowing Next.js to create `.next`; the first sandboxed attempt failed only with an EPERM mkdir error.
  - Built `/api-reference` HTML included `Schema Facades`, one `.schema-matrix`, one `.route-matrix`, five `.endpoint-table` tables, and all eight schema source references.
  - Browser tool discovery returned no exposed Browser tools in this session, so no new D7 screenshot was captured.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.

## D8 - 2026-06-03

- Expanded `/webhooks` with a source-backed Topic Requirements matrix.
- Documented real lifecycle topics and mandatory compliance topics:
  - `app.installed` from the OAuth authorize/direct install webhook subscription flow.
  - `app.uninstalled` from the uninstall flow after subscription disablement and install cleanup.
  - `customers/data_request`, `customers/redact`, and `shop/redact` from `MANDATORY_COMPLIANCE_WEBHOOK_TOPICS`.
- Clarified that app webhook subscription planning appends mandatory compliance topics to each configured app webhook's `event_types`.
- Added a local `WebhookTopicMatrix` docs component under `src/components/_local-ui/developer-docs.tsx`; this remains `[CONSOLIDATE]` with the rest of the portal-specific docs UI.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - Built `/webhooks` HTML included `Topic Requirements`, one `.webhook-topic-matrix`, `app.installed`, `app.uninstalled`, `customers/data_request`, `customers/redact`, and `shop/redact`.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.

## D9 - 2026-06-03

- Expanded `/oauth` with a source-backed Scope Matrix.
- Documented real install/OAuth scope behavior:
  - `read_products`, `read_orders`, `read_customers`, `read_themes`, and `read_storefront` map to the current GET-only app bridge first path segments.
  - `write_themes` and `app_collaboration` are present in partner collaborator access responses, but are not implemented as bridge/fetch permissions.
- Marked write-capable bridge behavior and collaboration bridge behavior as `[SKIP — NEEDS BACKEND/SDK]`.
- Added a local `OAuthScopeMatrix` docs component under `src/components/_local-ui/developer-docs.tsx`; this remains `[CONSOLIDATE]` with the rest of the portal-specific docs UI.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - Built `/oauth` HTML included `Scope Matrix`, one `.scope-matrix`, all seven documented scopes, and `[SKIP — NEEDS BACKEND/SDK]` for write/collaboration bridge support.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.

## D10 - 2026-06-03

- Expanded `/dashboard` with a source-backed Dashboard API Map.
- Documented real gateway dashboard and billing surfaces:
  - `GET /v1/app-store/developers/me`.
  - `GET /v1/app-store/developers/apps`.
  - `GET /v1/app-store/partners/dashboard`.
  - `POST /v1/app-store/partners/collaborator-code`.
  - `POST /v1/app-store/installations/:id/charges`.
  - `POST /v1/app-store/charges/:id/approve`.
- Kept credential management UI marked `[SKIP — NEEDS BACKEND/SDK]` because no public credential rotation or API key console exists in this branch.
- Added a local `DashboardSurfaceMatrix` docs component under `src/components/_local-ui/developer-docs.tsx`; this remains `[CONSOLIDATE]` with the rest of the portal-specific docs UI.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - Built `/dashboard` HTML included `Dashboard API Map`, one `.dashboard-surface-matrix`, `Partner dashboard aggregate`, `App charge creation`, `Credential management UI`, and `[SKIP — NEEDS BACKEND/SDK]` markers.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.

## D11 - 2026-06-03

- Expanded `/sdks` with source-backed SDK contract matrices.
- Added Theme Bundle Areas from `packages/theme-engine/src/theme-bundle.ts`, covering package metadata, settings schema/data, templates, sections, blocks, locales, renderer, and upload submission modes.
- Added App Bridge Capabilities from `packages/app-engine/src/index.ts`, covering `api.fetch`, `toast`, `resize`, optional `navigation.redirect`, and admin embed surface normalization.
- Kept published JavaScript SDK, CLI scaffolder, write bridge client, and test tooling marked `[SKIP — NEEDS BACKEND/SDK]`.
- Added a local `SdkContractMatrix` docs component under `src/components/_local-ui/developer-docs.tsx`; this remains `[CONSOLIDATE]` with the rest of the portal-specific docs UI.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - Built `/sdks` HTML included `Theme Bundle Areas`, `App Bridge Capabilities`, two `.sdk-contract-matrix` tables, `api.fetch`, `navigation.redirect`, `config.settings_schema`, and `renderer`.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.

## D12 - 2026-06-03

- Expanded `/api-reference` with source-backed Gateway Response Contracts.
- Documented the current gateway response behavior from real helpers and middleware:
  - Standard success helper returns `{ success: true, data, ...meta }`.
  - Paginated helper returns `{ success: true, data, meta: { page, per_page, total, total_pages, has_next, has_prev } }`.
  - Helper errors may return `{ success: false, error: { code, message, status } }`.
  - Compatibility helpers may return either `{ error: { code, message } }` or `{ success: false, error: { code, message } }`, so clients should branch on HTTP status and `error`.
  - Typed `AppError` responses return sanitized `{ error: { code, message, details? } }` with the AppError status code.
  - Unexpected errors return `INTERNAL_ERROR` with `request_id` for support correlation.
  - CORS exposes `X-Request-ID`, `X-Trace-ID`, `X-RateLimit-*`, `X-LetBuyy-API-Version`, and `X-Response-Time`; request ID middleware creates an ID when absent.
- Added a local `ResponseContractMatrix` docs component under `src/components/_local-ui/developer-docs.tsx`; this remains `[CONSOLIDATE]` with the rest of the portal-specific docs UI.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - Built `/api-reference` HTML included `Gateway Response Contracts`, one `.response-contract-matrix`, `success: true`, `total_pages`, `Compatibility error bodies`, `INTERNAL_ERROR`, and `X-Request-ID`.
  - `git diff -- pnpm-lock.yaml` was empty.
  - Production source hygiene search found no matches for `console.log`, inline styles, token storage, service-role strings, or loose type escape hatches.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.

## D13 - 2026-06-03

- Expanded `/api-reference` with source-backed Payment and Idempotency Contracts.
- Documented real gateway safety behavior from `orders`, `payments`, `storefront`, and checkout-core schemas:
  - Protected order mutations use `IdempotencyExecutionAdapter` claims keyed by `idempotency_key` and replay stored responses.
  - Protected order creation accepts order inputs and delegates pricing to the order execution adapter instead of accepting client totals as authority.
  - Protected Razorpay order start computes minor units from `order.total`, rejects stale client amount hints with `AMOUNT_MISMATCH`, and stores an idempotent provider order response.
  - Protected Razorpay verification checks ownership, blocks already-paid orders, verifies `razorpay_order_id|razorpay_payment_id` HMAC, and confirms payment with `idempotency_key`.
  - Protected Stripe checkout derives amount from the payable order and passes `idempotency_key` to the Stripe adapter.
  - Storefront provider starts for Razorpay, Cashfree, Stripe, and PayPal load the published store order, require supported INR amounts, create provider intents, and complete idempotency claims.
  - Storefront Razorpay and Cashfree starts reject stale amount hints with `AMOUNT_MISMATCH`.
  - Storefront provider verification/capture routes bind provider references to orders, confirm payment, emit order paid, and complete idempotency claims.
  - Protected merchant routes use `idempotency_key`; storefront routes use `idempotencyKey`.
- Added a local `PaymentSafetyMatrix` docs component under `src/components/_local-ui/developer-docs.tsx`; this remains `[CONSOLIDATE]` with the rest of the portal-specific docs UI.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - Built `/api-reference` HTML included `Payment and Idempotency Contracts`, one `.payment-safety-matrix`, `AMOUNT_MISMATCH`, `idempotencyKey`, `idempotency_key`, `Protected Razorpay verification`, `Storefront provider starts`, and `Checkout schema key casing`.
  - `git diff -- pnpm-lock.yaml` was empty.
  - Production source hygiene search found no matches for `console.log`, inline styles, token storage, service-role strings, or loose type escape hatches.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.

## D14 - 2026-06-03

- Expanded `/api-reference` with a source-backed App Submission Quality Gate matrix.
- Documented real app submission and Built-for-LetBuyy evidence rules from `packages/app-engine/src/index.ts` and `services/api-gateway/src/routes/app-store.ts`:
  - Required submission fields: `name`, `tagline`, `description`, `category_id`, `app_url`, and `privacy_url` or `privacy_policy_url`.
  - Quality evidence aliases: `quality_gate`, `built_for_letbuyy`, and `builtForLetBuyy`.
  - The gate runs only when quality evidence exists and `save_as_draft` is not true.
  - Performance requires a Lighthouse score of at least 70.
  - Reviews require at least one qualifying review and rating average of 4.0 or higher.
  - Installs require at least one successful install signal.
  - Storefront app blocks require at least one `storefront_block`, `app-block`, or `app_block` extension.
  - App and privacy URLs must be HTTPS, with localhost HTTP accepted only for local testing.
  - Failed non-draft quality evidence returns validation with failed check keys; draft submissions store as `draft`.
  - Non-draft submissions create a marketplace review record with automated checks and emit `app.submitted`.
- Added a local `AppQualityGateMatrix` docs component under `src/components/_local-ui/developer-docs.tsx`; this remains `[CONSOLIDATE]` with the rest of the portal-specific docs UI.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - Built `/api-reference` HTML included `App Submission Quality Gate`, one `.app-quality-gate-matrix`, `performance_score`, `built_for_letbuyy`, `save_as_draft`, `Storefront app block`, `Review record`, `app.submitted`, and `4.0 or higher`.
  - `git diff -- pnpm-lock.yaml` was empty.
  - Production source hygiene search found no matches for `console.log`, inline styles, token storage, service-role strings, or loose type escape hatches.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.

## D15 - 2026-06-03

- Expanded `/sdks` with a source-inspection SDK Tooling Gaps matrix.
- Kept absent tooling explicit instead of implying unsupported capabilities:
  - OpenAPI export remains `[SKIP — NEEDS BACKEND/SDK]`; gateway routes are mounted under `/v1`, but no generated OpenAPI artifact is checked in for this branch.
  - Published App SDK package remains `[SKIP — NEEDS BACKEND/SDK]`; app bridge contracts exist, but no `@letbuyy/app-sdk` browser client exists.
  - Theme CLI scaffolder remains `[SKIP — NEEDS BACKEND/SDK]`; JSON-contract schema validation exists, but no CLI generator or packager is present.
  - Webhook test sender UI remains `[SKIP — NEEDS BACKEND/SDK]`; dispatch exists behind service/internal flows, but no public developer test-delivery endpoint or UI exists.
  - Credential rotation console remains `[SKIP — NEEDS BACKEND/SDK]`; OAuth/app token routes exist, but no public credential rotation/API key console route exists.
  - Write-capable app bridge remains `[SKIP — NEEDS BACKEND/SDK]`; `bridge/fetch` currently accepts GET-only read requests.
- Added a local `ToolingGapMatrix` docs component under `src/components/_local-ui/developer-docs.tsx`; this remains `[CONSOLIDATE]` with the rest of the portal-specific docs UI.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - Built `/sdks` HTML included one `.tooling-gap-matrix`, `OpenAPI export`, `Published App SDK package`, `Theme CLI scaffolder`, `Webhook test sender UI`, `Credential rotation console`, `Write-capable app bridge`, and `[SKIP — NEEDS BACKEND/SDK]`.
  - `git diff -- pnpm-lock.yaml` was empty.
  - Production source hygiene search found no matches for `console.log`, inline styles, token storage, service-role strings, or loose type escape hatches.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.

## D16 - 2026-06-03

- Expanded `/sdks` with source-backed Theme Validation Rules.
- Documented rule-level JSON-contract constraints currently enforced by `@letbuyy/theme-engine`:
  - Package metadata validation for slug format, site types, status, pricing, currency, version, release status, and defaults.
  - Template `order` entries must reference existing section IDs.
  - Template section `block_order` entries must reference existing local block IDs.
  - Section definition keys must match `section.type`.
  - Block definition keys must match `block.type`.
  - Section `block_types` entries must reference existing block definitions.
  - Template section types must reference existing section definitions.
  - Template block types must reference existing block definitions.
  - Template blocks are constrained by section `block_types` when declared.
  - `validateThemeBundle` returns `{ ok, bundle?, issues }` and formats validation issues as path-prefixed strings.
  - Locale lookup normalizes underscores to dashes and checks normalized locale, lowercase variant, language, then `en`; translation references use the `t:` prefix.
- Reused the existing local `SdkContractMatrix` component; no new local UI component was needed for this slice.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - Built `/sdks` HTML included `Theme Validation Rules`, `Template order references`, `Template block order references`, `Section key/type match`, `Block key/type match`, `Allowed blocks per section`, `Validation issue formatting`, and `Locale lookup`.
  - `git diff -- pnpm-lock.yaml` was empty.
  - Production source hygiene search found no matches for `console.log`, inline styles, token storage, service-role strings, or loose type escape hatches.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.

## D17 - 2026-06-03

- Expanded `/webhooks` with a source-backed Delivery, Retry, and Failure Rules matrix.
- Documented current webhook worker behavior from source:
  - Production callback URLs must be HTTPS; localhost HTTP is accepted only outside production mode.
  - Delivery signs `${timestamp}.${rawBody}`, sends `X-LetBuyy-Hmac-SHA256` as `v1=<hex>`, and also sends `X-LetBuyy-Signature` as a legacy alias.
  - Outbound body shape is `{ id, event_type, created_at, payload }`, with event, request, trace, timestamp, user-agent, and signature headers.
  - Any 2xx response marks delivery successful; non-2xx responses record a response preview and `Webhook endpoint returned HTTP <status>`.
  - Retry backoff starts at 120 seconds, bounds attempts to 0-8, and caps at 3600 seconds.
  - Queue dispatch uses `claim_webhook_deliveries`, `complete_webhook_delivery`, and `fail_webhook_delivery` with `p_retry_seconds`.
  - `/app-lifecycle/dispatch` and `/webhook-deliveries/dispatch` remain internal-secret service routes; public test sender tooling is still `[SKIP — NEEDS BACKEND/SDK]`.
  - Lifecycle dispatch filters subscriptions by `event_types`, while app subscription planning appends the mandatory compliance topics.
- Added a local `WebhookDeliveryRuleMatrix` docs component under `src/components/_local-ui/developer-docs.tsx`; this remains `[CONSOLIDATE]` with the rest of the portal-specific docs UI.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - Built `/webhooks` HTML included `Delivery, Retry, and Failure Rules`, one `.webhook-delivery-rule-matrix`, `Webhook endpoint returned HTTP`, `claim_webhook_deliveries`, `fail_webhook_delivery`, `120 seconds`, `X-LetBuyy-Signature`, `event_types`, and `Internal dispatch routes`.
  - `git diff -- pnpm-lock.yaml` was empty.
  - Production source hygiene search found no matches for `console.log`, inline styles, token storage, service-role strings, or loose type escape hatches.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.

## D18 - 2026-06-03

- Expanded `/oauth` with a source-backed Token Lifecycle Matrix.
- Documented current OAuth, direct install, embedded session, and bridge token behavior from `services/api-gateway/src/routes/app-store.ts`:
  - Authorization-code installs store only a code hash, keep `redirect_uri`, scopes, state, issued time, and a 15-minute `expires_at`.
  - Token exchange accepts only `grant_type=authorization_code`, requires `code`, `client_id`, and `redirect_uri`, and rejects mismatched code payloads.
  - Authorization codes are one-time: exchanges compare the stored code hash and reject codes whose `redeemed_at` is set.
  - Scoped app tokens default to a 3600-second TTL and return Bearer token metadata while storing only `access_token_hash`.
  - Merchant-session token exchange requires an active installation, store ownership, and requested scopes within `scopes_granted`; returned tokens last 15 minutes.
  - Embed bridge sessions mint 15-minute bridge tokens, store `bridge_token_hash`, issued/expires/scopes, and return bridge version `2026-06-01`.
  - Bridge fetch verifies Bearer scopes, token store, active installation, and token hash; replaced tokens are rejected.
  - Direct install token responses are real but distinct from the authorization-code flow.
  - Refresh tokens and credential rotation remain `[SKIP — NEEDS BACKEND/SDK]`; no current route contract exposes them.
- Added a local `OAuthTokenLifecycleMatrix` docs component under `src/components/_local-ui/developer-docs.tsx`; this remains `[CONSOLIDATE]` with the rest of the portal-specific docs UI.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - Built `/oauth` HTML included `Token Lifecycle Matrix`, one `.oauth-token-lifecycle-matrix`, `Authorization code replay`, `Scoped app token`, `Merchant session token exchange`, `Embed bridge session`, `Bridge fetch token verification`, `Direct install token`, `Refresh tokens and rotation`, `refresh_token`, `bridge_token_hash`, `3600-second TTL`, and `15-minute`.
  - `git diff -- pnpm-lock.yaml` was empty.
  - Production source hygiene search found no matches for `console.log`, inline styles, token storage, service-role strings, or loose type escape hatches.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.

## D19 - 2026-06-03

- Expanded `/oauth` with a source-backed App Bridge Fetch Rules matrix.
- Documented current `POST /v1/app-store/bridge/fetch` behavior from `services/api-gateway/src/routes/app-store.ts`:
  - Requests default to GET, require a path, reject non-GET methods, absolute URLs, `..`, and double-slash paths, and strip an optional `/v1` prefix.
  - Allowed first path segments are `products`, `orders`, `customers`, `themes`, and `storefront`.
  - Allowed segments require `read_products`, `read_orders`, `read_customers`, `read_themes`, and `read_storefront` respectively.
  - Target URLs are built as `/v1{path}` and inject the token store ID; mismatched requested `store_id` values are rejected.
  - The bridge verifies Bearer token scopes, active matching installation state, installed-by ownership, and token hash allowlisting.
  - Accepted token hashes must match `bridge_token_hash` or `access_token_hash`; replaced bridge tokens are rejected.
  - Proxied reads forward internal identity headers plus `Accept: application/json`, `X-LetBuyy-App-Bridge`, and `X-Request-ID`, then return `{ ok, status, data, error }`.
- Added a local `AppBridgeFetchRuleMatrix` docs component under `src/components/_local-ui/developer-docs.tsx`; this remains `[CONSOLIDATE]` with the rest of the portal-specific docs UI.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - Built `/oauth` HTML included `App Bridge Fetch Rules`, one `.app-bridge-fetch-matrix`, `Request normalization`, `Products reads`, `Orders reads`, `Customers reads`, `Themes reads`, `Storefront reads`, `Store binding`, `Token hash allowlist`, `Proxy response shape`, `Bridge gateway request failed`, `read_storefront`, and `X-LetBuyy-App-Bridge`.
  - `git diff -- pnpm-lock.yaml` was empty.
  - Production source hygiene search found no matches for `console.log`, inline styles, token storage, service-role strings, or loose type escape hatches.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.

## D20 - 2026-06-03

- Expanded `/sdks` with a source-backed Theme Upload Gateway Contract matrix.
- Documented current `POST /v1/themes/packages/upload` behavior from the gateway and schema registry adapter:
  - Upload validates a strict `{ bundle, submission_mode }` body through `UploadThemePackageSchema`; `submission_mode` is `marketplace` or `private_install` and defaults to `marketplace`.
  - The upload route is merchant-auth protected and resolves the custom merchant user before persistence.
  - `SchemaRegistryExecutionAdapter.uploadThemePackageBundle` parses the bundle and persists theme package/version records through the schema registry path.
  - Marketplace submissions are review-required and force package/version status to draft before review.
  - `private_install` mode returns the upload result with `review_record: null`.
  - Marketplace uploads create automated checks for `bundle_schema_validation` and `theme_package_persistence`.
  - Marketplace uploads emit `theme.submitted` with idempotency key `theme.submitted:<theme_package_id>:<theme_version_id>`.
  - Upload responses include theme, package, version, `schema_manifest_version`, `renderer_version`, and `installable`.
  - Applying a theme remains a separate `POST /v1/themes/:slug/install` operation.
- Reused the existing local `SdkContractMatrix`; no new local UI component was needed for this slice.
- Verification:
  - `pnpm install --filter @letbuyy/developer-portal... --lockfile=false --ignore-scripts --no-frozen-lockfile` restored filtered dependency links without changing `pnpm-lock.yaml`.
  - `pnpm --filter @letbuyy/developer-portal typecheck` passed.
  - `pnpm --filter @letbuyy/developer-portal lint` passed.
  - `pnpm --filter @letbuyy/developer-portal build` passed and prerendered `/`, `/_not-found`, `/api-reference`, `/dashboard`, `/oauth`, `/sdks`, and `/webhooks`.
  - Built `/sdks` HTML included `Theme Upload Gateway Contract`, `Upload body schema`, `Merchant auth boundary`, `Persistence adapter`, `Marketplace submission mode`, `Private install mode`, `Review record`, `Theme submitted event`, `Upload response fields`, `Install route separation`, `bundle_schema_validation`, `theme_package_persistence`, `theme.submitted`, `private_install`, and `review_record`.
  - `git diff -- pnpm-lock.yaml` was empty.
  - Production source hygiene search found no matches for `console.log`, inline styles, token storage, service-role strings, or loose type escape hatches.
  - `node scripts/validate-governance.mjs` still stops at the known runtime-root allowlist conflict after architecture validation passes.
