# Playfield fresh factory source contract

Two unused inherited settings are removed only while constructing the fresh Playfield package:

- `templates.list-collections.sections.list-collections-grid.settings.subtitle` (`Browse every collection in the store.`).
- `templates.search.sections.search-results.settings.title` (`Results`).

The removal is guarded by each expected replacement section type. Neither value is referenced by the replacement Liquid, so adding editable schema fields would advertise content that the renderer does not use. The existing input bundle is cloned and remains unchanged. No schema/render fields are added, buyer templates removed, merchant drafts stripped, or shared normalizer/index/registry modified.

`factory-source-tests.tap` records **30/30 passing targeted tests**: 13 theme cases, three actual source/manifest cases, six actual app-mapper cases and eight discovery cases. Source and harness TypeScript checks pass.

The new docs harness reads and executes only the actual registry's three pure helper declarations, including `buildBundleTemplateConfig`; it does not import a service into the package or start the service. It uses the actual editor settings-schema adapter to construct the matching manifest runtime. The factory config itself is validated **before editor/template normalization** using the public engine validator. Both in-memory and actual `JSON.stringify`/`JSON.parse` wire configs return zero issues.

A full ThemeDocument V2 JSON-wire roundtrip retains the complete bundle values, template keys, instance identities and order arrays, then remains matching-manifest-valid. Reintroducing the two unsupported fields through that document adapter retains their raw merchant values and reproduces exactly the two original validation errors in memory and over JSON wire. This proves the strict gate remains active and no runtime strip was added. Actual Liquid output for search and list-collections is byte-identical with/without the two unused settings.

`factory-defaults-baseline.json` pins the pre-fix source hashes and original issue paths. `factory-source-receipt.json` contains exact current source hashes and read-only dependency hashes. The later factory receipt supersedes the two changed source hashes in the historical discovery checkpoint; historical receipts remain intact. All 113 frozen M1 artifacts and archived browser captures remain unchanged. No DB, migration, build, browser or promotion resource was started. Proposed migration 389 remains coordinator-owned and must be regenerated separately; these source tests do not claim installed/editor-browser acceptance.

```sh
TSX_TSCONFIG_PATH=apps/commerce/web/tsconfig.json node --conditions=react-server --import tsx --test packages/theme-engine/test/playfield.test.ts docs/implementation/niche-themes-2026-10-23/playfield/playfield-source-manifest.test.ts docs/implementation/niche-themes-2026-10-23/playfield/playfield-app-mapper.test.ts docs/implementation/niche-themes-2026-10-23/playfield/playfield-discovery.test.ts
pnpm exec tsc -p docs/implementation/niche-themes-2026-10-23/playfield/factory-source-tsconfig.json
node docs/implementation/niche-themes-2026-10-23/playfield/verify-owned.mjs
```
