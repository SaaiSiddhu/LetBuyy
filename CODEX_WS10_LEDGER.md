# CODEX WS10 (DEVELOPER ECOSYSTEM) LEDGER - started 2026-06-04T08:52:48Z

## CURRENT STATUS
- Stage: STAGE 6 - WS10 Developer Ecosystem.
- Active gate: DONE. D0-D4 developer portal complete; pre-commit governance passed 128/128.
- Scope lock: WS10 source ownership is `apps/developer-portal/**`, plus `CODEX_WS10_LEDGER.md` and final status ledgers. Gateway, app-engine, theme-engine, auth-core, and webhook-service were read-only source references for truthful docs.
- Governance exception: adding a new `apps/developer-portal` runtime is rejected by the repository's runtime validators unless the runtime is registered in canonical topology/env/deployment governance. Minimal support edits were made to runtime topology, env ownership, Vercel project metadata, runtime docs, and `scripts/validators/governance-common.mjs` so the new app can satisfy the 128-validator law. No backend contracts, database schema, gateway routes, or design-system source were changed for WS10.

## D0 SCAFFOLD
- Status: DONE / SCOPED PROOF PASSED.
- Source changes:
  - Created `apps/developer-portal` as a Next.js App Router runtime with local `AGENTS.md`, `runtime.manifest.json`, package scripts, Tailwind globals, self-hosted LetBuyy font variables, and `@letbuyy/ui` consumption.
  - Added routes for `/`, `/api`, `/docs`, `/sdk`, and `/dashboard`.
  - Built a shared portal shell with sticky navigation, footer, cards, code panels, status pills, and route/source badges.
  - Registered the runtime in canonical app roots, production/deployment topology, env ownership, staging/production secret matrix, Vercel project metadata, and governance docs because validators require every active app root to be canonical.
- Scoped proof:
  - `pnpm --filter @letbuyy/developer-portal typecheck` -> PASS.
  - `pnpm --filter @letbuyy/developer-portal lint` -> PASS.
  - `pnpm --filter @letbuyy/developer-portal test` -> PASS (`No tests yet` package script).
  - `NEXT_TELEMETRY_DISABLED=1 pnpm --filter @letbuyy/developer-portal exec next build --webpack` -> PASS. Routes prerendered: `/`, `/_not-found`, `/api`, `/dashboard`, `/docs`, `/sdk`.
  - Sandboxed `next build` with default Turbopack failed only because the sandbox blocked Turbopack worker process behavior (`Operation not permitted` while creating/binding an internal process); webpack production build outside the sandbox passed.

## D1 API REFERENCE
- Status: DONE / REAL CONTRACTS ONLY.
- Source references:
  - `services/api-gateway/src/index.ts`
  - `services/api-gateway/src/routes/auth.ts`
  - `services/api-gateway/src/routes/products.ts`
  - `services/api-gateway/src/routes/orders.ts`
  - `services/api-gateway/src/routes/customers.ts`
  - `services/api-gateway/src/routes/storefront.ts`
  - `services/api-gateway/src/routes/themes.ts`
  - `services/api-gateway/src/routes/app-store.ts`
  - `services/api-gateway/src/routes/operations.ts`
  - `services/api-gateway/src/middleware/rateLimit.ts`
- Implemented reference content:
  - Gateway mounts, auth/session, commerce admin, storefront runtime, theme platform, app platform, and operations/webhook-admin route groups.
  - Auth model notes for merchant session, app access tokens, and internal signed session headers.
  - Error and pagination guidance using real gateway error codes and store-scoped ownership conventions.
  - Query-cost rate-limit model: local/dev skip, capacity 200, leak rate 20/sec, method costs, include/expand costs, route surcharges, and emitted `X-RateLimit-*` headers.

## D2 OAUTH AND WEBHOOKS DOCS
- Status: DONE / REAL CONTRACTS ONLY.
- Source references:
  - `services/api-gateway/src/routes/app-store.ts`
  - `packages/auth-core/src/index.ts`
  - `packages/app-engine/src/index.ts`
  - `services/webhook-service/src/app-lifecycle-dispatch.ts`
- Implemented docs:
  - Authorization-code app install: `/v1/app-store/apps/:id/oauth/authorize`, store ownership/scope/redirect validation, 15-minute code expiry, active installation upsert.
  - Access-token exchange: `/v1/app-store/oauth/token`, one-time code redemption, scoped JWT app token, token hashes stored in installation config.
  - Embedded token exchange: `/v1/app-store/oauth/token-exchange`, merchant session to embedded app token.
  - Webhook HMAC model: `X-LetBuyy-Hmac-SHA256`, payload `timestamp.rawBody`, versioned `v1=<hex>` signature, legacy signature header, delivery metadata headers, HTTPS target requirement except localhost in non-production.
  - Mandatory compliance webhook topics: `customers/data_request`, `customers/redact`, and `shop/redact`.

## D3 THEME SDK AND APP SDK QUICK-STARTS
- Status: DONE WITH SDK/CLI SKIP.
- Source references:
  - `packages/theme-engine/src/theme-bundle.ts`
  - `packages/theme-engine/src/index.ts`
  - `packages/app-engine/src/index.ts`
  - `services/api-gateway/src/routes/themes.ts`
  - `services/api-gateway/src/routes/app-store.ts`
