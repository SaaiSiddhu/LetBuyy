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

Test lanes (P2-HERMETIC-GATEWAY-DB, 2026-09-29):

- `pnpm --filter @letbuyy/api-gateway run test:unit` is the fast unit lane: `src/__tests__/*.test.ts` (the glob does not descend). It needs no database and no Docker, and it is **not** full gateway acceptance.
- `pnpm --filter @letbuyy/api-gateway run test:db` is the isolated database lane: every `src/__tests__/owned-db/*.test.ts`, run only through `scripts/governance/run-executable-suites.mjs --gateway-db`. Each suite gets its own database cloned from a fully migrated template, a real PostgREST and a proven-ownership check. It needs Docker and two images the runner names; it never pulls one on a workstation. `pnpm --filter @letbuyy/api-gateway run test` is the acceptance: unit, then database, then contracts.
- A test that needs a real database goes in `owned-db/`, obtains it only through `requireOwnedDatabase()`, builds its own synthetic tenant (`owned-db/synthetic-tenant.ts`), never deletes an immutable or protected row by hand and never skips: the database is discarded with the suite. A unit-lane test must not run processes, name docker, read `.dev.vars` or depend on any store that already exists. `tests/governance/gateway-db-lane.test.mjs` pins all of this.
- No gateway test may write to a developer's own stack, hosted or local. The restored development stack (`supabase_*` containers) is refused by name, label and image before any statement is sent.
- A suite that proves a **route** (not only an RPC or a constraint) drives the real worker, never a router of its own: `owned-db/gateway-harness.ts` calls the worker's own `fetch` with real signed credentials, so the real global middleware, mount order, session and role middleware and production wiring are in the path. Its one seam, `tapRest` on the gateway→PostgREST hop, is used only to hold concurrent writes together or to inject one named fault; each request carries its own client address because the global limiter buckets by address. `buyer-privacy-intake` and `privacy-support-visibility` are the reference suites (P2-PRIVACY-CONCURRENCY-DB, 2026-10-01). A mock-router proof of a route's access control is not enough: the support router's role tiers passed one while an earlier mount's gate kept every non-super-admin out of the production route.
