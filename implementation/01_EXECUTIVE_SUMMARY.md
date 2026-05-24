# 01 - Executive Summary

Generated: 2026-05-22
Scope: LetBuyy Admin App, Urban Kicks storefront, Hono worker API, Supabase schema, Flutter Builder, shared packages, and production commerce infrastructure.
Status: Planning artifact. This document is source-derived from the current repository scan plus official commerce platform documentation listed below.

## Critical Objective

Transform the LetBuyy Admin App into a fully wired, production-grade, multi-tenant commerce operating system where merchant actions directly control the Urban Kicks storefront through validated worker contracts, versioned theme releases, shared web/Flutter models, event-driven sync, and observable infrastructure.

## Source-Derived LetBuyy Facts

1. Root governance file AGENTS.md identifies LetBuyy as a Shopify-class multi-tenant commerce and site-builder SaaS.
2. Database ownership uses sites. Merchant UI, URLs, and source naming often use store. The plan must preserve this mapping and must not add a stores table.
3. Admin app path: apps/web/consumer/admin. It contains store-scoped routes under src/app/[store], admin-local theme API route handlers, and a payment-config proxy route at src/app/api/stores/[store]/payment-config/route.ts.
4. Storefront app path: apps/web/consumer/storefront. It contains wildcard tenant routes under src/app/store/[subdomain], customer APIs, storefront payment APIs, theme preview routes, and Urban Kicks dynamic/preview modules.
5. Urban Kicks dynamic theme path: apps/web/consumer/storefront/consumer-storefront/stores/urban-kicks/dynamic. The dynamic renderer currently maps heroBanner, productGrid, featuredProducts, testimonials, newsletter, aboutSection, ctaSection, categoryGrid, brandMarquee, and trustBadges.
6. Theme registry path: apps/web/consumer/storefront/src/lib/theme-registry.ts. It currently registers only urban-kicks as active and uses a siteTypes array constrained to store.
7. Storefront homepage path: apps/web/consumer/storefront/src/app/store/[subdomain]/page.tsx. It uses ISR revalidate 300, StoreService.getStoreBySubdomain, ProductService.getProductsByIds, templateConfig.sections, and UrbanKicksSectionRenderer when themeId is urban-kicks.
8. API worker entrypoint: backend/workers/api/src/index.ts. Hono route modules live under backend/workers/api/src/routes and services live under backend/workers/api/src/services.
9. Worker theme routes path: backend/workers/api/src/routes/themes.ts. ThemeService supports catalog, categories, schema, editor load, draft save, draft delete, publish, install, purchase, and purchase list flows.
10. Theme service path: backend/workers/api/src/services/theme.service.ts. It verifies store ownership through the stores view, installs themes, reads theme_editor_drafts, upserts draft_config with version, and publishes by writing sites.theme_id and sites.template_config.
11. Worker store routes path: backend/workers/api/src/routes/stores.ts. It includes tenant payment-config GET/POST using sites.payment_settings, online_payment_enabled, cod_enabled, masked key id output, and AES-GCM encryption with PAYMENT_CONFIG_ENCRYPTION_KEY.
12. Product service path: backend/workers/api/src/services/product.service.ts. It verifies store ownership, writes products with JSON variants and scalar stock, allowlists updates, and soft deletes through deleted_at.
13. Order service path: backend/workers/api/src/services/order.service.ts. It recalculates totals from DB product prices, writes orders and order_items, decrements inventory row by row, and transitions order state through VALID_TRANSITIONS.
14. Webhook worker path: backend/workers/webhooks/src/index.ts. It is the dedicated Cloudflare webhook worker and contains payment webhook event handling and idempotency concerns.
15. Supabase migration root: backend/supabase/migrations. Current scan found 30 migration files plus duplicate/non-standard 022 numbering with 022_media_and_forms.sql and 022a_deactivate_non_urban_kicks_themes.sql.
16. Theme editor and payment migration path: backend/supabase/migrations/030_theme_editor_and_payment_events.sql. It adds theme_editor_drafts, payment_webhook_events, sites.payment_settings, online_payment_enabled, cod_enabled, and updates the stores view.
17. Flutter Builder path: apps/flutter/builder. It contains theme_service.dart, theme_editor_models.dart, editor widgets, product/order/analytics/settings screens, and uses a store-scoped ThemeService that mirrors admin web catalog, install, load editor, save draft, publish.
18. Dart model package path: packages/dart/models. It includes product, order, cart, payment_config_model, payment_settings_model, store_template_model, section_model, and other commerce models.
19. Shared TypeScript packages exist under packages/typescript/ui, packages/typescript/utils, and packages/typescript/api-types, but the UI package remains minimal with Button, Input, and DataTable only.
20. Current docs/task memory identifies production blockers: committed secrets, webhook verification parity, auth rate limiting, CSRF, server-side price recalculation, missing tests, and inconsistent app/API ownership.

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

