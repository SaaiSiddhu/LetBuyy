# 🏪 LetBuyy Store — Comprehensive Codebase Report
## Part 3: Mobile Apps, API Gateway & Database

---

## 1. Mobile Merchant App (`apps/mobile/merchant-app/`)

> **Purpose:** Flutter-based mobile store builder, editor, dashboard, products, themes, preview, and merchant operations.

### Status: 🟡 **Active Development** (~151 source files)

### Screen Inventory

| Screen | File | Purpose |
|--------|------|---------|
| **Splash** | `splash_screen.dart` | App loading / auth check |
| **Landing** | `landing/` (15+ widget files) | Marketing landing with hero, features, pricing, testimonials |
| **Create Store Wizard** | `wizard/create_store_wizard.dart` | Multi-step store creation |
| **Store Published** | `wizard/store_published_screen.dart` | Post-creation success |
| **Main Dashboard** | `main/store_main_screen.dart` | Tab-based main navigation |
| **Dashboard** | `dashboard/` (11 widgets) | Revenue chart, bento grid, stats, activity feed |
| **Products** | `products/products_screen.dart` | Product listing |
| **Product Form** | `products/product_form_screen.dart` | Create/edit products |
| **Import Products** | `products/import_products_screen.dart` | CSV product import |
| **Orders** | `orders/orders_screen.dart` | Order management |
| **Live Preview** | `preview/live_preview_screen.dart` | Real-time store preview |
| **Settings** | `settings/settings_screen.dart` | Store settings hub |
| **Store Details** | `settings/store_details_screen.dart` | Name, logo, description |
| **Domain Settings** | `settings/domain_settings_screen.dart` | Custom domain management |
| **SEO Settings** | `settings/seo_settings_screen.dart` | SEO meta configuration |
| **Help** | `settings/help_screen.dart` | Help & support |
| **Pricing** | `subscription/pricing_screen.dart` | Plan selection |
| **Connect Razorpay** | `subscription/connect_razorpay_screen.dart` | Payment gateway setup |
| **Upgrade** | `premium/upgrade_screen.dart` | Premium upgrade flow |

### Dashboard Widgets (11 components)
| Widget | Purpose |
|--------|---------|
| `dashboard_header.dart` | Store name, greeting, notifications |
| `hero_store_card.dart` | Hero card with store info |
| `glass_stat_card.dart` | Glassmorphism stat cards |
| `animated_revenue_chart.dart` | Animated revenue line chart |
| `performance_chart_card.dart` | Performance metrics chart |
| `bento_grid.dart` | Bento grid layout |
| `insights_grid.dart` | Business insights grid |
| `quick_actions_grid.dart` | Quick action buttons |
| `recent_activity_feed.dart` | Recent activity timeline |
| `activity_timeline.dart` | Detailed activity feed |
| `skeleton_loader.dart` | Loading skeleton |

### Editor / Theme Builder (20+ widgets)
| Widget | Purpose |
|--------|---------|
| `editor_toolbar.dart` | Main editor toolbar |
| `block_editor.dart` | Section block editor |
| `add_section_sheet.dart` | Add new section bottom sheet |
| `header_editor_sheet.dart` | Header/nav editor |
| `compact_settings_sheet.dart` | Section settings sheet |
| `layers_drawer.dart` | Layer management drawer |
| **Device Frames** | |
| `device_frame_preview.dart` | Multi-device preview container |
| `phone_frame.dart` | Phone mockup frame |
| `samsung_frame.dart` | Samsung device frame |
| `tablet_frame.dart` | Tablet mockup frame |
| `laptop_frame.dart` | Laptop mockup frame |
| **Preview Sections** | |
| `preview_hero.dart` | Hero section preview |
| `preview_header.dart` | Header preview |
| `preview_about.dart` | About section preview |
| `preview_footer.dart` | Footer preview |

### Landing Page Widgets (15+ widgets)
- Hero section with animated stats, laptop mockup, floating cards
- Bento features grid
- How it works section
- Comparison section (vs competitors)
- Pricing section
- Testimonials carousel
- CTA section with shimmer button
- Footer section
- Marquee section
- Chart painter, live badge, stat card

