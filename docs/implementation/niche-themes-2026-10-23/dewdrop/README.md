# Dewdrop implementation evidence

Dewdrop's version 2 Liquid module, strict beauty facts, original optimized assets and public sample catalog are implemented in the allocated files. The approved Milestone 1 storybook remains immutable. This folder records module and renderer presentation verification; shared app and merchant lifecycle acceptance remains open.

## Owned source

- `packages/theme-engine/src/dewdrop-theme.ts` — pure `createDewdropTheme(base: LiquidThemePackageBundle): LiquidThemePackageBundle`; stable `letbuyy-aura`, version `2.0.0`. Canonical section/document schemas and existing variant, cart, gallery, wishlist, header and account islands. No catalog dispatch import or alternate runtime.
- `packages/theme-engine/src/dewdrop-discovery.ts` — independently priced routine-stage rows, actual product links, GET discovery controls, server pagination and explicit unknown facts/media.
- `packages/theme-engine/src/dewdrop-styles.ts` — scoped warm limestone/sage presentation, Cormorant/Lato, responsive routine rows and named shade controls, focus/reduced-motion rules and canonical cart/account styling.
- `packages/commerce-core/src/dewdrop-facts.ts` — `BeautyFactsSchema`, inferred `BeautyFacts`, `BeautyShadeSchema`, inferred `BeautyShade`, and `readBeautyFacts(metadata: unknown): BeautyFacts | null`. Strict and bounded merchant-authored facts, never a Product DTO or medical/certification claim.
- `apps/commerce/web/src/lib/demo/dewdrop-demo.ts` — canonical `ProductModel[]`; `DEWDROP_DEMO_PRODUCTS`, `DEWDROP_DEMO_COLLECTIONS`, `DEWDROP_DEMO_COLLECTION_PRODUCT_IDS`, `DEWDROP_DEMO_NAVIGATION`, `withDewdropDemoContent`. Explicitly fictional public sample data only. Four products, separately purchasable; no installation seed.
- `apps/commerce/web/public/theme-assets/dewdrop/v2/` — four WebPs (312,776 bytes total) optimized from approved original artwork plus three local display-swap font files (433,384 bytes). Full hashes, dimensions and source provenance in `asset-manifest.json`.

## Contracts for shared integration

The coordinator owns central exports, metadata aggregation, canonical ProductModel/public product serialization, Liquid projection, query validation/RPC, versioned dispatch/compositions and migrations. Those shared files were not edited here.

`metadata.beauty` supplies `routineStage` (`cleanse`, `care`, `colour`), `format`, optional `netQuantity` (`value`, `unit` g/ml), ingredients/directions/warnings (missing/null/blank remain unknown), `shadeOptionName`, and `shades[]` (`value`, optional `code`, safe hex `color`, optional ingredient text). Defaults are schemaVersion 1, shadeOptionName Shade and an empty shade list. Duplicate named values are rejected; duplicate RGB values remain valid.

Each shade `value` refers to an exact canonical option value. It does not invent a variant UUID before product creation. Canonical mutation validation must check the configured option/value membership and save option renames with facts atomically. Purchase identity remains the actual `ProductVariant.id`. Variant input facts, if supplied, use `metadata.<namespace>` under the canonical mutation contract; the demo needs no additional variant metadata.

Liquid PDP consumes `product.beauty`. The renderer's global depth budget is unchanged. Its data-only scrub correctly removes deeper shade entries in product lists, so cards use coordinator-derived scalar `beauty.shadeCount` and `beauty.netQuantityLabel` from validated facts. Missing derived values remain absent; no count is guessed from colour or stock. Those derived display fields are not writable raw facts.

Discovery requests use `routine_stage`, `format`, `shade` and the existing sort/search/category contracts. Central product/collection/preview server queries and catalog-demo forwarding must support them before end-to-end discovery acceptance. Counts and page links come only from server pagination.

The factory constructs its three niche templates through canonical schemas. The coordinator must keep any shared Aura composition/registry consistent with the new package rather than replacing it with the v1 token overlay. The shared v2 Core-repair exemption, explicit designVersion dispatch and actual app fact mapper have landed and their Dewdrop regressions pass. Existing Aura v1 defaults remain on the prior path. Editable service block roots also include the coordinator-requested `{{ block.editor_attributes | raw }}` preview hook; two actual preview DOM block IDs and public-mode absence are verified; selection lifecycle remains for shared editor acceptance.

## Verification

`targeted-tests.log` records 34 passing tests: five strict facts/reader tests; ten actual Liquid render, escaping, missing data, exact option/variant identity, query/pagination, settings/blocks/resource round-trip and v1 preservation tests; three sample catalog/asset tests; three actual app mapper → Liquid/version-selection regressions; eight merchant facts-editor interaction tests; five actual shared collection resolver/route membership tests. The original v1 factory input is unmutated and all canonical non-commerce template functionality is preserved.

Commands:

```sh
node docs/implementation/niche-themes-2026-10-23/dewdrop/verify.cjs
```

