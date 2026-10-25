# Installed Trailmark lifecycle — shared fresh fixture plan

**Preparation only. Every runtime case is NOT_RUN; completed runtime cases: 0.** No resource, install, publish, cart or checkout operation ran. This is data and an execution matrix for the coordinator-allocated shared fixture, using existing hooks only.

Read Editor’s `fresh-fixture-data.plan.json` first. The `sports` create fields here are copied exactly and schema-checked equal; reuse that created product. Two additive products provide isolated same-variant negatives and a no-length witness. Their creation and five collections are requests for the shared fixture allocation, not executed seeds. Bind only real returned UUIDs/current versions/allocated origins. Syntactic UUID stand-ins used by preflight are never execution bindings.

## Exact fixture and visible values

| Fixture | Canonical facts and visible expected values | Availability / price |
| --- | --- | --- |
| Editor `sports` common | Product-level **67.5 cm**, **85 g**, **67.5 × 26 × 2 cm**; Badminton / racket; compatibility unconfirmed. | Base price INR 1800. |
| `sports.inch` | Selected **26.5 in**, **80 g**, **26.5 × 10 in**. The whole dimensions group replaces common dimensions: **no inherited 2 cm height**. The exact length normalizes to **673.1 mm**, not 675 mm. | Stock 4; price INR 1800. |
| `sports.common` | Omitted variant metadata inherits **67.5 cm**, **85 g**, **67.5 × 26 × 2 cm**. | Stock 4; price INR 1800. |
| `sportsWitness.small` / Size S | Length **67.5 cm**, weight **84 g**; common dimensions retained. Size is an equipment model option code, not a garment measurement. | Stock 3; variant price INR 500. |
| `sportsWitness.medium` / Size M | Length **700 mm**, weight **90 g**, dimensions **700 × 270 mm**, height absent. | Stock 2; variant price INR 1000. |
| `sportsWitness.soldOut` / Size L | Valid **254 mm / 10 in** source exists but cannot witness an available capability or purchase. | Stock 0; variant price INR 400. |
| `sportsNoLength` | Dimensions **50 × 20 × 15 cm**, grip **84 mm**, weight **120 g**, but canonical `sports.length` is absent. Overall length stays **Not supplied**; no length chooser/units may be inferred. | Simple product stock 2; INR 250. |

The witness product’s persisted `Product.price` is INR **9999**. A matching variant’s **500/1000** price is a separate discovery witness and selected-variant price; never replace the persisted base price to force the filter. Raw private supplier metadata must not enter public product drops, cart/order facts or buyer history. Exact pure helper outputs and frozen snapshot **contents** are in `expected-pure-values.json`; they are predictions, not observed runtime evidence. No opaque snapshot fingerprint computed with stand-ins is used as an expected runtime digest.

## Installed discovery matrix

Every recipe runs through both actual collection and search pages, and the same public/private paginated API path where applicable. Resolve `scopeCollectionKey` into the collection URL or `collection_id` from actual created membership. Each named collection is an exact isolated membership set; query labels never grant scope. `matches.variant_ids` describes the current page’s matching available variant IDs. No fallback to all catalogue or another variant is allowed.

