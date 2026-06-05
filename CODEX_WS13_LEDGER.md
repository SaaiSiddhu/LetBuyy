# WS13 EXTENSION PLATFORM LEDGER - started 2026-06-05T04:59:20Z

## BASELINE
- Active mission: `docs/Codex_waves/CODEX_EXTENSION_PLATFORM_MISSION.md`.
- Source audit: `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md` identifies the missing Shopify-grade extension layer as Admin UI extensions, Checkout UI extensions, theme app blocks, and Functions.
- Predecessor state: WS11 published the portable Liquid app-block contract; WS12 published Admin/Storefront GraphQL, bulk operations, SDKs, and REST shim parity. Both retain deployed staging proof skips because staging credentials and seeded data are unavailable locally.
- Scope: `packages/app-engine/**`, new `packages/extension-host/**`, `services/api-gateway` extension/function dispatch routes, forward-only registry migrations, and narrow extension host mounts in `apps/merchant-control-plane/src/components/extensions/**` and `apps/storefront-runtime/src/components/checkout-extensions/**`.
- Boundary: extend existing OAuth/App-Bridge/app-install/billing behavior; do not rewrite it. Functions must be deterministic, Wasm-only, no fs/network, and time-bounded.

## PROGRESS LOG
- 2026-06-05T04:59:20Z [X0 baseline] Read WS13 mission, `memory/lessons.md`, `tasks/todo.md`, `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md` extension gap, and local AGENTS for `packages/app-engine`, `services/api-gateway`, `apps/merchant-control-plane`, and `apps/storefront-runtime`. Inventory confirmed existing `app_extensions`, `app_installations`, app OAuth/token exchange, admin embed-session, bridge/fetch, install/uninstall lifecycle events, webhook revocation, storefront app-block reads, WS11 Liquid app-block rendering, and checkout client mount point.
- 2026-06-05T04:59:20Z [X0 manifest contract] Declarative app manifest contract - DONE locally. Evidence: `packages/app-engine/src/index.ts` now exports `LETBUYY_APP_MANIFEST_SCHEMA_VERSION`, extension surface/target/function hook constants, Zod schemas for app manifests/extensions/functions, manual fail-closed normalization, `createExampleLetbuyyAppManifest()`, and `planAppManifestRegistration()` for X1 persistence planning. The example manifest declares one Admin UI extension, one Checkout UI extension, one theme app block, and one Wasm discount Function.
- 2026-06-05T04:59:45Z [X0 pre-commit gate] Full local gate - PASS. Evidence: `pnpm turbo typecheck` -> PASS (58/58 tasks); `pnpm run lint` -> PASS (9/9 tasks, existing warnings only); `pnpm run test` -> PASS (324/324 tests); generated artifact cleanup under `apps`, `services`, and `packages` -> PASS; `.DS_Store` scan under governed roots -> no matches; `pnpm run validate:governance` -> PASS (128/128 validators; 2808 tracked files scanned).

## CONTRACT PUBLISHED
- Manifest schema version: `2026-06-05.ws13`.
- Extension surfaces: `admin.ui`, `checkout.ui`, and `theme.app_block`.
- Admin targets: `admin.dashboard.widget`, `admin.settings.page`, `admin.product.action`, and `admin.order.action`.
- Checkout targets: `checkout.contact.render-after`, `checkout.shipping-options.render-after`, `checkout.payment-options.render-after`, `checkout.order-summary.render-after`, and `checkout.thank-you.render-after`.
- Theme app-block targets: `storefront.home.after-hero`, `storefront.product.after-form`, `storefront.collection.after-grid`, and `storefront.footer.before`.
- Function hooks: `cart.discount.calculate`, `checkout.shipping.rate`, `checkout.payment.customize`, and `checkout.validation.run`.
- Function runtime contract: `wasm` only, HTTPS module URL, 64-character SHA-256 digest, deterministic output, no fs/network by policy, 1-5ms timeout budget, and 64-1024KB memory budget.

## SKIPPED - NEEDS HUMAN
- [SKIP - NEEDS HUMAN] WS13 deployed staging extension proof - requires staging gateway/storefront/admin deployment credentials, seeded merchant/store/app/theme/checkout data, and an approved example partner app origin hosting admin UI, checkout UI, app-block assets, and Wasm module bytes.

## VALIDATOR LEDGER
- 2026-06-05T04:59:20Z X0 focused checks: `node --test tests/app-platform/extension-manifest.test.mjs` -> PASS (3/3); first `pnpm --filter @letbuyy/app-engine typecheck` failed on missing workspace links/shared-types declarations after generated-artifact cleanup plus source diagnostics; after fixing source diagnostics, sandbox `CI=true pnpm install --frozen-lockfile --force` failed on registry DNS, escalated rerun -> PASS with lockfile unchanged; `pnpm --filter @letbuyy/shared-types build` -> PASS; `pnpm --filter @letbuyy/app-engine typecheck` -> PASS; `node --test tests/app-platform/*.test.mjs` -> PASS (9/9).
- 2026-06-05T04:59:45Z X0 full pre-commit gate: `pnpm turbo typecheck` -> PASS (58/58 tasks); `pnpm run lint` -> PASS (9/9 tasks, existing warnings only); `pnpm run test` -> PASS (324/324 tests); artifact cleanup -> PASS; `.DS_Store` scan -> no matches; `pnpm run validate:governance` -> PASS (128/128 validators).
