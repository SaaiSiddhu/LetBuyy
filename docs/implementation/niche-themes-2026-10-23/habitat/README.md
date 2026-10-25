# Habitat 2.0.0 implementation evidence

Habitat upgrades the existing `letbuyy-craft` identity through `createHabitatTheme(base)`. The pure factory clones the canonical Liquid bundle, changes its home/collection/product composition, and preserves the canonical cart, checkout, customer, gallery, variant, review and wishlist paths. The old input artifact remains untouched. This folder records implementation evidence; the approved 45-image storybook remains frozen.

## Owned work

- `packages/theme-engine/src/habitat-{theme,styles,discovery}.ts`: room index/panorama, large object cards, spatial PDP, separate assembled/package measurements, material/care/access information, independent related products and responsive styling.
- `packages/commerce-core/src/habitat-facts.ts`: strict bounded Zod facts, explicit units, omission handling and atomic measurement-group inheritance for a selected variant.
- `apps/commerce/web/src/lib/demo/habitat-demo.ts` and `public/theme-assets/habitat/v2/`: fictional preview products/resources plus four WebP derivatives of approved original assets. Installed merchant products receive no sample furniture facts or photographs.
- Two owned domain/theme test files: 17 passing tests, zero skipped. Assertions cover actual Liquid output, canonical islands, document roundtrip, merchant content/resource settings, opt-in room context, missing/invalid facts, escaping and the unchanged global drop-depth limit.

## Shared contract

The canonical write spelling is `product.metadata.furniture` / `variant.metadata.furniture`. The enclosing DTO alone owns the durable variant UUID. Public read models expose `product.furniture` / `variant.furniture`. The namespace contains no UUID map, SKU authority or duplicate save system.

`FurnitureFactsSchema` and `FurnitureVariantFactsSchema` accept optional assembled/package groups (`mm`, `cm`, `in`; positive finite supplied values), seat height, weight (`g`, `kg`), material strings, finish, assembly and care. Empty or omitted information stays unknown. `resolveFurnitureFacts` replaces each supplied measurement group including its unit; absent groups inherit. Unrelated/private metadata never becomes public furniture data.

Root owns persistence/metadata validators/public DTOs, catalog dispatch, query execution, projections, snapshots, migrations and shared hydration. Its derived `furniture_display` on product and variant exposes bounded scalar `assembled`, `package`, `weight`, `seat_height`, `materials`, `assembly`, `care` from validated raw facts. These display fields survive the unchanged global Liquid depth cap of four; they are presentation, not a second persisted authority. Habitat consumes them on cards and named-variant rows.

Existing integration hooks are `data-lb-variant-facts`, `data-lb-variant-facts-row` with the enclosing variant ID, and `data-lb-furniture-field` on common dimension/weight/seat-height fields. All named finishes remain readable without a new theme-specific controller. Dynamic selected-variant behavior remains a shared hydration acceptance check.

Collection and search share a GET form that preserves all unedited canonical query fields and repeated connectors. Material/finish choices require supplied facets; numeric controls independently consume the released exact `collection.measurement_capabilities.max_width_cm.available` and `.max_depth_cm.available` booleans. The aggregate furniture flag and all categorical/synthetic numeric facets never enable thresholds. Absent/false/merchant-disabled controls retain active values as hidden fields and server clear links. Root owns query execution, pagination URLs and capability projection. See `MEASUREMENT_CAPABILITY_CONSUMER_HANDOFF.md` for the current contract and actual FormData/parser evidence.

Custom Habitat sections use section settings. Retained/addable Core inline roots and the standalone badge now consume the renderer's conditional `block.editor_attributes | raw` fragment. Core FAQ blocks remain available under `faq-accordion`; the unchanged Habitat measurement guide has its own section type. Actual preview-ID/public-absence DOM checks cover both FAQ and badge roots.

## Verification

`targeted-tests.tap` records 16 passing owned domain/theme tests. `commerce-typecheck.log`, `theme-engine-typecheck.log` and `demo-typecheck.log` are successful no-emit checks (empty logs on success).

`render-fixtures.ts` runs the actual app `productToLiquidDrop` mapper, real `LiquidRenderer` and canonical page assembly. It asserts collection measurements, two separate finish packages/weights, round dimensions, variant material/assembly/care overrides, missing/invalid facts and private-field omission. `render-fixtures.json` lists the resulting HTML fixtures. The cross-boundary harness lives here to avoid introducing an undeclared commerce-core dependency into the theme-engine package.

`capture-rendered.cjs` ran in the coordinator-granted isolated slot, using a fresh sandboxed Chromium profile and own static server at `127.0.0.1:43274`. The 22 captures pass body/document/visible-content overflow and image checks at 1440/834/390/320 widths, 200% computed text enlargement and Hindi heading expansion. Native variant focus has a 2px outline, disclosures toggle and reduced motion uses automatic scrolling. CDP confirms real Libre Baskerville and Source Sans Pro glyphs. Eight sampled text pairs have contrast 5.15–12.54:1. `browser-audit.json` records the details; `responsive-review.png` is a QA crop montage, with full originals under `screenshots/`.

The review found and fixed two scoped CSS defects: browser-default blue header links and offscreen focusability of closed mobile navigation before hydration. Closed navigation is now invisible and cannot take focus; its canonical `data-open` state makes it visible. The audit directly exercises that existing attribute to check CSS, which does not prove hydrated menu operation. All owned browser/server resources closed; the isolated slot was explicitly released. Approved local fonts are used only for isolated presentation fixtures; actual app font delivery requires app verification.

`HabitatFactsEditor` is now implemented in the allocated merchant `niche-facts/` folder. It uses existing UI primitives/tokens and the shared controlled draft props. Six mounted React interaction tests and a focused component/test TypeScript check pass. See `FACTS_EDITOR_HANDOFF.md` for the exact parent save/removal/error contract. Parent integration and merchant browser acceptance remain pending.

