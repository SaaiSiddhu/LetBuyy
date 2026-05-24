# 06 - Architecture Gap Analysis

Generated: 2026-05-22
Scope: LetBuyy Admin App, Urban Kicks storefront, Hono worker API, Supabase schema, Flutter Builder, shared packages, and production commerce infrastructure.
Status: Planning artifact. This document is source-derived from the current repository scan plus official commerce platform documentation listed below.

## Gap Model

Each gap is evaluated as current state, production target, required delta, and acceptance proof.

### 1. Tenant and Store Context

Current state: Tenant and Store Context exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Resolve authenticated user, active site, store slug, permissions, plan limits, and storefront public identity from one canonical middleware stack.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 2. Theme Config Engine

Current state: Theme Config Engine exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Move Urban Kicks and future themes to versioned JSON schema, section schema, block schema, settings schema, asset manifest, and release snapshots.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 3. Admin Theme Editor

Current state: Admin Theme Editor exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Convert admin editor from local DEFAULT_TEMPLATE assumptions to schema-driven forms, optimistic draft saves, conflict handling, signed live preview, and publish approvals.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 4. Storefront Renderer

Current state: Storefront Renderer exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Render only published releases for shoppers, draft releases for signed preview sessions, and route every section through a registry with strict fallback handling.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 5. Product Engine

Current state: Product Engine exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Normalize product options, values, variants, media, attributes, publication status, SEO metadata, and collection links while preserving legacy products rows during migration.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 6. Inventory Engine

Current state: Inventory Engine exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Separate stock availability from product content through locations, levels, reservations, adjustments, and release/reconcile events.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 7. Collection and Search Engine

Current state: Collection and Search Engine exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Support manual and smart collections, filter facets, product search documents, indexing workers, and storefront search API parity.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 8. Cart and Checkout Engine

Current state: Cart and Checkout Engine exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Persist carts server-side, price carts from DB, apply discounts/taxes/shipping, create checkout sessions, and prevent stale or manipulated totals.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 9. Payment Engine

Current state: Payment Engine exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Use provider adapters for Razorpay, Stripe, PayPal, tenant credentials, payment attempts, webhook idempotency, refunds, disputes, and reconciliation.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 10. Order Engine

Current state: Order Engine exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Make order lifecycle event-driven with state machine, order events, fulfillment records, refund records, shipment tracking, and audit trail.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 11. CMS and Page Builder

Current state: CMS and Page Builder exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Model pages, templates, sections, blocks, navigation, banners, policies, and reusable content as store-scoped content entities.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 12. Media Pipeline

Current state: Media Pipeline exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Route uploads to R2, store asset metadata in media, generate derivatives, attach assets to products/themes/CMS, and enforce tenant ownership.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 13. RBAC and Audit

Current state: RBAC and Audit exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Enforce owner/staff role scopes per domain and record every sensitive mutation in audit/activity logs.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 14. Realtime and Events

Current state: Realtime and Events exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Add outbox_events, Cloudflare Queues consumers, Supabase Realtime or WebSocket/SSE fanout, and admin/storefront cache invalidation.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 15. Analytics and Observability

Current state: Analytics and Observability exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Capture shopper/admin/domain events, aggregate analytics, trace requests, alert on webhook/payment/order failures, and expose dashboards.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

### 16. CI, Testing, and Deployment

Current state: CI, Testing, and Deployment exists partially through current LetBuyy routes, services, migrations, or app screens, but the implementation is not yet fully productionized across admin web, Flutter Builder, worker, database, and Urban Kicks storefront.

Target state: Add contract tests, service tests, migration tests, e2e flows, preview deployment gates, rollback runbooks, and staged rollout controls.

Required delta:
- Define canonical owner and remove duplicated behavior from page-local code.
- Add missing tables/indexes/RLS/audit/version columns only where the current schema cannot support the target.
- Add worker endpoint and service method with Zod validation and standardized errors.
- Wire admin UI and Flutter Builder to the same contract.
- Wire Urban Kicks rendering or preview behavior where storefront output changes.
- Add event outbox entry, queue consumer, cache invalidation, and realtime fanout if state affects public storefront or operational dashboards.

Acceptance proof:
- Tenant isolation tests pass for two stores under different users.
- API contract tests pass for TypeScript and Dart models.
- Admin action changes the correct Urban Kicks storefront output without touching another store.
- Rollback can restore the previous published snapshot or feature flag path.

## Current Gaps That Directly Affect Admin-To-Urban-Kicks Production Readiness

1. Admin writes are not yet consistently canonicalized through the worker. Some admin screens and route handlers still operate as app-local surfaces or use direct Supabase logic.
2. Theme publishing writes template_config but does not emit a durable event, invalidate storefront cache, notify live previews, or update a versioned theme release table.
3. Urban Kicks storefront reads published template_config with ISR revalidate 300, so admin changes are not guaranteed to appear in real time.
4. The theme schema model is split between DB theme fields, admin DEFAULT_TEMPLATE, admin SECTION_SCHEMAS, Flutter theme editor models, and Urban Kicks section JSON files.
5. Product variants are partly modeled in migrations but ProductService still treats variants as any[] JSON on products, creating Flutter/web/backend contract risk.
6. Inventory is split between scalar products.stock and inventory_levels/inventory_adjustments. OrderService decrements products.stock sequentially without a database transaction or reservation state machine.
7. Payment configuration now exists but tenant-owned gateway usage is not yet fully propagated through storefront payment creation, webhook reconciliation, refunds, and order payment attempts.
8. Order lifecycle lacks a durable outbox, event log, fulfillment tables, refund tables, shipment tracking events, and atomic stock release/reservation behavior.
9. RBAC exists as middleware scaffolding and employee tables but merchant admin role enforcement is not yet consistently applied to every admin action.
10. Web and Flutter share concepts but do not share generated contracts. Dart models parse worker responses manually and TypeScript API types are small.
11. Cache strategy is mostly implicit. Storefront uses ISR and worker has cache/rate intent, but no cache tag registry, no purge API, and no store-scoped invalidation pipeline.
12. Search indexing is not productionized. Product search, collection filters, storefront indexing, and analytics feedback loops need dedicated architecture.
13. Media storage exists in schema and routes, but a complete R2/CDN derivative pipeline, asset ownership model, and theme asset versioning are missing.
14. Production observability is incomplete. Request IDs exist as governance, but structured logs, traces, metrics, error tracking, and SLO dashboards need implementation.
15. Design system is fragmented between web Tailwind/CSS, admin components, storefront theme CSS tokens, and Flutter UI kit/theme colors.
16. The monorepo has app/package naming drift, untracked/new AGENTS for future packages, generated worker dist debt, and inconsistent ownership boundaries.

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

This file, 06_ARCHITECTURE_GAP_ANALYSIS.md, is considered complete only when its recommendations are converted into tracked engineering work with owners, dependencies, migration notes, test proof, and production rollout gates.
