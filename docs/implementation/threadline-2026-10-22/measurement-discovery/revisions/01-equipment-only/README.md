# Measurement discovery — reserved migration 390 proposal

**Status: documentation and SQL draft only.** No production source was changed and no SQL, database fixture, app build, browser action or cleanup was started. Migration 390 is reserved for root review; neither draft is in the active migration tree. Existing held fixtures, owner previews, credentials and tabs remain untouched.

The smallest proposed change adds one bounded measurement capability to the existing `browse_storefront_products_v1` response and canonical `StorefrontDiscoveryMetadata`. Query shape, normalization, matching, availability, prices, pagination, facets and all existing witness semantics stay unchanged. This is not another query backend, interpreter, helper-function family or service.

## Evidence and the actual gap

The supplied all-nine in-process UI audit records **UI-TM-001**: paired `length_value` / `length_unit` controls cannot be advertised from the real 386 response shape. That audit rendered real Liquid templates with admitted synthetic response metadata; it did **not** execute SQL or prove an installed storefront. Its other findings are outside this proposal and may have subsequent owner repairs.

The inspected qualified 386 source:

- `storefront_discovery_flat_v1` validates and resolves the sports namespace, then emits private `_equipment_length_mm` (migration 386, line 239).
- `storefront_discovery_match_v1` uses that normalized value for the paired length predicate (lines 265–267).
- `matched_candidates` enforces current predicates on one candidate variant. Facets require `quantity > 0` and exclude underscore-prefixed keys (lines 313–340).
- Neither an equipment-length unit facet nor an independent capability is returned. The app projection currently fills `sports_facets.length_units` only from supplied `length_unit` facets, which 386 does not emit.
- The current Trailmark source has a separate paired length form, correctly gated by supplied `length_units`. Its current query-preserving form work does not create missing server evidence.

[Input hashes and exact function-body digests](source-evidence.json) pin the inspected authority. Qualified 386 and its rollback remain unedited. Current 388 and reserved 389 are outside this task.

## Exact additive contract

Add this **optional, strictly validated** field to the existing canonical metadata, and the corresponding raw RPC result:

```ts
// Illustrative addition to the existing type, not a new DTO authority.
measurement_capabilities?: {
  equipment_length: {
    available: boolean;
    allowed_units: NonNullable<StorefrontDiscoveryQuery['length_unit']>[];
  };
};
```

The sole field is equipment **length**, not sports package dimensions, grip circumference, apparel size or furniture dimensions. No client-supplied metadata is accepted as capability authority.

```json
{
  "measurement_capabilities": {
    "equipment_length": {
      "available": true,
      "allowed_units": ["mm", "cm", "m", "in"]
    }
  }
}
```

Normative invariants:

1. Only the canonical `length_unit` domain is admitted: `mm`, `cm`, `m`, `in`, in that stable order. At most four distinct strings. No labels, counts, arbitrary keys, expressions or configurable operators.
2. `available` is exactly equivalent to `allowed_units.length > 0`. Known unavailable is `{ "available": false, "allowed_units": [] }`.
3. For each unit, there must be at least one actual **quantity-positive, fully matched canonical candidate** with a validated resolved sports-length witness. The normalized millimetre value must be a positive JSON number and be representable in that unit within the current `length_value <= 100000` query bound. The query value must remain strictly positive.
4. Availability uses `matched_candidates` **before pagination** and **after all current predicates**, including an active length pair. It does not use another variant, another product, a sold-out variant, a mirror JSON row, an unfiltered catalog or a query with the length predicate removed.
5. Missing/invalid namespaces and explicit invalid variant overrides retain 386's existing suppression behavior. A weight-only valid variant can inherit common length under that existing resolution contract; an explicit invalid override cannot be skipped to rescue common data.
6. Unit strings describe supported **query representations**, not source-storage units or product facets. Do not display unit counts. One witness may support several equivalent units; that does not represent several products. Do not invent `length_unit` facets or relax the existing facet-count conservation check.
7. An absent optional field means an older response without this capability evidence. A present malformed field is a transport error, not a reason to silently default availability or strip unknown content. Keep strict nested validation and existing sanitized-error behavior.

The factors are the existing canonical normalization factors: mm=1, cm=10, m=1000, in=25.4. Matching still uses the existing rounding to 0.001 mm. The proposal does not change matching tolerance or numeric bounds.

| Available normalized witness | Allowed query units | Reason |
| --- | --- | --- |
| 254 mm (also 25.4 cm / 10 in) | mm, cm, m, in | All equivalent inputs fit the existing bound. |
| 100,000 m | m | The other representations exceed 100,000. |
| 100,000 in | m, in | The mm and cm representations exceed 100,000. |
| No available validated witness | none | Query presence cannot invent capability. |
| Positive source value rounded to zero | none | A zero normalized witness has no positive converted representation. Existing matching semantics are not altered. |

The last case is a conservative capability boundary, not a correction to 386's existing quantization behavior.

## Empty results and active-pair recovery

Capability and selected-query recovery are separate facts. For zero matches, the new capability is false/empty even if a valid length pair was requested. Do not fabricate a unit option, positive facet or capability from that request.

The existing validated query can still supply an **applied-filter summary** such as “Equipment length: 67.5 cm”, hidden query-preservation fields, and an independent **Clear equipment length** link. That link must remain visible outside an available-only length-form condition. Clear `length_value` and `length_unit` together and reset page to 1, while preserving search, sort, limit, collection scope, category, country and repeated connector values through the canonical URL helper.

