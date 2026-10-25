# Playfield implementation handoff

Status: owned Liquid/data modules, product/variant facts editors and explicit sample collection membership are ready. Static renderer browser QA passed for the archived fixtures. Variant parent persistence, hydrated commerce and lifecycle acceptance remain open. This is not a production-complete claim.

The approved design evidence remains in `docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/playfield-storybook/`. Implementation uses the canonical Liquid package, renderer, document model, gallery, variant picker, quantity, cart, wishlist and buyer routes (ARCH-R15, WIN-R4). No app, renderer, editor, auth, checkout or product-query authority was added.

## Owned modules

| File | Contract |
|---|---|
| `packages/theme-engine/src/playfield-theme.ts` | Pure `createPlayfieldTheme(base)` → cloned validated `LiquidThemePackageBundle`; version `2.0.0`, slug `letbuyy-bloom`, name `Playfield`. Ten retained editable block roots carry the preview-only `block.editor_attributes` hook without new block wrappers. |
| `packages/theme-engine/src/playfield-discovery.ts` | Canonical GET query controls: `age_band`, `interest`; independent clear actions preserve the other choice, search, category, prices and sort. Pagination consumes server URLs. |
| `packages/theme-engine/src/playfield-styles.ts` | Scoped cream/green Playfield layout, activity bento, whole-object cards, measured facts, canonical commerce/account styles and narrow/reduced-motion rules. |
| `packages/commerce-core/src/playfield-facts.ts` | `ToyFactsSchema`, `ToyVariantFactsSchema`, `readToyFacts`, `resolveToyFacts`, inferred types; bounded namespace `toys`. |
| `apps/commerce/web/src/lib/demo/playfield-demo.ts` | Canonical `ProductModel` sample catalog, navigation, collections, and `withPlayfieldDemoContent`; never an install seed. |
| `apps/commerce/web/public/theme-assets/playfield/v2/` | Four original approved artworks re-encoded to WebP, with SHA-256/source/dimension/size provenance. |
| `apps/merchant/web/src/components/products/niche-facts/playfield-facts-editor.tsx` | Named `PlayfieldFactsEditor`, controlled `NicheFactsEditorProps`; host UI/tokens, canonical field errors, editable incomplete drafts, deliberate removal, no API/storage or raw metadata textarea. See `EDITOR_HANDOFF.md`. |
| `apps/merchant/web/src/components/products/niche-facts/playfield-variant-facts-editor.tsx` | Named `PlayfieldVariantFactsEditor`, controlled `NicheVariantFactsEditorProps`; canonical partial-schema validation, read-only common context and distinct inherit/clear actions. See `VARIANT_EDITOR_HANDOFF.md`. |
| `apps/merchant/web/src/components/products/VariantFactsEditor.tsx` and `src/lib/variant-facts-draft.ts` | Compose all five real variant editors and retain raw metadata drafts. Single namespace clears preserve siblings; final clear emits explicit `{}`. The 69-case parent/wrapper/helper suite and scoped type checking pass; completed wiring and lease handoff are in `VARIANT_PARENT_HANDOFF.md`. |

Home order is a capability-gated age/interest opening (ordinary search/browse when metadata is absent) → activity bento → age entry → contents-rich grid → activity editorial → choosing information. Installed settings have no demonstration product images. Catalog preview alone supplies fictional artwork/products. Related products use edition-aware links rather than quick-adding an unresolved variant.

## Data and selected variant integration

`ToyFactsSchema` describes merchant statements about a product, never a child profile. Age choices are `3-5`, `6-8`, `9-12`. Interest/product-type values are bounded slugs. Contents quantities are positive integers; completeness is explicit. Measurements use cm/mm, require a finite positive dimension, and can name the measured object. Additional measurements always require a part label. Warnings require source labels and can identify an edition. No platform certification, invented safety badge, inferred material, generated age or child data is accepted.

`ToyVariantFactsSchema` is the inline namespace on the canonical variant command at `variant.metadata.toys`; public readback uses `variant.toys`. Variant identity belongs to the enclosing durable variant DTO; the payload rejects `variant_id`. Optional keys remain absent instead of applying product defaults. Arrays can be explicitly empty and primary dimensions explicitly null. `resolveToyFacts(common, selected)` handles those clears, resets inherited completeness for a replacement contents list, and removes a stale common prose age when a variant changes its age range. Invalid input returns null. Root owns the same-transaction variant persistence, aggregator, public serialization, canonical picker facts-update hook and accepted cart/order snapshot. Those integrations must pass before variant-specific facts can be considered complete.

