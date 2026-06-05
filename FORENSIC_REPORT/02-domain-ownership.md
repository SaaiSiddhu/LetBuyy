# Domain Ownership Report

Ownership below is **observed** (where the code/tables actually live), cross-checked against **declared** ownership (`AGENTS.md` constitution, `runtime.manifest.json` per runtime, `docs/governance/runtime-boundaries.md`).

## Domain map

| Domain | Declared owner | Observed implementation | Boundary verdict |
|--------|---------------|------------------------|------------------|
| **Identity** | `apps/identity-platform` | identity-platform UI/API routes + gateway `routes/auth.ts` (872 LOC) + `auth-core` contracts; tables `users_custom`, `sessions`, `verification_tokens`, `customer_credentials`, `password_set_intents` (mig. 078) | Coherent; split across app+gateway by design |
| **Tenancy/Stores** | `tenant-core` + gateway | `sites` table is the tenant container (naming drift: "sites" vs "stores" everywhere else); `site_roles`, `site_memberships`, `site_usage_meters`; subdomain resolution in `apps/storefront-runtime/src/proxy.ts` | Coherent; naming inconsistency |
| **Catalog/Commerce** | `commerce-core` (26 LOC schemas) | Real logic in gateway `routes/{products,inventory,categories,collections}.ts`; 110+ commerce tables | Logic lives in gateway, not package — package is contract-only |
| **Orders/Checkout** | `services/checkout-runtime` (declared) | **checkout-runtime has no code**; gateway `routes/{orders,payments}.ts` + `checkout-core` schemas; tables orders/order_items/fulfillment_orders/returns/refunds/checkout_sessions | **Declared owner empty — ownership violation** |
| **Payments/Billing** | `payments`, `billing-core`, `infrastructure` adapters | Gateway `routes/payments.ts` (916 LOC); providers razorpay/cashfree (mig. 075)/cod (074)/stripe-adapter; `app_billing_charges` with revenue-share bps, INR-only | Coherent; INR/India-first hardcoding |
| **Themes** | `theme-engine` + `apps/theme-marketplace` + merchant editor | 50+ theme tables (packages/versions/instances/releases/drafts/manifests); editor APIs in merchant-control-plane; rendering in storefront-runtime | Split ownership of rendering (see Theme report) |
| **Storefront** | `apps/storefront-runtime` | Owns rendering, section components, demo store; data via gateway `routes/storefront.ts` (4,320 LOC) | Section components owned by app not theme system — violation |
| **Apps platform** | `app-engine`, `extension-host`, `apps/app-marketplace` | Gateway `routes/app-store.ts` (2,721 LOC): OAuth, charges, webhooks, extension registry (mig. 076) | Coherent skeleton; storefront surfacing gap |
| **Search** | `services/search-service` (declared) | **No service**; `SEARCH_QUEUE` producer in gateway; `search-core` contracts only | **Declared owner empty** |
| **Media** | `services/media-service` (declared) | **No service**; gateway `routes/media.ts` + R2 bucket + `media`,`media_assets`,`gallery_items` tables | **Declared owner empty** |
| **Notifications** | `services/notification-service` (declared) | **No service**; `NOTIFICATION_QUEUE` + gateway `routes/notifications.ts`; 3 TODOs "Send invite email via Resend" | **Declared owner empty** |
| **Events/Messaging** | `services/event-bus` (declared) | **No service**; outbox pattern in gateway `src/execution/outbox-execution.adapter.ts` + Cloudflare Queues + queue-workers | **Declared owner empty** |
| **Analytics** | `services/analytics-pipeline` (declared) | **No service**; gateway `routes/analytics.ts` + Analytics Engine datasets + `ANALYTICS_QUEUE` | **Declared owner empty** |
| **CMS/Content** | `cms-core` | Gateway `routes/{blog,pages,form-submissions}.ts`; blog/pages/navigation tables | Coherent |
| **Marketplace (themes)** | `apps/theme-marketplace` | theme purchase/install via gateway `routes/themes.ts`; `theme_purchases`, `theme_reviews` | Coherent |
| **Platform governance** | `apps/platform-console`, `platform-operations-portal` | Console: `/internal/console/*` gateway routes w/ service token; Ops portal: merchant-health scoring | Coherent; console scaffold-level |
| **Developer ecosystem** | `apps/developer-portal` | Static docs reading `src/lib/reference.ts` (46 documented routes) | Governed by manifest but **missing from CLAUDE.md canonical map** |
| **PORTFOLIO/RESUME (legacy product)** | *No declared owner in current constitution* | Gateway mounts `/portfolio` + `/resume` (`index.ts:215-216`, `routes/{portfolio,resume,employee}.ts`); merchant admin pages experience/education/certifications/skills/projects/testimonials (473–509 LOC each, live CRUD against `/api/stores/[store]/content/*`); tables `portfolio_projects`, `resume_versions`, `education`, `work_experience`, `certifications`, `skills`, `testimonials`, `skill_endorsements`; verification file `040_portfolio_resume_runtime_alignment.sql` | **Unowned domain operating inside three layers** |
| **Operational runtime** | `distributed-runtime`/`orchestration`/`projection-runtime` + D1 | ~60 runtime_* / replay_* / projection_* / chaos_/load_ tables; Durable Object in gateway | Coherent but oversized relative to topology |

## Domain boundary findings

1. **Six declared service domains have empty owners** (checkout, search, media, notifications, event-bus, analytics). Their manifests assert authority (e.g. `services/search-service/runtime.manifest.json:14` "Reserved search and indexing authority for storefront, merchant, and marketplace discovery") while the api-gateway implements the behavior. Any team using the runtime map to assign ownership will mis-route work.
2. **The portfolio/resume domain has no owner** in `AGENTS.md`/governance docs yet ships in production surfaces (admin nav pages, mounted gateway routers, RLS-policied tables with active indexes `idx_certifications_store_active`, `idx_portfolio_projects_store_active`).
3. **Rendering ownership is split three ways**: schemas in `packages/theme-engine`, runtime section schemas duplicated in `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx` (`RUNTIME_SECTION_SCHEMAS`), editor schema re-exports in `apps/merchant-control-plane/src/lib/theme-schemas.ts`. The package is declared the owner; the storefront app is the de-facto owner of what can render.
4. **`sites` vs `stores`**: DB tenant table is `sites`; every API path, UI label, and package contract says "store" (`/api/stores/[store]/…`, `store_id` FK columns referencing `sites(id)` — e.g. `store_themes.store_id REFERENCES sites(id)` in mig. 009 section of baseline).
5. **developer-portal** is governed by its own manifest + AGENTS.md but excluded from the canonical runtime list in `CLAUDE.md` — two sources of truth disagree about the platform's app inventory.
