# 24 - Engineering Task Breakdown

Generated: 2026-05-22
Scope: LetBuyy Admin App, Urban Kicks storefront, Hono worker API, Supabase schema, Flutter Builder, shared packages, and production commerce infrastructure.
Status: Planning artifact. This document is source-derived from the current repository scan plus official commerce platform documentation listed below.

## Task Operating Rules

- Every task must state owner domain, touched files, migration impact, API impact, frontend impact, Flutter impact, security impact, test proof, rollback proof, and launch flag.
- Every mutation endpoint must have Zod validation, tenant check, RBAC check, audit event, and outbox event if storefront state can change.
- Every admin screen must have skeleton, empty, error, retry, permission, loading, dirty, saved, and conflict states.

## Epic 1: Tenant and Store Context

Epic objective: Resolve authenticated user, active site, store slug, permissions, plan limits, and storefront public identity from one canonical middleware stack.

### Task 1.1: Schema and migration

### Implementation Item: Tenant and Store Context - Schema and migration

Objective: Schema and migration work for Tenant and Store Context.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 1.2: Worker contract and service

### Implementation Item: Tenant and Store Context - Worker contract and service

Objective: Worker contract and service work for Tenant and Store Context.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 1.3: Admin web UI

### Implementation Item: Tenant and Store Context - Admin web UI

Objective: Admin web UI work for Tenant and Store Context.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 1.4: Flutter Builder parity

### Implementation Item: Tenant and Store Context - Flutter Builder parity

Objective: Flutter Builder parity work for Tenant and Store Context.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 1.5: Urban Kicks storefront behavior

### Implementation Item: Tenant and Store Context - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for Tenant and Store Context.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 1.6: Tests and rollout

### Implementation Item: Tenant and Store Context - Tests and rollout

Objective: Tests and rollout work for Tenant and Store Context.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 2: Theme Config Engine

Epic objective: Move Urban Kicks and future themes to versioned JSON schema, section schema, block schema, settings schema, asset manifest, and release snapshots.

### Task 2.1: Schema and migration

### Implementation Item: Theme Config Engine - Schema and migration

Objective: Schema and migration work for Theme Config Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 2.2: Worker contract and service

### Implementation Item: Theme Config Engine - Worker contract and service

Objective: Worker contract and service work for Theme Config Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 2.3: Admin web UI

### Implementation Item: Theme Config Engine - Admin web UI

Objective: Admin web UI work for Theme Config Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 2.4: Flutter Builder parity

### Implementation Item: Theme Config Engine - Flutter Builder parity

Objective: Flutter Builder parity work for Theme Config Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 2.5: Urban Kicks storefront behavior

### Implementation Item: Theme Config Engine - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for Theme Config Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 2.6: Tests and rollout

### Implementation Item: Theme Config Engine - Tests and rollout

Objective: Tests and rollout work for Theme Config Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 3: Admin Theme Editor

Epic objective: Convert admin editor from local DEFAULT_TEMPLATE assumptions to schema-driven forms, optimistic draft saves, conflict handling, signed live preview, and publish approvals.

### Task 3.1: Schema and migration

### Implementation Item: Admin Theme Editor - Schema and migration

Objective: Schema and migration work for Admin Theme Editor.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 3.2: Worker contract and service

### Implementation Item: Admin Theme Editor - Worker contract and service

Objective: Worker contract and service work for Admin Theme Editor.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 3.3: Admin web UI

### Implementation Item: Admin Theme Editor - Admin web UI

Objective: Admin web UI work for Admin Theme Editor.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 3.4: Flutter Builder parity

### Implementation Item: Admin Theme Editor - Flutter Builder parity

Objective: Flutter Builder parity work for Admin Theme Editor.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 3.5: Urban Kicks storefront behavior

### Implementation Item: Admin Theme Editor - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for Admin Theme Editor.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 3.6: Tests and rollout

