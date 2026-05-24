# 23 - Full Implementation Roadmap

Generated: 2026-05-22
Scope: LetBuyy Admin App, Urban Kicks storefront, Hono worker API, Supabase schema, Flutter Builder, shared packages, and production commerce infrastructure.
Status: Planning artifact. This document is source-derived from the current repository scan plus official commerce platform documentation listed below.

## Phase 0 - Safety And Contract Baseline

### 1.1 Rotate/purge secrets

### Implementation Item: Rotate/purge secrets

Objective: Deliver Rotate/purge secrets as part of Phase 0 - Safety And Contract Baseline.

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

### 1.2 Lock API response envelopes

### Implementation Item: Lock API response envelopes

Objective: Deliver Lock API response envelopes as part of Phase 0 - Safety And Contract Baseline.

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

### 1.3 Create generated contract pipeline

### Implementation Item: Create generated contract pipeline

Objective: Deliver Create generated contract pipeline as part of Phase 0 - Safety And Contract Baseline.

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

### 1.4 Add tenant isolation tests

### Implementation Item: Add tenant isolation tests

Objective: Deliver Add tenant isolation tests as part of Phase 0 - Safety And Contract Baseline.

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

### 1.5 Add CI gates

### Implementation Item: Add CI gates

Objective: Deliver Add CI gates as part of Phase 0 - Safety And Contract Baseline.

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

## Phase 1 - Theme Release Foundation

### 2.1 Create theme_versions/releases/assets tables

### Implementation Item: Create theme_versions/releases/assets tables

Objective: Deliver Create theme_versions/releases/assets tables as part of Phase 1 - Theme Release Foundation.

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

### 2.2 Move Urban Kicks schema into canonical package metadata

### Implementation Item: Move Urban Kicks schema into canonical package metadata

Objective: Deliver Move Urban Kicks schema into canonical package metadata as part of Phase 1 - Theme Release Foundation.

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

### 2.3 Add publish release snapshots

### Implementation Item: Add publish release snapshots

Objective: Deliver Add publish release snapshots as part of Phase 1 - Theme Release Foundation.

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

### 2.4 Add rollback and preview sessions

### Implementation Item: Add rollback and preview sessions

Objective: Deliver Add rollback and preview sessions as part of Phase 1 - Theme Release Foundation.

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

## Phase 2 - Admin Builder Wiring

### 3.1 Refactor editor to schema-driven forms

### Implementation Item: Refactor editor to schema-driven forms

Objective: Deliver Refactor editor to schema-driven forms as part of Phase 2 - Admin Builder Wiring.

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

### 3.2 Add live preview transport

### Implementation Item: Add live preview transport

Objective: Deliver Add live preview transport as part of Phase 2 - Admin Builder Wiring.

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

### 3.3 Unify admin and Flutter theme contracts

### Implementation Item: Unify admin and Flutter theme contracts

Objective: Deliver Unify admin and Flutter theme contracts as part of Phase 2 - Admin Builder Wiring.

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

### 3.4 Add cache invalidation on publish

### Implementation Item: Add cache invalidation on publish

Objective: Deliver Add cache invalidation on publish as part of Phase 2 - Admin Builder Wiring.

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

## Phase 3 - Product And Inventory Engine

### 4.1 Normalize variants

### Implementation Item: Normalize variants

Objective: Deliver Normalize variants as part of Phase 3 - Product And Inventory Engine.

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

### 4.2 Add product publication

### Implementation Item: Add product publication

Objective: Deliver Add product publication as part of Phase 3 - Product And Inventory Engine.

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

### 4.3 Implement inventory reservations

### Implementation Item: Implement inventory reservations

Objective: Deliver Implement inventory reservations as part of Phase 3 - Product And Inventory Engine.

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

### 4.4 Wire product sections to real products/collections

### Implementation Item: Wire product sections to real products/collections

Objective: Deliver Wire product sections to real products/collections as part of Phase 3 - Product And Inventory Engine.

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

## Phase 4 - Checkout Payment Order Engine

### 5.1 Checkout sessions

### Implementation Item: Checkout sessions

Objective: Deliver Checkout sessions as part of Phase 4 - Checkout Payment Order Engine.

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

### 5.2 Payment attempts/adapters

### Implementation Item: Payment attempts/adapters

Objective: Deliver Payment attempts/adapters as part of Phase 4 - Checkout Payment Order Engine.

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

