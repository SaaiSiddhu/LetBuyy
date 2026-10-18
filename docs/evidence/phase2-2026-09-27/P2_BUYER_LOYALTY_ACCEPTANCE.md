# Canonical buyer rewards — local acceptance

Date: 4 October 2026 (Asia/Kolkata)  
Checkout: `LetBuyy-phase2`, branch `letbuyy/phase2-shared-buyer-identity`  
Implementation and acceptance evidence are in the current working tree.

## Outcome

The site-bound LetBuyy buyer session can now read the selected store's merchant-funded rewards summary and recent ledger history. The gateway derives buyer and site from the signed storefront session, scopes database reads to both, uses the existing ledger projection for the exact balance and performs no TypeScript ledger writes. The storefront BFF exposes only validated balance and history fields with `no-store` responses. The React account page distinguishes an unconfigured programme from an enrolled zero balance, shows paused programmes, and links canonical buyers from both React and Liquid account navigation.

## Evidence

| Check | Result |
| --- | --- |
| Gateway loyalty route and source-guard tests | 17/17 passed, covering platform and storefront sessions, signed site/buyer authority, history caps, ledger projection, and read-only access |
| Owned Postgres/PostgREST real-worker suite | 3/3 passed: enrolled projection/history, no programme versus zero balance, site/buyer isolation and sanitized database failure |
| Commerce buyer proxy suite | 61/61 passed, including exact balance preservation, unsafe numeric rejection, no-program distinction, history allowlist and host-bound token forwarding |
| Liquid account rendering | 6/6 passed; Rewards appears for a canonical buyer, not a legacy customer |
| TypeScript | Gateway, commerce web and theme-engine checks passed |
| Gateway database-lane governance | 12/12 passed; loyalty is registered as the eighteenth owned gateway suite |
| `git diff --check` | Passed |

The normal account page requests at most 50 recent rows; the gateway caps direct requests at 100. Large integer balances remain decimal strings through the BFF and UI. A failed read returns an error, never a fabricated zero. No client-supplied identity, email, programme rate or mutable balance is trusted.

## Limits and next work

This is local code, proxy, real-worker and disposable-owned-database evidence. It is not a live browser identity-provider sign-in, custom-domain journey, hosted database check, production release, or proof that every checkout path is connected to the account. Hosted checkout buyer association is wired locally, but its new browser/owned-Postgres acceptance remains outstanding; legacy issuer retirement and the wider eleven-phase programme remain open.

Historical checkpoint note, superseded by the 4 October correction below: the signed hosted checkout flow and buyer ownership are implemented locally. Its browser/owned-Postgres acceptance remains open; see the dated correction for the exact verification status.

Primary-source research (4 October 2026): Razorpay's [Standard Checkout integration guide](https://razorpay.com/docs/server-integration/python/test-app/) says each payment uses a server-created provider order and the server must verify the returned HMAC signature built from the provider order ID and payment ID. Preserve that verification while moving the application-order creation behind LetBuyy's signed handoff; the client callback alone is not payment proof.

## 4 October correction — hosted online checkout joins the signed state machine

The checkout-origin Razorpay implementation no longer creates a payable order through the legacy `/api/orders` → merchant Razorpay endpoints. It persists contact and delivery through the signed `/api/checkout/:cartId/*` flow, requests a server-created Razorpay order from the Gateway payment-intent step, and confirms through the Gateway only after sending the provider order ID, payment ID and signature. Hosted online payment is now offered when enabled for the store; the merchant-origin path is unchanged. Buyer association remains session-bound at the store origin and is written by the canonical buyer-owned order RPC after the hosted session has been bound; browser-provided buyer IDs are not accepted.

Commerce checkout/order/availability tests pass **16/16**, including provider-order projection, signed proof forwarding, hosted online-only availability and wrong-store/session denial; Gateway checkout contracts pass **11/11**. Commerce web and Gateway TypeScript pass. Focused ESLint has zero errors and 51 warnings in the existing large checkout UI. Added a Chromium owned-Postgres journey that fakes the Razorpay popup and asserts one paid order, provider capture, canonical ledger entry and one `order.paid` outbox event. That browser suite could not run: Docker's configured socket has no daemon, and the installed `/Applications/Docker.app` cannot open because its executable is missing. Earlier owned-Gateway acceptance for hosted Razorpay provider recovery and capture remains recorded at 7/7 and 8/8 in the dated checkout records; the new Commerce-to-Gateway browser journey has no runtime result. No Razorpay sandbox or live transaction was used. Browser acceptance, owned-Postgres execution, provider-sandbox verification and full cross-buyer recovery remain open.

Next: run the existing hosted-checkout owned-Postgres suite and a browser journey with a Razorpay test adapter when the local Docker/browser runtime is available; retain legacy merchant checkout coverage and add buyer-order ownership assertions to the hosted journey.

## 10 October continuation — clear rewards data across buyer-session changes

The account rewards client previously fetched its balance and ledger only on
mount. The shared account shell keeps route children mounted while it
revalidates the host-only buyer cookie, so a cross-tab switch could let the
previous buyer's rewards render again after the shell accepted another buyer.
The client now binds each read to `buyerSessionRevision`, aborts the prior
request, hides cached balance/history while the session is refreshing, and
discards late responses from an earlier revision. A failed identity check also
clears the old rewards data and shows an unavailable state.

The mounted React test uses the real customer and wishlist session providers
with synthetic BFF responses. It loads buyer A's balance/history, holds a
focus-triggered session check and confirms A's rewards disappear, resolves the
same-email/different-ID switch to buyer B and confirms only B's rewards load,
then injects a verifier failure and confirms B's data is cleared. The test is
registered in the Commerce package suite. `pnpm --dir apps/commerce/web test`
passes all three stages (**104/104**, **135/135**, **947/947**); Commerce
typecheck and `git diff --check` pass. Scoped ESLint reports zero errors and
two existing unescaped-apostrophe warnings in the rewards component.

This is local mounted-component/session-context evidence with synthetic BFF
responses. No Chromium, Gateway/Postgres, hosted identity, rewards mutation or
provider journey was performed. It closes this React stale-read boundary only;
the F2.1 session-policy and issuer/drain gates and the remaining Phase 2 and
eleven-phase requirements remain open.