### Services (12 service classes)
| Service | Purpose |
|---------|---------|
| `api_client.dart` | HTTP client for API Gateway |
| `store_auth_service.dart` | Merchant authentication |
| `store_service.dart` | Store CRUD operations |
| `product_service.dart` | Product management |
| `order_service.dart` | Order management |
| `subscription_service.dart` | Subscription/plan management |
| `theme_service.dart` | Theme loading and management |
| `theme_provider.dart` | Theme state provider |
| `preview_service.dart` | Live preview data |
| `analytics_service.dart` | Analytics data fetching |
| `domain_service.dart` | Custom domain operations |
| `language_service.dart` | i18n/localization |
| `storage_service.dart` | Local storage operations |

### Theme System
| File | Purpose |
|------|---------|
| `app_theme_colors.dart` | Base theme color definitions |
| `light_theme_colors.dart` | Light mode palette |
| `dark_theme_colors.dart` | Dark mode palette |
| `store_admin_colors.dart` | Admin-specific colors |
| `store_theme.dart` | Material theme construction |
| `theme_resolver.dart` | Dynamic theme resolution |

---

## 2. Mobile Shopper App (`apps/mobile/shopper-app/`)

> **Status:** 🔴 **Reserved** — Only 1 placeholder file exists

**Planned Purpose:** Native customer browsing, cart, checkout, account, orders, and notifications.

---

## 3. Mobile Operator App (`apps/mobile/operator-app/`)

> **Status:** 🔴 **Scaffold** — ~19 files, basic structure only

**Planned Purpose:** Native operator workflows for production operations that complement the Platform Console.

---

## 4. API Gateway (`services/api-gateway/`)

> **Purpose:** Central Cloudflare Worker running Hono framework. Serves as the unified API layer for all clients.

### Route Modules (30 modules)

| Module | Routes | Description |
|--------|--------|-------------|
| `admin.ts` | `/v1/admin/*` | Admin management routes |
| `ai.ts` | `/v1/ai/*` | AI content generation |
| `analytics.ts` | `/v1/analytics/*` | Analytics data endpoints |
| `app-store.ts` | `/v1/apps/*` | App marketplace CRUD |
| `auth.ts` | `/v1/auth/*` | Authentication endpoints |
| `blog.ts` | `/v1/blog/*` | Blog post management |
| `categories.ts` | `/v1/categories/*` | Category CRUD |
| `contacts.ts` | `/v1/contacts/*` | Contact form handling |
| `coupons.ts` | `/v1/coupons/*` | Coupon management |
| `customers.ts` | `/v1/customers/*` | Customer management |
| `employee.ts` | `/v1/employees/*` | Employee management |
| `export.ts` | `/v1/export/*` | Data export (PDF/CSV) |
| `form-submissions.ts` | `/v1/forms/*` | Form submission handling |
| `inventory.ts` | `/v1/inventory/*` | Inventory management |
| `media.ts` | `/v1/media/*` | Media upload/management |
| `notifications.ts` | `/v1/notifications/*` | Notification endpoints |
| `onboarding.ts` | `/v1/onboarding/*` | Store onboarding flow |
| `operations.ts` | `/v1/operations/*` | Platform operations |
| `orders.ts` | `/v1/orders/*` | Order management |
| `pages.ts` | `/v1/pages/*` | CMS page management |
| `payments.ts` | `/v1/payments/*` | Payment processing |
| `portfolio.ts` | `/v1/portfolio/*` | Portfolio items |
| `products.ts` | `/v1/products/*` | Product CRUD |
| `resume.ts` | `/v1/resume/*` | Resume sections |
| `reviews.ts` | `/v1/reviews/*` | Review moderation |
| `shipping-tax.ts` | `/v1/shipping-tax/*` | Shipping zones, tax rates |
| `storefront.ts` | `/v1/storefront/*` | Public storefront data |
| `stores.ts` | `/v1/stores/*` | Store management |
| `themes.ts` | `/v1/themes/*` | Theme management |
| `upload.ts` | `/v1/upload/*` | File upload endpoints |

### Middleware Stack
| Middleware | File | Purpose |
|-----------|------|---------|
| Auth | `middleware/auth.ts` | JWT validation, session extraction |
| RBAC | `middleware/rbac.ts` | Role-based access control |
| Permission | `middleware/permission.ts` | Fine-grained permission checks |
| Rate Limit | `middleware/rateLimit.ts` | Upstash Redis rate limiting |
| Security | `middleware/security.ts` | Security headers, CORS |
| Store Context | `middleware/store-context.ts` | Tenant context injection |
| Validation | `middleware/validation.ts` | Zod schema validation |
| Observability | `middleware/observability.ts` | Request logging/tracing |

