# API Gateway Service Governance

Purpose: Cloudflare Hono `/v1` API gateway for actor-authenticated commerce, content, marketplace, media, analytics, tenant, and platform operations.

Runtime boundary: `services/api-gateway`.

Allowed dependencies:

- Shared TypeScript packages from `packages/typescript/*`.
- Domain, service-owned workflow, service-local event helpers, service-owned read planners, and infrastructure adapter packages declared in `runtime.manifest.json`.
- Durable service-local execution adapters under `services/api-gateway/src/execution`.
- Provider integrations only through `packages/infrastructure` adapters wired to worker environment bindings.

Forbidden dependencies:

- No imports from `apps/*`.
- No imports from `legacy/*`.
- No business service-local event helpers under `services/api-gateway/src/services/*.service.ts`.
- No direct provider SDK imports.
- No direct reliance on generated `dist/*` output.
- No client-side token storage or browser-only APIs.

Execution rules:

- Route modules own transport, validation handoff, context construction, and response formatting.
- Business workflow sequencing belongs in `service-local execution contracts`.
- Event, outbox, retry, dead-letter, and correlation primitives belong in `service-local event helpers`.
- Execution adapters may bridge service runtime bindings to service-owned workflow contracts.

Tenant rules:

- Every merchant-owned mutation must resolve `site_id` or prove explicit store ownership.
- Payment, checkout, and webhook-facing mutations must be idempotent.
- Unknown errors must return sanitized `AppError` responses.