When capability is available, project its units into the existing `collection.sports_facets.length_units`; do not derive them from source-unit/count facets. The paired form must submit both fields, preserve unedited query rows, and use `step="any"` with canonical server validation. When capability is unavailable, preserve/clear the active pair as a current selection; do not advertise a new measurement chooser. With no active pair, show no unsupported length controls. Collection and search must behave identically.

## Paired SQL drafts and catalog conservation

- [UP draft](390_measurement_discovery.up.draft.sql)
- [DOWN draft](390_measurement_discovery.down.draft.sql)

UP adds one four-row `measurement_units` CTE over the existing materialized `matched_candidates`, then one JSON result field. No relaxed matching branch or extra product query is added. DOWN restores the exact captured qualified-386 `browse_storefront_products_v1` definition, including its defaults and body bytes.

Both drafts:

- Reuse the qualified catalog-fence admission, including managed-role lock checks; no new privilege shortcut.
- Pin the exact existing helper profiles before and after the change, including rejection of non-owner ACL grantors. Only the expected target body digest differs between the two profiles.
- Replace the **same** `public.browse_storefront_products_v1(uuid,jsonb,uuid[])` object; no rename, wrapper, overload, helper or table is created.
- Require every `pg_proc` field except `prosrc` to remain identical within the transaction. This includes OID, owner, raw ACL/grantor/options, signature/default expression AST, return type, language, cost/rows, strictness, volatility, parallel/support flags, definer status and `search_path`.
- Conserve the comment and direct/shared dependency rows. No `GRANT`, `REVOKE`, `ALTER` or `DROP` repairs a drifted state.
- Notify PostgREST only after the replacement and all checks, in the same transaction.

The target body MD5 values are **baseline `9af9d5e2e51052a874ffad94fc8088d6`** and **proposal `d754946fdac247295acd267c81e1031e`**. These are source pins, not database execution evidence. Any later qualified change to a guarded helper requires root-reviewed rebasing; the draft must fail closed rather than overwrite that change. Replay is UP → DOWN → UP. Applying UP twice or DOWN twice refuses the unexpected source state atomically.

Conservation here means logical function/profile/ACL/dependency conservation. Replacing a function necessarily updates PostgreSQL catalog tuple versions; no physical MVCC-byte identity is claimed.

## Required promotion order and remaining qualification

Current canonical metadata and gateway raw-response schemas are strict and reject the extra field. **Do not apply SQL before coordinating these existing consumers.** After root review:

1. Extend the existing canonical `StorefrontDiscoveryMetadata` type/schema with the optional strict field, deriving admitted units from the existing canonical domain. Extend the gateway's existing raw RPC reader to admit and forward it. Extend the existing frontend metadata validation/projection. No index/client/app changes are made by this proposal.
2. In a separately allocated fresh owned-PG qualification lane, apply the proposed 390 after the exact reviewed predecessors. Use the real browse RPC and normal gateway route; run the positive and negative witness, security, catalog and rollback matrix. Apply no draft 386/388/389 substitutions.
3. Verify the same response against the canonical parser, app projection and real Trailmark collection/search forms. Prove actual DOM submissions and active-pair recovery. Only then qualify normal browser flows in an allocated isolated fixture.
4. Promote the reviewed pair to the migration/rollback directories only through the coordinator's allocation. Preserve existing strict guards and the immutable qualified 386 bytes. The optional field permits safe reader-first deployment; it is not a permanent second discovery system.

[34 regression specifications](regression-cases.json) cover equivalents, same-variant conjunctions, available/simple products, invalid/missing measurements, empty/out-of-range pages, pair recovery, metadata admission, all existing response conservation, exact catalog profiles/ACLs, managed admission, rollback/replay, security and bounded performance. Their database/browser statuses are **pending**, not passed.

[Ten executed pure/source-conservation checks](contract-checks.test.ts) pass: canonical enum/bound parity, normalization, pair validation and URL recovery, canonical variant/group semantics, the existing strict-reader activation dependency, exact DOWN restoration, unchanged original browse expressions, and paired catalog-guard presence, and explicit initial grantor-drift rejection. [Raw result](contract-checks.log). These checks do not parse or execute SQL and do not certify database behavior, performance, browser usability or release readiness.

## Analogous furniture gap — inventory only

386 emits private `_width_mm` / `_depth_mm` from validated **assembled** dimensions; these do not become public threshold facets. A later read-only refresh confirms Habitat now gates each control independently using positive per-key supplied facets, so it correctly hides dimension controls without that proof. The earlier umbrella-flag behavior is superseded in the current template; no current material-only false dimension advertisement is claimed here.

The backend gap remains: qualified386 supplies no per-axis numeric capability, so genuinely measured dimensions cannot enable those threshold controls through the current facet-only proof. Furniture accepts mm/cm/in source units and the existing width/depth threshold queries are explicitly in cm. Do not infer assembled dimensions from package, seat-height or diameter data, and preserve whole-group variant overrides.

[The requested tradeoff](furniture-tradeoff.md) shows how the same finite capability object could later cover those two existing thresholds without numeric facets/counts. This draft is **not expanded**: it changes neither furniture metadata nor SQL/query/UI behavior. Root review and the Habitat owner's exact requirements remain prerequisites to any expansion.
