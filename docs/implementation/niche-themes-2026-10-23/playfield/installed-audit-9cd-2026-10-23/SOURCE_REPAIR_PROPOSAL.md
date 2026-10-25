# PF-I05: read-only diagnosis and finite repair proposal

**Proposal only; no source or captured bundle changed.** Actual installed evidence establishes `PF-INSTALLED-FACTS-001`. A source-only probe independently reproduces it. Native LATEST392 qualification closure does not apply a repair to run 9cd or grant a factory/controller writer. The corrected shared fixture can retain this known failure while other lifecycle obligations proceed.

Recommendation: use **one canonical selected-toy presentation in the existing controller**, then choose explicitly between a bounded compatibility adapter for captured 2.0.0 and a new append-only package version with declared hooks. Existing 2.0.0 has **no declared toy slots** that can update its outer facts. A Liquid/hook change requires a new package version. An application-side compatibility adapter can preserve captured bytes but is a new runtime presentation contract requiring its own allocation, tests and render review.

## Exact cause and boundaries

1. `packages/theme-engine/src/playfield-theme.ts:16` renders `.pf-product-quick p` and `.pf-warning` from **common `product.toys`**. Line 17 renders `#playfield-product-facts`, `.pf-contents`, their numeric aggregate, dimensions, materials, finish and care from the same common object. Lines 35/38 insert those fragments around the canonical purchase controls. They have no `data-lb-toy-*` or `data-lb-facts-namespace="toys"` hook.
2. `apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts:53` builds each real variant's canonical presentation. It resolves `toys` using `resolveToyFacts` and supplies the resolved facts to `facts_json`. The raw variant `toys` property from `...facts` is a **partial variant override**, not a guaranteed complete resolved object. Reusing it as complete facts would resurrect or erase fields incorrectly.
3. `variant-options-carrier.ts:69` projects only bounded identity/options/price/stock/label and parsed `facts_json` to `PickerVariant`. Its toy display representation is flat strings. `encodeVariantFactPresentation` at line 161 preserves selected age/contents/dimension/material/warning text. It does not transport structured contents quantities, completeness, named measurement rows or warning attribution records as independently addressable data. Do not parse its joined prose back into domain facts or invent a total.
4. `variant-facts-controller.ts:36` owns explicit Food/Furniture targets. The generic branch at line 79 creates `[data-lb-selected-variant-facts]` after the picker, and `renderOtherFacts` at line 236 updates that panel. It never touches Playfield's outer selectors. The correct selected panel coexists with stale outer claims.
5. `liquid-hydration-islands.tsx:972` updates actual option inputs and `aria-pressed`; `applyAvailability` at line 994 resolves the matching durable variant, price, stock and selected facts. This path does not update or restore a selected-variant URL/history state. Bare-URL reload resets to unselected in saved actual evidence. This is a separate incomplete matrix obligation, not evidence that every bare PDP URL must persist prior state.

The canonical merge already handles omitted values, explicit `[]`/`null`/`""`, replacement contents completeness and incompatible inherited age prose in `packages/commerce-core/src/playfield-facts.ts:65`. It must stay the only merge authority. The actual selected cart snapshots are correct and schema-valid; this finding does not establish cart or order fact corruption.

## Choice A: scoped compatibility for existing captured 2.0.0

No bundle or factory bytes change. Extend the **existing** mapper/carrier/controller path with a bounded public resolved-toy payload, then a narrowly scoped adapter for Playfield's actual markup. This is possible, but is not an existing hook-based fix and must not be described as zero-risk.

