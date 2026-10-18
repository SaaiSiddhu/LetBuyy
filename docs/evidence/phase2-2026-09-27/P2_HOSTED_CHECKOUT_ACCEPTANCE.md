# Hosted checkout integration — local acceptance

**Date:** 2026-10-04 (Asia/Kolkata)  
**Checkout:** `/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-phase2`  
**Branch:** `letbuyy/phase2-shared-buyer-identity`  
**Base observed at start:** `0862687a5008d604d0df23357b2eb511293139fa`  
**State:** implementation in the shared working tree; not committed, pushed, merged,
deployed, or formally accepted.

## Delivered locally

- Added a same-origin Next route for the hosted checkout state machine. It validates
  step schemas and signed-handoff query fields, rejects foreign origins and oversized
  bodies, forwards only validated JSON, and returns a minimal projection rather than
  upstream PII or database rows.
- The checkout-origin page verifies that the gateway's returned cart ID matches the
  requested cart and passes only the signed handoff values into the client.
- Hosted COD now records contact, delivery, COD payment intent, and confirmation through
  the signed-cart gateway state machine. Product lines and prices remain derived from
  the server cart. Step idempotency keys remain stable for a retry and rotate when that
  step's payload changes.
- The legacy order BFF now requires same-origin JSON and a valid signed handoff, then
  checks store and exact cart line identity/quantities plus the cart-bound coupon before
  it can call order creation.
- The gateway's verified-handoff response includes the cart coupon code so the server
  can validate the submitted legacy order against the signed cart.

## Local verification

| Check | Result |
|---|---|
| `node --import tsx --conditions react-server --test src/app/api/checkout/route.test.ts src/app/api/orders/route.test.ts` from `apps/commerce/web` | 7/7 pass |
| `node --import tsx --test services/api-gateway/src/__tests__/checkout.test.ts services/api-gateway/src/__tests__/checkout-d6.test.ts` | 14/14 pass |
| `pnpm --filter @letbuyy/customer-web typecheck` | exit 0 |
| `git diff --check` | pass |

The API tests cover allowed forwarding, response projection, wrong/missing origins,
unknown steps, malformed bodies, invalid handoffs, upstream failure sanitization, and
rejection of unsigned, expired, cross-store, changed-line, and changed-coupon order
requests. Gateway tests cover the existing checkout lifecycle and signed cart binding.

## Remaining acceptance

- No real browser/device order journey was run. No live DNS, hosted origin, production
  signing key, provider credential, or production payment was used.
- Hosted Razorpay still uses the existing storefront order/payment verification journey;
  it is not yet joined to this checkout-session state machine. The state machine currently
  requires provider payment proof at confirmation, and the current online UI flow must be
  integrated only after that proof is verified against the canonical provider verifier.
- Cross-origin buyer-session continuity and atomic buyer-order ownership at order creation
  are not established by cart HMAC verification. Cart authenticity is not buyer identity.
- Hosted coupon entry/pricing presentation and authoritative server quote parity need a
  separate integration slice; this work does not claim coupon UX is complete.
- The secure-origin and live-payment setup gates remain human-required. This evidence is
  local implementation/testing only, not cloud readiness, deployment, or phase acceptance.

## Next concrete task

Join hosted Razorpay to the state machine without weakening the existing provider
signature/replay checks: create a provider order server-side from the server-resolved
checkout amount, persist and bind its provider order ID to the checkout session, then
verify the callback fields and reconcile through the canonical payment/ledger path.
In the same bounded slice, resolve how the verified buyer session crosses to the hosted
origin and how buyer-order ownership is written atomically. Keep live credentials,
hosted cutover, and real payments outside the local implementation task.

## Security follow-on — 4 October 2026

