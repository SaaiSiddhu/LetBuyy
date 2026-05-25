# Infrastructure Governance

Status: Phase 2 foundation.

Infrastructure adapters live in `packages/infrastructure` and are the only TypeScript package boundary allowed to import provider SDKs or call provider-specific APIs directly.

## Adapter Ownership

- `stripe-adapter`
- `razorpay-adapter`
- `paypal-adapter`
- `supabase-adapter`
- `cloudflare-adapter`
- `resend-adapter`
- `storage-adapter`
- `queue-adapter`
- `analytics-adapter`
- `cache-adapter`
- `search-provider-adapter`

## Rules

- Apps must not import infrastructure adapters directly; use runtime-composition adapters or service API contracts.
- Services may import adapter functions for execution bootstrapping, but must not import provider SDK packages.
- Runtime-composition may expose app-safe adapters that delegate to infrastructure without exposing provider SDKs to apps.
- Provider credentials are passed from runtime env or worker bindings into adapters.
- Provider errors must be normalized before reaching application services.
- Retry and idempotency policies must be explicit for mutating provider calls.
- Provider API URLs belong only in adapter code.

## Current Enforcement

`scripts/validators/provider-isolation-validator.mjs` fails TypeScript governance when provider SDK imports, provider SDK package dependencies, or known provider API URLs appear outside `packages/infrastructure`.
