# Dewdrop remaining acceptance obligations — run 936e5f577646

Preparation only, after the finite boundary at Tint version 36. Main owns scheduling after Pantry's current journey; Editor owns every runtime action. The reviewer has made no HTTP, browser, database or fixture change. Existing scope is one shared owned fixture, original buyer 50494 and checkout 50497. Do not reuse a capability in a public file.

**Current context correction from Main:** after Pantry P07 the shared buyer cart `6284ebe8-98d4-41db-9272-292417bd41e5` contains Lentils quantity2/INR360, accepted product version17. The earlier Dewdrop Pink/version36 cart is a proven historical R01 boundary, not its current content. Preserve the current Pantry cart bytes, accepted source and held checkout. Native c0 remains an old Pink/version15 private control, with no claim of current acceptance and no checkout/cleanup grant. This correction is owner-reported context; the reviewer has not made a new cart read.

Current independently audited disposition is 24 PASS, M05 FAIL, and five BLOCKED/incomplete rows. The controller's equivalent record is 24 PASS / 6 PARTIAL. This document proposes finite remaining controls; it is not an execution receipt or owner grant.

## P03: one known cross-product variant rejection

First positively read the existing Tint and the existing active, in-stock Lentils product/variant through the owner's allocated canonical read path. Record their current IDs and product/variant relationship. The chosen Lentils variant must exist, be in this same fixture, and differ from all three Tint variant UUIDs. This proves a cross-product mismatch rather than another random unknown UUID. Do not create a product or foreign tenant.

Make exactly one replacement attempt against the existing **native control cart** `c0f9b1fd-07b9-4ecf-9f4e-740aa656c0c2`. Its actual capability remains in private owner state. Do not use the restored buyer cart `6284ebe8-98d4-41db-9272-292417bd41e5`.

Canonical request template, with the positively read Lentils UUID bound privately before execution:

```json
{
  "lines": [{
    "product_id": "f04c5a94-8f0c-48ae-a450-e2374caa5c7e",
    "variant_id": "<actual existing in-stock Lentils variant UUID>",
    "quantity": 1,
    "properties": {}
  }]
}
```

Use the existing `PATCH /v1/storefront/{owned-subdomain}/cart/{private-control-capability}` contract. The body fields come from `packages/checkout-core/src/index.ts:42` and `services/api-gateway/src/routes/storefront/cart-routes.ts:42`; these source reads establish the contract, not runtime results. Expected actual outcome is HTTP400 `VARIANT_NOT_FOUND`, with no fallback line and no persisted mutation. Record actual status/code/request ID, command/response hashes, exact before/after scoped table hashes, both order rows/snapshots, control and buyer-cart hashes, product/options/variant/inventory conservation. No successful positive cart mutation or checkout is required. Stop if the positive read or fixture guard fails.

This can close the outstanding P03 subcase alongside the already captured required409, unknown400 and own-positive/wrong-site404 controls. It adds no claim about a cross-tenant product/variant UUID if the chosen Lentils row is same-site.

## M04: two identical canonical nonempty-variant API calls

No raw normal-browser Save body is currently retained in the reviewed evidence. The canonical mutation receipt is a database representation of that intent, not a captured HTTP request. Never reconstruct it and label it browser replay. Use a newly declared canonical API control if Main grants this proposal.

At the scheduled boundary, positively read the current Tint version, status, all original three UUIDs, current exact variant fields and inventory. Compare against normal recovery version36: Rose520/4, Pink560/2, Terra590/0; original v1 option names/values; existing private metadata and both immutable orders. If another actor has changed the product, stop and let Main bind a new guarded boundary.

Generate one fresh idempotency UUID for this new intent. Build a body from that **actual current read**, retaining all three variant IDs and their current title, price and exact options. Omit metadata, product_options and every stock field; do not include creation defaults. Contract: `packages/commerce-core/src/index.ts:49` and `:113`. A concrete v36 template is:

```json
{
  "version": 36,
  "idempotency_key": "<fresh UUID bound once by owner>",
  "variants": [
    {"id":"ce1348f3-7ddd-4e06-9a62-6fc77bc15dab","title":"Fixture shade SKU","price":520,"options":{"Shade name":"Rosewater","पैक आकार":"एक इकाई"}},
    {"id":"3f4e08a8-bf2e-4899-bbeb-06c7283af499","title":"Pink Clay / एक इकाई","price":560,"options":{"Shade name":"Pink Clay","पैक आकार":"एक इकाई"}},
    {"id":"b864a0c6-2fb9-472e-a70a-8bbb96db7e9b","title":"Fixture shade SKU","price":590,"options":{"Shade name":"Terracotta","पैक आकार":"एक इकाई"}}
  ]
}
```