### Implementation Item: Admin Theme Editor - Tests and rollout

Objective: Tests and rollout work for Admin Theme Editor.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 4: Storefront Renderer

Epic objective: Render only published releases for shoppers, draft releases for signed preview sessions, and route every section through a registry with strict fallback handling.

### Task 4.1: Schema and migration

### Implementation Item: Storefront Renderer - Schema and migration

Objective: Schema and migration work for Storefront Renderer.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 4.2: Worker contract and service

### Implementation Item: Storefront Renderer - Worker contract and service

Objective: Worker contract and service work for Storefront Renderer.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 4.3: Admin web UI

### Implementation Item: Storefront Renderer - Admin web UI

Objective: Admin web UI work for Storefront Renderer.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 4.4: Flutter Builder parity

### Implementation Item: Storefront Renderer - Flutter Builder parity

Objective: Flutter Builder parity work for Storefront Renderer.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 4.5: Urban Kicks storefront behavior

### Implementation Item: Storefront Renderer - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for Storefront Renderer.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 4.6: Tests and rollout

### Implementation Item: Storefront Renderer - Tests and rollout

Objective: Tests and rollout work for Storefront Renderer.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 5: Product Engine

Epic objective: Normalize product options, values, variants, media, attributes, publication status, SEO metadata, and collection links while preserving legacy products rows during migration.

### Task 5.1: Schema and migration

### Implementation Item: Product Engine - Schema and migration

Objective: Schema and migration work for Product Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 5.2: Worker contract and service

### Implementation Item: Product Engine - Worker contract and service

Objective: Worker contract and service work for Product Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 5.3: Admin web UI

### Implementation Item: Product Engine - Admin web UI

Objective: Admin web UI work for Product Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 5.4: Flutter Builder parity

### Implementation Item: Product Engine - Flutter Builder parity

Objective: Flutter Builder parity work for Product Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 5.5: Urban Kicks storefront behavior

### Implementation Item: Product Engine - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for Product Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 5.6: Tests and rollout

### Implementation Item: Product Engine - Tests and rollout

Objective: Tests and rollout work for Product Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 6: Inventory Engine

Epic objective: Separate stock availability from product content through locations, levels, reservations, adjustments, and release/reconcile events.

### Task 6.1: Schema and migration

### Implementation Item: Inventory Engine - Schema and migration

Objective: Schema and migration work for Inventory Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 6.2: Worker contract and service

### Implementation Item: Inventory Engine - Worker contract and service

Objective: Worker contract and service work for Inventory Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 6.3: Admin web UI

### Implementation Item: Inventory Engine - Admin web UI

Objective: Admin web UI work for Inventory Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 6.4: Flutter Builder parity

### Implementation Item: Inventory Engine - Flutter Builder parity

Objective: Flutter Builder parity work for Inventory Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 6.5: Urban Kicks storefront behavior

### Implementation Item: Inventory Engine - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for Inventory Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 6.6: Tests and rollout

### Implementation Item: Inventory Engine - Tests and rollout

Objective: Tests and rollout work for Inventory Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 7: Collection and Search Engine

Epic objective: Support manual and smart collections, filter facets, product search documents, indexing workers, and storefront search API parity.

### Task 7.1: Schema and migration

### Implementation Item: Collection and Search Engine - Schema and migration

Objective: Schema and migration work for Collection and Search Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 7.2: Worker contract and service

### Implementation Item: Collection and Search Engine - Worker contract and service

Objective: Worker contract and service work for Collection and Search Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 7.3: Admin web UI

### Implementation Item: Collection and Search Engine - Admin web UI

Objective: Admin web UI work for Collection and Search Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 7.4: Flutter Builder parity

### Implementation Item: Collection and Search Engine - Flutter Builder parity

Objective: Flutter Builder parity work for Collection and Search Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 7.5: Urban Kicks storefront behavior

### Implementation Item: Collection and Search Engine - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for Collection and Search Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 7.6: Tests and rollout

