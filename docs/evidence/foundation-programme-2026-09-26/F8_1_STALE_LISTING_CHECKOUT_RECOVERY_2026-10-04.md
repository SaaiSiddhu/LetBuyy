# F8.1 stale listing checkout recovery — 4 October 2026

## Implemented locally

The signed marketplace checkout resolver now collects unavailable listing IDs and returns them with `MARKETPLACE_LISTING_UNAVAILABLE` before creating or advancing a checkout cart. The payment screen turns that response into an item-specific recovery card, clears any delivery selection and reviewed total, blocks order submission, and offers to remove only the unavailable item snapshots. Removal goes through the cart provider's serialized, buyer-scoped snapshot subtraction, so valid lines and items changed during checkout remain in the local cart.

## Verification

| Check | Result |
|---|---|
| Checkout service contract test | Passed; unavailable listing ID is returned and no marketplace cart is created. |
| Marketplace COD checkout recovery widget test | Passed; stale listing blocks order submission, names the affected line, and the buyer action removes it from the local cart. |
| Focused checkout service/UI/address/pricing suite | **10/10 passed.** |
| Targeted Dart analysis | Passed with no issues. |

No device/browser run was performed. The cart subtraction primitive also has separate buyer-scope and snapshot semantics tests.

## 7 October purchase-time revision recovery continuation

The order RPC refuses a material marketplace listing revision that changes after buyer review. A product edit invalidates approval to `draft` before confirmation, so this concrete route returns the stable `MARKETPLACE_LISTING_UNAVAILABLE` code (not `MARKETPLACE_LISTING_CHANGED`). The native COD service retires only the incomplete secure-cart attempt; the payment screen clears the reviewed server total and delivery selection, retains the buyer's local cart, and returns to the review action. The next review resolves listing eligibility again and uses the existing item-specific unavailable-listing flow if approval was withdrawn. `MARKETPLACE_LISTING_CHANGED` remains supported for the distinct SQL fingerprint-mismatch refusal, but this product-edit fixture does not exercise that branch.

Verification on 7 October:

| Check | Result |
|---|---|
| Earlier owned API Gateway/Postgres marketplace cart/order suite | **13/13 passed** (`7a749756455b`); historical evidence, superseded for error-code classification by the 7 October revalidation below. |
| Earlier checkout service + native COD widget tests | **5/5 passed**; historical synthetic coverage, with the post-confirmation fixture updated to match the actual owned-database error code in the 7 October revalidation below. |
| Targeted Flutter analysis, Gateway typecheck, `git diff --check` | Passed. |

The second review and removal are verified with a synthetic transport fixture, not one continuous mobile-to-owned-Gateway/Postgres run. No physical device, hosted environment, provider or live order was exercised. Cross-seller allocations, marketplace online collection, capture recovery and wider Phase 8 acceptance remain open.

## Remaining Phase 8 work

This closes the stale-listing failure presentation for the single-seller native COD path. It does not close address/contact recovery across all checkout surfaces, multi-seller parent/allocation orders, marketplace online payments, provider capture/late-callback recovery, fulfillment/refunds, carrier serviceability or channel certification. The eleven-phase programme remains active.

## Corrected owned-database and native-client revalidation — 7 October 2026

Migration 278 has two refusal cases. A canonical product edit invalidates
approval to `draft`; confirmation then returns
`MARKETPLACE_LISTING_UNAVAILABLE`. A distinct fingerprint mismatch while the
listing remains approved maps to `MARKETPLACE_LISTING_CHANGED`. The material-
edit journey exercises the first case. Its previous test expectation was
stale; the owned test now asserts the observed unavailable code, and the native
widget fixture mirrors it.

| Check | Result |
|---|---|
| Owned API Gateway/Postgres marketplace cart/order suite | **13/13 passed**, zero skips/TODOs; runner `1a3119505ad9`; labeled-fixture cleanup passed. |
| Checkout service + native COD widget tests | **5/5 passed**. |
| Targeted Flutter analysis, Gateway typecheck, `git diff --check` | Passed. |

The mobile client retires only the incomplete checkout attempt, clears the
reviewed total and delivery choice, retains the local cart, and requires a new
review; that review displays the item-specific recovery action. The Gateway
suite and native transport tests are separate, so the full sequence has not
been executed as one mobile-to-database test. No device, hosted environment,
payment provider or live order was exercised; Phase 8 remains open.

The owned suite was run through the governed runner with `--kind gateway-db`,
`--jobs 1`, and log directory
`/private/tmp/letbuyy-marketplace-classification-20261007`.

## Committed-order response-loss recovery through native client — 8 October 2026

The continuous mobile-to-owned-Gateway/Postgres integration now simulates the
connection being dropped after the production Gateway has committed a COD
order but before the mobile `ApiClient` receives the confirmation response.
The first confirmation therefore fails at the client while the secure attempt
remains stored. Retrying the same mobile checkout calls the real
seller-scoped `checkout-status` route first, recovers the committed order, and
clears the attempt after success without creating another cart or order.

