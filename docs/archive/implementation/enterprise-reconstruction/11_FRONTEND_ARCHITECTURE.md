# 11 - Frontend Architecture

Generated: 2026-05-22
Scope: LetBuyy Admin App, Urban Kicks storefront, Hono worker API, Supabase schema, Flutter Builder, shared packages, and production commerce infrastructure.
Status: Planning artifact. This document is source-derived from the current repository scan plus official commerce platform documentation listed below.

## Admin Operating System Wireframe

```text
+----------------------------------------------------------------------------------+
| LetBuyy Admin / Store: Urban Kicks Demo                         User / Role / Help|
+-------------------+--------------------------------------------------------------+
| Sidebar           | Top Context Bar                                               |
| - Dashboard       | Store status: Published | Theme: Urban Kicks | Sync: Live     |
| - Products        +--------------------------------------------------------------+
| - Orders          | Main Workspace                                                |
| - Customers       |                                                              |
| - Collections     |  +---------------------+ +---------------------+             |
| - Inventory       |  | Revenue / Orders    | | Storefront Health   |             |
| - Discounts       |  +---------------------+ +---------------------+             |
| - Online Store    |                                                              |
|   - Themes        |  +--------------------------------------------------------+  |
|   - Builder       |  | Domain-specific table, editor, chart, or preview        |  |
|   - Navigation    |  | All writes go through worker /v1 with store context      |  |
|   - Pages         |  +--------------------------------------------------------+  |
| - Settings        |                                                              |
+-------------------+--------------------------------------------------------------+
| Audit strip: last publish, last payment config update, last product sync event     |
+----------------------------------------------------------------------------------+
```

## Theme Builder Wireframe

```text
+----------------------------------------------------------------------------------+
| Urban Kicks Theme Editor                         Draft saved 10:42 | Publish      |
+--------+----------------------+----------------------------------+----------------+
| Icons  | Section Tree         | Preview Canvas                   | Settings       |
| Home   | Header               | +------------------------------+ | Selected       |
| Theme  | Hero Banner          | | Urban Kicks live preview      | | - Content     |
| Media  | Brand Marquee        | | Desktop / Tablet / Mobile     | | - Layout      |
| SEO    | Product Grid         | | Real products from store      | | - Colors      |
|        | Category Grid        | | Draft config, signed token    | | - Products    |
|        | Testimonials         | +------------------------------+ | - Visibility  |
+--------+----------------------+----------------------------------+----------------+
| Bottom bar: Undo | Redo | Version conflict state | Preview URL | Publish checklist |
+----------------------------------------------------------------------------------+
```

## Current Frontend Anchors

- Admin app route pages live under apps/web/consumer/admin/src/app/[store].
- Theme editor page lives at apps/web/consumer/admin/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx and currently carries a large Urban Kicks DEFAULT_TEMPLATE.
- Storefront public Urban Kicks dynamic routes live under apps/web/consumer/storefront/src/app/store/[subdomain] and theme modules live under consumer-storefront/stores/urban-kicks.
- Flutter Builder theme flow lives in apps/flutter/builder/lib/services/theme_service.dart and apps/flutter/builder/lib/models/theme_editor_models.dart.

## Target Admin Module Structure

```text
apps/web/consumer/admin/src/
  app/[store]/... route shells only
  modules/
    products/ components, hooks, api, schemas, pages
    orders/ components, hooks, api, state machines
    customers/ components, hooks, tables, forms
    online-store/ themes, builder, navigation, pages, seo
    settings/ payments, shipping, taxes, checkout, users
  lib/api/ generated worker client
  lib/store-context/ store resolver and permissions
  components/ shared app shell and common controls
```

## Required UI States Per Screen
1. loading skeleton
2. empty state
3. error with retry
4. permission denied
5. unsaved changes
6. saving
7. saved
8. version conflict
9. publish pending
10. cache invalidating
11. live preview connected
12. offline/reconnect

## Admin-To-Urban-Kicks Interaction Pattern

1. Admin loads store context and theme editor payload from worker.
2. Admin renders section tree and settings forms from schema metadata.
3. Admin autosaves draft with base_version.
4. Worker stores draft, writes audit, emits theme.draft.updated.
5. Preview frame receives realtime event or polls sync cursor.
6. Publish validates draft, creates release, writes sites.theme_id/template_config compatibility fields, emits theme.release.published.
7. Queue invalidates cache and sends storefront/admin sync event.
8. Urban Kicks public page renders release snapshot.