### Implementation Item: Collection and Search Engine - Tests and rollout

Objective: Tests and rollout work for Collection and Search Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 8: Cart and Checkout Engine

Epic objective: Persist carts server-side, price carts from DB, apply discounts/taxes/shipping, create checkout sessions, and prevent stale or manipulated totals.

### Task 8.1: Schema and migration

### Implementation Item: Cart and Checkout Engine - Schema and migration

Objective: Schema and migration work for Cart and Checkout Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 8.2: Worker contract and service

### Implementation Item: Cart and Checkout Engine - Worker contract and service

Objective: Worker contract and service work for Cart and Checkout Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 8.3: Admin web UI

### Implementation Item: Cart and Checkout Engine - Admin web UI

Objective: Admin web UI work for Cart and Checkout Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 8.4: Flutter Builder parity

### Implementation Item: Cart and Checkout Engine - Flutter Builder parity

Objective: Flutter Builder parity work for Cart and Checkout Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 8.5: Urban Kicks storefront behavior

### Implementation Item: Cart and Checkout Engine - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for Cart and Checkout Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 8.6: Tests and rollout

### Implementation Item: Cart and Checkout Engine - Tests and rollout

Objective: Tests and rollout work for Cart and Checkout Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 9: Payment Engine

Epic objective: Use provider adapters for Razorpay, Stripe, PayPal, tenant credentials, payment attempts, webhook idempotency, refunds, disputes, and reconciliation.

### Task 9.1: Schema and migration

### Implementation Item: Payment Engine - Schema and migration

Objective: Schema and migration work for Payment Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 9.2: Worker contract and service

### Implementation Item: Payment Engine - Worker contract and service

Objective: Worker contract and service work for Payment Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 9.3: Admin web UI

### Implementation Item: Payment Engine - Admin web UI

Objective: Admin web UI work for Payment Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 9.4: Flutter Builder parity

### Implementation Item: Payment Engine - Flutter Builder parity

Objective: Flutter Builder parity work for Payment Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 9.5: Urban Kicks storefront behavior

### Implementation Item: Payment Engine - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for Payment Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 9.6: Tests and rollout

### Implementation Item: Payment Engine - Tests and rollout

Objective: Tests and rollout work for Payment Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 10: Order Engine

Epic objective: Make order lifecycle event-driven with state machine, order events, fulfillment records, refund records, shipment tracking, and audit trail.

### Task 10.1: Schema and migration

### Implementation Item: Order Engine - Schema and migration

Objective: Schema and migration work for Order Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 10.2: Worker contract and service

### Implementation Item: Order Engine - Worker contract and service

Objective: Worker contract and service work for Order Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 10.3: Admin web UI

### Implementation Item: Order Engine - Admin web UI

Objective: Admin web UI work for Order Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 10.4: Flutter Builder parity

### Implementation Item: Order Engine - Flutter Builder parity

Objective: Flutter Builder parity work for Order Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 10.5: Urban Kicks storefront behavior

### Implementation Item: Order Engine - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for Order Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 10.6: Tests and rollout

### Implementation Item: Order Engine - Tests and rollout

Objective: Tests and rollout work for Order Engine.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 11: CMS and Page Builder

Epic objective: Model pages, templates, sections, blocks, navigation, banners, policies, and reusable content as store-scoped content entities.

### Task 11.1: Schema and migration

### Implementation Item: CMS and Page Builder - Schema and migration

Objective: Schema and migration work for CMS and Page Builder.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 11.2: Worker contract and service

### Implementation Item: CMS and Page Builder - Worker contract and service

Objective: Worker contract and service work for CMS and Page Builder.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 11.3: Admin web UI

### Implementation Item: CMS and Page Builder - Admin web UI

Objective: Admin web UI work for CMS and Page Builder.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 11.4: Flutter Builder parity

### Implementation Item: CMS and Page Builder - Flutter Builder parity