- Implemented quick-start content:
  - Theme JSON-contract bundle: `config/settings_schema.json`, `config/settings_data.json`, `templates/*.json`, `sections/manifest.json`, `blocks/definitions.json`, and `locales/*.json`.
  - Theme upload and editor routes: `/v1/themes/packages/upload`, `/v1/themes/:slug/editor`, draft save/delete, preview session, release, rollback, install, purchase verification.
  - App manifest/extension model: developer profile, marketplace app submissions, scopes, admin embed extensions, app blocks, storefront slots, and install OAuth.
- Skips:
  - `[SKIP - NEEDS SDK/CLI]` No active `@letbuyy/cli`, theme CLI, app CLI, or `create-letbuyy` package exists in the tracked workspace.
  - `[SKIP - NEEDS SDK/CLI]` Local dev scaffolding commands are not documented as available; the portal keeps the current manual JSON-contract path visible.

## D4 DEVELOPER DASHBOARD SHELL
- Status: DONE WITH BACKEND SKIPS.
- Implemented dashboard shell:
  - Apps/submissions panel over existing `/v1/app-store/developers/register`, `/v1/app-store/developers/apps`, and `/v1/app-store/partners/dashboard` contracts.
  - Themes panel showing package upload/review/release readiness where current theme routes support it.
  - API keys, analytics, and earnings panels rendered as explicit backend-needed shells instead of fabricated data.
- Skips:
  - `[SKIP - NEEDS BACKEND]` No partner API key inventory/create/revoke/rotate endpoint exists in the gateway.
  - `[SKIP - NEEDS BACKEND]` No itemized app/theme earnings, payout export, API call analytics, or install funnel analytics endpoint exists as a separate developer contract.
  - `[SKIP - NEEDS BACKEND]` Developer self-serve webhook retry APIs are not exposed; retry/dispatch remains operations-owned under `/v1/operations`.
  - `[SKIP - NEEDS BACKEND]` Partner-owned theme dashboard endpoints distinct from marketplace operations are partial/planned.

## VISUAL PROOF
- Browser route smoke against `http://127.0.0.1:3008` -> PASS for `/`, `/api`, `/docs`, `/sdk`, and `/dashboard`; expected text rendered and default-width horizontal overflow was false for every route.
- Desktop/mobile screenshot proof with `@playwright/test` Chromium -> PASS after fixing a real mobile `/api` overflow caused by long route code labels.
- Final screenshot and overflow pass:
  - Desktop 1440x1100 screenshots: `/private/tmp/ws10-developer-portal/desktop-home.png`, `/private/tmp/ws10-developer-portal/desktop-api.png`, `/private/tmp/ws10-developer-portal/desktop-docs.png`, `/private/tmp/ws10-developer-portal/desktop-sdk.png`, `/private/tmp/ws10-developer-portal/desktop-dashboard.png`.
  - Mobile 390x844 screenshots: `/private/tmp/ws10-developer-portal/mobile-home.png`, `/private/tmp/ws10-developer-portal/mobile-api.png`, `/private/tmp/ws10-developer-portal/mobile-docs.png`, `/private/tmp/ws10-developer-portal/mobile-sdk.png`, `/private/tmp/ws10-developer-portal/mobile-dashboard.png`.
  - Final metrics: all pages had `scrollWidth == clientWidth` on both desktop and mobile; expected route text present; document title `LetBuyy Developers`.
- Visual review:
  - Desktop home screenshot reviewed; hero, code panel, four-card highlight grid, contract status section, source badges, and skip cards fit without visible overlap or clipping.
  - Mobile API screenshot reviewed; long endpoint labels wrap inside route cards and no page-level horizontal overflow remains.

## VALIDATOR LEDGER
- Scoped checks:
  - `pnpm --filter @letbuyy/developer-portal typecheck` -> PASS.
  - `pnpm --filter @letbuyy/developer-portal lint` -> PASS.
  - `pnpm --filter @letbuyy/developer-portal test` -> PASS.
  - `NEXT_TELEMETRY_DISABLED=1 pnpm --filter @letbuyy/developer-portal exec next build --webpack` -> PASS.
- Generated artifact cleanup:
  - `find apps services packages ... -prune -exec rm -rf {} +` -> PASS.
  - Flutter plugin metadata cleanup -> PASS.
  - Generated artifact scan after cleanup -> PASS, no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, or `.symlinks` directories found.
- Full `pnpm run validate:governance`:
  - Attempt 1 -> FAIL only on `Manifest lineage checksum drift: config/runtime/deployment-topology.json` after registering the new runtime.
  - Updated `config/runtime/manifest-lineage.json` deployment-topology SHA-256 from `3750b2472f4a2b5a95698ae9f6dd447b865032b145f46ebb0dff2c3263d5cc31` to `3712bf07d46c456e478332c809c03bd20df76422289bedc16cae8e0328d09419`.
  - Attempt 2 -> PASS, governance validation passed 128/128 validators.
