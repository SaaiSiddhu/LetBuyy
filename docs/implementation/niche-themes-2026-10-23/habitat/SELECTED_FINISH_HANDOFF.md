# Habitat current selected-finish furniture facts

The actual Habitat PDP now places a current facts panel after the canonical variant picker and before purchase. It always renders assembled/package measurements, weight, seat height, material, assembly and care, with explicit “not supplied” values. Before a complete selection it is labelled **Common product facts**. Product reference measurements, material/care and the footprint schematic below are explicitly common information. The schematic is not to scale and makes no fit/access/delivery guarantee.

Pantry's existing picker/controller consumes these owned hooks:

- Root: `data-lb-variant-facts`, `data-lb-facts-namespace="furniture"`, canonical `data-product-id`.
- State/status: `data-lb-variant-facts-state`, `data-lb-variant-facts-status`.
- Seven text slots: `data-lb-furniture-field="assembled|package|weight|seat_height|materials|assembly|care"`, each with `data-lb-facts-missing` fallback text.
- The named-finish comparison remains separate under `data-lb-variant-facts-fallback`; rows retain `data-lb-variant-facts-row` and enclosing variant IDs. The shared controller leaves this useful fallback readable.

Common slot text is available for reset. Complete matching selections use the validated server-resolved `furniture_display` through the bounded `facts_json` carrier. The controller updates text content by the enclosing durable variant UUID. An unavailable matching finish shows its own facts and explicit unavailable status while the canonical picker blocks purchase. Incomplete/unmatched selections restore common facts and remove stale selected data. No client field-by-field inheritance or unit mixing was added.

## Observed verification

`selected-finish-render-tests.tap` records two passing actual app binder → mapper → Liquid cases, with a service-call guard. The synthetic two-option fixture preserves common cm dimensions while a named finish supplies a whole width-only inch group and a separate partial mm package group. The missing axes never inherit values from the old cm group. All unknown fields remain explicit.

`selected-finish-controller-tests.tap` records three passing tests using the **actual** registered picker and shared controller on fragments from that real Liquid output. They cover complete versus partial selection, resolved material/assembly/care and units, sold-out facts/purchase blocking, unmatched/incomplete reset, cross-product isolation, unknown facts and hostile literal care text. No cart custom element, network request or purchase intent is activated in this harness.

The hostile care case exposed a shared JSON serializer defect: only `<` was Unicode-escaped, while the unchanged sanitizer removed data attributes containing either angle bracket. The renderer owner fixed the JSON encoding of both brackets and `&`; the same failing real picker case then passed without weakening the assertion, sanitizer or depth cap. Shared renderer/controller/mapper files were not edited by Habitat.

Run this DOM harness with the host app aliases:

```sh
TSX_TSCONFIG_PATH=apps/commerce/web/tsconfig.json node --import tsx --test docs/implementation/niche-themes-2026-10-23/habitat/selected-finish-controller.test.ts
```

The domain/theme suite passes 17 tests; prior product editor 6, variant editor 8, membership 2, guide acceptance 3, new binder/render 2 and picker/controller 3 total **41 passing owned tests**, zero skipped. The theme-engine no-emit check passes. The previously reported shared discovery connector-union TS2345 was fixed by its owner. The focused cross-boundary evidence typecheck now passes with an empty log.

## Browser evidence boundary

The explicit catalog-v2 builder, current app mapper and quoted-font renderer produced eight actual HTML fixtures. `browser-supplemental-audit.json` records 25 passing isolated captures: four affected PDPs and retained/editable Core FAQ at 1440/834/390/320, plus each scene with 200% computed text sizes. There is no document/body/visible-content overflow, broken image or page error. Actual Libre Baskerville and Source Sans Pro glyphs are confirmed. Ten tracked source hashes remained unchanged during capture. Browser/context/server closed and slot 1 was released. Original 22 captures were preserved.

The supplemental screenshots establish static presentation of the common panel, named finish differences and editable FAQ. They do not establish browser hydration or checkout/order persistence. Real picker switching is independently demonstrated by the DOM tests above.

Visual inspection found a retained FAQ spacing defect despite the clean overflow checks. Habitat's scoped FAQ widths/padding now align it with the page gutters; the separately regranted five-image FAQ-only corrective capture passes at all four widths and 200% text, with measured gutters of 60px desktop, 32px tablet and 20px mobile. No other source or layout selector changed for that correction. `browser-supplemental-faq-correction.json` and `supplemental/faq-correction/screenshots/` supersede the FAQ images from the initial 25 while preserving them for provenance. Sources remained stable; owned resources closed and the slot was explicitly released.

Remaining shared integration gates: composed live app/merchant variant acceptance and selected cart/quote/immutable order snapshot verification. The next owned in-process historical-order contract currently retains a real missing saved-option projection regression for the central mapper owner. Habitat made no product-parent, backend, cart/order, database, global registry or shared renderer write in this slice.
