# Measurement discovery — reserved migration 390 draft

**Status: native PostgreSQL and mounted gateway HTTP qualification GREEN; live storefront/browser acceptance pending.** Run `b07d0d6ed853` passed all10 groups, with no failures or skips, on a fresh owned through388 fixture using the docs390 pair. All15 pure conservation tests and the final gateway TypeScript check pass. Both drafts remain outside the active migration tree. No hosted change, app build or browser action was performed; held Threadline previews, credentials and tabs were untouched.

[Qualification evidence](native-qualification.json), [actual native TAP](native-runs/06-green/suite.tap) and [runner receipt with complete cleanup](native-runs/06-green/result.json) distinguish SQL/API proof from still-pending installed UI proof. The database lane was explicitly released to the coordinator after all runner-owned containers, networks and volumes were removed.

The draft adds three bounded capabilities to the existing `browse_storefront_products_v1` response and canonical `StorefrontDiscoveryMetadata`. Existing query shape, normalization, matching, availability, prices, pagination, categorical facets and witness semantics stay unchanged. No query backend, interpreter, helper-function family, schema authority or service is introduced.

## Evidence and the gap

The supplied all-nine in-process audit records **UI-TM-001**: the real386 response shape supplies no equipment-length unit evidence. The audit rendered actual Liquid with admitted synthetic metadata; it did not execute SQL or prove an installed storefront. Current Trailmark has a paired form correctly gated by supplied units. Current Habitat independently gates each dimension control on per-key proof. Neither UI should fabricate that missing proof.

Qualified386 emits validated normalized private `_equipment_length_mm`, `_width_mm` and `_depth_mm` values; its facets exclude private underscore keys and consume arrays, so those scalar measurements never become public threshold/unit facets. The matcher already supports exact paired equipment length and independent maximum assembled-width/depth thresholds. Reuse its existing fully filtered canonical candidates.

[Input hashes, body digests and revision chain](source-evidence.json) pin the source. [Habitat requirements](../../niche-themes-2026-10-23/habitat/DIMENSIONAL_CAPABILITY_REQUIREMENTS.md) informed the accepted axis semantics. Qualified386, current388 and held389 are not edited.

## Exact finite contract

The **entire** `measurement_capabilities` field is optional for older386 transport. **When present, all three strict children below are required**, with no unknown keys:

```ts
// Illustrative addition to the EXISTING canonical metadata authority.
measurement_capabilities?: {
  equipment_length: {
    available: boolean;
    allowed_units: NonNullable<StorefrontDiscoveryQuery['length_unit']>[];
  };
  max_width_cm: { available: boolean };
  max_depth_cm: { available: boolean };
};
```

```json
{
  "measurement_capabilities": {
    "equipment_length": { "available": true, "allowed_units": ["mm", "cm", "m", "in"] },
    "max_width_cm": { "available": false },
    "max_depth_cm": { "available": false }
  }
}
```

An absent object means older-response support is unknown. A present false leaf is negative evidence for this cohort. A partial object, missing leaf, null, coerced/string boolean, duplicate/unknown unit, unexpected field or inconsistent length availability is malformed and must follow the existing sanitized unavailable/error path. The equipment-only proposal was never shipped and is **not** an additional accepted transport shape.

Equipment units are a unique subset of the canonical `mm`, `cm`, `m`, `in` domain, in that stable order, maximum four strings. `equipment_length.available` is exactly equivalent to a nonempty `allowed_units` array. False means an empty array. Units describe supported **query representations**, not source-storage units or counted product facets. Furniture query units/operators are already fixed by `max_width_cm` / `max_depth_cm`; no extra unit array, numeric choices, ranges, counts, IDs or configurable operator is returned.

## Exact witness rules

Every capability uses `matched_candidates` **before pagination**, after **every current predicate**, and requires `quantity > 0` even when basic browsing retains sold-out products. Candidates remain relational canonical variants, or the existing product-stock candidate only when no relational variants exist. Store/collection/search/product-ID scope, deletion/active rules, options, prices and all structured filters remain enforced.

| Capability | Required validated witness on that candidate | Query representability |
| --- | --- | --- |
| Equipment length / each unit | Positive numeric `_equipment_length_mm` from resolved `sports.length` | Divide by the existing unit factor; result must be positive and <=100000. |
| Maximum width in cm | Positive numeric `_width_mm` from resolved **assembled.width** | Divide by10; threshold must be <=1000000cm. |
| Maximum depth in cm | Positive numeric `_depth_mm` from resolved **assembled.depth** | Divide by10; threshold must be <=1000000cm. |