Four no-emit checks and focused merchant ESLint have passed. The merchant editor uses the same targeted CLI options with `--jsx react-jsx`; exact commands and working directories are recorded in `verification.json`. `verification.json` records final command outcomes and hashes independently of ignored log files.

`render-fixtures.ts` invokes the real `LiquidRenderer` and canonical `assembleLiquidPageFromRenderResult`. The isolated fixture uses the actual `productToLiquidDrop` app mapper and explicit v2 catalog dispatch, supplies synthetic products and a minimal body-margin/input-font reset; it does not run the Next application or fake API calls. `render-fixtures.json` records four successful, warning-free renders. This is presentation evidence, not HTTP query or hydrated purchase acceptance.

The coordinator allocated isolated slot 1 and loopback port 43271. `capture-rendered.cjs` uses a fresh headless Chromium context with `chromiumSandbox:true`, DPR 1, blocked external requests and no user/IAB profiles. It captures home, collection, product and missing-data product at 1440×1000, 834×1112, 390×844 and 320×844, plus mobile text expansion and Hindi stress. All lazy images are decoded after scrolling before full-page export. `browser-audit.json` records body/document widths, broken images and element bounds. Intentional unfocused skip-link and closed offcanvas panel exclusions are explicit, with raw panel bounds retained. Body/document measurements are never filtered.

Native keyboard evidence checks separate Tab access with a visible 2 px ring for Pink Clay after Rosewater, Enter opening ingredient details and reduced-motion scroll behavior. It does not claim hydrated shade selection, unavailable-variant purchase rejection or cart mutation. Those require the shared app and owned fixture session.

## Remaining acceptance

- Published catalog/registry/composition consistency and full public read/write/query acceptance after the landed v2 factory and mapper integration.
- Merchant create/edit/reload, JSON/field editing, correct image/resource selection, save/recovery/publish/rollback/reinstall through canonical editor/API paths.
- Actual app browser: identical-colour named shades select different purchase UUIDs; unavailable Terracotta is rejected; quantity/cart/order snapshots use the selected canonical variant and server prices.
- Server discovery filter parity and pagination across public, collection and preview paths.
- Shared sample marketplace navigation, authenticated buyer/account/checkout journey and performance qualification after integration. No DB, build, migration, deployment or payment operation was performed here.

Final renderer audit: 18 screenshots/cases pass, including all four base scenes at all four viewports, text expansion and Hindi. No body/document or visible element overflow, broken images or primary controls below 44 px. The browser/context and owned server are closed; slot 1 was explicitly released to the coordinator. The navigation fix follows the canonical `data-open` state and removes a closed-panel shadow while preserving the same island and DOM.

The child remains responsible for Dewdrop-specific fixes during those later checks.

## Merchant facts editor allocation

`DewdropFactsEditor` and its matching test file are now implemented in the allocated merchant products/niche-facts directory. Eight ReactDOM/JSDOM tests pass and focused lint/type checking is green. The component preserves incomplete input, shows canonical field errors, selects existing product options, keeps identical-colour shade identities separate and clears with `null`. No new CSS, domain DTO, form, API call, network or storage was introduced. [Parent integration and remaining acceptance](facts-editor-handoff.md) describes exact raw-draft, namespace removal, membership, save/version/conflict and recovery responsibilities. Merchant browser and durable lifecycle acceptance remain open.

## Explicit catalog collection membership

The demo now exports `DEWDROP_DEMO_COLLECTION_PRODUCT_IDS`, with Cleanse → Cloud Rinse/Palm Wash, Care → Daily Veil, Colour → Soft Colour and matching 2/1/1 counts. Five additional tests pass against the actual common resolver/route parser, including explicit empty, foreign and missing membership. [Exact mapping and marketplace wiring](collection-membership-handoff.md) records the dispatcher dependency. No common helper or registration was edited here.

## All-nine historical order-facts support

A new shared pure `summarizeProductFacts` formatter and thin buyer/merchant `NicheOrderFacts` components are ready. Sixteen additional focused tests, two no-emit checks and buyer/merchant lint pass independently of the retained 34-test leaf qualification. [Order facts handoff and exact projection losses](order-facts-handoff.md) records the six owned source/test files and remaining canonical snapshot/readback/Liquid integrations. No second snapshot DTO/writer, current-product lookup or shared order route edit was introduced.

## Historical readback integration allocation

The subsequent authorized allocation now wires the canonical snapshot through the actual buyer gateway allowlist, private BFF, Liquid order mapper, mounted buyer fallback and mounted merchant order page. The formatter displays exact saved options for every niche, including Unicode/spaced names, without inferring measurements. The pure presentation decorator is registered by root for the nine niche v2 factories; Core/Threadline/default bytes remain excluded. [Readback handoff, ownership and limits](order-readback-handoff.md) records the complete path and released source lease.

`order-readback-verification.json` records 132 passing tests, five no-emit checks and two lint checks with no errors (one existing merchant unused-import warning), plus stable source hashes. This current cohort includes the prior formatter/wrapper cases and existing regressions, so it is not additive unique coverage over earlier receipts. No database/browser/full build was used in this allocation; durable database, production-worker, purchase-flow and public browser acceptance remain open.
