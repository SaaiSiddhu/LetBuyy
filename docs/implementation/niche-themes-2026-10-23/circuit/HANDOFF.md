# Circuit M2 implementation handoff

Circuit v2 uses the approved Circuit storybook as its design target. The pure `createCircuitTheme(base)` factory retains the `letbuyy-forge` identity and creates version `2.0.0`. It does not install, publish or mutate a merchant document. Existing platform credential sections remain byte-identical, and existing cart, account, order and other canonical template definitions remain intact. Circuit styles those commerce surfaces through its scoped CSS.

The home composition leads with task collections and search, followed by a featured model, technical product cards, connector education and merchant-authored service information. Collection/search results use contained imagery and compact mobile rows. PDP specifications distinguish power input, power output, cable capacity and laptop pass-through. Device compatibility stays unconfirmed unless a specific model, source reference and valid source date are supplied. The factory retains canonical product gallery, variant and add-to-cart islands. It adds no compare tray, cart state, auth flow or payment path.

## Owned integration symbols

| File | Public symbols / purpose |
| --- | --- |
| `packages/theme-engine/src/circuit-theme.ts` | `createCircuitTheme`, `CIRCUIT_VERSION`, `CIRCUIT_SLUG` |
| `packages/theme-engine/src/circuit-styles.ts` | `CIRCUIT_CSS`; scoped semantic-token presentation |
| `packages/theme-engine/src/circuit-discovery.ts` | `CIRCUIT_DISCOVERY_INTRO`, `CIRCUIT_FILTERS`, `CIRCUIT_SORT`, `CIRCUIT_PAGINATION` |
| `packages/commerce-core/src/circuit-facts.ts` | `ElectronicsFactsSchema`, `ElectronicsConnectorSchema`, `ElectronicsFacts`, `readElectronicsFacts`, `normalizeElectronicsMeasurement` |
| `apps/commerce/web/src/lib/demo/circuit-demo.ts` | `CIRCUIT_DEMO_PRODUCTS`, `CIRCUIT_DEMO_COLLECTIONS`, `CIRCUIT_DEMO_NAVIGATION`, `circuitDemoNavigation(basePath)`, `withCircuitDemoContent(input)` |

Shared catalog dispatch and package exports belong to the coordinator and are now observed integrated. The actual public explicit-v2 catalog path is exercised by the owned demo and app-mapper tests. The demo helper returns unrelated, invalid and legacy inputs unchanged. It binds fictional preview resources only and performs no database writes. Four original approved M1 assets are optimized to 1000×1000 WebP, 24–54 KB each, under `apps/commerce/web/public/theme-assets/circuit/v2/`; `provenance.json` records generation prompts and asset digests.

## Public facts contract

Persist validated facts under `metadata.electronics`; expose only the allowlisted parsed leaf as `ProductModel.electronics` / Liquid `product.electronics`. No arbitrary metadata enters Liquid. The strict leaf supports manufacturer/model/kind, connector kind/role/count, W/Mb/s/mm values, exact video dimensions/Hz, product dimensions, host requirements, box contents, referenced device models and product fact-sheet provenance. Units remain canonical. `5 Gb/s → 5000 Mb/s`, `0.1 m → 100 mm` and `65000 mW → 65 W`; input/output/capacity/pass-through fields retain separate meanings. A fact sheet alone does not establish device compatibility.

The reader accepts an own data property named `electronics`, rejects inherited namespaces and accessors, and returns `null` for invalid facts. Strict object fields, array/text limits, finite positive measurements, real calendar dates and duplicate connector/device checks are tested. The shared namespace byte budget and HTTP validation remain coordinator-owned.

Collection/section product arrays encounter the existing Liquid drop depth limit before nested video/connector objects survive. Do not raise this limit. The card consumes these optional coordinator-derived scalar properties, created only from validated facts:

- `product.electronics_video_summary`: `3840 × 2160 / 30 Hz`, derived from the three video measurements.
- `product.electronics_output_connector_summary`: `2 × USB-C`, derived from connector rows with role `power-output`. This is optional; absent source facts remain absent.

