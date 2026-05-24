# 02 - Industry Research Findings

Generated: 2026-05-22
Scope: LetBuyy Admin App, Urban Kicks storefront, Hono worker API, Supabase schema, Flutter Builder, shared packages, and production commerce infrastructure.
Status: Planning artifact. This document is source-derived from the current repository scan plus official commerce platform documentation listed below.

## External Research Anchors

- Shopify theme architecture: https://shopify.dev/docs/storefronts/themes/architecture
- Shopify JSON templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates
- Shopify sections and blocks: https://shopify.dev/docs/storefronts/themes/architecture/sections
- WooCommerce Store API: https://developer.woocommerce.com/docs/apis/store-api/
- WordPress theme.json global settings and styles: https://developer.wordpress.org/block-editor/how-to-guides/themes/global-settings-and-styles/
- Medusa modules: https://docs.medusajs.com/learn/fundamentals/modules
- Saleor channels: https://docs.saleor.io/developer/channels/overview
- Saleor apps: https://docs.saleor.io/developer/extending/apps/overview
- BigCommerce Stencil: https://docs.bigcommerce.com/developer/docs/storefront/stencil/overview
- Adobe Commerce architecture: https://developer.adobe.com/commerce/php/architecture/
- Stripe PaymentIntents: https://docs.stripe.com/payments/payment-intents
- Stripe webhooks: https://docs.stripe.com/webhooks
- Stripe idempotency: https://docs.stripe.com/api/idempotent_requests
- Razorpay webhook validation: https://razorpay.com/docs/webhooks/validate-test/
- Cloudflare Queues: https://developers.cloudflare.com/queues/
- Cloudflare Workers observability: https://developers.cloudflare.com/workers/observability/

## Research Synthesis For LetBuyy

Shopify themes separate layout, templates, sections, blocks, snippets, assets, config, and locales. The critical lesson for LetBuyy is that Urban Kicks must stop being only a React folder plus some JSON defaults. It needs a formal theme package shape, a schema contract, store-specific settings data, versioned releases, and merchant-safe editor controls.

WooCommerce and WordPress block themes show the value of a central theme.json style contract. LetBuyy should converge web and Flutter design parity around tokens that can be stored, validated, versioned, and compiled into CSS custom properties and Flutter ThemeData.

Medusa uses modular commerce concepts and workflows. The lesson is that LetBuyy should not place product, order, payment, and theme workflows in page components or thin route handlers. Domain modules and workflows should own side effects and event emission.

Saleor emphasizes channels and apps. LetBuyy needs equivalent channel-aware concepts for storefront, mobile builder, marketplace apps, and future social/POS channels. Apps and webhooks must be explicit extension points, not ad hoc route files.

BigCommerce Stencil reinforces the need for theme assets, context-aware storefront rendering, and a theme development contract. Urban Kicks should have a buildable asset manifest, schema manifest, preview data, and production data renderer.

Adobe Commerce demonstrates event, observer, module, indexer, queue, and configuration concepts at enterprise scale. LetBuyy should adopt the parts that fit: event outbox, background workers, search indexers, cache invalidation, and admin configuration scopes.

Stripe and Razorpay documentation requires secure webhook verification, idempotency, and asynchronous reconciliation. LetBuyy payment architecture must store payment attempts and webhook events before mutating orders and inventory.

Cloudflare Queues and Workers observability map directly to LetBuyy needs: async indexers, cache purgers, webhook processors, media jobs, and operational metrics outside the request path.

## Theme Configuration Patterns

1. Theme package has identity, version, renderer key, default templates, settings schema, section schemas, block schemas, locales, assets, and preview fixtures.
2. Store-specific theme data is settings_data, not code. It should be edited through schema-aware admin forms.
3. Templates are composition containers. Sections and blocks are movable, hideable, duplicable, and schema-validated.
4. Live preview should read a signed draft snapshot. Public storefront should read only a published immutable release snapshot.
5. Theme assets must be content-addressed and CDN-backed so rollbacks and cache invalidations are deterministic.
6. Typography and color systems should compile to CSS variables for web and ThemeData/token maps for Flutter.

## Product Management Patterns

1. Product identity, variant identity, inventory identity, media identity, collection identity, and publication identity are separate concerns.
2. Variants are not arbitrary JSON in production commerce. They need option values, SKU/barcode, price overrides, inventory policy, media, and fulfillment fields.
3. Inventory is a ledger/reservation problem, not only a product.stock integer.
4. Product search should be an index fed by product events, not a slow storefront SQL query per request.
5. Product publish state should distinguish draft, active, archived, scheduled, hidden from channel, and deleted.
6. SEO metadata and URL handles need uniqueness per store and redirect history for renamed products.

## Order, Payment, And Admin Patterns

1. Orders should have immutable financial line items, event history, fulfillment state, payment state, refund state, and shipment state.
2. Payments should use a gateway adapter layer and store provider-specific ids in payment_attempts, not directly on orders only.
3. Admin panels at commerce scale require RBAC, audit logs, bulk actions, idempotent mutations, retryable background jobs, and schema-driven settings.
4. Storefront sync should be event-driven: admin mutation -> DB transaction -> outbox -> queue -> cache purge -> realtime preview/storefront notifications.
5. Cache invalidation needs store-scoped tags such as store:{id}, theme:{id}, product:{id}, collection:{id}, and route groups.
6. Enterprise systems favor boring primitives: validation, isolation, event logs, queues, retries, metrics, and rollback snapshots.

## Applying Research To LetBuyy Domains

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

This file, 02_INDUSTRY_RESEARCH_FINDINGS.md, is considered complete only when its recommendations are converted into tracked engineering work with owners, dependencies, migration notes, test proof, and production rollout gates.
