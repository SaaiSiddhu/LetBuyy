# CIR-C02: manufacturer and compatibility evidence

The approved Circuit capability pack proposes these two controls. Current canonical product facts can carry both values, but the strict discovery query, SQL flat facts and storefront electronics facet list expose neither. They remain an open acceptance gap. No shared source or migration is changed by this proposal.

Use the existing `StorefrontDiscoveryQuerySchema`, `browse_storefront_products_v1` path and same-response storefront projection. Keep merchant facts in `metadata.electronics`. There is no new product DTO, table, renderer or browser-side matcher. Migration 386 and the model-search correction remain immutable qualified history; any additive migration needs an allocator-assigned number and paired rollback.

The smallest proposed wire addition is:

| Key | Values | Predicate and display |
| --- | --- | --- |
| `electronics_manufacturer` | One trimmed, nonempty string, at most 120 characters | Equality using the existing SQL trim/lower convention against the **validated product electronics manufacturer**. Facet value uses that convention; label retains merchant casing. It is the accessory manufacturer, never the manufacturer of a referenced host device. |
| `compatibility_evidence` | `supplied` or `unconfirmed`; omitted means Any | `supplied` requires a valid electronics namespace with at least one specific device-model reference, source and real calendar date in `compatible_devices`. A valid namespace with no such rows is `unconfirmed`. Missing/invalid electronics facts match neither choice, preserving current strict fact handling. UI labels: “Device references supplied” and “Device compatibility unconfirmed”. |

This is a proposed contract for the shared owner's review, not an accepted extension. The distinction between valid unknown facts and absent/invalid electronics metadata must be retained in implementation and native tests. A general `fact_sheet`, connector, product name or model keyword cannot imply device compatibility. “Supplied” describes merchant evidence; it does not certify suitability for a buyer's device. No device selector or automatic compatibility detector is added.

Both keys are scalar. Repeated scalars, unknown enum values, overlong/manipulated text and unknown query keys fail validation. Preserve existing conjunction across different predicates, connector OR within that key, same available canonical candidate, product-distinct counts, variant UUIDs, stock rules, pagination and stable sort. Electronics facts remain product-level; cosmetic variants never override them.

Extend the existing SQL flat facts only after canonical namespace validation. Reuse current equality, facet counting/capping and candidate filtering. Count a product once even with multiple variants/references. Keep current filtered-result facet semantics; this proposal does not introduce disjunctive counts. Add the two keys to the storefront electronics label/set projection. Existing Liquid facets, search/sort forms, active chips and clear URLs should then consume the same server response. Controls remain hidden without response evidence; old responses must not silently ignore a requested filter.

The M1 acceptance also says “indexed allowlisted predicates.” Current source inspection shows candidate-time validated JSON flattening, not an established manufacturer/evidence index plan. A native plan/latency witness against the admitted bounded fixture is required before claiming that acceptance. Do not add a table, index or capability merely from this document; the shared owner must choose and verify the smallest change against the current database closure.

## Required qualification after allocation

1. Canonical schema/SQL parity, actual strict HTTP parsing and URL serialization: scalar/enum/length limits, repeated key denial, hostile literal text, case/trim behavior, no ignored filters.
2. Owned A collection positive control before genuine B collection denial. Search/category/collection/price/power/type combinations remain conjunctive; connector OR and same-candidate price/stock/UUID witnesses stay intact.
3. Positive sourced reference, valid empty evidence, absent/invalid namespace, general fact sheet only, connector only, impossible source date, universal-model claim, manufacturer/host-manufacturer confusion and private metadata isolation.
4. Distinct counts with several variants/references, real pagination beyond one page, deterministic sort, zero results, selected zero-count value, chip removal, clear one/all, search submission and reload retain the other filters.
5. Owned native baseline → additive migration → rollback → replay; preserve RLS/GUC/ACL/helper drift checks, all-ten existing predicates, model-only search and actual query-plan/performance evidence. Do not rerun the unchanged 386 qualification as a substitute.
6. In one newly admitted Editor browser slot, verify the actual saved/published source version and response lineage, accessible facet labels, keyboard behavior, mobile fit and authoritative catalogue/cart/history values. A source observation does not satisfy this gate.

Allocator action: accept/refine the bounded predicate/labels, assign the one shared writer and migration identity, then qualify source/native before admitting a runtime/browser. This Circuit proposal requests no runtime start, database adoption, provider call or production deployment.