Objective: Flutter Builder parity work for CMS and Page Builder.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 11.5: Urban Kicks storefront behavior

### Implementation Item: CMS and Page Builder - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for CMS and Page Builder.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 11.6: Tests and rollout

### Implementation Item: CMS and Page Builder - Tests and rollout

Objective: Tests and rollout work for CMS and Page Builder.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 12: Media Pipeline

Epic objective: Route uploads to R2, store asset metadata in media, generate derivatives, attach assets to products/themes/CMS, and enforce tenant ownership.

### Task 12.1: Schema and migration

### Implementation Item: Media Pipeline - Schema and migration

Objective: Schema and migration work for Media Pipeline.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 12.2: Worker contract and service

### Implementation Item: Media Pipeline - Worker contract and service

Objective: Worker contract and service work for Media Pipeline.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 12.3: Admin web UI

### Implementation Item: Media Pipeline - Admin web UI

Objective: Admin web UI work for Media Pipeline.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 12.4: Flutter Builder parity

### Implementation Item: Media Pipeline - Flutter Builder parity

Objective: Flutter Builder parity work for Media Pipeline.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 12.5: Urban Kicks storefront behavior

### Implementation Item: Media Pipeline - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for Media Pipeline.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 12.6: Tests and rollout

### Implementation Item: Media Pipeline - Tests and rollout

Objective: Tests and rollout work for Media Pipeline.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 13: RBAC and Audit

Epic objective: Enforce owner/staff role scopes per domain and record every sensitive mutation in audit/activity logs.

### Task 13.1: Schema and migration

### Implementation Item: RBAC and Audit - Schema and migration

Objective: Schema and migration work for RBAC and Audit.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 13.2: Worker contract and service

### Implementation Item: RBAC and Audit - Worker contract and service

Objective: Worker contract and service work for RBAC and Audit.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 13.3: Admin web UI

### Implementation Item: RBAC and Audit - Admin web UI

Objective: Admin web UI work for RBAC and Audit.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 13.4: Flutter Builder parity

### Implementation Item: RBAC and Audit - Flutter Builder parity

Objective: Flutter Builder parity work for RBAC and Audit.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 13.5: Urban Kicks storefront behavior

### Implementation Item: RBAC and Audit - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for RBAC and Audit.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 13.6: Tests and rollout

### Implementation Item: RBAC and Audit - Tests and rollout

Objective: Tests and rollout work for RBAC and Audit.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 14: Realtime and Events

Epic objective: Add outbox_events, Cloudflare Queues consumers, Supabase Realtime or WebSocket/SSE fanout, and admin/storefront cache invalidation.

### Task 14.1: Schema and migration

### Implementation Item: Realtime and Events - Schema and migration

Objective: Schema and migration work for Realtime and Events.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 14.2: Worker contract and service

### Implementation Item: Realtime and Events - Worker contract and service

Objective: Worker contract and service work for Realtime and Events.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 14.3: Admin web UI

### Implementation Item: Realtime and Events - Admin web UI

Objective: Admin web UI work for Realtime and Events.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 14.4: Flutter Builder parity

### Implementation Item: Realtime and Events - Flutter Builder parity

Objective: Flutter Builder parity work for Realtime and Events.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 14.5: Urban Kicks storefront behavior

### Implementation Item: Realtime and Events - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for Realtime and Events.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 14.6: Tests and rollout

### Implementation Item: Realtime and Events - Tests and rollout

Objective: Tests and rollout work for Realtime and Events.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 15: Analytics and Observability

Epic objective: Capture shopper/admin/domain events, aggregate analytics, trace requests, alert on webhook/payment/order failures, and expose dashboards.

### Task 15.1: Schema and migration

### Implementation Item: Analytics and Observability - Schema and migration

Objective: Schema and migration work for Analytics and Observability.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 15.2: Worker contract and service