| Exact source path to allocate | Finite change |
| --- | --- |
| `apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts` | Encode only canonical `resolveToyFacts` output for the owned actual variant; add a scalar carrier for structured selected toy facts. Retain current flat `facts_json` and all identity/price/cart contracts. |
| `apps/commerce/web/src/lib/theme-engine/variant-options-carrier.ts` | Decode an optional, bounded structured toy scalar into a typed `ToyFacts` value using the public canonical schema. Preserve present per-variant/product budgets and fail-closed handling. Do not promote raw partial `variant.toys` or private metadata. |
| `apps/commerce/web/src/lib/theme-engine/variant-facts-controller.ts` | Add one read-only toy renderer and compatibility target adapter. Bind all three outer consumers to the same selected UUID/facts; retain ownership checks, text-only DOM construction, status handling and reversible disposal. |
| Adjacent focused mapper/carrier/controller tests | Add exact supplied recipe, unknown/clear/cycle and whole-page assertions; preserve existing Food/Furniture/generic tests. |

The adapter must be limited to the nearest owned `[data-section-id]`/product and verified Playfield structure (`.pf-theme`, `.pf-product-quick`, `.pf-warning`, `#playfield-product-facts`), with strict expected cardinality. The baseline does not expose a trusted package-version hook; therefore those classes alone cannot prove “2.0.0 only.” If a version-limited adapter is required, root must additionally allocate a server-derived installed-package marker in the existing renderer path. Do not infer package/version from a buyer query parameter.

Do not leave a mixture of common and selected values. On a selected edition, render age, contents and completeness, named dimensions, materials, finish, care and attributed warnings from that same resolved object. Unknown fields get truthful not-supplied treatment. Empty warnings must remove stale warning statements without asserting safety. Render numbers/labels from structured data; do not keep the 15-total line when contents change. Preserve setting visibility, linked anchors and the layout's semantic grouping. On incomplete/invalid selection, show an explicit choice state without presenting common facts as selected-edition facts. Product-only mode keeps validated product facts. Unavailable variants may show their actual facts with purchase disabled. Dispose/remount must restore original nodes and attributes.

This option can correct an already installed capture while leaving its content hash intact. It needs actual before/after whole-page screenshot/DOM review because replacing unmarked content is brittle. A new generic second controller, a second merge implementation, or CSS-only suppression without correct replacement facts is rejected.

## Choice B: append-only package with declared slots (recommended distribution repair)

Keep the original `createPlayfieldTheme` 2.0.0 implementation and all captured bundles byte-for-byte. Add a version-specific factory/transform under a new, root-named file in `packages/theme-engine/src/`; select it only for the newly allocated Playfield package version through the existing `first-party-theme-catalog.ts` distribution path. That path currently accepts only `designVersion: '2.0.0'`; a new version needs explicit plumbing without relabeling the other eight niche captures or creating a second catalog.

The new package declares a toy presentation root and targets for **every** consumer: quick age, warning region, contents list/completeness total, dimensions/additional dimensions/materials/finish/care, with real product ownership and selection-status hooks. Example names such as `data-lb-variant-facts data-lb-facts-namespace="toys"` and typed toy-field/list targets are **proposed contract names**, not present support. Reuse the same structured carrier and the same renderer from Choice A; omit the class compatibility adapter if old 2.0.0 remains a frozen diagnostic baseline. Declare truthful unselected/product-only SSR and selected hydration behavior, with no unqualified stale common statements.

Exact additional allocation: a new Playfield version factory file, `packages/theme-engine/src/first-party-theme-catalog.ts` for explicit version selection, focused catalog/version tests, and the **existing** catalog capture/install/update distribution owner. Root chooses the actual version identifier, file name and any numbered migration only after inspecting the then-current max. No migration 393 is reserved or authored here. There is no schema/business-fact change or new runtime.

The immutable registry contract is explicit: `services/api-gateway/src/execution/schema-registry-execution.adapter.ts:511` forbids overwriting captures; line 540 uses duplicate-preserving version materialization; line 562 rejects changed validation capture, and line 613 rejects changed bundle content with `THEME_PACKAGE_VERSION_CONFLICT` and requires a new package version. Adding Liquid attributes under 2.0.0 would violate that contract even if the UI looked corrected.

Choose B for a durable declared markup contract while preserving old reproduction. Choose A only if root specifically needs existing 2.0.0 installations corrected without an upgrade. Implementing both should be justified by that real need; both must share one canonical renderer/merge path.

## Reload-selection obligation