| Case | Exact query fields beyond search=Trailmark | Isolated scope | Expected total / variant witness | Measurement capability | Runtime |
| --- | --- | --- | --- | --- | --- |
| Q-OVERRIDE-mm | `{"length_value":673.1,"length_unit":"mm"}` | trailmarkBaseline | 1 / sports.inch | length available; units mm, cm, m, in | NOT_RUN |
| Q-OVERRIDE-cm | `{"length_value":67.31,"length_unit":"cm"}` | trailmarkBaseline | 1 / sports.inch | length available; units mm, cm, m, in | NOT_RUN |
| Q-OVERRIDE-in | `{"length_value":26.5,"length_unit":"in"}` | trailmarkBaseline | 1 / sports.inch | length available; units mm, cm, m, in | NOT_RUN |
| Q-COMMON-mm | `{"length_value":675,"length_unit":"mm"}` | trailmarkBaseline | 1 / sports.common | length available; units mm, cm, m, in | NOT_RUN |
| Q-COMMON-cm | `{"length_value":67.5,"length_unit":"cm"}` | trailmarkBaseline | 1 / sports.common | length available; units mm, cm, m, in | NOT_RUN |
| Q-COMMON-in | `{"length_value":26.5748031496063,"length_unit":"in"}` | trailmarkBaseline | 1 / sports.common | length available; units mm, cm, m, in | NOT_RUN |
| Q-UNIT-NOT-DROPPED | `{"length_value":26.5,"length_unit":"cm"}` | trailmarkBaseline | 0 / none | all false; units empty | NOT_RUN |
| Q-CROSS-SIZE-LENGTH | `{"size":"M","length_value":675,"length_unit":"mm"}` | trailmarkWitness | 0 / none | all false; units empty | NOT_RUN |
| Q-CROSS-PRICE-LENGTH | `{"size":"M","length_value":700,"length_unit":"mm","max_price":500}` | trailmarkWitness | 0 / none | all false; units empty | NOT_RUN |
| Q-MEDIUM-POSITIVE | `{"size":"M","length_value":700,"length_unit":"mm","min_price":1000,"max_price":1000}` | trailmarkWitness | 1 / sportsWitness.medium | length available; units mm, cm, m, in | NOT_RUN |
| Q-SMALL-POSITIVE | `{"size":"S","length_value":67.5,"length_unit":"cm","max_price":500}` | trailmarkWitness | 1 / sportsWitness.small | length available; units mm, cm, m, in | NOT_RUN |
| Q-SOLDOUT-ONLY | `{"size":"L","length_value":10,"length_unit":"in"}` | trailmarkWitness | 0 / none | all false; units empty | NOT_RUN |
| Q-NO-LENGTH | `{}` | trailmarkNoLength | 1 / none | all false; units empty | NOT_RUN |
| Q-NO-LENGTH-SELECTED | `{"length_value":50,"length_unit":"cm"}` | trailmarkNoLength | 0 / none | all false; units empty | NOT_RUN |
| Q-EMPTY-COLLECTION | `{}` | trailmarkEmpty | 0 / none | all false; units empty | NOT_RUN |
| Q-PAST-END | `{"page":9,"limit":1}` | trailmarkBaseline | 1 / none | length available; units mm, cm, m, in | NOT_RUN |
| Q-QUERY-PRESERVATION | `{"length_value":700,"length_unit":"mm","size":"M","connector":["usb-c","hdmi"],"category":"Recreation","country_of_origin":"India","sort":"price-desc","limit":1,"page":2}` | trailmarkWitness | 0 / none | all false; units empty | NOT_RUN |

All fixture measurement responses have furniture width/depth false. `Q-PAST-END` has **total1, page9, limit1, data[]**, but true equipment capability from the positive cohort. `Q-QUERY-PRESERVATION` deliberately combines connector filters with a racket that has no electronics facts, so it remains zero; it tests retention without fabricating a witness. The 26.5748031496063 in common query normalizes to675 mm at the existing0.001 mm precision; the plan adds no tolerance or new normalization.

At true zero matches: no length chooser; a valid selected value+unit remains visible as an applied chip and hidden in Apply/sort. Its `active_filters[].clear_url` removes **both** fields, resets page1 and preserves all unrelated search/sort/limit/category/country/fixed collection/repeated connectors. Clear one connector removes only that value. Changing sort preserves all unedited fields and repeated values; native FormData must have no duplicate scalar controls. Do not synthesize a unit facet/count or infer availability from current selections, dimensions, grip or sold-out rows.

## Existing lifecycle hooks and expected results