### Schemas (16 validation schemas)
```
auth.schema.ts        product.schema.ts    order.schema.ts
blog.schema.ts        coupon.schema.ts     review.schema.ts
store.schema.ts       theme.schema.ts      shipping.schema.ts
customer.schema.ts    media.schema.ts      page.schema.ts
onboarding.schema.ts  common.schema.ts     ai.schema.ts
form-submission.schema.ts  operations.schema.ts
```

### Execution Adapters (12 adapters)
| Adapter | Purpose |
|---------|---------|
| `event-execution.adapter.ts` | Domain event dispatching |
| `idempotency-execution.adapter.ts` | Idempotent request handling |
| `observability-execution.adapter.ts` | Telemetry and tracing |
| `order-execution.adapter.ts` | Order workflow execution |
| `outbox-execution.adapter.ts` | Transactional outbox pattern |
| `payment-execution.adapter.ts` | Payment processing execution |
| `product-execution.adapter.ts` | Product operation execution |
| `queue-execution.adapter.ts` | Queue dispatching |
| `saas-execution.adapter.ts` | SaaS entitlement checks |
| `schema-registry-execution.adapter.ts` | Schema version registry |
| `theme-execution.adapter.ts` | Theme operation execution |

### Library Modules
- `lib/auth-user.ts` — User extraction from auth
- `lib/crypto.ts` — Cryptographic utilities
- `lib/errors.ts` — Error classes and handling
- `lib/internal-auth.ts` — Internal service auth
- `lib/supabase.ts` — Supabase client factory
- `lib/tenant-context.ts` — Tenant context resolution

### Durable Objects
- `durable/runtime-coordinator.ts` — Cloudflare Durable Object for runtime coordination

---

## 5. Database Schema

### Supabase Migrations — 65 Sequential Files

| # | Migration | Domain |
|---|-----------|--------|
| 001 | `initial_schema.sql` | Core tables: sites, products, orders, pages, themes, categories |
| 002 | `roles_and_permissions.sql` | RBAC system: roles, permissions, site_roles |
| 003 | `align_schema.sql` | Schema alignment and fixes |
| 004 | `plan_alignment.sql` | Subscription plan alignment |
| 005 | `auth_system.sql` | Auth tables: sessions, OTP, password resets |
| 006 | `store_platform.sql` | Store platform configuration |
| 007 | `fix_stores_trigger.sql` | Trigger function fix |
| 008 | `fix_constraints_and_columns.sql` | Constraint fixes |
| 009 | `online_store_themes.sql` | Theme system tables |
| 010 | `products_section.sql` | Extended product fields |
| 011 | `plans_table.sql` | Subscription plans table |
| 012 | `fix_rls_recursion.sql` | RLS policy recursion fix |
| 013 | `fix_subscription_rls.sql` | Subscription RLS fix |
| 014 | `fix_stale_super_admins_refs.sql` | Super admin reference fix |
| 015 | `fix_audit_null_actor.sql` | Audit null actor fix |
| 016 | `razorpay_plan_ids.sql` | Razorpay plan ID mapping |
| 017 | `app_store_ecosystem.sql` | App marketplace tables |
| 018 | `theme_marketplace_extensions.sql` | Theme marketplace tables |
| 019 | `fix_product_rls.sql` | Product RLS policy fix |
| 020 | `notifications.sql` | Notification system |
| 021 | `blog_system.sql` | Blog posts, comments |
| 022 | `media_and_forms.sql` | Media library, form submissions |
| 023 | `customer_system.sql` | Customer management |
| 024 | `ai_and_notifications.sql` | AI features, notification enhancements |
| 025 | `customer_credentials.sql` | Customer authentication |
| 026 | `store_customers.sql` | Store-customer relationships |
| 027 | `missing_tables.sql` | Gap-fill for missing tables |
| 028 | `schema_compliance.sql` | Soft deletes, audit columns, version column |
| 029 | `order_items.sql` | Proper order_items relational table |
| 030 | `theme_editor_and_payment_events.sql` | Theme editor state, payment events |
| 031 | `enterprise_events_theme_releases.sql` | Enterprise events, theme release pipeline |
| 032 | `inventory_reservations_order_commit.sql` | Inventory reservation system |
| 033 | `payment_state_machine.sql` | Payment state machine |
| 034 | `inventory_level_runtime.sql` | Multi-location inventory levels |
| 035 | `payment_failure_state.sql` | Payment failure handling |
| 036 | `shipping_tax_runtime_alignment.sql` | Shipping zones, tax rates |
| 037 | `product_reviews_moderation_status.sql` | Review moderation |
| 038 | `form_submissions_runtime_alignment.sql` | Form submission enhancements |
| 039 | `pages_runtime_alignment.sql` | CMS pages runtime |
| 040 | `portfolio_resume_runtime_alignment.sql` | Portfolio/resume sections |
| 041 | `store_employee_runtime_alignment.sql` | Employee management |
| 042 | `collections_gift_cards_runtime_alignment.sql` | Collections, gift cards |
| 043 | `app_store_runtime_alignment.sql` | App store enhancements |
| 044 | `theme_purchase_payment_runtime.sql` | Theme purchase payments |
| 045 | `tenant_context_idempotency_foundation.sql` | Idempotency keys, tenant context |
| 046 | `checkout_payment_inventory_ledgers.sql` | Checkout/payment/inventory ledgers |
| 047 | `enterprise_theme_engine_foundation.sql` | Enterprise theme engine |
| 048 | `promotions_and_gift_card_ledgers.sql` | Promotions, gift card ledgers |
| 049 | `fulfillment_returns_refund_engine.sql` | Fulfillment, returns, refunds |
| 050 | `purchase_orders_and_transfers_engine.sql` | Purchase orders, stock transfers |
| 051 | `outbox_dispatcher_observability.sql` | Outbox pattern, dispatcher |
| 052 | `saas_entitlements_usage_metering.sql` | SaaS entitlements, metering |
| 053 | `search_analytics_queue_consumers.sql` | Search, analytics, queue |
| 054 | `storefront_cms_navigation_backfill.sql` | CMS navigation backfill |
| 055 | `only_urban_kicks_theme_catalog.sql` | Theme catalog constraint |
| 056 | `restore_dynamic_theme_catalog.sql` | Restore theme catalog |
| 057 | `theme_preview_instance_draft_runtime.sql` | Theme preview drafts |
| 058 | `deactivate_non_urban_kicks_themes.sql` | Theme deactivation |
| 059 | `distributed_runtime_operations_foundation.sql` | Distributed runtime tables |
| 060 | `operational_runtime_finalization.sql` | Operational runtime |
| 061 | `operational_readiness_runtime.sql` | Readiness checks |
| 062 | `production_rollout_operations.sql` | Production rollout |
| 063 | `absolute_production_operationalization.sql` | Production operations |
| 064 | `live_production_certification.sql` | Live certification |
| 065 | `enterprise_sdlc_lifecycle.sql` | Enterprise SDLC |