Source review found that the hosted `/confirm` handler previously accepted a generic
`provider_payment_id` and called `PaymentExecutionAdapter.confirmPayment` without checking
the Razorpay signature or the server-bound Razorpay order ID. That route had no browser
consumer yet, but a caller with a valid signed cart handoff could reach the handler; a
cart signature authenticates the cart, not a payment. The previous handler also omitted
the provider-payment replay guard used by the storefront payment route.

The hosted confirm schema now accepts explicit Razorpay order/payment/signature fields,
rejects the generic payment-ID field, verifies the Razorpay HMAC through the shared
verifier against a provider order ID already stored on the checkout session, then invokes
the existing global replay check before order/capture work. Non-COD hosted payment-intent
requests now return `PAYMENT_SETUP_REQUIRED` rather than minting a synthetic value that
could look like provider authority. COD remains available through the state machine.

Verification after this change:

| Check | Result |
|---|---|
| `node --import tsx --test services/api-gateway/src/__tests__/checkout.test.ts services/api-gateway/src/__tests__/checkout-d6.test.ts services/api-gateway/src/__tests__/provider-payment-verification.test.ts packages/checkout-core/test/checkout-core.test.ts` | 31/31 pass |
| `node --import tsx --conditions react-server --test src/app/api/checkout/route.test.ts src/app/api/orders/route.test.ts` from `apps/commerce/web` | 7/7 pass |
| `pnpm --filter @letbuyy/api-gateway typecheck` | exit 0 |
| `pnpm --filter @letbuyy/customer-web typecheck` | exit 0 |
| `pnpm --filter @letbuyy/commerce-core build` followed by `pnpm --filter @letbuyy/checkout-core typecheck` | both exit 0 |
| `git diff --check` | pass |

An earlier package-script attempt to run checkout-core tests could not start because
tsx's IPC pipe hit sandbox `EPERM`; the direct Node/tsx command above ran the same test
file and passed. No real Razorpay sandbox transaction, hosted browser journey, or
provider-order creation/binding is verified. Razorpay's [official integration guidance](https://razorpay.com/docs/server-integration/python/test-app/)
requires a server-created order and server-side HMAC verification using the server-held
order ID; this implementation now fails closed until the missing hosted-order binding is
built.

## 4 October correction — buyer ownership path connected in local source

The legacy `/api/orders` finalization now forwards a site-matching canonical buyer session and the
gateway calls the transactional `create_checkout_order_for_buyer` wrapper for authenticated buyers.
The guest path is retained. See [authenticated checkout ownership acceptance](P2_AUTHENTICATED_CHECKOUT_OWNERSHIP_ACCEPTANCE.md).
The owned-worker/Postgres suite is authored but did not run because no Docker daemon is available;
this does not close the canonical hosted state-machine path, provider-order binding, payment recovery,
browser/device acceptance, or hosted launch requirements recorded above.

## 4 October update — Phase 2 order ownership accepted on owned Postgres

The buyer ownership slice is now locally verified end to end through the real gateway and an owned
disposable Postgres database: five checkout scenarios pass, including stale-session race rejection,
idempotent ownership, guest preservation, backend-only RPC grants and rollback/reapply. The full
gateway database lane passes 119/119. See `P2_AUTHENTICATED_CHECKOUT_OWNERSHIP_ACCEPTANCE.md`.
This resolves the Phase 2 ownership writer requirement while leaving the separate Phase 8 canonical
checkout-state-machine integration, provider order creation/binding, payment recovery, browser/device
journey, and hosted launch requirements open.

## 4 October correction — buyer identity crosses hosted checkout without a URL bearer

The preceding entry is superseded for the hosted COD buyer-ownership path. A same-origin commerce
BFF now reads the canonical buyer session from its HttpOnly storefront cookie and forwards it only
server-to-server to the gateway. No bearer is placed in the checkout URL or returned to browser
JavaScript. The gateway checks the signed site and live buyer status/session epoch, then binds the
buyer to the hosted checkout session. The order adapter carries that identity into the atomic
`create_checkout_order_for_buyer` transaction when COD is confirmed. Guest checkout remains
available, and the existing ownership link is written with the order transaction.