`HabitatVariantFactsEditor` now supplies optional controlled overrides validated with the canonical variant schema, with common facts shown only as reference. Eight mounted interaction tests and its component/test no-emit check pass. Two explicit demo membership tests pass. See `VARIANT_FACTS_EDITOR_HANDOFF.md` for inheritance, atomic group replacement and shared parent requirements. Total owned passing tests across these suites: 32, zero skipped.

Three additional tests in `section-acceptance.test.ts` establish that the separate measurement guide is accepted as a **bundle-owned Liquid section**: strict full bundle/document roundtrip, canonical persistence manifest/schema and full draft validation, real storefront resolver/data-planner behavior and actual edited-title Liquid output. The full template config remains below the unchanged 256,000-character validation limit. The global section registry does not register this type, and validation without its package schema rejects it. Both `theme-governance-validator.log` and `no-new-react-sections-validator.log` pass. Total owned passing tests including these checks: 35, zero skipped. No React section or runtime was added.

After the retained-section correction, seven actual mapper fixtures were refreshed. Home, collection and missing-product HTML matches the earlier captured files exactly; four PDP hashes changed. `rendered-refresh-check.json` records this boundary. The 22 screenshots above describe the earlier captured source; final-source PDP and composed editor/commerce browser acceptance remains pending.

Current status and remaining shared acceptance are in `STATUS.json`. Static actual-render fixtures do not establish merchant install/edit/save/publish/rollback, API/RLS persistence, selected-variant/cart hydration, order snapshots or production readiness.

## Reproduce bounded checks

```sh
node --import tsx --test packages/commerce-core/test/habitat-facts.test.ts packages/theme-engine/test/habitat.test.ts
node --import tsx docs/implementation/niche-themes-2026-10-23/habitat/render-fixtures.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false --composite false -p packages/commerce-core/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --incremental false --composite false --rootDir . -p packages/theme-engine/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --esModuleInterop --module ESNext --moduleResolution Bundler --target ES2022 --rootDir . apps/commerce/web/src/lib/demo/habitat-demo.ts
```

Run browser capture only after the coordinator explicitly allocates the slot. No full build, shared browser, DB mutation, push or deployment is covered by this handoff.

The current selected-finish slice is documented in `SELECTED_FINISH_HANDOFF.md`: 17 domain/theme + 2 actual binder/render + 3 real picker/controller cases pass, alongside the earlier editor/membership/guide suites (41 passing owned tests). The shared JSON serializer hostile-text regression is fixed and the scoped evidence typecheck passes. Final supplemental evidence comprises the preserved 25-image pass plus a separate five-image FAQ gutter correction, both with stable source hashes; original 22 captures remain untouched.

The subsequent actual snapshot → order normalizer → customer/order mapper → v2 Liquid roundtrip passes five cases, including exact saved option names, food/beauty controls, money/status conservation, unknown legacy data and unchanged history after catalog mutation/deletion. The genuine missing-option projection red result is preserved; the shared owner fixed it without relaxing the Liquid key policy. See `HISTORICAL_ORDER_HANDOFF.md`. Total owned passing tests: **46**, zero skipped. Real DB/HTTP/cart/provider/composed browser qualification remains central work.

Eight later collection/search form cases verify real Liquid → FormData → canonical query roundtrips, all unedited filters, repeated connectors, independent clear links, pagination and honest capability handling. These and the 13 existing theme cases pass; theme/evidence no-emit checks pass. Total owned passing cases: **54**, zero skipped. Historical-order evidence is preserved without a repeat run. Earlier collection/search captures predate this form correction; browser/SQL/HTTP acceptance was not run in this slice.

The subsequent [dimensional capability review](DIMENSIONAL_CAPABILITY_REQUIREMENTS.md) specifies the smallest per-width/per-depth response extension and 17 pending qualification cases for the shared reserved390 proposal. It is requirements only: all 13 reviewed source inputs were unchanged during the review, with hashes in `dimensional-capability-review-sources.json`. No SQL, runtime source, test execution, DB, build or browser work was performed for that review.

The later authorized selected-label correction changes only the Habitat discovery fragment and its own regression harness. Selected and unselected matches retain the supplied merchant label and normalized value; unmatched current selections are explicitly marked `Current: …`. All original eight FormData cases plus two label cases and 13 theme cases pass (23 total), and the focused evidence typecheck passes. Latest total owned passing cases: **56**, zero skipped. `discovery-label-source-manifest.json` records the exact source hashes released to the coordinator; source is frozen again.

After the shared projection release, the authorized canonical measurement consumer replaces synthetic numeric-facet enablement with the exact independent per-axis capability booleans. The current **29/29** run covers 16 actual discovery contracts and 13 theme cases; both focused typechecks pass. Total passing owned cases across preserved suites: **62**, zero skipped. `measurement-consumer-source-manifest.json` pins the released frozen source and shared inputs. See [the current handoff](MEASUREMENT_CAPABILITY_CONSUMER_HANDOFF.md). No DB/build/browser/SQL or historical-order repeat run occurred; real390 and composed acceptance remain shared work.

The [installed lifecycle matrix](installed-lifecycle-matrix.md) now prepares Editor's existing fresh run: exact canonical recipe/update/query payloads, real options/variant/stock cases, local COD and immutable history expectations. Its pure canonical validation and focused no-emit check pass, with receipts in `installed-fixture-schema-validation.json` and `installed-fixture-validator-typecheck.log`. All **17 installed lifecycle cases and nine query cases remain NOT_RUN**. No fixture, seed, DB, runtime write or browser session was created; released runtime source hashes remain unchanged.