Private normalized values come only from the existing validated flat-facts helper. Raw sibling metadata, product mirror variants, photographs, descriptions, package dimensions, diameter, height, seat height, grip circumference or another variant cannot supply a missing axis/length. Explicit invalid variant namespaces retain386 suppression. Omitted valid variant fields/groups inherit under existing rules. A supplied variant assembled group replaces the whole group and unit: width-only override never inherits common depth.

The width and depth booleans are independent supported inputs, **not a joint-fit claim**. Without active thresholds, width-only A and depth-only B may each witness their own true flag. With both thresholds active, neither incomplete variant can match the conjunction; both flags are then false unless a single fully matched available variant already satisfied both predicates. Never stitch axes, options, materials, finish or price across variants.

No relaxed query, extra catalog request or store-wide capability inference is used. Query presence does not create capability. An out-of-range/empty page can still carry true capabilities if another page in the same matched cohort contains a witness. Truly zero matches give all false and no units.

Normalization remains the existing round-to0.001mm behavior and factors mm=1/cm=10/m=1000/in=25.4. Furniture source units remain mm/cm/in; it does not gain a metre source unit or sports exact-length semantics. Furniture thresholds remain inclusive `axis_mm <= threshold_cm*10`, without rounding the requested threshold.

| Witness | Capability consequence |
| --- | --- |
| 254mm =25.4cm =10in equipment length | All four query units can be represented. |
| Equipment length100000m | Only `m`; other representations exceed100000. |
| Equipment length100000in | `m`, `in`; mm/cm exceed100000. |
| Assembled width609.6mm =60.96cm =24in | Width true; depth only if it independently has a witness. Threshold60.96cm matches;60.9599cm does not. |
| Missing/invalid/unavailable measurement | Corresponding leaf false; equipment units empty. |
| Positive source rounded to0mm | Corresponding leaf false. This conservative capability rule does not change386's existing quantization/matcher behavior. |

## Active-query recovery and UI mapping

Capability evidence and selected-query recovery remain separate. At zero results, retain valid current filters as **applied selections**, not supported unit choices, positive facets or fit claims.

- Length recovery shows the current value+unit and a paired clear outside the available-only form. Clear both `length_value` / `length_unit` and reset page1.
- Width/depth recovery shows each exact current threshold and its independent clear. Clearing width preserves depth, and vice versa.
- Every clear/form preserves unrelated search, sort, limit, collection scope, category, country and repeated connector values through the existing canonical URL/query helpers.
- Forward the validated optional object unchanged as `collection.measurement_capabilities`. Trailmark reads `collection.measurement_capabilities.equipment_length.available` and `.allowed_units` directly; Habitat reads `collection.measurement_capabilities.max_width_cm.available` and `.max_depth_cm.available` independently. Omit the whole object when absent; preserve the required all-three strict shape when present. Do not manufacture facets or reshape the capability into facet lists.
- No current selection plus no capability means no new corresponding chooser. Missing old metadata also does not advertise capability. An invalid present object is an error, not a fallback. A newer false/unknown response must supersede stale true evidence.
- Collection and search must consume the same response contract. Equipment fields submit as one pair with `step="any"` and server validation; furniture fields retain their independent cm-threshold semantics. No delivery/access/room-fit promise is made.

## Paired SQL and exact conservation

[UP draft](390_measurement_discovery.up.draft.sql) adds a four-row unit CTE and a single aggregate width/depth CTE over the existing materialized matched candidates, then the fixed three-child result field. [DOWN draft](390_measurement_discovery.down.draft.sql) restores the exact qualified386 browse definition and source bytes.

Both legs retain explicit **owner-grantor admission** as well as permitted grantees/options; preserving a preexisting bad grantor is insufficient. They explicitly reject effective EXECUTE for anon, authenticated, app_tenant and authenticator, including privilege gained through inherited role membership. These are admission checks, not permission mutations. The owned qualification must positively prove the owner/service-role baseline and named-role denial before introducing an inherited-role mutant. They pin the complete helper profiles before/after and replace the same function object only. No helper/table/overload is created; no GRANT/REVOKE/ALTER/DROP repairs drift. The qualified managed-catalog fence and actual lock checks remain.

The within-transaction conservation check permits only `prosrc` to change across the target `pg_proc` row. OID, owner, raw ACL/grantors/options, arguments/default AST, return type, language, cost/rows, volatility/strictness/parallel/support/definer flags and search_path remain exact. Comment and direct/shared dependency rows also remain exact. PostgREST notification occurs only after both checks in the same transaction. This is logical catalog/profile conservation, not physical MVCC tuple-byte identity.

| Revision | Target body MD5 |
| --- | --- |
| Qualified386 / exact DOWN body | `9af9d5e2e51052a874ffad94fc8088d6` |
| Preserved equipment-only proposal | `d754946fdac247295acd267c81e1031e` |
| Accepted three-capability proposal | `95cda4d15f36172c5457ad5045600cde` |