Migration 268 adds the session binding fields and a service-role-only binding function. Binding is
serialized for a site/cart, rechecks buyer status and epoch, rejects a changed cart token and refuses
to rebind another buyer or completed checkout. Its rollback intentionally refuses while an active
bound checkout exists; rollback/reapply was exercised only after the checkout reached a terminal
state in the disposable owned database.

| Check | Result |
|---|---|
| Gateway unit suite, `pnpm --filter @letbuyy/api-gateway run test:unit` | 1,345 total; 1,344 pass, 0 fail/cancel/skip, 1 existing TODO; exit 0 |
| Commerce handoff and orders BFF tests | 7/7 pass (run with `node --conditions react-server --import tsx --test src/app/api/checkout-handoff/route.test.ts src/app/api/orders/route.test.ts` from `apps/commerce/web`) |
| Commerce and gateway TypeScript checks | both exit 0 |
| Full gateway owned-DB lane before final rollback guard/assertion | 122/122 across 20 suites; exit 0 |
| Final hosted-checkout buyer-ownership owned-DB suite | 4/4 pass; 0 fail/cancel/skip/TODO; cleanup verified |
| `git diff --check` | pass before this documentation update |

The focused database suite drives the real gateway worker against runner-owned Postgres/PostgREST.
It proves authenticated COD ownership, guest preservation, wrong-site and stale-epoch refusal,
other-buyer rebind refusal, service-only grants, active-session rollback refusal and terminal
rollback/reapply parity. Its sanitized run summary is
[`P2_HOSTED_CHECKOUT_BUYER_DATABASE_RUN.json`](P2_HOSTED_CHECKOUT_BUYER_DATABASE_RUN.json).
All disposable database, REST, container, network and volume fixtures were reported cleaned up;
the restored development database and hosted databases were not changed.

This closes the locally verified buyer-binding/order-ownership slice only. It does not establish a
real browser PKCE session, deployed storefront or checkout origin, provider sandbox payment,
Razorpay provider-order creation/binding, online payment recovery, hosted coupon quote parity,
production migration, cloud readiness, or Phase 2 closure. The checkout-origin canonical state
machine and existing storefront online-payment path still need an end-to-end integration decision
and acceptance. No migration was applied outside the disposable test database.

## 4 October UI correction — hosted payment and saved-address gates

Source review found the shared checkout UI still offered Razorpay on the hosted checkout origin,
where its click path used the legacy order/payment calls rather than the hosted checkout state
machine. That path did not carry the server-bound buyer through canonical online order ownership
and payment recovery. Hosted checkout now fails closed for online payment: it defaults to COD when
COD is enabled, otherwise shows that no method is available. Storefront-origin Razorpay remains
unchanged. The Razorpay browser script is not loaded on the hosted origin while its flow is gated.
Hosted checkout also skips the legacy host-only customer-address request; the signed cart handoff
alone is not authority to disclose a buyer's saved-address PII. The form explains that the delivery
address must be entered for this checkout.

| Check | Result |
|---|---|
| Customer-web typecheck | exit 0 |
| `node --conditions react-server --import tsx --test src/lib/checkout/payment-availability.test.ts src/app/api/checkout/route.test.ts` from `apps/commerce/web` | 8/8 pass |
| `git diff --check` | pass |

This is a local UI and policy gate, not hosted-browser acceptance. Next hosted-payment work must
bind the Razorpay provider order to the checkout session, verify callback signatures and replay,
create buyer ownership atomically, and cover failure/retry/reconciliation before enabling online
payment on this origin. Safe saved-address continuity also requires a checkout-origin authorization
proof beyond possession of the cart handoff; no PII bridge was added.

### Provider contract checked 4 October 2026