### 5.3 Webhook reconciliation

### Implementation Item: Webhook reconciliation

Objective: Deliver Webhook reconciliation as part of Phase 4 - Checkout Payment Order Engine.

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

### 5.4 Fulfillment/refund workflows

### Implementation Item: Fulfillment/refund workflows

Objective: Deliver Fulfillment/refund workflows as part of Phase 4 - Checkout Payment Order Engine.

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

## Phase 5 - CMS Navigation SEO Media

### 6.1 Page builder

### Implementation Item: Page builder

Objective: Deliver Page builder as part of Phase 5 - CMS Navigation SEO Media.

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

### 6.2 Navigation editor

### Implementation Item: Navigation editor

Objective: Deliver Navigation editor as part of Phase 5 - CMS Navigation SEO Media.

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

### 6.3 SEO metadata

### Implementation Item: SEO metadata

Objective: Deliver SEO metadata as part of Phase 5 - CMS Navigation SEO Media.

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

### 6.4 R2 media derivatives

### Implementation Item: R2 media derivatives

Objective: Deliver R2 media derivatives as part of Phase 5 - CMS Navigation SEO Media.

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

### 6.5 Urban Kicks header/footer sync

### Implementation Item: Urban Kicks header/footer sync

Objective: Deliver Urban Kicks header/footer sync as part of Phase 5 - CMS Navigation SEO Media.

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

## Phase 6 - Analytics Realtime Observability

### 7.1 Outbox events

### Implementation Item: Outbox events

Objective: Deliver Outbox events as part of Phase 6 - Analytics Realtime Observability.

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

### 7.2 Queue consumers

### Implementation Item: Queue consumers

Objective: Deliver Queue consumers as part of Phase 6 - Analytics Realtime Observability.

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

### 7.3 Realtime sync cursors

### Implementation Item: Realtime sync cursors

Objective: Deliver Realtime sync cursors as part of Phase 6 - Analytics Realtime Observability.

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

### 7.4 Analytics aggregation

### Implementation Item: Analytics aggregation

Objective: Deliver Analytics aggregation as part of Phase 6 - Analytics Realtime Observability.

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

### 7.5 SLO dashboards

### Implementation Item: SLO dashboards

Objective: Deliver SLO dashboards as part of Phase 6 - Analytics Realtime Observability.

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

## Phase 7 - Security RBAC Enterprise Hardening

### 8.1 Merchant staff RBAC

### Implementation Item: Merchant staff RBAC

Objective: Deliver Merchant staff RBAC as part of Phase 7 - Security RBAC Enterprise Hardening.

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

### 8.2 Audit viewer

### Implementation Item: Audit viewer

Objective: Deliver Audit viewer as part of Phase 7 - Security RBAC Enterprise Hardening.

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

### 8.3 CSRF/CORS/rate limits

### Implementation Item: CSRF/CORS/rate limits

Objective: Deliver CSRF/CORS/rate limits as part of Phase 7 - Security RBAC Enterprise Hardening.

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

### 8.4 PII redaction

### Implementation Item: PII redaction

Objective: Deliver PII redaction as part of Phase 7 - Security RBAC Enterprise Hardening.

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

### 8.5 permission matrix tests

### Implementation Item: permission matrix tests

Objective: Deliver permission matrix tests as part of Phase 7 - Security RBAC Enterprise Hardening.

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

## Phase 8 - Rollout And Scale

### 9.1 Feature flags

### Implementation Item: Feature flags

Objective: Deliver Feature flags as part of Phase 8 - Rollout And Scale.

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

### 9.2 Canary stores

### Implementation Item: Canary stores

Objective: Deliver Canary stores as part of Phase 8 - Rollout And Scale.

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

### 9.3 Load/performance tests

### Implementation Item: Load/performance tests

Objective: Deliver Load/performance tests as part of Phase 8 - Rollout And Scale.

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

### 9.4 migration cleanup

### Implementation Item: migration cleanup

Objective: Deliver migration cleanup as part of Phase 8 - Rollout And Scale.

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

### 9.5 production runbooks

### Implementation Item: production runbooks

Objective: Deliver production runbooks as part of Phase 8 - Rollout And Scale.

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

This file, 23_FULL_IMPLEMENTATION_ROADMAP.md, is considered complete only when its recommendations are converted into tracked engineering work with owners, dependencies, migration notes, test proof, and production rollout gates.
