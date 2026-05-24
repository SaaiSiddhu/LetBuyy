# 21 - Scalability Architecture

Generated: 2026-05-22
Scope: LetBuyy Admin App, Urban Kicks storefront, Hono worker API, Supabase schema, Flutter Builder, shared packages, and production commerce infrastructure.
Status: Planning artifact. This document is source-derived from the current repository scan plus official commerce platform documentation listed below.

## Scaling Targets

1. Many stores per merchant account without cross-store data leakage.
2. High storefront read traffic served from edge/cache/release snapshots.
3. Admin writes remain strongly validated and auditable.
4. Checkout/payment/order paths remain consistent under retries and provider delay.
5. Search, analytics, media, and cache purge work happens asynchronously.
6. Flutter and web clients use the same contracts so feature rollout scales operationally.

## Performance Risks In Current Shape

1. Storefront homepage fetches products by section product ids at render time and relies on ISR instead of precomputed release data.
2. Product variants and settings stored as JSON reduce queryability and can create expensive app-side filtering.
3. Order creation performs sequential inventory updates and is not protected by a transaction/reservation workflow.
4. Admin route pages can become heavy client surfaces if schema/forms/tables are not modularized.
5. No production search index means storefront search and filters will pressure Postgres as catalog grows.
6. No cache tag registry means invalidation can become broad, stale, or manual.

### Implementation Item: Storefront release snapshots

Objective: Precompute public theme release data so Urban Kicks pages can render from cacheable snapshots rather than assembling all settings and content on every request.

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

### Implementation Item: Async indexing and cache purging

Objective: Move search indexing, analytics aggregation, media derivatives, and cache invalidation to queues.

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

### Implementation Item: Pagination and index discipline

Objective: Require pagination for all list endpoints and add compound indexes around store_id plus sort/filter columns.

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

This file, 21_SCALABILITY_ARCHITECTURE.md, is considered complete only when its recommendations are converted into tracked engineering work with owners, dependencies, migration notes, test proof, and production rollout gates.
