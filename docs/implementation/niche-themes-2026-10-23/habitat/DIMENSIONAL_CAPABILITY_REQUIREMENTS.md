# Furniture dimensional capability: reserved390 requirements review

**Historical review snapshot.** The accepted shared design uses the exact `measurement_capabilities.max_width_cm.available` and `.max_depth_cm.available` members alongside required `equipment_length`, not the illustrative `furniture_dimensions` object below. The released transport/projection and [Habitat consumer](MEASUREMENT_CAPABILITY_CONSUMER_HANDOFF.md) now implement that shape. This review's SQL/witness/rollback requirements remain qualification requirements; it is not evidence that390 SQL has run.

**Status: requirements only, not implemented or qualified.** This review informs the single canonical measurement-capability follow-up being drafted under [Threadline's measurement-discovery allocation](../../threadline-2026-10-22/measurement-discovery/390_measurement_discovery.up.draft.sql). That draft currently implements sports-only proposal text and explicitly records furniture as a gap. This document does not expand or amend its allocation, reserve a second migration, or modify source/SQL. The existing Habitat form implementation remains frozen.

The smallest missing furniture contract is **two same-response booleans, one for each existing query key**, derived from resolved, in-stock candidate facts in the current fully matched cohort **before pagination**. It needs neither numeric facets nor measurement ranges, counts, IDs, alternate-unit choices, relaxed queries or another discovery system.

## What the current source implements

| Evidence | Implemented behavior |
| --- | --- |
| [Canonical furniture facts](../../../../packages/commerce-core/src/habitat-facts.ts:8) | `assembled` and `package` are separate optional groups; supplied lengths are positive finite values at most 100,000 in `mm`, `cm` or `in`. A group may contain only width, only depth, height or diameter. Missing axes are unknown. |
| [Variant resolution](../../../../packages/commerce-core/src/habitat-facts.ts:61) and [386 flat facts](../../../../database/supabase/migrations/386_storefront_discovery.sql:184) | A supplied variant `assembled` object replaces the entire common group, including its unit. Omitted variant groups inherit; a width-only override does not inherit common depth. SQL validates raw namespaces and drops a malformed variant namespace from resolved furniture evidence. |
| [386 normalization](../../../../database/supabase/migrations/386_storefront_discovery.sql:179) and [axis extraction](../../../../database/supabase/migrations/386_storefront_discovery.sql:220) | Only resolved `assembled.width` and `assembled.depth` produce `_width_mm` / `_depth_mm`. Values normalize to millimetres (`mm × 1`, `cm × 10`, `in × 25.4`) rounded to three decimals. Source-unit labels remain supplied facts; normalization does not rewrite them. |
| [Query schema](../../../../packages/commerce-core/src/storefront-discovery.ts:34) and [386 matcher](../../../../database/supabase/migrations/386_storefront_discovery.sql:262) | Independent optional `max_width_cm` / `max_depth_cm` are positive finite numbers at most 1,000,000. A candidate passes when its normalized assembled axis is present and `axis_mm <= threshold_cm × 10`, inclusively. The query threshold is not rounded to a whole centimetre or to a display precision. |
| [386 candidates/matching](../../../../database/supabase/migrations/386_storefront_discovery.sql:297) | All active structured facts/options/price conditions must match the same available canonical candidate. Relational variants use `inventory_qty > 0`; a non-variant product uses product stock. There is no base-product fallback when relational variants exist. Existing basic browsing can retain sold-out products. |
| [386 response](../../../../database/supabase/migrations/386_storefront_discovery.sql:334) | Facets consume array facts and exclude private `_` keys. Normalized numeric axis scalars never become numeric facet choices. No per-width/per-depth capability is returned. Data, count, categorical facets and page-scoped matching witnesses are computed in one response. |
| [App projection](../../../../apps/commerce/web/src/lib/theme-engine/storefront-discovery.ts:80) | Active values missing from supplied facets become selected zero-count rows for recovery. The aggregate furniture flag means any supplied furniture facet, including material/finish. Neither that flag nor a selected numeric row proves support for a particular axis. |
| [Strict metadata](../../../../packages/commerce-core/src/storefront-discovery.ts:61) and [backend reader](../../../../services/api-gateway/src/lib/storefront-discovery.ts:9) | The present schemas do not accept a new capability field. A SQL-only response addition would be rejected. Shared transport/schema/reader/projection changes must be reviewed together before activation. |

The existing [owned-PG furniture test source](../../../../services/api-gateway/src/__tests__/owned-db/storefront-discovery.postgres.test.ts:78) asserts unit conversion and no cross-variant width/depth/material/finish stitching. Reading those assertions is not a new database execution or proof of the proposed capabilities.

## Minimum proposed response and meaning

Illustrative placement within the **same** `measurement_capabilities` object proposed for sports:

```json
{
  "measurement_capabilities": {
    "furniture_dimensions": {
      "max_width_cm": true,
      "max_depth_cm": false
    }
  }
}
```

The object name is a proposal for the shared owner to reconcile once; the required semantics are the two independent query-key booleans. The existing query keys fix the input unit to centimetres. The contract fixes the source to assembled dimensions. Repeating source/input-unit strings, an aggregate availability boolean, or arrays of supported units adds no necessary information. The original stored units remain `mm`/`cm`/`in`; furniture does not gain sports' `m` source unit or its paired exact-length query semantics.

For each axis, `true` requires **at least one candidate** from the existing fully filtered `matched_candidates` cohort that:

1. Belongs to the already authorized store and the same collection/search/product-ID scope, active-product/deletion rules and all current base restrictions.
2. Has canonical availability `quantity > 0`, even when basic browsing would show sold-out products.
3. Has valid resolved furniture facts and a positive normalized assembled value for that axis; no package, diameter, height, seat height, image, description, legacy variants JSON, or another variant supplies the axis.
4. Already satisfies **every active predicate** on that same candidate, including both thresholds if present, categorical facts, options and candidate price. Reuse the existing search behavior, including its candidate-specific facts; do not infer from product visibility alone.

The positive normalized-value condition avoids advertising a representable measurement when a tiny positive source rounds to zero millimetres. This adds a capability eligibility rule only; the current 386 matcher does not separately reject rounded-zero facts. Changing that existing query behavior would be a distinct, explicitly reviewed change and is not requested here.

Capability is computed over the matched cohort, not the page slice, raw variants table, store-wide inventory or a query with dimensions removed. This matches the sports draft's cohort rule and avoids a second scan/relaxed facet system. Each flag can have its own witness. With no dimension filter active, `true/true` can come from different candidates; it promises two supported inputs, not that one item fits any combined request. Once both thresholds are active, the existing conjunction must be satisfied on one candidate before either flag can use it as evidence. Do not add a joint-fit claim or stitch axes across variants.

## Zero results, legacy responses and buyer recovery

| Response condition | Required behavior |
| --- | --- |
| Matching in-stock axis exists outside the requested page, including an out-of-range page | Its flag remains true. Pagination, sort and limit cannot change capability for an otherwise identical query. |
| No matched candidates; active width and/or depth threshold | Both flags false. Keep each validated active threshold visible as an applied filter and preserved in unrelated forms. Supply its independent clear URL outside any availability-only controls. Clearing width preserves depth, and vice versa; reset page to 1. |
| Only sold-out candidates remain, or every matched candidate lacks that axis | That axis false, even if basic browsing returns products or categorical facets exist. |
| No capability extension in an older response | Unknown support. Hide new numeric controls; never infer true from an active threshold, facet fallback, product count, material/finish or cached prior response. Preserve valid active thresholds and recovery when the existing discovery response/query is otherwise accepted. This does not loosen existing errors for unsupported niche requests with no discovery metadata. |
| Capability object present with both keys false | Valid negative evidence for this cohort, distinct from the legacy unknown case. No positive-count facet is required to recover the active query. |
| Capability object present but malformed | Reject through the canonical sanitized unavailable/error path. Do not coerce strings/null to booleans, fill a missing axis from the other axis, or silently strip malformed evidence. |

No automatic relaxed query is needed for zero-result recovery. The buyer clears an active filter through the existing canonical link; the next actual response recomputes capabilities. Preserve search, category/country, fixed collection, sort, limit, repeated connectors and other niche filters. Clear-all must retain its existing server-defined semantics. A stale true capability never overrides a newer false/unknown response. The inputs describe maximum assembled dimensions; they do not guarantee room/access fit, orientation, package passage or delivery.

## Qualification required before exposing controls

These are **pending cases**, not newly passing tests. Integrate them into the single shared follow-up's existing contract/owned-PG/rollback plan.

| ID | Required fixture and expected result |
| --- | --- |
| HDC-01 | Valid assembled width only, in stock, no material/finish: width true, depth false. Depth-only fixture reverses the flags. Material/finish-only fixture has both false. |
| HDC-02 | Height/diameter/package/seat-height-only products: neither width nor depth inferred. Round furniture stays diameter-based until a separately authorized query contract exists. |
| HDC-03 | Equivalent 609.6 mm, 60.96 cm and 24 in widths normalize identically. Width threshold 60.96 cm matches; 60.9599 cm does not. Preserve original-unit facts in presentation. |
| HDC-04 | Common width/depth in cm, variant assembled width-only in inches: variant width available, depth unknown. No inherited depth or mixed unit. An omitted entire override inherits both axes. |
| HDC-05 | Invalid unit, nonpositive/over-limit value, missing unit, empty group, malformed selected namespace: no capability from that invalid candidate. A separate valid sibling may still witness its own capability. |
| HDC-06 | A: 24 × 30 in, Wood/Natural, available; B: 70 × 60 cm, Metal/Black, available. Width 61 + depth 61 yields zero and false/false; width 61 + depth 76.3 + wood/natural returns A only. Wood + Black cannot combine candidates. |
| HDC-07 | A supplied measurement on a sold-out variant cannot pair with a size/price/material match on an in-stock sibling. Base product stock or common facts cannot create a fallback candidate when relational variants exist. |
| HDC-08 | Product without relational variants uses positive product stock and its valid common assembled facts; zero/negative stock never witnesses a capability. Keep existing inventory semantics, including `track_inventory`, unchanged. |
| HDC-09 | Other-store/deleted/inactive/unselected-collection/product-ID-excluded/search-mismatching candidates cannot witness either flag. Category/country and candidate price/option/fact filters remain enforced. |
| HDC-10 | Width-only and depth-only variants in one product may advertise both controls without active thresholds; with both thresholds active neither incomplete variant can satisfy the conjunction. No synthetic combined variant or false fit claim. |
| HDC-11 | Match exists on another page; empty/out-of-range requested page still carries true capability. Identical query at different page/limit/sort retains both flags. |
| HDC-12 | Tight active threshold yields true zero results and false/false: collection and search both preserve exact width/depth in FormData and show each real clear link. Clear width retains depth and every unrelated value/repeated connector; page becomes 1. Re-query after clear can recover support. |
| HDC-13 | Older response omits extension; present false/false; present malformed object/string/null/missing axis/unknown keys: verify the three distinct legacy/negative/error behaviors, with no fabricated numeric facets. |
| HDC-14 | Tiny positive source normalizes to 0 mm: no positive capability. Exercise three-decimal normalization boundary/ties against PostgreSQL numeric semantics; do not change the comparator or round query thresholds. |
| HDC-15 | Entire pre/post extension response is equal after removing the new capability field: products/count, persisted base prices, matching price/witness IDs, categorical facet counts, ordering/pagination and repeated-filter semantics. No capability counts or IDs are emitted. |
| HDC-16 | Coordinated strict schemas/readers and both collection/search projections accept valid optional extension, reject malformed present extension, and consume per-axis flags directly. Real response → Liquid → FormData → canonical parser proves no duplicate scalars or unrelated-field loss. |
| HDC-17 | The shared paired UP/DOWN qualification preserves the original invoker scope, function ownership/ACLs/signatures/defaults, unrelated helper/body semantics and managed-catalog fences; DOWN restores the approved baseline and legacy response handling. No migration is executed by this review. |

The shared owner should extend the existing same-response capability design once, rather than emit synthetic `max_width_cm`/`max_depth_cm` categorical facets or add a Habitat-only endpoint/parser/normalizer. All source hashes reviewed are recorded in `dimensional-capability-review-sources.json`. No new runtime test, database, build or browser session was run for this document.