Both scalar projections are implemented by the coordinator and verified through the actual app `productToLiquidDrop` mapper and actual Circuit render. The PDP reads its nested validated facts directly. Cards fall back to honest input/output/cable-capacity/data/length values when summaries are absent.

## Discovery contract

Facets render only when `collection.electronics_filters_enabled === true` and non-empty `collection.electronics_facets` exist. The server owns validated query execution, counts, sorting and paging. Rows must be flat and grouped contiguously by `key`:

```ts
electronics_facets: Array<{
  key: string; group_label: string; value: string; label: string;
  count?: number; selected: boolean;
}>;
electronics_active_filters: Array<{ key: string; value: string }>;
sort_options: Array<{ value: string; label: string; selected: boolean }>;
clear_filters_url?: string;
pagination: { page?: number; pages?: number; previous_url?: string; next_url?: string };
```

Native GET filter submissions preserve `search` and `sort`, include checked values and omit `page`. Native sort submissions preserve `search` and active filters and omit `page`. URLs are supplied by the server and passed through canonical URL handling. Without the server capability, Circuit renders usable basic search, product links and empty-result recovery, with no inert filter rail.

Variant-specific electronics facts are deferred pending the canonical durable variant-ID creation/persistence contract. The current create-variant payload has no durable ID/metadata correlation. No facts are keyed to mutable SKU or option strings. CG-7 and CG-5 are independent product models; finish/plug/length variants retain durable fixture IDs and actual independent stock.

## Observed evidence and remaining gates

- `unit.log`: 21/21 pass. Six strict facts tests, nine real Liquid rendering tests, three demo/catalog/media contract tests and three actual app-mapper→public-catalog→Liquid tests. Includes semantic DOM XSS checks, absent facts/media, enabled/disabled facets, actual native form data, shallow card summaries, canonical islands, unchanged platform credentials, immutable input and lossless document roundtrip. Inline navigation roots carry distinct real `data-block-id` attributes in preview and none publicly, using only server-generated `block.editor_attributes | raw` fragments. Merchant strings remain escaped.
- `resource-bindings.log`: 2/2 pass. Actual app `buildSectionDataPlan` with an explicitly supplied bounded preview catalog: a saved featured resource changes the rendered model, URL and price; clearing optional related resources resolves no products and hides the section. Network access throws within these fixtures, proving no hidden catalog fetch.
- `merchant-editor.log`: 5/5 mounted React tests pass; see the parent integration contract below.
- `commerce-typecheck.log`: `@letbuyy/commerce-core` typecheck exit 0.
- `demo-typecheck.log`: scoped demo/test TypeScript check exit 0; config is `demo-tsconfig.json`.
- `theme-typecheck.log`: full `@letbuyy/theme-engine` typecheck exit 0. The earlier MadeYours diagnostic was resolved by its owner/coordinator.
- `merchant-editor-typecheck.log`: scoped Circuit editor and test typecheck exit 0; config is `merchant-editor-tsconfig.json`.
- `merchant-editor-lint.log`: ESLint for the owned editor and test exits 0 without diagnostics.
- `package-audit.json`: canonical theme linter has zero errors and no newly introduced warnings; existing registry warnings remain advisory. Canonical packager produces a deterministic 74-file artifact manifest.

Earlier focused failures exposed credential schema reserialization, nested facet scrubbing and an overbroad string-based XSS assertion. They were fixed by preserving platform credential source, flattening supplied facets and asserting the parsed DOM. Expanded demo tests also caught and corrected a test-only relative asset path and optional canonical test typings. No production guard was weakened.

The isolated actual-Liquid review is complete: `visual-audit.json` records 33/33 cases passing after scoped fixes, with 27 PNGs under `actual-liquid-review/`. Six states (home, collection, PDP, missing media/facts, empty collection, invalid historical facts) were captured at 1440/834/390/320; home/collection/PDP also passed 200% root text at 834/390/320. Document width, body width, visible element bounds and text Range bounds are clean. Four actual Inter font weights loaded, local product images decoded and the observed text-contrast failures are zero. Fourteen keyboard stops have visible 2px focus outlines within the viewport; the closed mobile menu leaves the tab order. This is a bounded static check, not WCAG certification.

