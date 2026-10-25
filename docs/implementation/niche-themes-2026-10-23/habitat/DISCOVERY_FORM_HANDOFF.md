# Habitat discovery form correction

**Historical M6 handoff.** The later [canonical capability consumer](MEASUREMENT_CAPABILITY_CONSUMER_HANDOFF.md) supersedes the positive-numeric-facet control path and resolves the consumer-side capability gap below. Earlier evidence remains preserved at its own pinned source stage.

Collection and search now use one Liquid GET form. Sort/apply preserve every unedited valid value from `collection.discovery_query_fields`, including limit, fixed collection, country/category, search, repeated connectors, and all other niche filters. Only page and the actual edited controls are excluded from hidden fields. Submissions reset to page 1. Newest is a supported sort choice. Both routes render `active_filters[].clear_url` and the server's `clear_filters_url`; independent clears and pagination retain the remaining query.

Material and finish are selects populated from supplied positive-count facet rows, with explicit empty choices and the current validated selection retained exactly. A selected matching option retains its actual normalized facet value and supplied merchant label, just as unselected options do. Only an unmatched current value gets the explicit `Current: …` fallback. Merchant-disabled or unsupported controls keep their values hidden rather than erasing them. Query values and labels pass through ordinary Liquid escaping.

## Numeric capability boundary

`furniture_filters_available` currently means **any** furniture facet. The shared projection also adds active numeric values to `furniture_facets` as synthetic zero-count rows. Neither proves the server supplied width/depth support. Habitat therefore enables each field only with a positive facet for that exact key. A threshold lacking that proof stays in the query as a hidden field and remains individually clearable. A supplied numeric field uses assembled centimetres, `step="any"` and the canonical 1,000,000 maximum; it never rounds values or derives package/access guarantees.

The actual migration 386 response represented by Circuit's independent report supplies material/finish choices and omits numeric threshold facets. Exposing numeric controls consistently, including zero-result pages, needs an authoritative per-key support contract distinguishable from selected fallback rows, with assembled/cm semantics. This is shared backend/projection work; no such capability has been fabricated locally. The positive numeric-facet test below establishes a transport/UI path only, and does not claim current SQL emits that metadata.

## Evidence

`discovery-form-roundtrip.test.ts` runs the actual backend payload reader, frontend page validator/projector, explicit Habitat v2 catalog bundle, Liquid renderer, JSDOM FormData, URLSearchParams and canonical parser. Eight cases cover both collection/search: every current canonical field, repeated connectors, sort/apply/search, clear-one/clear-all, pagination, absent metadata, merchant-disabled controls, selected synthetic numeric rows, an explicitly supplied per-key numeric facet and sub-decimal threshold preservation. No network call occurs.

```sh
TSX_TSCONFIG_PATH=apps/commerce/web/tsconfig.json node --conditions=react-server --import tsx --test packages/theme-engine/test/habitat.test.ts docs/implementation/niche-themes-2026-10-23/habitat/discovery-form-roundtrip.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false --composite false --rootDir . -p packages/theme-engine/tsconfig.json
node node_modules/typescript/bin/tsc -p docs/implementation/niche-themes-2026-10-23/habitat/tsconfig.finish-evidence.json
```

The recorded run has 21 passing cases (13 theme + 8 new discovery), zero skipped, and both focused no-emit checks pass. The earlier five historical-order cases remain preserved and were not repeated. Total owned passing cases across the existing suites: 54.

The narrow subsequent selected-label correction adds one direct selected/unselected merchant-label regression per route. `discovery-label-regression.tap` records **23 passing cases** (13 theme + 10 discovery), including all original eight FormData cases, with zero skipped. The focused evidence typecheck passes in `discovery-label-typecheck.log`. Total owned passing cases are now **56**. `discovery-label-source-manifest.json` pins the corrected discovery source and regression inputs; its exact hashes were released for Circuit and Editor rechecks, after which source was frozen again. No factory/shared source changed in that correction.

This correction changes the collection/search presentation after the earlier captures. Those screenshots and their pinned source receipts remain historical evidence; no new browser, DB, full build, HTTP purchase or installed-theme acceptance is claimed. Only owned Habitat source/tests/docs were edited. `discovery-source-manifest.json` pins the source inputs for this result.
