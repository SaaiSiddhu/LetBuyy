# Selected variant facts: shared UI handoff

The native picker owns selection. Facts are a bounded, read-only display projection keyed by its matched durable variant UUID; there is no window-wide selected-facts state and no new endpoint, storage, fetch or cart mutation. Existing `options_json`, price/stock selection and cart/dialog behavior remain authoritative.

## Source and entry

- `apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts` calls the existing validated domain presentation helpers and resolves toy groups with the existing `resolveToyFacts`. It retains raw validated public facts for no-JS/read-only Liquid lists. Each variant gains `facts_json`; the product also has a scalar `facts_json` for unvarianted Pantry pack display.
- `variant-options-carrier.ts` exports `encodeVariantFactPresentation`, `parseVariantFactPresentation`, display-only `VariantFactDisplay`, and existing `parsePickerVariants`. Parsed picker rows now include optional `label` and `factPresentation`. Facts are an explicit whitelist of food contents/value, furniture/sports measurements, resolved toy age/contents/dimensions/material/care/warnings and book edition display. No metadata/SKU/supplier/cost object is copied. Limits:32KiB UTF-8 per facts scalar,128KiB aggregate per product. Missing or invalid display facts do not discard a valid UUID/options carrier.
- `variant-facts-controller.ts` exports `VariantFactsController(section:HTMLElement,productId:string,currency:string,variants:PickerVariant[],productOnly=false)`, `update(variant:PickerVariant|null,state:'incomplete'|'unknown'|'selected'|'unavailable')`, and `dispose()`.
- Preferred integration/test entry remains `registerLiquidHydrationIslands()`: the actual `lb-variant-picker` creates and updates its controller directly. `lb-add-to-cart` initializes unvarianted food presentation only when its own product section has no picker. No cart mutation method was changed.

Every target must be inside the enclosing product's `[data-section-id]`. Add `data-product-id` to explicit targets so mismatched product data is never reused. Quantity changes are listened for only in that same section. Missing/unmatched/incomplete selections clear the previous selected display. Known matched out-of-stock options can show their own exact facts with an explicit unavailable status; purchase remains blocked. Whole dimension groups come from domain resolvers, never a second client merge.

## Pantry food hook

`[data-lb-food-presentation][data-product-id][data-facts]`, where `data-facts="{{ product.facts_json }}"` uses ordinary Liquid attribute escaping. It has useful static fallback children. The controller hides those children while mounted, appends `[data-lb-current-food]` with role=status/live/atomic and its current UUID/state, and restores the original children on disposal.

The current food region exposes `[data-lb-food-net-quantity]`, `[data-lb-food-unit-price]`, and `[data-lb-food-pack-context]` when supported. Per-pack contents and server-derived unit value stay separate from sellable pack count. Quantity context uses existing `foodPackSummary`; a blank, fractional, zero or unsupported count does not manufacture a total. A missing variant quantity never inherits common product net contents or parses an option label. Unknown quantity and OOS remain explicit.

## Habitat exact hook (implemented by Habitat owner)

One panel:
`[data-lb-variant-facts][data-lb-facts-namespace="furniture"][data-product-id]`.

Inside it, `[data-lb-variant-facts-status]` is a live status; seven `[data-lb-furniture-field]` slots use `assembled`, `package`, `weight`, `seat_height`, `materials`, `assembly`, `care`, each with `data-lb-facts-missing` text. Initial `data-lb-variant-facts-state="common"` content is captured as a common reference. A selected or unavailable matched UUID fills exact resolved `furniture_display` values and missing labels; an incomplete/unmatched selection restores the initial common text with explicit common/no-match status. Current `data-variant-id` and state are local to the panel. Initial values/status/state are restored on disposal.

The named finish/read-only list stays intact. The common table/schematic remains labelled common and is not silently relabelled as a selected variant.

## Other supported namespaces

An optional product-scoped `[data-lb-selected-variant-facts][data-product-id]` host can be supplied by a leaf owner. Otherwise a region is inserted immediately after the owning picker when supported facts exist. It uses a live selected/unavailable/unknown status and text-only `h3`/`dl`/`dt`/`dd` nodes for furniture (when no dedicated Habitat panel), sports, toys and books. No `innerHTML` is used for merchant text. Existing read-only variant rows and no-JS comparisons remain intact. Leaf owners may style this exact host in their own namespace; no factory other than Pantry was edited by this writer.

## Final verification and source release

The exact original root carrier/cart cohort remains27/27 green. With eight new native custom-element DOM cases, the final integrated cohort passes **35/35,0failures/0skips/0cancellations**. Run from `apps/commerce/web`: `node --import tsx --test src/lib/theme-engine/liquid-buy-now.test.ts src/lib/theme-engine/liquid-cart-island.test.ts src/lib/theme-engine/product-liquid-drop.test.ts src/lib/theme-engine/variant-options-carrier.test.ts src/lib/theme-engine/variant-facts-controller.test.ts`. Log: `variant-integrated-cohort.log`.

The tests exercise actual mapper → depth4 Liquid → sanitizer → native picker classes in JSDOM. Coverage includes two independent product sections; spaces/Hindi labels and exact UUIDs; per-pack value and quantity context without a fetch; incomplete/nonexistent/unknown/OOS selections; unvarianted contents; furniture/sports/toy/book whole-group resolution and inert hostile text; exact Habitat current slots/common restoration; section disposal/reconnect and an existing supplied host's original attributes; per-row/aggregate limits and private-key omission. No source-string assertion replaces the native path.

The initially red hostile-materials case reproduced the canonical JSON-filter bracket escaping defect. Editor fixed the existing serializer's encoding of both brackets and ampersand while preserving sanitizer/depth/limits. The actual hostile case and the complete cohort now pass. The unused alternate picker scalar prototype was removed; the one existing picker protocol remains. Raw valid care/material text stays intact for read-only Liquid lists.

Full commerce typecheck currently exits2 with **zero owned diagnostics** and four other-owner discoveryPreviewToken prop mismatches in collection/products/search/shop page callers. Exact evidence is in `variant-facts-typecheck.log`; no query/composition file was changed to hide that work-in-progress diagnostic.

All five shared mapper/parser/island/controller/test files are explicitly released to the coordinator with no pending edits. `selected-variant-source-release.json` pins final hashes, the Editor-owned renderer dependency and the small Pantry hook. Subsequent leaf owners need rerun only affected native selected-facts tests when those inputs change. No DB, shared IAB, fresh browser/server or heavy build was started, and immutable cart/order acceptance is not claimed by this DOM proof.
