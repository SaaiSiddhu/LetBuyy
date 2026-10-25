# Playfield 2.0.1 selected-facts source repair

**Implemented and source-verified; ready for independent root review. Installed acceptance remains open.** This is the precise later source allocation for Decision B. It does not hotpatch run `f6074d90e894`, rewrite 2.0.0, generate a persisted package capture, allocate a migration, or advance any installed lifecycle result.

When a shopper selected Paper or Unknown on the actual 2.0.0 PDP, the separate selected panel was correct while outer age, warning, contents, measurements and materials continued to describe common product facts. The append-only **2.0.1** template now declares targets for every one of those consumers. The existing native picker and `VariantFactsController` update them from the same actual variant's canonical resolved toy facts. Incomplete selections show an edition choice; Unknown removes cleared claims, Paper shows 36 paper sheets and its own dimensions/material, and returning to Inherited restores its real facts.

## Exact implementation scope

| Source | Change |
| --- | --- |
| New `packages/theme-engine/src/playfield-theme-v201.ts` | Derives a new package version from the untouched 2.0.0 factory. Changes only package version/sequence and PDP source. Declares versioned toy presentation, status, quick age, warning, contents/completeness, and measurement/material/finish/care targets. SSR does not show common facts as a selected edition. Setting-off removes the whole toy presentation. |
| `packages/theme-engine/src/first-party-theme-catalog.ts` | Adds the explicit in-memory builder opt-in `{ designVersion: '2.0.0', playfieldVersion: '2.0.1' }` only for Playfield. Default behavior, explicit 2.0.0 and the other nine catalog entries are unchanged. This flag is not wired to live catalog/persistence or install promotion. |
| `apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts` | Adds a public structured scalar for canonical `resolveToyFacts` output. Reserves all previous flat display carriers first, then uses remaining existing limits for structured facts. Raw partial variant toys remain partial; no private metadata is copied. |
| `apps/commerce/web/src/lib/theme-engine/variant-options-carrier.ts` | Adds typed canonical-schema validation and inert structured transport. Rejects private, malformed, accessor, sparse or oversized input. Combined flat/structured payload remains at most 32,768 bytes per row and 131,072 bytes per product; limits do not increase. |
| `apps/commerce/web/src/lib/theme-engine/variant-facts-controller.ts` | Adds toy rendering inside the existing controller, only for declared toy targets. Uses product/section ownership and actual constructor variant IDs. All consumers get the same selected ID; text nodes render facts and warning attribution. Missing data is explicit; disposal restores original nodes/attributes. Old class-only markup gets no compatibility adapter. |

Focused adjacent tests are new `packages/theme-engine/test/playfield-v201.test.ts` and `apps/commerce/web/src/lib/theme-engine/playfield-v201-facts.test.ts`. The exact allocated delta is `allocated-diff.patch`; existing shared dirty-tree work is not represented as our change. Exact source/diff hashes and commands are in `SOURCE_RELEASE.json`.

No form, domain merge/schema, cart, SQL, original 2.0.0 factory/style, hydration-island or current candidate source was edited. No class compatibility adapter, joined-text parsing, CSS suppression, parallel renderer or alternate mutation authority was introduced.

## Actual verification

| Check | Actual result |
| --- | --- |
| Final real Liquid/native picker, carrier, mapper, Food/Furniture/generic regressions and factory/catalog cases | **45 PASS, 0 FAIL, 0 SKIP** (`focused-final.tap`) |
| Existing Liquid adversarial/security suites | **28 PASS, 0 FAIL, 0 SKIP** (`liquid-security.tap`) |
| Commerce no-emit | Exit 0 (`commerce-noemit-final.log`) |
| Theme-engine no-emit | Exit 0 with explicit rootDir (`theme-noemit-final.log`) |
| Touched app source/test eslint | Exit 0 (`eslint.log`) |
| Real Liquid + native-island jsdom render proof | **9 saved HTML states**, zero live calls (`render-proof.json`, `rendered/`) |
| Previous builders | **All 20 default/2.0.0 JSON byte hashes match** their pre-change baseline, including all nine niche 2.0.0 outputs. The Playfield-only opt-in leaves the other nine entries equal. |

The 73 tests are source behavioral/security/contract regressions, not installed lifecycle cases. The nine DOM states are unselected, Inherited, Unknown, Paper, returned Inherited, explicit material clear, unavailable Paper, product-only and setting-off. All use explicitly synthetic source-test identities and the original approved toys recipe. Their IDs, stock and prices are source-test inputs, not fresh durable runtime readbacks.

The tests also exercise partial contents completeness, hostile text/attribution, foreign UUID/root refusal, independent product sections, unavailable/nonexistent/incomplete native options, setting-off, repeated disposal/remount and original node restoration. Old 2.0.0's outer-fact defect remains reproducible by design; it is not silently repaired under its immutable version.

An added edge case initially failed because absent product facts left an empty SSR warning region visible. The 2.0.1 condition now hides the empty region unless actual attributed warnings exist; its final test passes. Initial test type inference and an ambiguous standalone TypeScript project root were corrected without production configuration changes. Red/initial logs remain saved.

## Preservation and limits

Read-only verification matched **13 frozen sources**, **296 pinned artifacts** including all **113 original M1 files**, all **55 files in the sealed prior installed audit**, and **17 named source pins inside the active copied candidate**. The four allocated existing files are the only prior source paths changed by this allocation, alongside one new factory and two new test files. `preservation.json` records exact evidence. No previous report, failure input, archive or screenshot was overwritten.

This lease includes no browser. There are **no screenshots, responsive browser passes, screen-reader speech, installed 2.0.1 passes or production claims**. The HTML states preserve real rendered structure and the unchanged 2.0.0 CSS; actual layout/visual review at 320/768/1440 remains for a later allocated browser run. A source-only fixture contains no accepted order, stock mutation or server totals proof.

Exact-edition reload is a separate unimplemented PF-I05 obligation. `RELOAD_SELECTION_CONTRACT.md` records the bounded inspection; the frozen hydration source remains `9e87ff6b…`. No route/URL behavior was changed.

## Distribution proposal and next permitted work

Root can independently review and qualify this exact source delta. If admitted, the existing distribution owner must add Playfield **2.0.1 as a new immutable package/version capture**, retain all 2.0.0 content and historical releases, and use the canonical exact-version install/update/recovery flow. Inspect the then-current migration maximum before naming any migration; none is reserved here. Source SQL, persisted capture generation, catalog promotion, runtime rebuild and browser activity remain unallocated.

After an explicitly hashed corrected candidate and fixture/browser lease, repeat PF-I05's real selected-edition journey and visual/DOM review, complete the separate selected-edition reload obligation, and continue all unfinished installed cases with actual canonical readbacks/effect counts. The existing 9cd and f607 baselines keep their known PF-I05 failure until an actual corrected installed retest. The lifecycle follow-up stays active.
