# Shared Razorpay Test Mode readiness — preparation only

Status: **UNVERIFIED / no provider execution**. MadeYours is the proposed shared readiness owner; exact allocator scope is still required. No credential file, protected fixture state, production profile or account was accessed. Missing evidence must not be described as proof that credentials do not exist.

The actual source path is the storefront hosted checkout client `apps/commerce/web/src/app/store/[subdomain]/checkout/checkout-client.tsx` -> same-origin hosted-step BFF -> `services/api-gateway/src/routes/checkout.ts` payment-intent/confirm -> existing `packages/infrastructure/razorpay-adapter/index.ts`. This is buyer checkout, separate from merchant subscription/billing endpoints. The client loads the real provider Checkout and sends `mode:sandbox`; the gateway rejects live hosted intents. The adapter's createIntent invokes the real provider Orders API. Therefore a sandbox label does not establish Test Mode credentials, and a local fetch fake does not establish a provider payment.

The existing gateway verifies server-stored provider-order binding through `services/api-gateway/src/lib/provider-payment-verification.ts`, checks provider state/amount/order and uses canonical payment execution. Existing webhook-service `POST /razorpay` reads original request text, verifies the signature with `RAZORPAY_WEBHOOK_SECRET` before parsing and uses durable event processing plus gateway transitions. Source presence is not delivery, race or reconciliation proof. Record the eventual API/webhook compiled identity and actual service binding; do not expose unrelated routes or databases.

Fresh provider documentation requires server-created orders and server-side signature checking against the stored order reference; authorized and captured payment states differ. Verify actual account capture/method behavior and Test Mode before use. [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), inspected24October2026.

Webhook delivery needs a public URL; localhost and several common test/tunnel domains are blocked. Admit an existing owned, provider-accepted public HTTPS test route with matching test webhook secret. Validate signatures on the raw body, handle duplicates and do not rely on event ordering. A synthetic local POST cannot establish actual provider delivery. [Razorpay webhook validation/testing](https://razorpay.com/docs/webhooks/validate-test/), inspected24October2026.

## Required secure admission receipt

The allocator/credential owner supplies a sanitized readiness receipt identifying the approved Test Mode account, secure binding mechanism for `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, mode verification, permitted synthetic store/order scope, owned accepted public HTTPS route and credential/ingress expiry/cleanup owner. Values remain in protected runtime files/bindings, never prompts/Git/evidence/screenshots/HAR. A key-ID prefix check is only one control; verify the dedicated account and resulting test entities. No live fallback or real card data.

At this boundary these prerequisites are **not admitted**. Do not search ambient env files, copy the old fixture's keys, create a tunnel or deploy a new runtime to manufacture readiness. Use the file-based allocator handoff until helpers are resumed; no extra human permission loop is needed for document preparation.

## Finite execution after allocation

1. Admit current source/candidate, secure Test Mode configuration and normal browser checkout HTTPS. Verify source/provider mode without printing keys.
2. One normal synthetic reference purchase: PDP -> reviewed configuration -> cart -> hosted quote/address/shipping -> actual Razorpay Test Mode Checkout -> server verification -> actual provider-delivered webhook. Record redacted local/provider order/payment/event linkage, amount/currency, observed authorization/capture state, canonical order/payment/inventory/ledger result and both history views.
3. Execute the shared required decline/dismiss/retry/invalid-signature/wrong-order/amount/currency/tenant/expired-intent, duplicate/out-of-order webhook, verify/webhook race and provider-success/local-failure reconciliation cohort. Exactly one canonical effect and balanced ledger, preserving earlier rows. Share only unchanged relevant proof; every theme still needs its own actual browser Test Mode purchase.
4. Exercise supported synthetic/Test Mode refund/reversal through canonical authority with duplicate/reconciliation evidence, preserve original failures and clean only the owned scope.

Required evidence remains NOT_RUN in COVERAGE (`MY-C-RZ01..RZ03`, `MY-C-PAY01`, `MY-C-HIS01`). Existing local15 hosted-buyer/provider regressions and COD are separate evidence classes and cannot turn RAZORPAY_TEST_VERIFIED true.


## Verified authentication and preparation02 — 2026-10-24T13:00:26.349620+00:00

The requesting chat’s redacted official read-only API receipt isHTTP200: `docs/implementation/niche-theme-programme/completion-2026-10-24/razorpay-test-credential-preflight-network-20261024.json`. This supersedes the earlier authentication-UNVERIFIED preparation statement only. No authentication call was repeated here and the designated CSV was not opened. [RAZORPAY_RUNTIME_BINDING_PROPOSAL02.json](RAZORPAY_RUNTIME_BINDING_PROPOSAL02.json) records actual canonical source seams, protected injection, fresh same-DB runtime/owned publicHTTPS/secret/account admission and reversible effect-aware operation. Runtime binding, public reachability/provider-acceptedreceiver, matching TESTwebhook secret and actual per-theme payment remainunverified.