## Target Architecture Principles

1. The Cloudflare Hono worker becomes the canonical commerce API for admin web, Flutter builder, storefront, marketplace, console, team, and background workers.
2. Every admin mutation is store-scoped, role-checked, Zod-validated, idempotent when side effects exist, audited, and emitted as a domain event.
3. The storefront never trusts client totals and never reads admin-only secrets. It renders only published theme releases and shopper-safe public data.
4. Urban Kicks is treated as the first production theme, not as hardcoded demo UI. Its schema, sections, presets, assets, and renderer registry become database-backed and versioned.
5. The admin builder edits drafts. Publish creates immutable releases. Storefront reads release snapshots. Preview reads draft snapshots through a signed preview channel.
6. Product, inventory, cart, checkout, payment, order, fulfillment, refund, analytics, theme, CMS, media, and settings domains have explicit service ownership and database boundaries.
7. Web and Flutter consume generated OpenAPI/JSON schema contracts and generated Dart/TypeScript models. Manual duplicated DTOs are phased out.
8. Edge cache, ISR, CDN assets, R2 objects, search documents, and preview sessions are invalidated by outbox events, not by ad hoc frontend refreshes.
9. RLS remains enabled, but service-layer tenant checks are mandatory because service-role operations bypass normal user policies.
10. Production readiness means migrations, tests, observability, security controls, rollback strategy, and operational runbooks are complete before rollout.

## Target Runtime Topology

```text
+----------------------+     +-----------------------+     +------------------------+
| Admin Web            |     | Flutter Builder       |     | Console / Team         |
| store-scoped UI      |     | mobile builder UI     |     | internal operations    |
+----------+-----------+     +-----------+-----------+     +-----------+------------+
           |                             |                             |
           +-------------+---------------+---------------+-------------+
                         |                               |
                         v                               v
              +----------------------+          +-----------------------+
              | Hono API Worker /v1  |          | Webhooks Worker      |
              | auth, RBAC, Zod      |          | provider signatures  |
              | services, events     |          | idempotent events    |
              +----------+-----------+          +-----------+-----------+
                         |                                  |
          +--------------+--------------+                   |
          |                             |                   |
          v                             v                   v
+-------------------+        +-------------------+   +-------------------+
| Supabase Postgres |        | Cloudflare Queues |   | R2 / CDN / Cache  |
| sites, products   |        | outbox consumers  |   | theme/media assets|
+---------+---------+        +---------+---------+   +---------+---------+
          |                            |                       |
          +-------------+--------------+-----------------------+
                        |
                        v
          +-----------------------------+
          | Storefront Urban Kicks      |
          | public release renderer     |
          | signed draft preview        |
          +-----------------------------+
```

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

## Executive Implementation Thesis

The existing repository has enough foundation to become a production commerce platform: Admin routes exist, Storefront routes exist, Urban Kicks exists as a real dynamic theme, worker services exist for themes/products/orders/payments, Supabase migrations cover many commerce entities, and Flutter Builder already mirrors the theme workflow. The missing layer is not another screen. The missing layer is a coherent operating architecture that makes the worker the source of truth, makes theme releases immutable, makes every admin mutation evented/audited/cache-aware, and makes web/Flutter/storefront consume the same contracts.

## Immediate Production Focus
1. Security and secret hygiene
2. Theme release engine for Urban Kicks
3. Admin and Flutter contract generation
4. Outbox events plus cache invalidation
5. Product variant and inventory normalization
6. Payment attempt and webhook reconciliation
7. Order lifecycle workflows
8. CMS/navigation/SEO/media engines
9. Observability and CI gates

## Executive Domain Plan

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

This file, 01_EXECUTIVE_SUMMARY.md, is considered complete only when its recommendations are converted into tracked engineering work with owners, dependencies, migration notes, test proof, and production rollout gates.