### Core Database Tables (from migrations analysis)

| Domain | Tables |
|--------|--------|
| **Tenant** | `sites`, `site_settings`, `site_roles`, `store_employees` |
| **Auth** | `profiles`, `user_sessions`, `otp_tokens`, `password_resets` |
| **Commerce** | `products`, `product_variants`, `product_options`, `categories`, `collections`, `collection_products`, `gift_cards`, `gift_card_ledger` |
| **Inventory** | `inventory_locations`, `inventory_levels`, `inventory_adjustments`, `inventory_reservations`, `suppliers`, `purchase_orders`, `purchase_order_lines`, `stock_transfers`, `transfer_lines` |
| **Checkout** | `orders`, `order_items`, `order_status_history`, `payment_events`, `shipping_zones`, `shipping_rates`, `tax_rates`, `coupons`, `coupon_usage` |
| **Fulfillment** | `fulfillments`, `fulfillment_lines`, `returns`, `return_lines`, `refunds` |
| **CMS** | `pages`, `blog_posts`, `blog_comments`, `navigation_menus`, `policy_pages` |
| **Portfolio** | `portfolio_items`, `experience_entries`, `education_entries`, `skills`, `certifications`, `testimonials` |
| **Themes** | `themes`, `theme_releases`, `theme_installations`, `theme_purchases`, `theme_editor_state`, `theme_previews` |
| **Apps** | `app_listings`, `app_reviews`, `app_installations` |
| **Notifications** | `notifications`, `notification_templates` |
| **Media** | `media_files`, `form_submissions` |
| **Customers** | `store_customers`, `customer_credentials`, `customer_addresses` |
| **Reviews** | `product_reviews` |
| **Billing** | `plans`, `subscriptions`, `invoices`, `entitlements`, `usage_records` |
| **Events** | `domain_events`, `outbox_messages`, `idempotency_keys` |
| **Operations** | `operational_checkpoints`, `runtime_state`, `deployment_records` |