PF-I05's exact-selected-edition reload remains open. The source path inspected has no reload selection contract, and the evidence reloads a URL without a variant selector. A future change should first use any established canonical product-link selection contract if one exists. If none exists, allocate a bounded URL contract separately: validate the durable variant belongs to the current product, derive all displayed options from that actual row, preserve unrelated parameters, reject unknown/foreign/ambiguous IDs, and keep canonical cart/server authorization. Do not use SKU, guessed UUID, local stale facts, submitted totals or a buyer-controlled metadata object as authority. No such change is included or claimed by this proposal.

## Required proof after a named source allocation

| Oracle | Required result |
| --- | --- |
| Whole actual 2.0.0 or new-version PDP through Inherited → Unknown → Paper → Inherited | All visible purchase facts and all target UUIDs move together. Inherited has 15 complete Wood items, blue finish, common dimensions/warning; Unknown has only inherited Wood and art, with no stale age/contents/dimensions/warning; Paper has 36 complete paper sheets, age 9–12, A5 21×14.8 cm, Paper and no stale height/tile/warning. Returning to Inherited restores its real statements. |
| Explicit material clear | After corrected live save/readback/reopen, Unknown `{materials:""}` does not resurrect Wood. Existing failed draft is not accepted proof. |
| Incomplete/unknown/unavailable/product-only + setting off | Truthful statuses; Add authority unchanged; no cross-product/hidden-section update; field absence never becomes a certification/safety claim. |
| Carrier and DOM security | Canonical strict validation, same byte/depth/row budgets, private keys/accessors excluded, script-like text stays text, multi-product scoping, repeated mount/dispose restores original state. Preserve sandbox/security gates. |
| Render parity | Real Liquid render and actual hydrated screenshots/AX at 320/768/1440 for supplied selections, empty/partial contents and warnings. Retain original M1 and old captures unchanged. Review layout, focus/announcement behavior, anchors and duplicated facts. |
| Regression and immutability | Current Food/Furniture/generic controller cases remain green; old 2.0.0 bundle hashes stay equal; changed content under old version is refused; new version install/recovery uses canonical existing owner flow. |
| Installed acceptance | Retest actual PF-I05 and PF-I06 on the specifically hashed corrected candidate. Continue PF-I07–14 through their real server journeys; no source test or snapshot-only assertion substitutes for them. |

These are proposed repair acceptance oracles, not executed passing tests. The only executed source probe reproduces the present defect. The two saved cart schema validations and eleven saved-evidence checks are independent audit checks.

## Other niche source comparison: bounded conclusions

| Niche | Source evidence | Conclusion |
| --- | --- | --- |
| Pantry | `pantry-facts.ts:13` allows only net quantity as a variant override. `pantry-theme.ts:27` declares `[data-lb-food-presentation]`; controller has the dedicated food renderer. | This specific common-ingredients/variant-net distinction does not establish the Playfield defect. No new runtime PASS claim. |
| Habitat | `habitat-theme.ts:22` labels common reference; line 36 declares furniture current fields; line 38 distinguishes common reference and named finish facts. Controller updates declared furniture fields. | Explicit current/common presentation exists. No new runtime PASS claim. |
| Trailmark | `trailmark-facts.ts:9` permits only measurements overrides. `trailmark-theme.ts:18–19` labels product-level measurements and named variant rows. | Source distinguishes reference and variant measurements. No automatic Playfield finding or runtime acceptance. |
| Marginalia | `marginalia-theme.ts:25` gates main edition rows when variants exist but leaves Author/Subjects common; line 44 always uses common `.mg-author`. `marginalia-facts.ts:12–14,34` permits edition author/subject overrides. | **SOURCE_CANDIDATE_NOT_LIVE_FAILURE** for common author/subject claims. Needs an owned fixture/selection witness; no repair scope added here. |

`VARIANT_NICHE_FACT_SCHEMAS` in `niche-product-facts.ts:31` declares five namespaces, not all nine. No all-nine failure or success assertion follows. Exact inspected source SHA-256 values are in `source-pins.json`.