| Stage | Existing action | Exact acceptance / runtime status |
| --- | --- | --- |
| L00 — fixture/install | Root allocates fresh shared store, identities/origins/migrations and final Trailmark2.0.0 package/version; Editor installs, saves, previews and publishes through existing lifecycle. | Record actual package/instance/release IDs and immutable snapshot digest. No catalogue demo or old held fixture substitutes. All bindings remain null in this preparation. **NOT_RUN** |
| M01 — merchant/create/readback | Reuse exact Editor sports product; create supplemental witness/unmeasured products only if allocated. GET each created product and bind canonical variant IDs/versions. | Sports length value/unit remains one object; relational variant metadata/options/stock read back as supplied; no guessed UUID/SKU ownership. **NOT_RUN** |
| M02 — merchant/fact-recovery | Attempt invalid partial length or unit ft through actual controlled editor, then correct before save. | Valid common/variant facts preserved; incomplete/invalid measurement blocks save. No payload with half a value/unit pair, default cm or invented measurement. **NOT_RUN** |
| P01 — published/PDP | Open baseline product; select Length26.5 in and Common size through lb-variant-picker, inspect labelled #equipment-facts and exact variant roots. | Product-level 67.5 cm/85 g stays labelled common; inch variant26.5 in/80 g/26.5×10 in with no inherited height; common variant67.5 cm/85 g/67.5×26×2 cm. See expected-pure-values.json after input validation; no garment-size substitution. **NOT_RUN** |
| P02 — public/private discovery | Run every query recipe on both collection and search; inspect actual payload metadata/matching variant IDs and controls, not only visible product cards. | Counts/IDs/price witnesses exactly as query matrix; persisted price stays authoritative base. Signed preview uses same store/token/no-store, fails explicitly without public fallback. **NOT_RUN** |
| C01 — stock/cart | Select witness sold-out L; attempt add then try baseline inch quantity5 with stock4. | Native sold-out option/add disabled; direct overstock server attempt409 INSUFFICIENT_INVENTORY. No accepted unavailable line/order/stock effect; exact status/code recorded at runtime. **NOT_RUN** |
| C02 — stock/cart reload | Select baseline inch quantity1, add through lb-add-to-cart, capture actual cart response, reload page then cart GET and drawer. | One logical durable variant line, price1800, quantity1, saved options Length26.5 in and resolved80 g/26.5 in facts. Stable accepted fingerprints across read-only reload; no client-posted prices/facts. Initial variant available4 remains4 until authorized checkout reservation; record mirrors/reservations. **NOT_RUN** |
| O01 — local COD | Use actual cart checkout-url capability and existing hosted contact→delivery→payment-intent(cod,sandbox)→confirm with allocated local COD-enabled shipping row. | No PSP/network/payment credentials. One order/line, one net unit stock effect (available4→3), amount recomputed server-side1800 plus observed shipping/tax/discount. No paid/captured claim for COD. **NOT_RUN** |
| O02 — idempotent local COD recovery | Reload checkout and retry EXACT confirm key/body after the first acknowledged order. | Same order ID, exactly one order line/stock effect; no second unit decrement. Recover original acknowledgement without rebuilding the command. **NOT_RUN** |
| H01 — historical facts after edit | Capture canonical order_items.product_snapshot.niche via authorized readback and buyer/merchant order text; then execute afterRecordedOrder edit with latest version and existing variant IDs. | Current catalogue changes to70 cm common,27 in selected,82 g selected and2100. Recorded order still26.5 in/80 g/original26.5×10 in with absent height; option Length26.5 in, unit price1800 and saved digest byte-for-byte unchanged. **NOT_RUN** |
| H02 — authorized history/recovery | Reload buyer account order and merchant order after edit; probe as another buyer/tenant and signed-out session using existing identity fixtures. | Authorized current buyer/merchant see recorded Equipment details and recorded option tuple; unauthorized sees denial/identity gate and no saved facts/private_supplier. No fallback to current27 in facts; no delivery/compatibility guarantee invented. **NOT_RUN** |
| H03 — stale cart boundary | For a separate pre-edit cart, attempt checkout after product facts/options/version change before reacceptance. | Existing388 CART_FACTS_CHANGED guard prevents committing stale reference; no order/stock effect. Reopen actual picker/review and persist new cart facts before another checkout. HTTP sanitized error code recorded, no raw DB error exposure. **NOT_RUN** |

