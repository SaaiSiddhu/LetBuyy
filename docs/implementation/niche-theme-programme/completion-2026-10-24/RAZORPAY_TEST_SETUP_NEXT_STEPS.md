# Razorpay Test Mode setup checkpoint — 24 October 2026

The human supplied a CSV and explicitly authorized using its Test Mode keys after the programme pause. This authorizes the credential check recorded here; it does not itself resume the ten-theme programme or authorize a deployment. The existing programme and source work remain preserved.

## Verified now

- The supplied CSV contains one complete API pair with a Test Mode key ID.
- One authenticated, TLS-verified, read-only `GET https://api.razorpay.com/v1/orders?count=1` returned HTTP 200 and the expected collection shape.
- No provider order/payment/refund was created or changed. No returned order data, API credentials or authorization header was printed or persisted.
- No local application, draft, database, runtime environment or cloud configuration was changed.
- Redacted receipt: `razorpay-test-credential-preflight-network-20261024.json`. The preceding restricted-network DNS failure remains in `razorpay-test-credential-preflight-20261024.json`.

Authentication is verified. Runtime integration, actual provider payment, webhook delivery and theme certification are not verified by this check.

## Required before the actual payment run

1. Resume the existing programme and obtain the shared allocator's fresh, isolated test runtime/store/buyer scope. Preserve old fixtures and local applications. Use the canonical real Razorpay adapter, without the injected hosted-payment test adapter.
2. Bind the supplied Test API pair server-side as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in that admitted gateway runtime. Pass values directly through protected runtime configuration; do not paste them into chat, source, reports, screenshots or commands. An API authentication receipt does not prove that a runtime is configured.
3. Identify an owned public HTTPS test endpoint routed to the existing `services/webhook-service` receiver, `POST /razorpay`, backed only by the admitted isolated test environment. The URL has not yet been supplied or provisioned. Local browser HTTPS is separate from public provider reachability. No second webhook service is needed.
4. Configure the webhook in the Razorpay Dashboard's **Test Mode**, under **Accounts & Settings → Webhooks → Add New Webhook**. Use the confirmed public URL, a separate strong webhook secret, an owned failure-alert email and the payment events supported by the receiver. The current source handles `payment.authorized`, `payment.captured`, `payment.failed`, `refund.created`, `refund.processed` and `refund.failed`; enable refund events if the admitted scope includes refund verification. Do not alter existing unrelated webhooks.
5. Bind the same webhook secret as `RAZORPAY_WEBHOOK_SECRET` at the admitted receiver. Configure its other required canonical bindings without changing production. Verify raw-body signatures and durable event deduplication, actual successful delivery and matching account/runtime identity.
6. Complete the already requested normal browser Test Mode purchase for each theme through the canonical checkout. Join local/provider order and payment IDs, amount/currency, captured state, buyer/merchant history and exact ledger/inventory/outbox effects. Preserve the required negative/race/recovery cases. A Dashboard webhook probe or API-key check alone cannot certify a theme.

Public HTTPS means an encrypted URL Razorpay's servers can reach over the internet. Prefer an existing owned test/staging hostname on the canonical Cloudflare service. A placeholder such as `https://payments-test.<owned-domain>/razorpay` is illustrative only; no such address is claimed to exist. Do not enter a placeholder into the Dashboard. Any missing deployment or ingress change must be prepared as a concrete reviewable change under the existing authority and ownership rules.

## Official references checked on 24 October 2026

- [API authentication and Test Mode](https://razorpay.com/docs/api/authentication/)
- [Set up and edit payment webhooks](https://razorpay.com/docs/webhooks/setup-edit-payments/)
- [Validate and test webhooks](https://razorpay.com/docs/webhooks/validate-test/)

Razorpay requires public webhook URLs, recommends HTTPS and blocks localhost and several common tunnel/interceptor domains. Its API secret and webhook secret serve different purposes. Matching raw-body signature verification is required by the existing receiver's contract.