Current sample product facts state that all Pattern Studio editions share the listed kit. Each preview variant now also carries its own canonical public `toys` contents and labelled measurements. Fixed preview IDs are synthetic display records, never variant create inputs. `playfield-variant-create-fixtures.json` contains ID-free canonical create payloads for root persistence QA; `playfield-variant-fixtures.test.ts` tests their domain resolution and real Liquid render. It does not prove persistence or picker interaction.

The rendered kit is 12 tiles + 2 idea cards + 1 tray = 15 items. Tray: 24 × 19 × 1.5 cm; each tile: 5 × 5 × 0.6 cm. Paper Play contains 36 A5 sheets; folded examples are illustrative. Arch Paths contains 6 arches; 18 cm refers to the largest arch. Make a Story intentionally lacks an image, age, contents and dimensions.

## Verification performed

- Owned unit/contract/real Liquid render tests: `module-tests.tap` (29 passing tests: 8 facts, 12 theme, 3 variant fixtures, 6 actual app mapper contracts).
- Nine mounted merchant editor tests pass (`editor-tests.tap`); focused component/test type checks and the exclusive CSS module's Stylelint check pass. Parent persistence and merchant browser acceptance remain separate gates.
- Thirteen mounted variant editor tests pass (`variant-editor-tests.tap`), with focused component/test type checking and scoped CSS Stylelint. No product defaults are inserted into partial override payloads.
- Four explicit collection membership tests pass (`collection-membership-tests.tap`), with demo/harness type checking. Named handle/ID routes and counts match the existing sample product IDs; missing/foreign membership never becomes all products.
- The current 69-case parent/wrapper/helper suite passes (`variant-parent-tests.tap`), including all 36 protected regressions, ten new real parent mounted cases, ten wrapper cases and thirteen helper cases. Partial facts, final `{}` clearing, retained invalid drafts, UUID isolation, immutable retries and explicit combination review are integrated into the shared new/edit page. Scoped TypeScript passes; ESLint has zero errors and the same eleven pre-existing harness warnings as the saved baseline. See `VARIANT_PARENT_HANDOFF.md`. The older 17-case TAP records the prior support-only checkpoint.
- Eight current actual page-validator → shared projection → public v2 → Liquid/DOM discovery cases pass. The current combined module/mapper/discovery cohort is 37/37; generic SEC-4, scoped TypeScript and CSS Stylelint pass. Each unsupported chooser stays hidden, actual response options replace hardcoded interests, and a homepage without metadata uses search/browse. See `DISCOVERY_HANDOFF.md`.
- Archived static Liquid browser review passes 49/49 cases with zero keyboard failures; 43 screenshots and scoped overflow/font/media/contrast/target/navigation checks are recorded in `visual-audit.json`. See `VISUAL_QA.md` for the pipeline and limits.
- `theme-engine` and `commerce-core` no-emit package type checks pass using explicit rootDir, with composite/incremental output disabled.
- Focused no-emit checks for the demo module and actual app mapper harness pass.
- Real renderer checks include exact contents/dimensions, escape handling and parsed-DOM active markup denial, canonical commerce islands, unknown facts/media, empty results, selected/independently cleared discovery, document roundtrip and merchant setting mutation.
- `playfield-app-mapper.test.ts` imports the actual app `productToLiquidDrop` and public package contracts, then renders the explicit v2 catalog bundle. It verifies all four sample collection cards, home/collection partial contents, PDP facts, variant card inheritance/clears, invalid fact rejection and unchanged default v1 output. The harness resolves the app's declared package exports without adding a theme-engine → commerce-core dependency.
- Original artwork bytes are frozen. WebP outputs total 387138 bytes; largest 163104 bytes.

Commands:

```sh
node --import tsx --test packages/theme-engine/test/playfield.test.ts packages/commerce-core/test/playfield-facts.test.ts
node --import tsx --test docs/implementation/niche-themes-2026-10-23/playfield/playfield-variant-fixtures.test.ts
node --import tsx --test docs/implementation/niche-themes-2026-10-23/playfield/playfield-app-mapper.test.ts
pnpm exec tsc -p packages/theme-engine/tsconfig.json --noEmit --incremental false --composite false --rootDir packages/theme-engine/src
pnpm exec tsc -p packages/commerce-core/tsconfig.json --noEmit --incremental false --composite false --rootDir packages/commerce-core/src
node docs/implementation/niche-themes-2026-10-23/playfield/prepare-assets.mjs
```