## Frontend Work By Domain

### 1. Tenant and Store Context

Objective: Resolve authenticated user, active site, store slug, permissions, plan limits, and storefront public identity from one canonical middleware stack.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 2. Theme Config Engine

Objective: Move Urban Kicks and future themes to versioned JSON schema, section schema, block schema, settings schema, asset manifest, and release snapshots.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 3. Admin Theme Editor

Objective: Convert admin editor from local DEFAULT_TEMPLATE assumptions to schema-driven forms, optimistic draft saves, conflict handling, signed live preview, and publish approvals.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 4. Storefront Renderer

Objective: Render only published releases for shoppers, draft releases for signed preview sessions, and route every section through a registry with strict fallback handling.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 5. Product Engine

Objective: Normalize product options, values, variants, media, attributes, publication status, SEO metadata, and collection links while preserving legacy products rows during migration.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 6. Inventory Engine

Objective: Separate stock availability from product content through locations, levels, reservations, adjustments, and release/reconcile events.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 7. Collection and Search Engine

Objective: Support manual and smart collections, filter facets, product search documents, indexing workers, and storefront search API parity.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 8. Cart and Checkout Engine

Objective: Persist carts server-side, price carts from DB, apply discounts/taxes/shipping, create checkout sessions, and prevent stale or manipulated totals.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 9. Payment Engine

Objective: Use provider adapters for Razorpay, Stripe, PayPal, tenant credentials, payment attempts, webhook idempotency, refunds, disputes, and reconciliation.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 10. Order Engine

Objective: Make order lifecycle event-driven with state machine, order events, fulfillment records, refund records, shipment tracking, and audit trail.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 11. CMS and Page Builder

Objective: Model pages, templates, sections, blocks, navigation, banners, policies, and reusable content as store-scoped content entities.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 12. Media Pipeline

Objective: Route uploads to R2, store asset metadata in media, generate derivatives, attach assets to products/themes/CMS, and enforce tenant ownership.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 13. RBAC and Audit

Objective: Enforce owner/staff role scopes per domain and record every sensitive mutation in audit/activity logs.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 14. Realtime and Events

Objective: Add outbox_events, Cloudflare Queues consumers, Supabase Realtime or WebSocket/SSE fanout, and admin/storefront cache invalidation.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 15. Analytics and Observability

Objective: Capture shopper/admin/domain events, aggregate analytics, trace requests, alert on webhook/payment/order failures, and expose dashboards.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

### 16. CI, Testing, and Deployment

Objective: Add contract tests, service tests, migration tests, e2e flows, preview deployment gates, rollback runbooks, and staged rollout controls.

Current LetBuyy anchor points:
- Admin surface: apps/web/consumer/admin/src/app/[store] and admin-local API routes.
- Worker surface: backend/workers/api/src/routes and backend/workers/api/src/services.
- Storefront surface: apps/web/consumer/storefront/src/app/store/[subdomain] and Urban Kicks dynamic modules.
- Mobile surface: apps/flutter/builder/lib/services and apps/flutter/builder/lib/models.

Implementation requirements:
- Add or update Zod schema in backend/workers/api/src/schemas before exposing mutation endpoints.
- Enforce site_id/store_id ownership and RBAC scope before every read or write.
- Return standardized worker envelopes and update TypeScript and Dart clients from generated contracts.
- Emit outbox event after every successful mutation that affects storefront, analytics, inventory, payment, or cache.
- Write audit/activity event with actor, store_id, request_id, domain, action, before/after diff, and result.
- Add unit, contract, migration, and e2e coverage before rollout.

Production checklist:
- Tenant isolation test exists.
- API contract test exists.
- Admin web flow is wired.
- Flutter Builder flow is wired.
- Storefront Urban Kicks behavior is verified.
- Cache invalidation and preview refresh are verified.
- Rollback path is documented.

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

This file, 11_FRONTEND_ARCHITECTURE.md, is considered complete only when its recommendations are converted into tracked engineering work with owners, dependencies, migration notes, test proof, and production rollout gates.