Razorpay's [official Standard Checkout integration guide](https://razorpay.com/docs/server-integration/python/test-app/)
requires server-side order creation for each payment, passing the resulting server-created order ID
to Checkout, and HMAC verification using the server's order ID plus the returned payment ID. The
guide also calls for checking actual payment status/capture through a trusted source; a valid
signature alone is not evidence that the correct amount was captured. The existing hosted confirm
path has signature/order binding and replay checks, but it still needs server-side captured-status
and exact amount verification before this path can be enabled. This is the acceptance consequence
for the next implementation; no provider credentials were used and no sandbox transaction was run
in this local verification.

## 4 October update — hosted Razorpay server-order and capture path implemented locally

The hosted gateway now creates one canonical, buyer-linked pending order from the server-resolved checkout total, sends its exact integer INR paise amount to the existing Razorpay adapter, stores the provider order ID and amount on the checkout session, and attaches that provider reference to the canonical order/payment records. Confirmation verifies the callback HMAC against that stored order ID, checks global payment replay, fetches provider payment status, and only posts capture through the existing ledger RPC when the fetched payment is captured for the exact order, amount and currency. A captured mismatch is queued for support review; a captured payment against an unfulfillable order is recorded through the canonical RPC and the checkout is failed rather than announced completed. Live mode and tokenization remain closed.

Before the provider call, the session records a durable `creating_provider_order` state. If the request outcome is ambiguous, subsequent attempts stop for reconciliation rather than creating another provider order. Once the provider ID has been saved, an interrupted local reference write can be resumed idempotently. Razorpay's [Orders API documentation](https://razorpay.com/docs/api/orders/fetch-with-id/?preferred-country=SG) says receipt values are unique and limited to 40 characters; the integration uses the cart UUID as the stable receipt. The documented fetch endpoint requires the provider order ID, so an ambiguous create response still requires an operator/provider reconciliation path before retries can resume. This is why the hosted browser UI remains gated.

The owned-worker/Postgres regression covers buyer ownership, canonical amount binding, no secret exposure, status-pending retry, provider-order reuse, capture ledger idempotency and callback replay. Its first run exposed the missing tenant predicate during idempotency reclaim; after fixing that shared-path defect, the final run passed all five tests. The normal package test script still encounters `tsx` IPC `EPERM`, so the full gateway unit suite used `node --import tsx`; the owned DB lane ran through the repository's labeled resource-owning runner with elevated Docker access and confirmed cleanup.

| Check | Result |
|---|---|
| Gateway typecheck | exit 0 after strict branded idempotency-key fix |
| Focused checkout, handoff, provider-signature and checkout-core tests | 33/33 pass |
| Gateway unit suite via direct Node runner on final source | 1,345 pass, 0 fail, 1 existing TODO |
| Commerce hosted handoff BFF tests | 3/3 pass |
| Owned hosted-checkout worker/Postgres suite | 5/5 pass; zero skips/TODOs; disposable DB/container/network/volume cleanup verified; see [`P2_HOSTED_CHECKOUT_RAZORPAY_DATABASE_RUN.json`](P2_HOSTED_CHECKOUT_RAZORPAY_DATABASE_RUN.json) |
| Razorpay sandbox/browser/device | not run; no credentials or external transactions used |
| `git diff --check` | pass |

This is local implementation evidence only. It does not enable hosted online payment, establish provider sandbox acceptance, close payment recovery, prove a real browser/device journey, or close Phase 8/11. The immediate next task is to execute this owned database regression in an available isolated Docker environment, then add the provider-order ambiguity/reconciliation operation and a sandbox/browser journey before opening the hosted UI gate.

## 4 October correction — ambiguous Razorpay order creation now recovers by receipt