The pipeline uses the public explicit-v2 factory, real bounded app data binding, real app product mapper, canonical renderer and real `assembleLiquidPageFromRenderResult`. Approved M1 Inter font bytes were served locally for deterministic review; production font delivery and performance remain separate gates. No hydration or fake API was introduced. Scope and exact scenes are recorded in `render-review.json`; executable reproduction is `render-review.ts`, `review-server.cjs` and `capture-review.cjs`. The owned headless browser and 127.0.0.1:43272 server were closed, and slot 2 was explicitly released to the coordinator.

The review caught and fixed a low-contrast search button, redundant default overlay search control, closed offscreen navigation remaining visible/tabbable, header/card overflow under text enlargement, long heading overflow and an empty announcement link. Changes remain Circuit-scoped. M1 target files were preserved.

Actual shared electronics query/facet execution, merchant product-form persistence, complete catalog/demo dispatch, editor save/reload and publish/rollback lifecycle, hydrated commerce behavior, security/performance qualification and database-backed gates remain required. These checks are not end-to-end completion or deploy approval. No shared global gate, database reset, full build, production write, commit or deployment was performed by Circuit M2.

## Merchant electronics editor handoff

The named `CircuitFactsEditor` export is at `apps/merchant/web/src/components/products/niche-facts/circuit-facts-editor.tsx`, with a matching `.test.tsx`. It implements the shared `NicheFactsEditorProps` contract without editing that contract or the parent product form. It uses existing `@letbuyy/ui` fields/buttons and host token utilities, labelled fields with `useId`, canonical Zod field errors, bounded arrays, explicit units and deliberate clearing. Empty facts stay absent. Incomplete numeric text such as `-` or `1.` remains editable; invalid drafts are not coerced to zero or silently reset. Optional video/dimensions/source groups can be cleared as a unit.

The five actual mounted tests exercise emitted payloads (including exact connector roles, independent input/pass-through watts, video and specific-device source dates), canonical valid/invalid validation, incomplete decimal retention, unknown/omitted facts, removal, disabled controls, labels, hostile strings and parent form ownership. All action buttons are `type="button"`. There is no nested form, network, storage, authentication, new domain DTO or raw-JSON textarea. Product media and variant labels never generate factual claims.

The coordinator must mount this editor within the existing product save/conflict/version journey. Keep the controlled value as `unknown` while editing; validate `ElectronicsFactsSchema` before a write, preserve unrelated metadata namespaces, and delete `metadata.electronics` when `onChange(null)` is emitted. Never persist `{electronics:null}`. Parent save/reload/conflict/version, disabled permission states and merchant browser layout remain integration gates; component tests alone do not prove persistence.

Reproduction commands run the owned unit suite using the commerce app's declared dependencies via `NODE_PATH=/Volumes/Projects/LetBuyy/apps/commerce/web/node_modules`; server-only resource/render harnesses additionally use the commerce tsconfig and Node `--conditions react-server`. The merchant mounted suite runs from `apps/merchant/web` using its existing UI dependency boundary. No manifest or dependency was added.

Authority: `ARCH-R7/R8`, `WIN-R3/R4/R6`, `CODE-R1/R2/R6`, `TEST-R6/R7`, `UI` governance and the programme's exclusive implementation allocation. Approved M1 target files remain unchanged.


### Fresh Circuit settings contract repair

The fresh v2 factory now writes `headingFontFamily` and `bodyFontFamily` as Inter, matching its declared schema and rendered font-token contract. It no longer introduces `experienceId` as a current theme setting; `letbuyy-forge` identity and the established Forge preset remain unchanged. This edits the fresh package factory only, with no runtime stripping of merchant data, shared normalizer/registry change, or M1 change.

`factory-settings-unit.log` passes10/10, including real matching engine manifest validation before normalization and after a JSON-wire ThemeDocument roundtrip. The owned docs harness `factory-settings-source-probe.mjs` extracts the actual registry `buildBundleTemplateConfig` and editor helpers, then validates every Circuit template against its matching generated persistence manifest. `factory-settings-source-roundtrip.json` reports21/21 templates, zero baseline/wire issues and stable header/footer identities. Theme-engine noEmit passes. Exact source and bundle hashes are in `factory-settings-source-release.json`. This is source qualification only; no DB, build, browser, installed store or publish operation was performed.


