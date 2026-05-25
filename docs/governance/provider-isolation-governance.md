# Provider Isolation Governance

Status: Phase 2 foundation.

Provider isolation prevents apps and service handlers from coupling directly to external SDKs. App runtimes also must not import infrastructure adapters directly; app-facing provider access is exposed through runtime-composition adapters or service API contracts.

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

Apps must not import `@letbuyy/infrastructure` or declare it as a package dependency. Services may bootstrap infrastructure adapters as execution containers. Runtime-composition may expose app-safe composition adapters that delegate into infrastructure without leaking provider SDKs into apps.

## Migration Note

Dart mobile provider integrations remain a separate mobile-adapter migration track. New TypeScript provider work must start in `packages/infrastructure`.