The preceding entry's immediate task is complete for the local provider-order recovery slice. When Razorpay creates an order but the create response is lost, the checkout session retains its durable `creating_provider_order` state. A retry performs a bounded lookup for the exact cart UUID receipt and binds an order only when there is one result whose entity, status, receipt, INR amount, server-resolved canonical order, tenant, checkout session and stable idempotency note all match. An empty, duplicate, foreign or otherwise mismatched result keeps the existing support-review response and does not create another provider order. The server still requires the provider capture and exact amount checks before ledger posting; this change does not enable the hosted online-payment UI.

The official [Razorpay Fetch All Orders API](https://razorpay.com/docs/api/orders/fetch-all/) documents the exact `receipt` filter and bounded `count` query used for recovery. No secrets or external provider calls were used in the local tests.

| Check | Result |
|---|---|
| `pnpm --filter @letbuyy/api-gateway typecheck` | exit 0 |
| Focused checkout/signature and Razorpay adapter tests | 25/25 pass, 0 fail/cancel/skip/TODO |
| Owned gateway/Postgres checkout suite on final recovery test | 5/5 pass, 0 fail/cancel/skip/TODO; run `7c762caa7657`; disposable resources cleaned up; see [`P2_HOSTED_CHECKOUT_RAZORPAY_RECOVERY_DATABASE_RUN.json`](P2_HOSTED_CHECKOUT_RAZORPAY_RECOVERY_DATABASE_RUN.json) |
| `git diff --check` | pass |

This is local verification with a synthetic provider adapter and owned Postgres/PostgREST, not a Razorpay sandbox transaction or hosted browser/device journey. Runtime-role RLS, provider sandbox acceptance, cross-origin real buyer session behavior, hosted deployment and production cutover remain unverified. The next bounded task is a real browser acceptance of the hosted checkout state machine in a controlled environment, followed by a provider sandbox journey with approved credentials; keep the hosted online-payment gate closed until those acceptance records pass.

## 5 October correction — hosted buyer journey passes in owned Postgres and Chromium

The previous entry's browser acceptance gap is now closed for the local synthetic journey. Chromium drives the normal Commerce storefront handoff into the checkout-origin application, chooses a saved delivery rate, and completes both COD and Razorpay paths through the real Gateway worker and runner-owned Postgres/PostgREST. COD persists the exact selected COD rate and is not announced as paid. Razorpay uses only a synthetic provider adapter; Gateway verifies the signed callback and server-fetched captured status/amount, records one confirmed/paid order, one provider capture, one canonical ledger entry, one `order.paid` outbox event, and one signed store-scoped confirmation-email queue job containing the order line. The callback does not use a live provider or external transaction.

The browser test caught two integration defects and was rerun after both fixes: successful hosted captures were missing the `order.paid` announcement, and the confirmation-email item query lacked its store predicate and selected a nonexistent column. Checkout now uses the existing provider-payment-idempotent event/email path only after a fulfillable capture and ledger proof; email order-item lookup is tenant scoped and uses columns present in the canonical schema.

| Check | Result |
|---|---|
| Owned Commerce + Gateway + Postgres/PostgREST Chromium journey | 2/2 pass, zero failures/skips/TODOs/cancellations; run `34b3931106ab`; fixture ownership verified and containers, network, volume, REST service and database cleaned. The proxy reports one upstream connection error among 354 forwarded requests (zero refused); the worker log has no HTTP 4xx/5xx or error event, and all browser assertions pass. See [`F8_HOSTED_CHECKOUT_BROWSER_RUN_2026-10-05.json`](F8_HOSTED_CHECKOUT_BROWSER_RUN_2026-10-05.json) |
| Gateway order-confirmation email tests | 3/3 pass |
| Gateway typecheck | exit 0 |
| `git diff --check` | pass |
| Razorpay sandbox, hosted domain and production | not run; no external payment or deployment |

The prior “not run” statement remains historical and is superseded for this local browser journey only. This does not establish PSP sandbox acceptance, live custom-domain identity continuity, provider refund/reconciliation, mobile/device behavior or production rollout. The hosted online checkout code path has local integration evidence; external/provider and release acceptance remain open.
