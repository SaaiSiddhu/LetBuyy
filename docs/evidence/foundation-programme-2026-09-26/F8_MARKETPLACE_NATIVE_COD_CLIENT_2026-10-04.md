# F8.3 native marketplace COD client slice — 4 October 2026

## 8 October response-loss recovery continuation

The continuous native-client to owned-Gateway/Postgres integration now drops
the confirmation response only after the production worker has committed the
COD order. The real mobile service retains its secure checkout attempt; on
retry it calls seller-scoped checkout status, returns the already committed
order receipt, and does not create a second order. The integration asserts one
order and one checkout-session binding for the cart, then clears the completed
attempt. The full owned Gateway/Postgres suite passes **14/14**, zero
failures/skips/TODOs (`e065d4584aae`); Gateway typecheck and focused diff checks
pass. See [the dated recovery evidence](F8_1_STALE_LISTING_CHECKOUT_RECOVERY_2026-10-04.md#committed-order-response-loss-recovery-through-native-client--8-october-2026)
and [the run record](F8_MARKETPLACE_MOBILE_RESPONSE_LOSS_OWNED_RUN_2026-10-08.json).

This remains local service/API/database integration rather than physical-device,
hosted, PSP or release acceptance. The separate 8 October emulator widget run
below does not change those limits. Phase 8 remains open for D08/provider
acceptance, cross-seller allocation, fulfillment/refund recovery and remaining
channel certification.

The native widget journey also removes the remaining app-layer gap: after the
simulated committed-but-lost response, it empties the local cart, edits the
email to an invalid value, and retries through the checkout button. The UI now
lets the service check for a committed receipt before showing an empty-cart
error; recovery presents the original order without another confirmation.

## Recovery takes precedence over changed local checkout input — 8 October 2026

The mobile service now checks a persisted buyer-scoped attempt for a committed
order before validating current email/cart input or resolving current listing
state. This preserves receipt recovery when the buyer emptied the cart or
changed contact details after the confirmation response was lost. The retry
uses the stored seller/cart capability, and marks the result as not matching
the current cart when its revision changed. A real production Gateway worker,
PostgREST and runner-owned PostgreSQL integration drops the response after
commit, retries through Flutter `ApiClient` with empty items, invalid changed
email and a new revision, then verifies the same receipt and exactly one order
and checkout binding. The suite passes **14/14** (`e065d4584aae`); focused
checkout-service/COD-widget tests pass **7/7**, and targeted Flutter analysis
passes. The stale-listing widget fixture now supplies an in-memory attempt
store rather than invoking an unmocked secure-storage channel.

A buyer-isolation widget regression starts recovery under a signed-in buyer,
switches the stored session to a second canonical buyer before checkout status
returns, and refreshes that identity through the fake account API. It verifies
the first buyer's receipt is not displayed, the second buyer's session remains
active, the cart stays intact and both buyer-scoped secure attempts are retained.
This uses fake API responses and in-memory stores; it is not another real-Gateway
integration or sign-in-flow test.

The **7/7** focused service/UI suite also passes on Android emulator
`sdk_gphone64_arm64`; the buyer-isolation case runs without the prior
uninitialized-preferences warning after the fixture initializes mocked
preferences. No physical-device test is claimed.

## Native checkout-attempt storage integration — 8 October 2026

An Android `integration_test` now exercises `MarketplaceCheckoutService` with
its production-default `FlutterSecureStorage` attempt store, not the in-memory
test double. In the prepare run, the service writes a synthetic buyer-scoped
attempt while preparing COD checkout and returns the shipping review. The test
app is kept installed; its process is force-stopped, native preference files
are confirmed to remain, and a separate recovery run launches the app again.
That new process reads the encrypted storage entry, asks the fake Gateway only
for the signed cart's checkout status, and recovers a synthetic committed
receipt despite an empty current cart and invalid changed email. It verifies
the cart token, receipt and exactly one status request without opening another
cart or confirmation. Both stages pass (**1/1 each**) on Android emulator
`sdk_gphone64_arm64` through `flutter drive`. All API responses and order data
are synthetic; no Gateway, database, provider or live order is contacted. No
existing secure-storage key or user data is read or changed. This proves
app-process-restart persistence on the emulator; physical-device verification
remains open.

A second process-restart pair covers the non-completed failure path. After
force-stop/relaunch, the fake checkout-status endpoint returns 404. The service
retains the stored buyer attempt, reconstructs the same seller cart with the
original token, returns a fresh shipping review, and sends no confirmation.
Prepare and retry stages each pass (**1/1**) on the same emulator; the retry
asserts one status request, one cart request with the original token, no
confirmation request, and an unchanged secure attempt. This is a synthetic
not-yet-committed state, not an owned Gateway test or provider journey.

A third process-restart pair covers buyer isolation in the native plugin.
Buyer one prepares a synthetic attempt; after force-stop/relaunch, buyer two
uses a different canonical namespace with an empty cart and invalid email.
The service returns `CHECKOUT_CART_EMPTY` without making an HTTP request,
buyer one's secure attempt remains unchanged, and no buyer-two attempt appears.
Both stages pass (**1/1**) on the emulator; the recovery-stage teardown removes
both dedicated synthetic keys. This verifies namespace isolation across the
actual Android secure-storage plugin, not account authentication or a server
authorization boundary.

This is still local integration/widget evidence, not physical-device, hosted,
PSP or release acceptance. D08, Phase 8 and the other open channel,
cross-seller, fulfillment and refund requirements remain open.

## Outcome implemented locally

The marketplace mobile app now connects its existing cart and address screens to the canonical seller-bound checkout state machine. `MobileCartScreen` and the Flutter web-layout cart both open the shared checkout screen; payment offers COD only. Checkout refreshes each marketplace listing, checks seller and listing identity, creates a server-priced marketplace cart, obtains and validates its signed handoff, and submits contact and delivery steps with stable idempotency keys. Client catalog prices are never sent as order totals.

The first submission asks the Gateway to reprice and resolve delivery, then shows the returned server breakdown and total. It does not create a COD intent or order until the buyer submits again with that exact total. If the price changes before confirmation, the app displays the new total and requires another explicit submission.

The app stores a random 256-bit cart token and request fingerprints in secure storage scoped to the canonical buyer ID or guest namespace. On retry/resume it checks a new minimal checkout-status route before starting another attempt. That route returns only cart state and the completed order receipt; a different seller cannot read it. After confirmed success, local cart cleanup subtracts only the captured quantities and variant IDs, and only while the same buyer namespace is active. A buyer/session switch cannot delete another account's cart or display the previous account's order number.

Marketplace cart variants are preserved as canonical variant IDs when lines are merged and when a completed snapshot is removed. Multiple sellers are refused at the client and remain unsupported by the canonical purchase allocation model.

## Verification

| Check | Result |
|---|---|
| Marketplace checkout service, COD screen, checkout address and checkout pricing Flutter tests | **9/9 passed.** Tests cover server repricing before intent, a changed total requiring another review, same-token/idempotency retry behavior, COD-only UI and adjacent address/pricing behavior. |
| Cart persistence, buyer/guest scope and guest-transfer Flutter tests | **33/33 passed.** |
| Variant identity and exact checkout snapshot model tests | **2/2 passed.** |
| Dart API-client marketplace route contract tests | **11/11 passed.** |
| Gateway-owned Postgres marketplace cart/order suite | **9/9 passed** through the production worker and runner-owned disposable database. Tests verify completed status recovery, minimal receipt fields, cross-seller denial, seller-configured shipping charges, out-of-zone denial and rate-change refusal. |
| Hosted checkout and signed-handoff tests | **18/18 passed.** |
| Targeted Dart analysis | Passed with no issues. |
| Gateway typecheck and migration safety validator | Passed. |
| Android secure checkout-attempt plugin integration | Completed-order, pending-retry and buyer-isolation process-restart pairs each pass **1/1 prepare + 1/1 recovery** via `flutter drive` on emulator `sdk_gphone64_arm64`; the app is force-stopped between stages. The pending path reuses its stored cart token after status 404 and issues no confirmation. The buyer-isolation path leaves buyer one's attempt private to that namespace and issues no API request for buyer two. |

No provider transaction, live order, physical-device journey, deployment, hosted database or restored database was used. The Phase 2 worktree is `LetBuyy-phase2`, branch `letbuyy/phase2-shared-buyer-identity`, source HEAD `0862687a5008d604d0df23357b2eb511293139fa`; this work remains uncommitted among substantial pre-existing local changes.

## Limits and next work

- **Superseded in part by [F8.1 seller-zone shipping selection](F8_1_SELLER_ZONE_SHIPPING_SELECTION_2026-10-04.md):** marketplace COD now requires an active seller-configured destination rate and does not use the method-based zero-price fallback. The response verifies the merchant's saved zone declaration, not live carrier serviceability.
- D08 still blocks marketplace online collection. Razorpay stays unavailable in the marketplace app until provider eligibility, contracting entity and fund flow are accepted and provider sandbox behavior is verified.
- Post-review listing-revision recovery now clears the stale buyer-reviewed total and retires the incomplete cart capability; a second synthetic client review re-resolves eligibility, identifies a withdrawn line, and exercises buyer-directed removal while preserving the cart until then. Continuous mobile-to-owned-Gateway/Postgres evidence now covers one successful COD order followed by a material-edit refusal that preserves that prior order; see the [dated continuation](F8_1_STALE_LISTING_CHECKOUT_RECOVERY_2026-10-04.md#continuous-native-client-to-owned-gateway-stale-listing-journey--7-october-2026). Cross-seller parent/allocation transactions, capture/late-callback reconciliation, fulfillment, partial refunds and full Phase 8.7 channel certification remain open.
- Android emulator widget/client coverage runs for the focused service/UI suite with a fake API and in-memory stores. The separate 8 October `integration_test` exercises the production-default secure-storage plugin across an app-process force-stop/relaunch with a fake API. No physical Android handset, browser, PSP sandbox, hosted or release acceptance has run for this new path.

Phase 8 and the locked eleven-phase goal remain active.