### Circuit actual discovery form contract repair

The factory now consumes `collection.capabilities.electronics_filters`. Real supplied connector choices use repeated-OR checkboxes; other electronics keys use mutually exclusive radios with an empty Any choice. Filter forms preserve canonical discovery_query_fields except page and the keys actually being edited; sort omits only sort/page; search omits search/page. Canonical active_filters[].clear_url links provide independent removal. No local matcher or capability is fabricated.

`discovery/circuit-ui-unit.log` passes10/10, including actual FormData, scalar switching, repeated connectors, deliberate clearing and unedited scope fields. The independent oracle consumes the real shared projection, renders actual Circuit collection/search and passes all6 Circuit checks with zero findings/network. The full oracle still records other owners' failures. Actual editor normalization/compile/wire source checks remain21/21 and theme-engine noEmit passes. Exact hashes are in discovery/circuit-ui-source-release.json. Frozen M1, backend386 and other theme production sources are unchanged by this repair.


### Cross-theme discovery gate and canonical390 response metadata

The corrected independent UI oracle passes55/55 with zero skips, cancellation, network or source drift across24 actual Liquid renders. Its frozen pre390 receipt and complete artifacts are under discovery/ui-facet-contract/green-55-before390/. Original24/55 and frozen51/55 red artifacts remain preserved. Merchant-authored facet labels remain exact; only the canonical books_kind enum maps book→Books and stationery→Stationery. Actual386 physical measurement capability gaps remain pending backend390, independent of the passing UI contract and separately labelled synthetic positive cases. This is not installed/browser/SQL acceptance.

Root then allocated the existing canonical metadata schema and gateway raw reader only. Optional measurement_capabilities is now strict when present: all three members are required; equipment_length carries a boolean and ordered unique canonical unit subset with availability/nonempty consistency; width/depth capabilities each carry one strict boolean. Old386 absence is preserved. Malformed/partial/null/unknown/contradictory metadata fails closed. No query key, unit authority, interpreter, SQL, SDK, barrel, frontend or runtime was added. Four source hashes and the exact contract are in discovery/measurement390/source-release.json. Focused tests14/14, core/Gateway noEmit and byte-identical query JSON-schema parity pass. Threadline owns390 SQL; Trailmark owns the frontend measurement projection/consumer after release. Those integrations remain pending in this handoff.


### Accessible Circuit facet counts and post390 consumer UI gate

Circuit now keeps each visible bare count in its existing styled span with aria-hidden=true, and supplies explicit count semantics using the existing lb-sr-only helper. Actual computed names are e.g100 (4 matching products), with correct singular and zero-count text. A literal separating text-node space is required: the first computed-name probe caught adjacent inline text being flattened without one; that failed attempt is retained. No new IDs, custom roles, altered native radio/checkbox behavior or shared CSS were introduced.

The actual Liquid/JSDOM/dom-accessibility-api suite passes6/6, checking96 native choice names, grouping/legends, Any labels, visible counts, unchanged source labels/values and valid query-preserving FormData across collection/search and desktop/mobile forms with0/1/4 counts. Circuit regression10/10, editor source-wire21/21 and theme-engine noEmit pass. Exact leaf/bundle/harness hashes, reports, runtime versions and six actual HTMLs are under discovery/accessibility-counts/.

After the shared390 consumer releases, only the independently labelled positive physical fixtures were updated to carry the strict all3-member accepted measurement_capabilities response through the real raw reader/projector. Legacy numeric/unit facets are not capability authority, and main386 absence/recovery cases remain unchanged. The final55/55 oracle uses24 renders with no source drift/network and exact start/end hashes. New immutable checkpoint: discovery/ui-facet-contract/green-55-after390-consumers-accessible-counts/. Earlier red and green checkpoints remain intact. This is source UI/accessibility-name qualification, not SQL, browser, assistive-technology or installed-store acceptance; Root owns389 regeneration from the new bundle hash and further integration.
