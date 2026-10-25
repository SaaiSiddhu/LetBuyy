# Independent immutable order-facts acceptance

`packages/commerce-core/test/niche-order-snapshot-acceptance.test.ts` adds independent consumer tests against the **public canonical** `prepareProductFactSnapshot`, `readProductFactSnapshot` and personalization review APIs. It defines no replacement snapshot schema or writer and imports no app/service code.

**17 tests pass; focused TypeScript passes.** Commands and source hashes are in `niche-snapshot-acceptance-report.json`; current TAP is `niche-snapshot-acceptance.log`. No test is skipped.

Each of the nine positive fixtures uses valid domain schemas, verifies concrete accepted values, confirms that the source catalog remains mutable, deeply erases the source facts and selected relational option rows, then reads the serialized historical snapshot. Expected facts remain unchanged and the accepted/readback object trees are frozen.

| Namespace | Independent fulfillment assertions |
| --- | --- |
| Toys | Selected edition clears age/contents/dimensions; it cannot inherit the old completeness or age-prose promise. Complete fact removal stays absent. |
| Electronics | Input/output connectors and watt values remain distinct. Invalid pass-through input fails. |
| Food | Selected 250 g pack overrides common 1,000 g; a missing or null selected pack remains unknown. |
| Furniture | Selected dimension groups replace their unit and values atomically, without inheriting old cm dimensions into an inch group. |
| Gifts | Three exact included items, care and distinct open/closed role indices remain frozen. Omitted contents stay absent; incomplete declared quantities fail. |
| Personalization | Exact NFC Hindi/Latin text, chosen labels and revision survive. Fresh review advances work; stale version/meaning/product/re-add and forged digests or labels fail. Unreviewed normalization fails. |
| Beauty | Rosewater/Pink Clay remain distinct named selections despite identical RGB. Exact spaces, Hindi values/names and case-sensitive option names survive deterministic ordering. The ten-option bound is enforced. |
| Sports | Selected lengths, weights and full dimension groups retain their supplied units; missing common equipment context fails. |
| Books | The selected durable edition retains its language, format, pages, identifier and dimensions. A book/stationery conflict fails. |

Different durable selected variant UUIDs produce the correct different facts even when display options match. Foreign-parent variants fail. Private product metadata is excluded, and private/unsupported historical fields fail closed.

## Genuine defect found and resolved by the canonical owner

The initial run had **15 passes and one failure**: the historical reader accepted both `{name:'Shade', value:'Rosewater'}` and `{name:'Shade', value:'Pink Clay'}` in one selected option array. A canonical relational options record cannot produce two values for one exact name.

That failing assertion was relayed to root. MadeYours added exact-name uniqueness to `ProductFactSnapshotSchema`; the unchanged rejection assertion now passes. The test was neither skipped nor relaxed, and this owner did not edit the production snapshot module. Distinct names that differ by case remain exact, as required.

## Evidence boundary

These are pure canonical server-context API tests. They do not establish database row authorization, locked reads, transaction persistence, order readback routing or provider effects. Those remain the assigned writer/readback owners' gates.

Gift assertions prove numeric role-index and included-quantity immutability. Genuine historical photograph identity requires the existing frozen `product_snapshot.images` or order-line image captured by the canonical writer. These tests never fetch current catalog images or invent historical URLs. The normalized `OrderItem.niche_snapshot` formatter/readback integration remains Dewdrop-owned.

The Kindred narrow-header follow-up is separately qualified in `narrow-browser-review.json`: 15 cases pass, normal brand is one line at 320/360/390, actual Hindi glyph fonts were observed, and browser/server slot2 resources were explicitly closed/released. All 91 frozen M1 image/board/source hashes remain unchanged. Parent files are Playfield-owned and were not edited during this work.
