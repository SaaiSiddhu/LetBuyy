# Furniture capability tradeoff — read-only proposal, not a draft expansion

The same bounded `measurement_capabilities` object can cover the existing furniture thresholds without numeric facets or counts. The current Habitat template correctly requires positive per-key support and therefore does not advertise dimensions from material/finish or a selected zero-count row. Qualified386 has validated normalized `_width_mm` / `_depth_mm` witnesses but emits no threshold capability, so that honest gate has no server evidence to consume.

A possible **later finite extension** is:

```ts
measurement_capabilities?: {
  equipment_length: { available: boolean; allowed_units: CanonicalLengthUnit[] };
  max_width_cm?: { available: boolean };
  max_depth_cm?: { available: boolean };
};
```

`CanonicalLengthUnit` here means the existing non-nullable canonical query `length_unit` domain, not a new public type or interpreter. The two new keys reuse the existing query keys. Their units and maximum-threshold operators are already fixed by the canonical query; no redundant furniture unit selector or configurable operator is needed.

For each axis independently, availability would require a quantity-positive fully matched canonical candidate, a validated positive normalized **assembled** measurement from that candidate, and a representable threshold within the current query's `(0, 1000000] cm` bound. No package/seat-height/diameter inference, material/finish proxy, source-unit facet, guessed numeric bound or unit/product count. Invalid selected-variant namespaces remain suppressed; dimension groups remain atomic.

The two axis booleans can have different witnesses when no axis predicates are active. That only advertises independent supported filters, not a claim that one variant fits both. When width and depth are requested together, existing matching must still require the **same variant** to satisfy both thresholds and every other active predicate. Never combine width from A and depth from B to manufacture a matching variant, a fit claim or a joint count.

The same empty-result rule applies: false/missing capability cannot be fabricated from the selected query. Retain each existing applied threshold and independent clear through canonical query navigation. A current selection is recovery data, not positive measurement support. With no current selection and no capability, hide the corresponding control.

| Choice | Benefit | Additional review/qualification |
| --- | --- | --- |
| Keep390 equipment-length only (current SQL draft) | Smallest ready review; no furniture consumer changes or additional response fields. | Furniture's proven backend capability gap remains queued. |
| Add the two booleans to the same390 object after Habitat/root agreement | Reuses the same canonical witnesses, schema extension, RPC and catalog-conservation work; avoids a second follow-up solely for the analogous numeric gap. | Expand strict metadata/raw-reader validation and Habitat projection; add per-axis, atomic-group, cross-variant, unavailable, empty-result and threshold-bound cases; regenerate both SQL body pins and repeat the owned-PG/rollback/security qualification. |

If root accepts the furniture requirements before390 is qualified, the finite two-axis addition is a reasonable shared completion. Otherwise retain the equipment-only draft. **No draft SQL has been expanded to furniture, and no source or database action is authorized by this comparison.** Root can review this concrete tradeoff and the Habitat owner's inventory before allocating the next edit.
