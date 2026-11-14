# Razorpay test-mode verification — 30 October 2026

**Blocked: Razorpay rejects the configured local test credentials. No actual payment has been verified.** The owner confirmed that a replacement test key pair is not available at present.

## Executed evidence

- A real authenticated **GET /v1/orders?count=1** to `https://api.razorpay.com` returned **401**, `BAD_REQUEST_ERROR`, **Authentication failed**. Credentials were loaded privately from the existing gateway configuration and never printed. The key had a test-mode prefix; no live key was used. This was a read-only request, with no order or payment creation.
- Chromium opened the local marketing pricing page with HTTP 200, loaded **the real** `https://checkout.razorpay.com/v1/checkout.js`, and observed the Razorpay constructor. No SDK replacement, provider response interception, payment modal, form submission or payment attempt was used. SDK availability alone does not establish checkout success.
- The configured public key is consistent across Gateway, webhook service, queue worker, Merchant and Identity local files. Consistency does not make the rejected credentials valid.
- Read-only service checks are recorded separately below. Existing local services were not reconfigured or restarted.

[Provider response](evidence/provider-preflight.json) · [Browser SDK check](evidence/browser-preflight.json) · [Local services](evidence/local-services.json) · [Acceptance state](acceptance.json)

## Additional configuration prerequisite

The shared gateway has no `LETBUYY_SUBSCRIPTION_TAX_PROFILE`. The canonical checkout resolves this before creating a paid provider order and returns `SUBSCRIPTION_TAX_SETUP_REQUIRED` if the supplier/recipient facts are absent or unsupported. Source: `services/api-gateway/src/lib/subscription-checkout-source.ts`, `resolveNewSubscriptionTaxSnapshot`, and `packages/billing-core/src/index.ts`, `SubscriptionSupplierTaxProfileSchema`.

Do not bypass that guard or fabricate an approved supplier into the shared environment. The normal shared billing setup requires the actual approved supplier profile, its approval reference, legal name, GSTIN, state and address, plus the merchant recipient billing details. A future isolated sandbox run may use explicitly synthetic local billing fixtures, labelled as such; that would not certify the shared supplier configuration or real tax facts.

## Remaining end-to-end acceptance

After valid **Test Mode** credentials are placed in local untracked configuration, repeat the read-only authentication check before attempting payment. Keep secrets out of chat, patches, reports and source control. Use the canonical worker and production-built Merchant app against an ownership-verified disposable database with the retained real Launch/Growth catalog.

The next run must create a real provider order, open the actual Checkout SDK, complete an official Razorpay test-card payment, validate its returned signature, fetch the payment server-side and match its captured status/order/currency/amount, then join the provider identifiers to exactly one canonical activation and invoice. Verify retries/replays cannot duplicate value, declined/dismissed payments do not activate a plan, and billing/plan pages read the persisted result. Real provider callbacks and recurring mandates need their own evidence; the current founding-price plans use one-time order checkout and must not be described as verified AutoPay.

A local browser callback can return to the app directly, but server-to-server provider webhooks require a reachable public endpoint. No tunnel, new provider webhook or dashboard setting was created. Any later webhook test must use a scoped test-mode endpoint, validated signatures and duplicate-event protection.

Primary provider references checked on 30 October 2026: [official test cards](https://github.com/razorpay/markdown-docs/blob/master/payments/payments/test-card-details.md) and [official webhook testing](https://github.com/razorpay/markdown-docs/blob/master/webhooks/validate-test.md). The latter documents the public-URL requirement for localhost webhook testing. No card or payment data was entered in this run.

## Scope and preservation

No runtime, test, package, migration, environment file or database record changed. No new test transaction, message, provider subscription, webhook configuration, commit, push, merge or deployment occurred. Reports and the execution ledger are the only changes from this investigation. Prior local simulated-provider acceptance remains useful application evidence, but it is **not** real Razorpay test-mode acceptance and has not been relabelled.
