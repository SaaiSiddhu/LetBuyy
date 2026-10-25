# Trailmark implementation — 23 October 2026

Trailmark’s owned theme, sports contracts, product/variant editors, demo assets and explicit collection memberships are implemented. Milestone 1’s approved storybook remains the visual target and is unchanged. This is implementation evidence, not architecture authority or production certification.

## Current checkpoint

- Domain 6/6, actual Liquid theme 10/10, controlled product editor 8/8 and controlled variant editor 7/7: **31 focused tests pass**.
- The owned app harness passes canonical ProductModel mapping → real Liquid rendering → native picker data parsing, and actual shared demo dispatch/collection resolution.
- Commerce/theme no-emit package checks and the current bounded TypeScript check including both editors/tests pass. The coordinator corrected the shared discovery coercion-input generic; the earlier TS2345 is resolved.
- Baseline browser review passed 32 responsive captures plus 6 stress/presentation cases. The final affected-source supplemental also passes all 7 cases after adaptive measurement columns and context-specific focus contrast repairs. All 11 recorded source hashes still match the captured current pipeline. This qualifies the static fixture scope, not integrated app or commerce behavior.
- The isolated Chrome/server on 43278 were closed/stopped and the lease explicitly released. No browser, DB or full-build resource is held here.

## Implemented source

- `packages/theme-engine/src/trailmark-theme.ts`: pure `createTrailmarkTheme(base)` returning validated 2.0.0 Liquid under stable `letbuyy-ride` / `ride` / catalogue UUID `7b669c70-0000-4000-8000-000000000006`. Input is cloned; matching v2 is idempotent; v1 releases are untouched. Home is activity masthead → real collection pathways → measured equipment cards → merchant guide → service content. Existing cart/account/content and canonical product gallery/variant/quantity/add-to-cart/wishlist/review/policy contracts survive. Identity credential sections do not receive the Trailmark wrapper. Editable inline block roots receive server-generated `block.editor_attributes | raw` only; actual preview DOM identification/public absence is tested.
- `trailmark-styles.ts`: theme-scoped semantic colors/fonts, dark activity chrome, light facts, contained 4:3 equipment imagery, desktop facets/mobile rows, reflow and reduced motion. Scoped repairs separate price/link text, preserve image geometry, align content, wrap long branding, maintain overlay text contrast and exclude closed mobile navigation from native tab order.
- `trailmark-discovery.ts`: canonical GET search and supplied sort/pagination. Equipment-specific controls appear only with actual server capability/facet data; preview fixtures do not fabricate that capability.
- `packages/commerce-core/src/trailmark-facts.ts`: strict bounded `SportsFactsSchema`, nonempty `SportsVariantFactsSchema`, inferred types, own-data-only `readSportsFacts`, and immutable `resolveSportsMeasurements`. Equipment measurements carry explicit units; garment facts remain in apparel. Missing compatibility stays absent/unconfirmed; a merchant-supplied claim requires a reference. Unknown keys/IDs inside variant facts, unsafe categories, invalid units and unbounded numbers are rejected.
- `apps/commerce/web/src/lib/demo/trailmark-demo.ts`: preview-only canonical ProductModel fixtures and guarded `withTrailmarkDemoContent`. No merchant installation seeding. `TRAILMARK_DEMO_COLLECTION_PRODUCT_IDS` declares Court time→all 3 products; Rackets→Rally68; Court accessories→shuttles then sleeve. Counts 3/1/2 match membership. The shared dispatcher now clones/uses this map.
- `apps/commerce/web/public/theme-assets/trailmark/v2/`: five encoded approved original images, 27–212 KB, maximum 1600 px wide. Source dimensions/hashes are recorded in `asset-provenance.json`.

## Bounded fact and picker projection

The generic Liquid sandbox depth limit remains 4. Root provides `product.sports_display` and `variant.sports_display`: derived scalar length/weight/grip/dimensions, validated from raw facts. They are not merchant inputs or parallel persisted truth. Cards and PDP use those scalars; bounded material/contents/conditions/care/compatibility remain raw facts.

The coordinator chose `variant.metadata.sports` for atomic create/edit and public `variant.sports`. The enclosing canonical variant owns its durable UUID. There is no product-level UUID map, mutable SKU association, client-generated identity or second save. Product-level facts are distinguished from each variant’s labelled resolved measurements.

`verify-demo.ts` uses the actual app mapper and canonical `parsePickerVariants` on the real rendered `data-variants` attribute. Durable IDs, Color/Grip circumference names/values and stock 0 survive the unchanged sandbox via the shared bounded options carrier. It also proves 68 cm/88 g cards,72 × 24 cm sleeve dimensions,84/88 mm variant facts, and invalid raw facts/forged display failing closed.

The same harness calls actual `resolveCatalogDemoContent` and `resolveCatalogDemoCollection`, verifying cloned mapping, named ID/handle selection, intentionally empty[], and null for foreign/missing/unknown membership. It creates no duplicate resolver/API.

## Merchant product and variant editors

`TrailmarkFactsEditor` uses shared `NicheFactsEditorProps`, host Button/Input/Select/Textarea/tokens, React useId and explicit labels. Raw controlled drafts retain incomplete values and use canonical product-schema errors. Units/references require deliberate input; unknown optional facts stay absent. Whole-namespace clear emits null as a removal intent, not persisted namespace:null. Included-content editing is bounded to 30 rendered rows with explicit clear recovery.