The bridge verifies the captured response contained the committed order ID
before dropping the socket. Database assertions verify exactly one additional
seller order, exactly one checkout-session/order binding for that cart, and
the resulting `pending_cod` state. The integration is part of the same native
client journey that covers server-authoritative price/shipping, one successful
COD order, and subsequent stale-listing refusal with no extra order or stock
effects.

The governed Gateway/Postgres suite passes **14/14**, with zero failed,
cancelled, skipped or TODO tests (`e065d4584aae`); runner-owned fixture cleanup
passed. Gateway typecheck and focused `git diff --check` pass. This is a local
service/API/database integration, not physical-device, hosted, provider or
release acceptance. D08 online collection, multi-seller allocation,
fulfillment/refund recovery and broader Phase 8 certification remain open.

## Recover committed order before validating changed cart input — 8 October 2026

Review found that `placeCodOrder` read the buyer-scoped secure attempt but then
validated the current email/cart and re-resolved listings before checking the
seller-scoped checkout-status route. That contradicted the recovery contract:
after an ambiguous response, the buyer may have emptied the cart, changed the
email or edited the cart before retrying. The service now recovers a completed
receipt immediately after reading that buyer's attempt, before validating the
new checkout payload. Recovery still uses the stored seller subdomain and cart
token, and reports `matchesCurrentCart: false` when the revision changed.

The owned Gateway/Postgres integration drops the actual confirmation response
after the order transaction commits, then retries through the real mobile
`ApiClient` with an empty cart, invalid changed email and incremented local
revision. It recovers the same order; assertions retain exactly one order and
one checkout-session/order binding. The governed suite passes **14/14** with no
failures, skips or TODOs (`e065d4584aae`), and runner cleanup passes. The focused
Flutter service and COD UI tests pass **7/7**; Flutter analysis and diff checks
pass. The stale-listing widget fixture now injects its in-memory attempt store,
so it does not depend on an unmocked secure-storage platform channel. The COD
UI regression now empties the local cart and edits the email after the lost
response, then exercises the visible retry action and recovers the receipt
without another confirmation.

A buyer-isolation widget regression switches the stored session to a second
canonical buyer while the first buyer's status request is in flight, then
refreshes that session through the account API. It confirms the first account's
receipt is not shown, the second buyer's session remains active, the cart stays
intact and both buyer-scoped retry records are preserved. All **7/7** focused
service/UI tests now pass on Android emulator `sdk_gphone64_arm64` using fake
API responses and in-memory stores; the harness initializes mocked preferences.

This is local service/API/database and Android-emulator widget verification;
physical-device, hosted, payment-provider and release acceptance remain
unverified. Phase 8,
D08, cross-seller allocation, fulfillment/refund recovery and remaining channel
certification remain open. See the [updated owned-run record](F8_MARKETPLACE_MOBILE_RESPONSE_LOSS_OWNED_RUN_2026-10-08.json).

## Continuous native-client to owned-Gateway stale-listing journey — 7 October 2026

The Flutter `MarketplaceCheckoutService` now has an opt-in integration test that
runs from the existing owned-database Gateway suite. It uses the actual Dart
`ApiClient`, the production Gateway worker over a loopback HTTP bridge, the
runner-owned PostgREST sidecar and disposable PostgreSQL. First, the mobile
client reviews server price (129 × 2) instead of its display-only 0.01 price,
reviews the configured 60 COD delivery charge, submits that exact total and
creates one order. It then runs a second buyer cart, edits the product
immediately before final confirmation, and receives the real
`MARKETPLACE_LISTING_UNAVAILABLE` 409. The test checks that this incomplete
secure checkout attempt is retired, the prior successful order and stock state
are preserved, and the stale checkout remains at `payment_intent`, not completed.

The first integration run exposed a real defect: the public listing-detail
route's disclosure query read tenant-guarded `products` by product ID alone, so
the tenant query guard returned a 500 before checkout began. The route now
carries the `site_id` returned by the canonical listing-detail RPC into that
read. The final rerun passed both mobile client journeys plus all existing
cases in the owned suite: **14/14, zero skips/TODOs**, run `56118bbddbfe`; governed
runner cleanup passed. Gateway typecheck and targeted Flutter analysis passed.
The reproducible invocation is
`LETBUYY_ENABLE_MARKETPLACE_MOBILE_OWNED_E2E=1 node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/marketplace-cart-origin.postgres.test.ts --jobs 1`.

This connects both a successful COD purchase and stale-listing recovery across
the native service/API/database boundary. It is local service/API/database
integration, not Android-device acceptance, browser acceptance, a hosted
environment, a PSP transaction, or Phase 8 closure. D08 online collection,
cross-seller allocation, fulfillment, refund recovery and the broader Phase 8
contracts remain open.