## Remaining acceptance

Coordinator owns central catalog/composition/public exports, preview dispatch, query/schema/SDK/API propagation, persistence and selected-variant contracts. Merchant editor and marketplace integration use their own leases. Synthetic mounted merchant create/edit/readback and recovery now pass; Playfield still needs browser/API/DB acceptance, age+interest real pagination, atomic selected-variant facts, server-authoritative cart/checkout/order snapshot, and lifecycle install → edit → save → publish → reopen → rollback acceptance.

The coordinator reports product fact controls are connected with 21 passing parent tests; those are separate from the owned leaf tests. Canonical partial-override parent wiring is complete under the coordinator grant; 69 mounted/pure cases and the lease release are recorded in `VARIANT_PARENT_HANDOFF.md`. Marketplace owns importing `PLAYFIELD_DEMO_COLLECTION_PRODUCT_IDS` into the shared dispatcher; details and limits are in `COLLECTION_MEMBERSHIP.md`.

**Collection depth gap resolved:** the shared mapper now derives validated `toys_card.ageLabel`, `contentsLabel`, `contentsComplete` and `hasOptions`. Playfield cards consume those bounded scalars. Actual collection and home render regressions pass with the global SEC-4 depth4 cap unchanged. Raw merchant metadata is not flattened into the public drop. Product details retain canonical `product.toys` facts.

The explicit catalog option `createFirstPartyCatalogBundle('letbuyy-bloom', { designVersion: '2.0.0' })` selects Playfield. The default Bloom/v1 package remains unchanged. This pure factory test does not certify marketplace/install/preview route dispatch.

The ten inline block roots use `{{ block.editor_attributes | raw }}`. An actual preview render proves two identically labelled FAQ roots have distinct stable IDs and public mode has no block metadata. Interactive editor selection/save/reopen acceptance remains pending.

No browser/process/port/DB fixture lease is held. Slot 2 was explicitly released after closing the owned browser/server and confirming port 43273 had no listener. No full shared build, production publication, real commerce operation, commit, push or deployment was run. Renderer-only captures do not replace the shared hydrated commerce and lifecycle gates. All 113 frozen M1 artifact hashes still match.

The later sample collection membership/handle/link update has pure resolver/type-check evidence, rather than a new browser capture. The archived 49-case audit pins its original HTML and screenshots and does not certify the subsequently updated category route integration.

The later capability-gate update also postdates those archived HTML/screenshots. Its current evidence is `discovery-regression-tests.tap` and the real projection-to-Liquid DOM harness, with unchanged generic depth4, scoped TypeScript and CSS Stylelint. No new browser/API/DB acceptance is claimed. The shared product-parent lease remains released.

The fresh-factory source gate is repaired: two unused inherited settings (`list-collections` subtitle and search-results title) are explicitly removed at factory construction. No runtime adapter strips merchant data. The actual registry helper and matching manifest validate raw and JSON-wire configs before normalization; full document JSON-wire values, all buyer templates and unchanged search/list-collections HTML are tested. Current targeted factory/render cohort: 30/30. See `FACTORY_SOURCE_HANDOFF.md`.

The independent form audit exposed query loss missed by the earlier helper, which collapsed repeated values. `QUERY_CONTINUITY_HANDOFF.md` supersedes the earlier narrow form-navigation claim: all forms now preserve canonical projected query fields, and independent clears use exact server URLs. The current 37-case targeted cohort uses actual FormData, URLSearchParams and the canonical repeated-value parser for collection/search, with seven new form cases, zero network calls and passing scoped TypeScript. The independent audit oracle remains coordinator/Circuit-owned and was not edited or run by Playfield; a concurrent source hash change was reported to the coordinator.

Read-only accessibility review of the immutable green-55-before390 checkpoint is complete:24 HTML artifacts (18 primary,4 synthetic physical,2 stationery),37 forms and177 data-entry controls. One consolidated Circuit count/name ambiguity affects32 options; two browser-review groups remain separate from defects. See accessibility-review/FINDINGS.md for owner/selectors/excerpts and exact limits. No browser/AT or real backend390 physical qualification is claimed; accepted source is unchanged.