`TrailmarkVariantFactsEditor` uses shared `NicheVariantFactsEditorProps`. `commonFacts` means the raw product sports namespace; canonical presentation validates/derives its read-only common values. Its value uses the VARIANT schema. An absent override inherits the common whole measurement. A supplied override needs a complete value+unit; dimensions replace the whole length/width/optional-height/unit set. Removing the final override emits null, never an empty override. Invalid common facts get an explicit correction note. The editor owns no variant identity.

Neither editor nests a form or uses raw JSON controls, network, storage, factual defaults, garment sizes or safety certification. Tests cover actual edited payload, invalid partial retention/correction, omission/removal/inheritance, disabled semantics, labels, hostile text and historical data recovery. Product tests also exercise actual parent metadata composition: clearing removes sports while preserving unrelated metadata; incomplete facts block composition. The scoped typecheck includes both components/tests and shared props; JSDOM uses an explicit Window & typeof globalThis runtime surface without any/suppression.

Root owns the already-mounted product wrapper and the variant parent integration. Required acceptance is actual atomic create/edit/readback, returned version, conflict/recovery, tenant ownership and selected-variant order snapshots. A controlled UI or mocked parent success alone does not prove those gates.

## Browser evidence and final supplemental

`render-fixtures.ts` uses explicit shared v2 catalog dispatch → actual app mapper → LiquidRenderer → canonical app page assembly and a snapshot of app storefront CSS. Eight fixtures cover home, collection, search, racket, sleeve, clothing, missing product data and empty collection. Source/HTML hashes are in `render-fixtures.json`.

This static fixture supplies a document reset, local approved Inter 400/600/800 plus existing Pantry Inter 700, and fixed app-layout font/radius/card/input/text variables. It does not run Next routing, hydration, identity, DB, purchases or real filter queries. Menu/search open states are forced presentation states. Inter 800 is now requested in the shared font registry; live delivery still needs integrated-app verification.

Baseline `browser-audit.json`:8 scenes × 1440/834/390/320 px, plus200% text, Hindi expansion, long branding and open menu/search. Zero document/visible overflow, broken images, form controls below 44 px, contrast failures or JS errors. Minimum measured text contrast 6.35:1. Native 18 Tab traversal skips closed nav; variant focus is 3 px and native disclosure works.

Deeper visual inspection found activity text fragmentation in forced measurement columns at enlarged text. Columns now adapt with a minimum 9em track. Focus contrast was also corrected: accent on dark was 2.44:1; light outlines against dark are 13.46:1, and accent on light is 5.51:1. The granted supplemental now qualifies both repairs. `browser-supplemental-audit.json` records six racket/sleeve/clothing cases at 390/320 and product text at 200%, plus header-focus and close-up tile images. Body, document, visible-element and actual Range text bounds have zero overflow. Inter 400/600/700/800 FontFace entries are loaded; actual Canvas glyph probes differ from Arial fallback. Tile PNGs visually show whole readable words. Header focus measures 13.458:1, closed-nav native tab exclusion and disclosure pass, and all source pins match current files. Only owned Chrome/server PID5208 were closed/stopped, and the lease was explicitly released. `verification.json` records this checkpoint.

## Shared checkpoints and remaining gates

The coordinator reported 21 mounted product lifecycle tests, 11 owned atomic variant-persistence tests and 27 cart/picker/projection regressions passing. These complement leaf evidence; this chat did not rerun/certify those broader suites.

Shared discovery frontend is now released with 14/14 focused tests, all nine actual Liquid collection renders, 26/26 adjacent regressions and full commerce noEmit. Exact contract/source evidence is in `discovery-frontend/`. Circuit separately qualified backend discovery migration 386. The Trailmark inherited category-grid source gate is also released: 21/21 actual Editor registry/draft/JSON-wire roundtrips, 11/11 theme tests and both source/test noEmit checks pass (`factory-validation/`). Earlier static visual evidence retains its original source pins.

Remaining: integrated discovery/browser and variant-parent/snapshot acceptance; qualify the integrated app; complete install/editor/save/preview/publish/public storefront/cart/shared checkout/buyer account/recovery and security gates. No full shared build/governance gate, DB fixture, publication, provider call, merge, push or deployment has been performed here. A passing leaf phase is not end-to-end completion.


## Shopping form correction

`shopping-form/` records the bounded Trailmark form follow-up: all unedited canonical query rows and arrays survive Apply/sort; clears use supplied canonical links; length/unit submits and clears as a pair. Nine actual Liquid/FormData/parser tests, eleven Trailmark regressions, twenty-one Editor JSON-wire source roundtrips and scoped noEmit pass. Migration 386 currently supplies no `length_unit` facet, so new length controls remain hidden until the coordinator’s canonical backend follow-up. Existing valid pairs are preserved and clearable. Shared discovery/backend source and prior frozen captures were not changed here.


## Canonical measurement response consumer

`measurement390/` records the accepted canonical capability follow-up. The exact optional all-three measurement object passes through the existing frontend; Trailmark length controls now use its equipment capability independently of categorical facets. Zero-result/old-response recovery stays separate and preserves paired clears. Twenty frontend, nine form, eleven theme tests, twenty-one actual Editor JSON-wire roundtrips and full commerce/focused noEmit pass. No shared contract/SDK/SQL source changed here. Canonical390 live qualification, Habitat’s own axis consumer and final combined/integrated acceptance remain coordinator gates.