### Implementation Item: Analytics and Observability - Worker contract and service

Objective: Worker contract and service work for Analytics and Observability.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 15.3: Admin web UI

### Implementation Item: Analytics and Observability - Admin web UI

Objective: Admin web UI work for Analytics and Observability.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 15.4: Flutter Builder parity

### Implementation Item: Analytics and Observability - Flutter Builder parity

Objective: Flutter Builder parity work for Analytics and Observability.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 15.5: Urban Kicks storefront behavior

### Implementation Item: Analytics and Observability - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for Analytics and Observability.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 15.6: Tests and rollout

### Implementation Item: Analytics and Observability - Tests and rollout

Objective: Tests and rollout work for Analytics and Observability.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Epic 16: CI, Testing, and Deployment

Epic objective: Add contract tests, service tests, migration tests, e2e flows, preview deployment gates, rollback runbooks, and staged rollout controls.

### Task 16.1: Schema and migration

### Implementation Item: CI, Testing, and Deployment - Schema and migration

Objective: Schema and migration work for CI, Testing, and Deployment.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 16.2: Worker contract and service

### Implementation Item: CI, Testing, and Deployment - Worker contract and service

Objective: Worker contract and service work for CI, Testing, and Deployment.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 16.3: Admin web UI

### Implementation Item: CI, Testing, and Deployment - Admin web UI

Objective: Admin web UI work for CI, Testing, and Deployment.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 16.4: Flutter Builder parity

### Implementation Item: CI, Testing, and Deployment - Flutter Builder parity

Objective: Flutter Builder parity work for CI, Testing, and Deployment.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 16.5: Urban Kicks storefront behavior

### Implementation Item: CI, Testing, and Deployment - Urban Kicks storefront behavior

Objective: Urban Kicks storefront behavior work for CI, Testing, and Deployment.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

### Task 16.6: Tests and rollout

### Implementation Item: CI, Testing, and Deployment - Tests and rollout

Objective: Tests and rollout work for CI, Testing, and Deployment.

Technical explanation:
- Implement this as a store-scoped domain capability, not as isolated page logic.
- The worker owns validation, authorization, tenant isolation, persistence, and event emission.
- Admin web and Flutter Builder call the same worker contract and receive the same response envelope.
- Storefront Urban Kicks consumes published snapshots and public APIs only.

Architecture impact:
- Moves business behavior out of page components and route glue into services.
- Creates an explicit admin-to-storefront synchronization path.
- Enables contract generation and parity between TypeScript and Dart clients.

Dependencies:
- Supabase migration and RLS policy updates where data shape changes are required.
- Zod schemas under backend/workers/api/src/schemas.
- Worker services under backend/workers/api/src/services.
- Admin modules under apps/web/consumer/admin/src/app/[store].
- Flutter Builder service/model updates under apps/flutter/builder/lib.

Database changes:
- Add normalized tables if the current JSON/scalar model cannot support queryability, consistency, or multi-tenant scale.
- Add store_id/site_id, created_at, updated_at, deleted_at, created_by, updated_by, version, indexes, and RLS policies.
- Add outbox_events rows for mutations that require storefront, cache, analytics, search, or webhook follow-up.

API changes:
- Add versioned /v1 endpoints in the worker.
- Require store_id in protected merchant mutations unless resolved by store-context middleware.
- Return standardized success/error envelopes and request_id.
- Add idempotency keys to mutation endpoints that create orders, payments, refunds, webhooks, imports, or publish releases.

Frontend changes:
- Replace direct local assumptions with API-backed loaders, mutations, optimistic state, error states, conflict states, and skeletons.
- Render forms from shared schema metadata when possible.
- Keep Urban Kicks preview visible for every storefront-impacting change.

Backend changes:
- Use service classes for domain logic.
- Add audit logging and domain events after successful writes.
- Sanitize errors and avoid leaking raw DB details.

