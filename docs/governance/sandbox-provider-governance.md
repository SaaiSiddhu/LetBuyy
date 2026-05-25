# Sandbox Provider Governance

Provider isolation prevents accidental production side effects.

## Local Providers

- Payments: WireMock endpoints for Stripe, Razorpay, and PayPal intent simulation.
- Email: Mailpit.
- SMS: WireMock SMS endpoint.
- Queue: ElasticMQ.

## Remote Providers

Development and staging must use provider sandbox accounts or isolated test modes. Production live providers are only available during credential-gated execute mode and must record operational evidence.

## Persistence

Sandbox and live-provider contracts are tracked by `sandbox_provider_contracts`.
