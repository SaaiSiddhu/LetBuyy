# F8.3 normal storefront shipping-rate selection — 4 October 2026

## Outcome

Normal Commerce storefront checkout now quotes delivery from the merchant's
saved shipping zones and rates. The quote is scoped to the published store,
India destination, state/pincode coverage and server-read cart subtotal. Flat,
free and price-based seller rates are displayed; unsupported weight-based rates
are not guessed. COD is offered only when the selected rate and zone both allow
it. Seller estimates remain explicitly unconfirmed by a carrier.

The buyer must choose a returned rate. The reviewed rate ID and minor-unit
amount pass through the normal Commerce order BFF and Gateway. Gateway rechecks
current serviceability, amount, subtotal bounds and COD before claiming
idempotency. Migration 281 adds a service-role-only transaction wrapper that
locks the rate and zone, repeats address/amount checks, and invokes the existing
canonical guest or buyer-owned order RPC. A concurrent rate or zone edit waits
until order creation commits or rolls back. Changed quotes return a recoverable
conflict and the storefront refreshes options instead of silently retrying a
stale amount.

The signed hosted checkout delivery step also consumes saved seller-zone rates
and requires the reviewed amount for both storefront and marketplace delivery.
The standalone normal-checkout fallback and the old path from the rate BFF to a
merchant-authenticated endpoint are removed. The migration has a paired
rollback. A hosted checkout database run exposed and corrected an integration
gap: the signed delivery-options endpoint had reused the marketplace's COD-only
resolver for storefront carts. It now resolves all storefront rates (including
online-only rates from a zone that disallows COD) and preserves each rate's
actual COD eligibility through the Commerce BFF.

## Verification

| Check | Result |
|---|---|
| Focused Gateway shipping/checkout tests (`storefront-shipping.test.ts`, `shipping.test.ts`, `checkout.test.ts`) | **23/23 passed**, including the storefront UI quote/selection/amount contract. |
| Commerce signed checkout, order and shipping-rate BFF tests | **12/12 passed**. |
| Gateway and Commerce typechecks | Passed on this continuation. |
| Combined Gateway, Commerce and API-client typecheck command | Passed all three package typechecks. |
| `pnpm run validate:migrations` | Passed with migration 281 present. |
| `git diff --check` | Passed after the implementation, test and evidence updates. |
| Owned direct storefront Gateway/Postgres acceptance | `authenticated-checkout.postgres`: **9/9 passed**, zero fail/skip/TODO, Postgres 16, real Gateway worker + PostgREST. Runner run `6df0dc41bec4`. |
| Owned signed hosted-checkout Gateway/Postgres acceptance | `hosted-checkout-buyer-ownership.postgres`: **7/7 passed**, zero fail/skip/TODO, Postgres 16. Includes COD and online-only rates, zone COD disabled, COD denial, selected-rate order creation, buyer ownership, payment-intent recovery and rollback/reapply checks. Runner run `08f845a50c00`. |

The first hosted-suite run was red (0/5, run `2d90f1fba3a3`) because its older
fixtures sent an empty quote and had no configured seller rate; detailed replay
`74499ec34928` confirmed the sanitized `CHECKOUT_SHIPPING_RATE_REQUIRED`
response. Updating those cases to use real configured rates then exposed that
the signed quote GET was filtering storefront rates through a COD-only resolver.
Both the fixture journey and resolver are now corrected; the final 7/7 run
covers COD allowed and denied cases plus an online Razorpay adapter flow with a
non-COD rate. The earlier red run is retained here as the reason for the fix.

### 4 October browser acceptance continuation

The normal storefront-to-hosted-checkout journey now passes through actual
Commerce Next, the production Gateway worker, PostgREST, owned Postgres 16 and
Chromium. The browser starts at the synthetic store's tenant host with the
same cart token and local cart lines the Commerce cart provider hydrates, follows
the signed handoff, and obtains COD-eligible and online-only saved rates. It
asserts COD is disabled for the online-only rate, then switches to the COD
rate, submits the buyer/address details, and reaches “Order Confirmed!”. The
database contains exactly one COD order and one shipping line bound to the
reviewed rate ID and ₹20 amount. Owned suite `checkout-browser.postgres` passes
1/1 (runner `44ca45e83dbe`; no skip/TODO); runner cleanup removed its database
and PostgREST container without leftovers.

This browser run also found that the normal BFF origin check compared against
Next's internal URL origin and rejected a legitimate store-host POST when the
host was forwarded. The checkout-handoff and hosted checkout step handlers now
use the established strict forwarded-origin validator, which requires a
same-origin Fetch Metadata value when Origin is absent and rejects cross-site
requests. Its focused regression passes 4/4, including an allowed forwarded
same-origin request and a denied attacker-origin request. Commerce and Gateway
typechecks pass after the change.

The authored owned test covers a successful selected-rate quote/order path,
no-rate and out-of-zone refusal, stale client amount, and a rate mutation
between preflight and transaction. It also verifies guest/buyer order ownership,
same-key replay, disabled/revoked-buyer refusal and a simultaneous last-variant
checkout race. Migration 281 was applied only to the runner-owned disposable
databases for these runs; both runners returned exit 0 with no cleanup failures
or remaining labeled resources. No restored, shared or hosted database was
changed.

### 5 October browser continuation — stale quote recovery

The actual Commerce checkout UI now covers a saved rate changing after the buyer
reviews it. Chromium selects the configured ₹20 COD rate; the browser harness
changes its owned fixture to ₹25 immediately before the delivery quote reaches
the Gateway. The Gateway rejects the stale buyer-reviewed amount, and the UI
shows the conflict, refreshes the saved rates, and clears the old selection.
Chromium verifies there is no order or payment-intent creation, sees ₹25, must
select the refreshed rate again, and then completes exactly one COD order with
the ₹25 shipping line. The same suite retains normal COD and synthetic hosted
Razorpay browser journeys.

The final owned run `c920d01bcfa9` passes **3/3** with no failures, skips,
cancellations or TODOs. PostgreSQL, PostgREST, containers, network and volumes
were removed. Commerce and Gateway typechecks plus `git diff --check` pass. See
the [sanitized run record](F8_1_STOREFRONT_STALE_QUOTE_BROWSER_RUN_2026-10-05.json).

## Limits and next task

This is local browser and worker/database integration evidence, not physical
device acceptance, carrier confirmation, payment-provider acceptance or
deployment. The hosted Razorpay adapter result is synthetic test evidence, not
provider sandbox acceptance. Phase 8 remains open. Next continue with the F8.2
cross-seller parent/allocation boundary while preserving the unresolved human
choices around buyer-facing grouping, per-seller shipping/COD collection,
refunds and merchant privacy. Do not claim the eleven-phase programme complete.
