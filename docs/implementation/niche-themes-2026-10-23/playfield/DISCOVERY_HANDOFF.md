# Playfield canonical discovery capability gates

The coordinator confirmed the exact Trailmark-owned projection contract. This change touches only Playfield's factory, discovery markup, scoped CSS selector, existing theme test and owned evidence/harness. Shared frontend and product-parent files remain untouched; the parent writer lease is released.

## Contract consumed

| Projection | Meaning and use |
|---|---|
| `collection.capabilities.discovery` | Validated server metadata exists; strict boolean true is required. |
| `collection.capabilities.toys_filters` | At least one actual valid age or interest facet is supplied. |
| `collection.capabilities.toys_age_band` | Actual age options supplied. Gates only the age chooser/entry links. |
| `collection.capabilities.toys_interest` | Actual interest options supplied. Gates only the interest chooser. |
| `collection.toy_facets.age_bands` / `.interests` | Finite `{value,label,count,selected}` rows from that same response. Labels, values and selected state are rendered directly through escaped Liquid. The relevant array must also be nonempty. |

The global Liquid depth4 budget is unchanged. The real validator/projection-to-Liquid DOM harness proves option rows, Hindi/English labels and selected booleans survive it. No backend capability is inferred from a query, product facts, sample content, local defaults or selected zero-count synthetic rows. Invalid age/interest facet values fail the canonical validator before projection.

The homepage finder and age entry links consume the same capabilities/options. With no actual metadata, the homepage offers ordinary search and browse. Installed bento destination defaults are ordinary `/products`; configured merchant URLs and the sample's explicit named collection links are preserved. There is no baked-in art/building/puzzles option set. Collection search and sort remain available independently of niche capabilities. A valid selected zero-result query remains independently clearable and retained through ordinary search/sort, without showing an unsupported chooser. GET filter changes reset pagination; canonical previous/next links retain the server query.

The new search inputs share the existing scoped control styling and 48px minimum height. Complete extracted CSS passes the repository Stylelint config. No browser/resource lease was opened for this slice.

## Evidence

`discovery-regression-tests.tap`: **37/37 pass**, combining the prior 29 module/mapper/variant cases with eight new actual discovery contract cases. `discovery-contract-tests.tap` records the eight cases separately; `discovery-theme-tests.tap` records the existing twelve theme cases.

The new harness imports the actual app `validateDiscoveryProductPage` and `projectDiscoveryPage`, uses canonical query/facet types and real product fixtures, selects the public v2 bundle, then parses actual Liquid-rendered DOM. It covers same-response options/selection at depth4; missing metadata with local facts and selected query; selected zero-count synthetic witnesses; each independently missing facet on home/collection; ordinary search/sort/independent clears and pagination; hostile label escaping; false/nonboolean/incomplete aliases; and rejected invalid server options. Synthetic response fixtures prove these client/render contracts, not a live API or database.

`discovery-sec4-tests.tap`: the unchanged generic SEC-4 depth guard passes. Engine and focused harness no-emit TypeScript checks pass. The previously exposed shared connector-array type error was fixed by its owner; this chat made no shared frontend edit. New discovery-module/test ESLint exits zero. An exploratory use of the commerce-app ESLint configuration over the entire branded theme source flags seven existing unchanged brand-hex literals in the factory/CSS; no broad package lint-green claim is made. `discovery-cross-app-eslint.log` preserves that result.

`discovery-wiring-receipt.json` pins the current owned source and shared read dependencies. `owned-verification.json` verifies all 113 frozen M1 artifacts, original artwork and archived renderer capture hashes remain unchanged. The 49-case browser audit predates this later capability update; it is not evidence of a new browser review. API/DB, hydrated commerce and lifecycle acceptance remain coordinator-owned gates.

```sh
TSX_TSCONFIG_PATH=apps/commerce/web/tsconfig.json node --conditions=react-server --import tsx --test docs/implementation/niche-themes-2026-10-23/playfield/playfield-discovery.test.ts
pnpm exec tsc -p docs/implementation/niche-themes-2026-10-23/playfield/discovery-wiring-tsconfig.json
pnpm exec tsc -p packages/theme-engine/tsconfig.json --noEmit --incremental false --composite false --rootDir packages/theme-engine/src
node --import tsx --test --test-name-pattern='SEC-4' packages/theme-engine/test/qi-security.test.ts
node docs/implementation/niche-themes-2026-10-23/playfield/verify-owned.mjs
```