[Equipment-only files, evidence and full manifest](revisions/01-equipment-only/manifest.json) are preserved byte-for-byte. Their UP SHA256 is `b27e5ed7b476678004c9ea2a746fc8149a0af448908c5d96ecd1cea057f2be80`; DOWN is `2ccfcab46cf1b007eb9a97528f6d69a480e27d573cc189d69f5bca322b91776c`. The active expanded draft pins are in [source evidence](source-evidence.json) and [manifest](manifest.json).

Any later qualified helper-body/profile change requires root-reviewed rebasing. UP → DOWN → UP is the supported qualification replay. Repeated UP or repeated DOWN refuses the unexpected source state atomically. A hostile initial grantor/profile mutant must be rejected before replacement; neither leg normalizes it.

## Released consumers and remaining acceptance

Circuit's canonical metadata/schema and strict gateway reader, Trailmark's direct frontend projection and own consumer, and Habitat's independent numeric consumer were released by their owners. Reader-first support keeps the whole object optional for older386 and requires all three strict children when present. The native suite exercised that real reader and mounted worker; the source-only Liquid/form oracles are separately owned and do not establish installed browser acceptance.

Root review/admission of the exact qualified pair remains required before active migration/rollback promotion. Qualified386/current388 and held389 were not edited. The next live check must use a separately allocated fresh fixture containing the qualified390 pair and final released Trailmark/Habitat bundles, with new owned tabs. No existing owner preview, merchant login, editor or handoff fixture should be reused or mutated.

[Regression specifications](regression-cases.json) remain49 proposed permutations; they are **not49 claimed passing tests**. The native qualification records the exact10 executed groups. Live storefront/browser behavior, managed-provider fence execution and production-scale performance remain unqualified here.

## Executed owned-PG qualification

The allocated [measurement-discovery owned suite](../../../../services/api-gateway/src/__tests__/owned-db/storefront-measurement-discovery.postgres.test.ts) passed10/10 in a fresh proven-owned template using `--through-migration 388 --jobs 1 --no-reap`. It applied the exact docs drafts through `owned.script`, without active389/390 migration insertion. The [qualification receipt](native-qualification.json) pins SQL, native test source, final typed source, inputs, cleanup and limitations.

Actual checks cover equivalent equipment units and representability bounds; available same-variant option/price/measurement witnesses; independent assembled width/depth and inclusive unrounded thresholds; invalid/absent/sold-out suppression; atomic variant dimension overrides; no cross-variant joint fit; before-pagination capabilities;17 exact original-response parity queries across all nine other niche fact fixtures; real mounted HTTP for length, width, depth and a joint query with one RPC per request; malformed-response sanitized refusal; ACL/grantor/inherited-role admission mutants; and exact catalog/business-row recovery through UP/DOWN/UP.

The native inherited-role mutant restores both directions/options of role membership. D4 makes service_role a member of app_tenant, so its opposite edge is temporarily removed in the disposable cluster before testing a native inherited grant. Both edges/options and owner/service-role positive controls are restored in `finally`. Native GRANT mutants are undone with native REVOKE so their shared ACL dependencies are also removed. These test-only operations never targeted held/shared/managed clusters.

The strict guard found a real draft formatting defect: a leading newline in dynamic DDL changed `proargdefaults` source locations103/138 to104/139. An explicit BEGIN/ROLLBACK diagnostic proved this was the sole field difference and restored the full catalog. Both drafts remove that one newline; every prosrc-only conservation guard remains. Measurement bodies and original predicates are unchanged. [Revision03](revisions/03-before-default-ast-text-position-fix/) preserves the pre-fix draft bytes, tests and pure evidence.

Two test-fixture issues were also corrected: native ACL cleanup must restore dependencies, and a positive sports variant must use the canonical measurement-only variant namespace. Original red runs and an independent REST-readiness infrastructure failure are retained under [native runs](native-runs/). The green source needed one explicit TypeScript tuple annotation afterward; [emitted-code equivalence](native-runs/06-green/type-only-followup.json) proves no runtime/assertion change. Final gateway noEmit passes.

The measured function-call smoke was33.529ms on a finite synthetic fixture; the fixed capability object was144bytes. This is not an internal-plan or production-scale benchmark.

[Executed pure/source checks](contract-checks.test.ts) and [raw results](contract-checks.log) are15/15, including exact dynamic-DDL text positions. They support the separate native results. Earlier13/13 and14/14 receipts remain in revision archives. The coordinator registered this owned suite in the central inventory; this chat did not edit central governance files.