The version/key placeholders and latest title values are bound from the current owner read before making a final serialized command and its SHA. This template is not the actual command hash. Use `PATCH /v1/products/f04c5a94-8f0c-48ae-a450-e2374caa5c7e` with the owned merchant/site identity and matching `X-Idempotency-Key`.

Call 1 saves the valid nonempty variant intent. Capture the actual response and returned version, allowing opaque version increments. Call 2 replays the exact original serialized bytes and key, including the original expected version. Do not refresh its version or generate a second key. Expected replay returns the original successful receipt and introduces no second effect.

Each transport attempt needs its own legitimate authentication envelope: this fixture consumes signed-auth JTIs once. Reusing the same signed header object yields an authentication401 before the business command reaches replay handling. Preserve that observed transport rejection separately. Main has specifically allocated one fresh-auth reattempt after the observed401, retaining the original serialized business body, idempotency key and expected version36. This does not authorize another intent, altered command or authentication weakening. Do not claim cached200 until that attempt's actual response is captured.

Conservation is phase-specific: call1 may advance product/variant timestamps/version and the canonical product outbox event. Call2 must preserve the post-call1 scopes exactly, including any idempotency receipt scope observed by the owner. Both phases preserve the original three UUIDs/count, prices/options, stocks4/2/0 and inventory rows, private metadata, both order rows/snapshots, buyer cart and native cart. No creation-default stock, duplicate variants, reservations, order or money effects are permitted.

This is an API idempotency control, not browser transport replay. A later normal merchant full reload should verify the same v1 values and original IDs. As this proposal re-saves current identical values, a new value-changing product restoration is not inherently needed. A successful save can still advance Tint's opaque version; unchanged cart bytes alone never prove current acceptance. **The current buyer cart is Pantry Lentils/version17, so this Tint save does not stale its actual line. Do not replace it or request Pink reacceptance while Pantry is held.** The native c0 Pink/version15 line remains an intentionally old private control. If Main later allocates another Dewdrop shopping slice, reaccept then-current Tint normally at that time, without a new confirmation. Preserve historical R01 version36 proof separately. If actual current product values differ, do not apply the template; request Main's guarded rebind and explicitly allocate any further normal UI restoration. No direct data writer or new harness is proposed.

## M05: observed defect and missing membership boundary

Actual normal membership saves/readbacks are 2/1/1 and editor/public links target the exact collections. The collection list's visible false0 is an observed defect. Main/Circuit own the count fix and admitted runtime retest; source/test success alone cannot close this failure. Also retain an existing exact-empty/missing-membership proof if available, or explicitly allocate a safe normal empty-collection check. Never replace an empty map with all products. Keep pre-fix UI evidence immutable.

## D02: live compatibility subcases remain unexecuted

The current canonical route always supplies validated discovery metadata. Unknown-only and zero cohorts are valid metadata, not malformed/missing transport. No existing live fault control has been identified. Do not add a runtime, proxy, schema mutation, injected response, interception or harness merely to claim this UI branch ran.

The existing component test `apps/commerce/web/src/lib/theme-engine/storefront-discovery-frontend.test.tsx:116` covers missing capability, unsupported niche filters and malformed responses. Its admitted stable392 run has actual 20PASS/0FAIL evidence in `d02-component-stable392-936e5f577646-result.json`. Keep that separate from this unexecuted live branch. Main must retain the live NOT_RUN reason or explicitly approve an existing safe owned fault control.

## O05: unavailable buyer context remains unexecuted

Normal BuyerA/foreign-site, BuyerB and missing-session positive/denial sequences are captured. HTTP statuses of those browser BFF navigations were not observed and must not be invented. Main declined a disabled-account mutation; it is not needed to manufacture an unavailable-backend response.

Existing companion tests are `apps/commerce/web/src/app/api/buyer/buyer-proxy-routes.test.ts:198` (order-detail transport/status sanitization including 500→503 and malformed-success503) and `services/api-gateway/src/__tests__/owned-db/storefront-buyer-orders.postgres.test.ts:56` (missing/wrong-site/audience/expired/revoked/disabled session denials). These are source references, not newly executed results in this run. No extra test execution is proposed here. The live unavailable-context branch stays NOT_RUN unless an already existing isolated owner control is allocated.

## S01: actual inert DOM and observation limits

The isolated normally created security product, hostile format/ingredients, inert PDP/search DOM and benign recovery are actual. The unavailable stock0 cohort supplied no format chooser, so no unsafe facet choice was available or exercised. The retained DOM has zero attack images, handler attributes and executable attack scripts. It does not independently prove that no external request occurred.

The reviewed packet explicitly says `networkInterception:false`; there is no saved request-observer receipt. Main/Editor should state whether an already available browser/network observer can inspect this exact actor's requests within its granted UI workflow. Do not infer its availability, install interception, reclassify DOM counts as network capture, or make a fabricated unsafe-choice purchase. Record unreachable chooser and unobserved external-request assertions explicitly.
