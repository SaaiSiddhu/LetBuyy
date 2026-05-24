# API Gateway Service Governance

Purpose: Cloudflare Hono `/v1` API gateway for actor-authenticated commerce, content, marketplace, media, analytics, tenant, and platform operations.

Runtime boundary: `services/api-gateway`.

Allowed dependencies:

- Shared TypeScript packages from `packages/typescript/*`.
- Durable service-local modules under `services/api-gateway/src`.
- External service SDKs configured only through worker environment bindings.

Forbidden dependencies:

- No imports from `apps/*`.
- No imports from `legacy/*`.
- No direct reliance on generated `dist/*` output.
- No client-side token storage or browser-only APIs.

Tenant rules:

- Every merchant-owned mutation must resolve `site_id` or prove explicit store ownership.
- Payment, checkout, and webhook-facing mutations must be idempotent.
- Unknown errors must return sanitized `AppError` responses.
