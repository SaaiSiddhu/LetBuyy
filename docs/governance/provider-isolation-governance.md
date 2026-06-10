# Provider Isolation Governance

Status: Phase 2 foundation.

Provider isolation prevents apps and service handlers from coupling directly to external SDKs. App runtimes also must not import infrastructure adapters directly; app-facing provider access is exposed through service API contracts or package-owned client facades that do not expose provider SDKs.

## Providers Covered

- Supabase
- Stripe
- Razorpay
- PayPal
- Resend
- Upstash Redis and rate limit
- Cloudflare bindings
- Storage providers including R2/S3/Supabase/Firebase storage
- Analytics providers
- Search providers including Algolia and Meilisearch

## Enforced Rule

TypeScript apps, services, and packages must not import provider SDK packages or declare provider SDK dependencies outside `packages/infrastructure`.

Apps must not import `@letbuyy/infrastructure` or declare it as a package dependency. Services may bootstrap infrastructure adapters as execution containers. App-safe client facades may expose provider-neutral request/response contracts, but provider execution and credentials remain in services or `packages/infrastructure`.

`packages/payments` owns provider-neutral interfaces and INR/idempotency rules only. It must not import provider SDK packages or call provider APIs directly.

## Migration Note

Dart mobile provider integrations remain a separate mobile-adapter migration track. New TypeScript provider work must start in `packages/infrastructure`.
