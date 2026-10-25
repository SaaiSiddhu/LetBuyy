# Historical furniture order roundtrip

`order-facts-roundtrip.test.ts` exercises these actual canonical functions in process:

`prepareProductFactSnapshot` → immutable `product_snapshot.niche` → `normalizeOrderItemRecord` → `mapOrderDetailDrop` → explicit Habitat 2.0.0 catalog bundle → real `customers/order` Liquid template.

There is no mocked projection, fake HTTP success, database write or current-product service. A global fetch guard rejects external/current-data requests. A current-product getter trap rejects accidental catalog fallback. The render uses an explicit synthetic buyer context and asserts real saved item content before comparing history; an unchanged sign-in page cannot pass.

Five cases pass, zero skipped:

- Selected furniture keeps width-only inch assembled facts and a separate partial mm package group, without inheriting missing cm axes. Saved material, weight, tools and care pass through the actual mapper and Liquid output.
- Exact saved option keys and values survive both the existing mapper `variant` field and scalar historical text, including `Seat size: Compact` and `आकार: छोटा` in actual HTML.
- Food remains 250 g per sellable pack at quantity 3, without becoming 750 g or the old product's 1000 g. Beauty selects Pink Clay/PC02 through the exact saved `Shade name` key and retains the saved shade ingredient statement.
- Missing/malformed snapshots display unknown history without raw/private/current-product fallback. A valid older beauty snapshot missing selected options retains known product facts and an unknown shade, never the first shade's code.
- Title, quantity, unit/line amounts, totals and payment/order status are conserved. The major-to-minor display conversion happens once. Literal hostile care stays text with no executable element. Rendered history remains byte-identical after current catalog facts/options change and the catalog context is deleted.

The actual test initially exposed missing saved options in `mapOrderDetailDrop.variant` and scalar order text. `order-facts-roundtrip-pre-fix.tap` preserves that genuine red result. The shared mapping owner then preferred canonical saved options and added their exact names to scalar historical text. The same assertions pass; the generic Liquid key policy was not relaxed. Habitat changed no shared mapper, formatter, backend, cart/order or renderer source.

```sh
TSX_TSCONFIG_PATH=apps/commerce/web/tsconfig.json node --conditions=react-server --import tsx --test docs/implementation/niche-themes-2026-10-23/habitat/order-facts-roundtrip.test.ts
```

`order-facts-roundtrip-tests.tap` records 5/5 passing. `order-roundtrip-typecheck.log` is the passing focused no-emit check. `order-roundtrip-source-manifest.json` pins the observed snapshot/normalizer/mapper/formatter/bundle/renderer inputs.

This establishes the in-process historical contract. It does not establish real database immutability/RLS, HTTP authorization, a cart/checkout purchase, provider behavior, browser hydration, deployment or production readiness. Those remain central integration gates.