Use the installed product’s `#equipment-facts`, labelled `.tm-variant-facts`, `lb-variant-picker`, `lb-add-to-cart`, and `[data-lb-add-to-cart-status]`; use the real `.tm-discovery-form`, `.tm-length-form`, active clear anchors and pagination links. Names/labels/current IDs are resolved from the actual rendered controls; do not set a local cart or fabricate a successful DOM state. Cart reload is the existing token-bound GET plus native drawer/page reload. Capability URLs, cookies and buyer identity tokens stay out of evidence files.

## Exact mutation and checkout payloads

`installed-trailmark-fixture.plan.json` contains canonical `createFields`, membership templates, versioned `afterRecordedOrder` edit, cart line bodies and the four hosted COD step bodies. Before any write, substitute the actual store/product/variant/membership/shipping IDs and latest observed versions, then rerun their canonical input schemas. Use the real owner products API (`POST /v1/products`, `GET/PATCH /v1/products/{id}`); edit body/header idempotency UUIDs must match and an exact retry must preserve both. Membership replacement uses its actual read `membership_version`, exact product IDs and matching save key.

Only actual product/variant IDs, quantity and allowed properties cross the cart input boundary; the server recomputes price and derives/locks facts. Do not send client snapshot facts, product version or total as a substitute for the canonical cart receipt. The sold-out and quantity5 bodies are intentionally structurally valid inputs whose stock rejection is a future runtime assertion. A provider-free local COD lane requires the fresh fixture’s COD-enabled shipping quote and server amount; bind the observed major-unit amount, never hardcode an assumed free/20-rupee rate. Use the returned existing checkout-url capability and existing contact/delivery/payment-intent/confirm steps. Provider is `cod`, mode `sandbox`, tokenize false. Nothing invokes a PSP or marks COD paid/captured.

After a single accepted order, record one net stock unit **4→3** for the primary inch variant and no additional decrement across checkout reload/exact confirm retry. Preserve actual reservation/on-hand/available fields and phase timing in evidence rather than assuming that cart creation reserves stock. The retry must return the same order ID. Server subtotal is INR 1800 for quantity1, plus its actual shipping/tax/discount; client totals are not an authority.

## Immutable history after current product edit

Complete and capture the first COD order **before** the versioned edit. The exact update changes the common length to70 cm/90 g/70×27×3 cm, the selected variant to27 in/82 g/27×11 in, its option title/tuple to27 in, and both variant prices/product price to2100. It carries both existing durable variant IDs and omits stock so the post-order stock3 is not reset to create-time4. Common variant metadata is omitted to preserve its previous inheritance semantics.

The earlier order must still show saved option **Length:26.5 in**, equipment **Length:26.5 in**, **Weight:80 g**, dimensions **Length 26.5 in · Width 10 in**, height absent, and price1800. Capture the canonical authorized order snapshot before/after and require equal saved contents and digest; no lookup of today’s27 in row may rewrite it. Buyer/merchant order pages must render that frozen text. Another buyer/tenant and signed-out view must not reveal it. A separate stale pre-edit cart must hit the existing `CART_FACTS_CHANGED` boundary with no order/stock side effect until re-review/reacceptance. Record sanitized HTTP outcome; never surface raw SQL errors.

## Preflight actually performed

`input-schema-validation.json` reports **PASS** for3 product commands,5 variants,1 versioned edit,5 collection creates/membership replacements,17 queries/capability expectations,3 cart lines and4 checkout steps. Four invalid query shapes were rejected. Five expected snapshot contents and display summaries were generated through existing pure canonical helpers only. These checks neither invoke hooks nor prove persisted membership/stock, API authorization, installation, Liquid hydration, filtering, cart storage or COD. **All runtime states remain NOT_RUN.**

`source-pins.json` records the Editor plan and actual source/schema/hook revisions reviewed. Released source stays frozen. Required execution depends on coordinator fixture allocation and qualified390 plus final389 installation; no DB/build/browser/provider, new harness, shared code edit or cleanup was performed.
