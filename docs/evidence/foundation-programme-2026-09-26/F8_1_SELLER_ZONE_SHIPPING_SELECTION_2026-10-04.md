# F8.1 seller-zone shipping selection for marketplace COD — 4 October 2026

## Implemented locally

Marketplace checkout now discovers delivery options through the signed checkout handoff. The Gateway returns only active COD rates whose seller-owned zone matches the address country, state and exact pincode. Flat, free and price-bounded rates are supported; weight-based rates are withheld because the marketplace cart does not yet carry verified package weights. The response explicitly labels the source as seller zone configuration and `carrier_confirmed: false`; any displayed delivery window is identified as a seller estimate.

The merchant rate-creation route now fills the `site_id` and COD-enabled fields added by the existing shipping schema. The buyer sees available options, selects one, and reviews the resulting server total before submitting the order. The delivery step re-resolves the rate and ignores any client amount. Migration 279 adds a service-role-only marketplace order wrapper: it locks the selected rate and zone through the canonical order transaction, rechecks seller/address/COD eligibility and the exact reviewed amount, then delegates to the existing listing-bound order writer. A concurrent rate or coverage change therefore refuses the order instead of silently changing the buyer's price. The mobile client retires only that incomplete secure checkout attempt so the buyer's next retry can begin with a fresh signed cart.

## Verification

| Check | Result |
|---|---|
| Gateway owned Postgres `marketplace-cart-origin.postgres.test.ts` | **9/9 passed** through the real worker and one runner-owned disposable PostgreSQL database. It covers a configured seller rate being applied to the created COD order, client fee tampering being ignored, an address outside the configured zone being denied without advancing checkout, and a rate change after buyer review being rejected without creating an order. |
| Focused Gateway checkout/shipping unit contracts | **25/25 passed**, including tenant-bound rate creation and seller-zone option filtering. |
| Gateway TypeScript check | Passed. |
| Migration safety validator | Passed; migration 279 has a paired rollback. |
| Marketplace Flutter checkout/address/pricing tests | **9/9 passed**. |
| Targeted Dart analysis | Passed with no issues. |
| Dart API-client marketplace wire tests | **11/11 passed**, including signed delivery-option query propagation. |
| `git diff --check` | Passed. |

The 60 INR rate in the database test is synthetic seller configuration used only in the disposable test database; no price or delivery policy was added as a production default. Migration 279 is local and has not been applied to a shared or hosted database. No device/browser run, live-carrier query, provider transaction, hosted cutover, or deployment was performed.

## Limits and next work

- This proves address matching against the seller's saved shipping-zone declaration, not current carrier serviceability. The response says so. Carrier integration is sandbox/live-gated separately; a carrier's live pincode support, pickup coverage, COD eligibility and delivery promise remain unverified.
- Only flat, free and price-bounded options are exposed. Weight-based pricing needs trusted package weights before it can be enabled.
- Existing checkout retry, listing withdrawal/recovery UI, cross-seller order allocations, marketplace online provider eligibility, capture/late-callback recovery, fulfillment/refunds, device/browser verification and full Phase 8.7 remain open.

Phase 8 and the locked eleven-phase goal remain active.

## 4 October checkout UI acceptance continuation

The normal marketplace app's mobile checkout, Flutter web layout and desktop wrapper all reach
the same `CheckoutScreen` / `PaymentMethodScreen`; there is no second marketplace checkout widget
that bypasses rate selection. A new widget flow now drives that shared screen through rate discovery,
seller-estimate display, explicit rate selection, server-total review, and the separate final COD
submission. It asserts that order confirmation is absent until the buyer accepts the repriced total,
the selected seller-rate ID reaches the delivery request, the checkout attempt token stays stable,
and online payment remains unavailable. The run also exposed and fixed the rate radio's missing
Material surface inside its decorated card.

| Check | Result |
|---|---|
| Four focused Flutter checkout/address/service/widget test files | **11/11 passed**, including the complete seller-rate buyer UI journey. |
| Targeted Flutter analysis of the changed screen and widget test | Passed with no issues. |
| Installed SDK preservation | Flutter ran through a temporary `/private/tmp` SDK/cache overlay; the protected installed SDK was not changed. |

This is widget-level local verification, not a real web browser, physical device, live carrier,
provider, hosted, or release result. The serviceability and commercial limitations above still apply.

## 4 October checkout retry recovery continuation

The same buyer-facing COD checkout widget now exercises the response-lost-after-commit boundary.
The test models the server committing an order and losing the response, then checks that a retry
uses the existing secure cart token, reads the minimal completed-order receipt, presents the order
confirmation, cleans up only the matching local cart, and does not submit a second confirmation.

| Check | Result |
|---|---|
| Flutter checkout UI, service, address and pricing files | **11/11 passed** with `--no-pub`; covers delivery-rate selection, server-total review, stale-listing recovery and UI-level lost-response recovery. |
| Targeted Flutter analysis | `payment_method_screen.dart` and the checkout UI test: no issues found. |

The lost response and completed status are simulated at the API client boundary; the owned Gateway/Postgres test separately exercises the real worker status route. This still is not a real device, browser, provider, hosted or release run. Existing SharedPreferencesService-not-initialized harness diagnostics print during widget tests and do not fail them.

## 4 October D08 source refresh

Razorpay's currently published [Terms & Conditions](https://razorpay.com/terms/) require a marketplace to accept payments only for sellers it has onboarded and with whom it has a contractual obligation, and describe master-merchant onboarding and seller authorization for sub-merchant collection. Its current [Route product page](https://razorpay.com/route/) describes linked accounts, transfers, reversals and configurable settlement holds, but does not establish LetBuyy's account eligibility or written use-case approval. Marketplace online intent creation therefore stays fail-closed until provider-written approval and counsel review address LetBuyy's actual entity, sellers, fund flow and responsibilities. See [F3.3 provider evidence](F3_PROVIDER_ELIGIBILITY_2026-10-04.md#4-october-official-provider-terms-refresh).