Infrastructure changes:
- Route events through Cloudflare Queues consumers.
- Add cache tag invalidation, search indexing, media derivative jobs, and realtime fanout where relevant.

Security considerations:
- Validate ownership through sites/stores view plus RBAC scope.
- Never expose service-role credentials, payment secrets, webhook secrets, or internal provider responses to clients.
- Use CSRF protections for cookie-authenticated mutating routes and strict CORS for worker surfaces.

Performance considerations:
- Paginate lists, add query indexes, avoid N+1 reads, and precompute storefront release snapshots.
- Keep live preview incremental and throttle autosaves.

Scaling considerations:
- Partition hot data by store_id/site_id where possible.
- Keep search, analytics, media processing, webhook processing, and cache purge off the synchronous request path.

Risks:
- Contract drift between admin web and Flutter if generated clients are not enforced.
- Tenant data leaks if route handlers bypass store ownership checks.
- Stale storefront rendering if publish events do not purge caches.

Edge cases:
- Draft conflicts from multiple editor sessions.
- Deleted products referenced by theme sections.
- Payment provider webhook arrives before local payment attempt is stored.
- Inventory changes while checkout is open.

Testing requirements:
- Unit tests for service logic.
- Contract tests for worker schemas and client models.
- Migration tests for backfills and rollback.
- E2E tests for admin save -> publish -> Urban Kicks storefront render.

Migration strategy:
- Add new schema in parallel, dual-read legacy and new shape, backfill, dual-write, cut read path, then remove legacy reads in a later release.

Rollback strategy:
- Keep previous release snapshots, old columns, and legacy read path until metrics prove stability.

Production readiness checklist:
- Ownership and RBAC verified.
- Validation exists.
- Audit event exists.
- Outbox event exists.
- Cache invalidation exists.
- Web and Flutter parity exists.
- Urban Kicks storefront behavior verified.

## Enterprise Implementation Control Appendix

This appendix converts the requested production requirements into explicit engineering controls for this artifact. It is intentionally repetitive across the artifact set so each file remains usable independently during implementation reviews.

### Control 1: Tenant and Store Context

Requirement: sites remains database source of truth while store remains the UI and URL term.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 2: Theme Config Engine

Requirement: Urban Kicks configuration becomes schema-driven, versioned, and release-backed.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 3: Dynamic Section System

Requirement: Every section has schema, renderer, preview component, data dependencies, and fallback behavior.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 4: Theme Component Registry

Requirement: Storefront maps section type to registered renderer metadata instead of switch-only assumptions.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 5: Admin-to-Theme Sync

Requirement: Admin draft/save/publish flows emit events and invalidate storefront cache.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 6: Product Publishing Pipeline

Requirement: Products move through draft, active, channel-published, archived, and deleted states.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 7: Storefront Rendering Pipeline

Requirement: Public storefront renders published release snapshots and shopper-safe public commerce APIs.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 8: Live Preview Engine

Requirement: Draft preview uses signed sessions, sync cursors, and draft snapshots.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 9: CMS Builder

Requirement: Pages, sections, blocks, navigation, banners, and policies are store-scoped content data.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 10: Dynamic Form Engine

Requirement: Admin and Flutter render settings forms from shared schema metadata.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 11: Store Configuration Engine

Requirement: Settings for checkout, shipping, taxes, payments, localization, brand, and SEO share one worker contract.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 12: Multi-store Isolation

Requirement: All reads and writes are constrained by store ownership and role scope.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 13: Product Variant Engine

Requirement: Options, option values, variants, media, SKU, price, and inventory policy are normalized.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 14: Inventory Sync

Requirement: Reservations, levels, adjustments, and reconciliation replace scalar stock as the source of truth.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 15: Payment State Machine

Requirement: Payment attempts, provider sessions, webhooks, refunds, and reconciliation are idempotent.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 16: Order Event Bus

Requirement: Order lifecycle changes are immutable events with fulfillment/refund/shipment context.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 17: Search Infrastructure

Requirement: Product and content changes feed search_documents and storefront search indexes.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 18: Media CDN Pipeline

Requirement: R2 assets, derivatives, usage graph, and cache tags make media safe and fast.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 19: Cache Invalidation

Requirement: Outbox events map domain changes to route and tag purges.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 20: Realtime Events

Requirement: Admin web, Flutter Builder, preview frames, and dashboards consume store-scoped events.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 21: Audit Logs

Requirement: Every sensitive mutation records actor, store, request, before/after diff, and result.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 22: RBAC

Requirement: Merchant owner/staff scopes are enforced in worker middleware and reflected in UI.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 23: Webhook System

Requirement: Provider events verify signatures, store event ids, and process asynchronously.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 24: Queue Architecture

Requirement: Async jobs handle search, cache, media, analytics, email, and webhook retries.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 25: Background Workers

Requirement: Consumers are idempotent, observable, retryable, and dead-letter capable.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 26: Database Normalization

Requirement: Core commerce data is relational; JSONB remains metadata/settings only.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 27: GraphQL/API Layer

Requirement: Worker REST remains canonical now, with generated OpenAPI/JSON schema and optional future GraphQL BFF.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 28: Storefront State Hydration

Requirement: Urban Kicks hydrates only minimal interactive state and avoids leaking admin/draft data.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 29: SEO Engine

Requirement: SEO metadata, redirects, sitemap, robots, and OG assets are first-class.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 30: Analytics Pipeline

Requirement: Shopper/admin/domain events feed dashboards and operational alerts.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 31: Feature Flags

Requirement: Every major engine ships behind store/platform flags with rollback.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 32: Observability Stack

Requirement: Request ids, logs, traces, metrics, SLOs, and alerts cover every critical path.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 33: Error Tracking

Requirement: Sanitized client errors and detailed internal errors are correlated by request id.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 34: Production Deployment

Requirement: Staging, canary, rollout, rollback, and runbooks are mandatory.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 35: CI/CD Pipelines

Requirement: Typecheck, lint, tests, migrations, contracts, and security scans gate release.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 36: Testing Infrastructure

Requirement: Unit, service, contract, migration, e2e, Flutter, and tenant-isolation suites are required.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 37: Migration Infrastructure

Requirement: Backfills, dual-writes, validation queries, and rollback snapshots protect stores.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 38: Theme Versioning

Requirement: Theme packages, drafts, releases, assets, and rollbacks are versioned.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 39: Draft/Publish Workflow

Requirement: Draft edits are isolated until publish creates a public immutable release.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

### Control 40: Edge Rendering Strategy

Requirement: Public storefront pages use release snapshots, cache tags, and on-demand invalidation.
Current repository tie-in: verify the current state across apps/web/consumer/admin, apps/web/consumer/storefront, backend/workers/api, backend/supabase/migrations, apps/flutter/builder, packages/typescript, and packages/dart before making changes.
Implementation proof: a merged change must include schema or contract updates where needed, admin web wiring, Flutter parity where the domain is mobile-visible, Urban Kicks storefront verification where storefront-visible, tests, and rollback notes.
Security proof: tenant ownership, RBAC scope, sanitized errors, audit record, secret handling, and webhook/idempotency behavior must be reviewed before production rollout.
Performance proof: query plan, pagination, cache tag, async job, bundle impact, and storefront render behavior must be checked for this control when applicable.
Operational proof: logs, metrics, alerts, queue retry behavior, feature flag state, and runbook entry must exist when this control touches runtime behavior.

## Artifact-Specific Review Closeout

This file, 24_ENGINEERING_TASK_BREAKDOWN.md, is considered complete only when its recommendations are converted into tracked engineering work with owners, dependencies, migration notes, test proof, and production rollout gates.
