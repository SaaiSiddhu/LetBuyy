<!-- SOURCE-DERIVED FROM docs/architecture/SYSTEM_INTELLIGENCE_REPORT.md AND LOCAL CODE INSPECTION ON 2026-05-22. -->
# LetBuyy Builder, Admin, Backend, Database, And UrbanKicks Integration Plan

This document is the implementation plan for making the Flutter Builder app and the Admin web app operate against the same backend, same database, same theme contracts, same tenant boundaries, and same storefront rendering model.

The source basis is the current repository code, especially:

- `docs/architecture/SYSTEM_INTELLIGENCE_REPORT.md`
- `AGENTS.md`
- `memory/lessons.md`
- `tasks/todo.md`
- `backend/workers/api/src/index.ts`
- `backend/workers/api/src/routes/stores.ts`
- `backend/workers/api/src/routes/themes.ts`
- `backend/workers/api/src/routes/payments.ts`
- `backend/workers/api/src/routes/upload.ts`
- `backend/workers/api/src/services/order.service.ts`
- `backend/workers/webhooks/src/index.ts`
- `backend/supabase/migrations/009_online_store_themes.sql`
- `backend/supabase/migrations/018_theme_marketplace_extensions.sql`
- `backend/supabase/migrations/028_schema_compliance.sql`
- `backend/supabase/migrations/029_order_items.sql`
- `apps/web/consumer/admin/AGENTS.md`
- `apps/web/consumer/admin/src/app/api/themes/*`
- `apps/web/consumer/admin/src/app/[store]/online-store/themes/*`
- `apps/web/consumer/admin/src/lib/theme-schemas.ts`
- `apps/web/consumer/storefront/src/app/store/[subdomain]/*`
- `apps/web/consumer/storefront/src/lib/store-service.ts`
- `apps/web/consumer/storefront/consumer-storefront/stores/urban-kicks/dynamic/*`
- `apps/flutter/builder/AGENTS.md`
- `apps/flutter/builder/pubspec.yaml`
- `apps/flutter/builder/lib/config/supabase_config.dart`
- `apps/flutter/builder/lib/services/api_client.dart`
- `apps/flutter/builder/lib/services/store_service.dart`
- `apps/flutter/builder/lib/services/product_service.dart`
- `apps/flutter/builder/lib/services/order_service.dart`
- `apps/flutter/builder/lib/services/preview_service.dart`
- `packages/dart/core/lib/src/constants/api_constants.dart`

The plan is written in sequential parts so it can be executed without changing architectural direction halfway through.

---

## Part 1 - Current Reality From Code

### 1.1 Product reality

LetBuyy is not just a single storefront app. The repository is trying to become a Shopify-class commerce and site-builder platform with these major surfaces:

- Merchant account and onboarding UI.
- Merchant admin dashboard.
- Public storefront runtime.
- Theme marketplace.
- App marketplace.
- Internal platform console.
- Employee/team operations app.
- Flutter-native builder.
- Flutter-native super admin and team scaffolds.
- Cloudflare Workers API.
- Cloudflare webhooks worker.
- Supabase Postgres/Auth/Storage database backend.

The main mismatch today is not that the platform lacks pieces. The mismatch is that the pieces are not all using the same contracts yet.

The intended architecture exists in several places:

- Cloudflare Hono API under `backend/workers/api/src/index.ts`.
- Supabase migrations under `backend/supabase/migrations`.
- Admin theme routes under `apps/web/consumer/admin/src/app/api/themes`.
- Storefront rendering under `apps/web/consumer/storefront`.
- Flutter API client under `apps/flutter/builder/lib/services/api_client.dart`.

But these surfaces still disagree on ownership, paths, theme IDs, config loading, and payment/security behavior.

### 1.2 Canonical backend reality

The Hono API worker is the right canonical backend.

Observed from `backend/workers/api/src/index.ts`:

- Base API path is `/v1`.
- Public route groups:
  - `/v1/auth`
  - `/v1/contacts`
  - `/v1/storefront`
- Protected route groups after `authMiddleware` and `rateLimit`:
  - `/v1/stores`
  - `/v1/products`
  - `/v1/orders`
  - `/v1/payments`
  - `/v1/upload`
  - `/v1/portfolio`
  - `/v1/resume`
  - `/v1/employees`
  - `/v1/admin`
  - `/v1/blog`
  - `/v1/customers`
  - `/v1/notifications`
  - `/v1/media`
  - `/v1/ai`
  - `/v1/app-store`
  - `/v1/themes`
  - `/v1/export`
  - `/v1/shipping-tax`
  - `/v1/onboarding`
  - `/v1/inventory`
  - `/v1/coupons`
  - `/v1/categories`
  - `/v1/analytics`

The API worker already contains the correct structural idea:

- Auth middleware before protected business routes.
- Request IDs.
- Security headers.
- Input validation middleware.
- CORS.
- Rate limiting.
- Route modularity.
- Shared schemas.
- Service layer in several areas.

The implementation gap is that Admin Web still has local Next route handlers that duplicate backend behavior, especially for themes, and Flutter Builder still has stale path/config references.

### 1.3 Canonical database reality

The repository governance says:

- Database tables use `sites`.
- URLs and merchant UI use `store`.
- Do not add a physical `stores` table.

The migrations show the practical compromise:

- `sites` is the canonical storage table.
- `stores` exists as a compatibility view or API-facing abstraction in later migrations.
- Many code paths query `stores`, while newer governance says migrations must keep ownership in `sites`.

This means the correct target is:

- Database migrations create and evolve `sites`.
- SQL views can expose `stores` where needed for compatibility.
- Backend API returns `store`/`stores` language to clients.
- Admin and Flutter never need to know whether storage is `sites` or a `stores` view.
- Storefront runtime can continue consuming store-shaped data from a service layer.

### 1.4 Admin Web reality

The Admin app already has theme management UI:

- Theme list page:
  - `apps/web/consumer/admin/src/app/[store]/online-store/themes/page.tsx`
- Theme editor page:
  - `apps/web/consumer/admin/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`
- Theme API handlers:
  - `apps/web/consumer/admin/src/app/api/themes/route.ts`
  - `apps/web/consumer/admin/src/app/api/themes/install/route.ts`
  - `apps/web/consumer/admin/src/app/api/themes/publish/route.ts`
  - `apps/web/consumer/admin/src/app/api/themes/[themeId]/editor/route.ts`
  - `apps/web/consumer/admin/src/app/api/themes/[themeId]/editor/draft/route.ts`
  - `apps/web/consumer/admin/src/app/api/themes/[themeId]/sections/route.ts`
- Theme schema:
  - `apps/web/consumer/admin/src/lib/theme-schemas.ts`

The core Admin problem:

- The theme editor has a hardcoded `DEFAULT_TEMPLATE`.
- The editor does not load the real template or draft from the backend on initial state.
- Admin theme route handlers use Supabase directly instead of the canonical worker.
- Admin relies too heavily on RLS without explicit ownership checks in application logic.
- Admin preview uses placeholder rendering, not the actual storefront renderer.
- UrbanKicks is visually present but not fully merchant-configurable end to end.

### 1.5 Flutter Builder reality

Flutter Builder already has a central API client:

- `apps/flutter/builder/lib/services/api_client.dart`

The API client:

- Uses `AppConfig.apiBaseUrl`.
- Adds a Supabase bearer token when a session exists.
- Calls worker-style paths such as:
  - `stores`
  - `products`
  - `orders`
  - `upload`

The core Flutter problem:

- `pubspec.yaml` path dependencies point to missing paths:
  - `../../../packages/core`
  - `../../../packages/models`
  - `../../../packages/services`
  - `../../../packages/ui_kit`
- Actual package roots are:
  - `../../../packages/dart/core`
  - `../../../packages/dart/models`
  - `../../../packages/dart/services`
  - `../../../packages/dart/ui_kit`
- `supabase_config.dart` still contains placeholder Supabase URL/key defaults.
- `packages/dart/core/lib/src/constants/api_constants.dart` contains stale `agrimate.com` constants.
- `preview_service.dart` contains stale Firebase hosting URLs.

This means Flutter is structurally close to the right model, but configuration and shared package paths are wrong.

### 1.6 UrbanKicks reality

UrbanKicks exists in multiple forms:

- Seeded database theme from `009_online_store_themes.sql` and extended in `018_theme_marketplace_extensions.sql`.
- Admin theme schema in `apps/web/consumer/admin/src/lib/theme-schemas.ts`.
- Storefront preview/runtime files under:
  - `apps/web/consumer/storefront/consumer-storefront/stores/urban-kicks/dynamic`
- Storefront route-level special cases:
  - `apps/web/consumer/storefront/src/app/store/[subdomain]/layout.tsx`
  - `apps/web/consumer/storefront/src/app/store/[subdomain]/page.tsx`
  - `apps/web/consumer/storefront/src/app/store/[subdomain]/urban-kicks-home.tsx`

The core UrbanKicks problem:

- The dynamic package declares `THEME_ID = 'urban_kicks'`.
- Database/Admin/Storefront route checks use `urban-kicks`.
- The storefront page does not clearly use the full dynamic section renderer as the canonical renderer.
- Some UrbanKicks sections are rendered as embedded fixed blocks rather than independent merchant-configurable sections.
- Admin preview is not the same renderer that shoppers see.

The target must normalize the UrbanKicks slug and rendering contract.

### 1.7 P0/T0 reality

The previous system report and repository TODOs identify hard blockers:

- TypeScript error in `backend/workers/api/src/routes/upload.ts`.
- Flutter path dependency errors.
- Lint configuration failure in web marketplace apps.
- Hardcoded payment provider keys.
- Payment order creation trusting client-submitted amounts in some endpoints.
- Stripe checkout trusting client-submitted line item prices.
- Missing idempotency persistence for webhook processing.
- CSRF protection missing for browser-cookie mutation routes.
- Theme ownership and draft ownership not explicit enough in Admin route handlers.
- Web and Flutter models are not generated from the same API contract.

These are the real single-go stabilization items before product polish.

---

## Part 2 - Target Architecture

### 2.1 Target principle

Admin Web and Flutter Builder must both be clients of the same platform backend.

They should not each define their own business model, theme model, payment model, or store lifecycle.

The target is:

```text
Admin Web UI
    |
    | authenticated requests
    v
Cloudflare API Worker /v1
    |
    | service-layer logic, validation, tenant ownership checks
    v
Supabase Postgres/Auth/Storage
    ^
    | same authenticated requests
    |
Flutter Builder UI
```

Storefront remains public rendering infrastructure:

```text
Public shopper request
    |
    v
Storefront Next app
    |
    | server-side store/theme/product fetch
    v
Supabase or Storefront API service
    |
    v
Theme renderer
```

The storefront can keep server-side direct Supabase reads for public performance where appropriate, but the contract and data shape must be the same shape produced by the worker.

### 2.2 Runtime boundary decisions

#### Admin Web

Admin Web owns:

- Merchant dashboard UI.
- Operational views.
- Theme editing UX.
- Product/order/settings UX.
- Admin-side route protection.
- Server component composition.
- Thin BFF wrappers only where browser cookie/session handling requires them.

Admin Web must not own:

- Theme installation business logic.
- Store publish business logic.
- Payment amount calculation.
- Tenant ownership rules.
- Theme schema registry.
- Product/order mutation semantics.

#### Flutter Builder

Flutter Builder owns:

- Native/mobile merchant builder UX.
- Mobile dashboard UX.
- Mobile theme editing UX.
- Mobile upload UX.
- Mobile preview links.

Flutter Builder must not own:

- Alternative API contracts.
- Local-only theme schemas.
- Hardcoded payment keys.
- Hardcoded storefront hostnames.
- Duplicate pricing or checkout logic.

#### API Worker

API Worker owns:

- `/v1` contracts.
- Auth enforcement.
- Tenant enforcement.
- Zod validation.
- Payment provider orchestration.
- Theme installation.
- Theme draft save/load/publish.
- Store publish/unpublish.
- Product/order/customer/coupon/category/inventory mutations.
- Upload authorization and object key policy.

#### Supabase

Supabase owns:

- Database persistence.
- RLS backup boundary.
- Auth identity source.
- Storage buckets.
- SQL constraints/indexes.
- Audit fields.

Application code must not use RLS as the only tenant check. RLS is defense in depth.

### 2.3 Canonical API language

External API terms:

- `store`
- `store_id`
- `subdomain`
- `theme_id`
- `template_config`

Database terms:

- `sites`
- `site_id` where table already uses `site_id`
- `store_id` where legacy table already uses `store_id`

Migration rule:

- New storage tables should prefer `site_id` if they are tied directly to `sites`.
- API responses can expose this as `store_id`.
- If a legacy table uses `store_id`, do not rename blindly; add service-layer mapping.

### 2.4 Canonical theme terms

The platform should use these theme fields:

- `theme_id`: public stable slug such as `urban-kicks`.
- `theme_db_id`: UUID primary key from `themes.id`.
- `renderer_key`: code renderer key such as `urban-kicks`.
- `schema_version`: version of the theme schema.
- `default_template`: default section tree.
- `section_schemas`: editable section schemas.
- `settings_schema`: global theme settings schema.
- `config_overrides`: store-specific installed theme overrides.
- `template_config`: active store template.
- `draft_config`: unpublished editing config.

Do not allow both `urban_kicks` and `urban-kicks` to remain active identifiers. Use `urban-kicks` as the canonical slug because database seed and route checks already use it.

### 2.5 Shared contract goal

The long-term target should be:

```text
backend/workers/api/src/schemas
    |
    | generate
    v
packages/typescript/api-types
    |
    | generate or mirror
    v
packages/dart/models
```

Until full generation exists, manually keep the contracts synchronized through a documented contract registry and tests.

---

## Part 3 - Database And Schema Plan

### 3.1 Current database tables relevant to this plan

The key database entities for this work are:

- `sites`
- `stores` compatibility view
- `themes`
- `store_themes`
- `theme_purchases`
- `theme_reviews`
- `theme_editor_drafts`
- `products`
- `orders`
- `order_items`
- `customers`
- `coupons`
- `categories`
- `inventory`
- `media`
- `shipping_zones`
- `tax_rates`
- `payment_transactions`
- webhook/event audit table if present or to be added

### 3.2 Theme schema storage target

UrbanKicks cannot remain defined only in Admin code. The theme schema must live in a backend-owned source.

Target columns on `themes`:

```text
themes
  id uuid primary key
  slug text unique not null
  name text not null
  site_type text not null
  category text
  description text
  preview_url text
  thumbnail_url text
  is_premium boolean
  price numeric
  renderer_key text not null
  schema_version integer not null default 1
  default_template jsonb not null default '{}'
  settings_schema jsonb not null default '{}'
  section_schemas jsonb not null default '{}'
  asset_manifest jsonb not null default '{}'
  features jsonb
  tags jsonb
  is_active boolean
  created_at timestamptz
  updated_at timestamptz
  deleted_at timestamptz
```

If these fields already exist under different JSON names in `config`, migrate by reading from `config` first, then backfilling first-class fields.

### 3.3 Draft and publish storage target

The minimal path can use existing `theme_editor_drafts` and `sites.template_config`.

The more future-proof path adds `theme_versions`:

```text
theme_versions
  id uuid primary key
  store_id uuid not null references sites(id)
  theme_id uuid not null references themes(id)
  version_number integer not null
  status text not null check (status in ('draft', 'published', 'archived'))
  template_config jsonb not null
  created_by uuid
  published_by uuid
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
  published_at timestamptz
  deleted_at timestamptz
  unique (store_id, theme_id, version_number)
```

Recommended implementation:

- Phase 1: keep `theme_editor_drafts`, fix ownership, validation, and API contract.
- Phase 2: add `theme_versions` for version history, rollback, staged publishing, and AI theme generation.

### 3.4 Store theme installation storage

Current table `store_themes` exists.

Target behavior:

- One installed record per store/theme.
- One active theme per store.
- `sites.theme_id` stores the active public theme slug.
- `sites.template_config` stores the published active template.
- `store_themes.config_overrides` stores install-specific non-template settings only when needed.

Implementation rule:

- Installing a theme creates/upserts `store_themes`.
- Installing does not automatically publish unless the endpoint is explicitly `install-and-publish`.
- Publishing copies the draft/default template into `sites.template_config` and sets `sites.theme_id`.

### 3.5 Payment event idempotency table

Webhooks currently verify signatures, but need durable idempotency tracking before side effects.

Add:

```text
payment_webhook_events
  id uuid primary key
  provider text not null
  provider_event_id text not null
  event_type text not null
  signature_valid boolean not null default false
  processed_at timestamptz
  processing_status text not null default 'received'
  raw_payload jsonb
  error_message text
  created_at timestamptz not null default now()
  unique (provider, provider_event_id)
```

Processing states:

- `received`
- `processing`
- `processed`
- `failed`
- `ignored`

### 3.6 Tenant isolation database rules

Every merchant-owned table must have one of:

- Direct `site_id`.
- Direct `store_id` referencing `sites`.
- Join path through a parent row that has `site_id`.

For theme editing:

- `theme_editor_drafts.store_id` must resolve to `sites.id`.
- `store_themes.store_id` must resolve to `sites.id`.
- Updates require the authenticated user to own the site.

For orders:

- `orders.site_id` or `orders.store_id` must be the primary isolation column.
- `order_items` can be isolated through `orders`, but high-volume queries may need denormalized `site_id` for performance.

### 3.7 Monetary precision rules

Payment code must not use floating point for authoritative amounts.

Use:

- Integer minor units in API/provider calls.
- Numeric database fields with explicit precision for persisted money.
- Server-side recalculation from product/variant/coupon/tax/shipping tables.

Never accept final payable amount from:

- Admin Web.
- Flutter Builder.
- Storefront client.
- Theme client code.

---

## Part 4 - Backend API Contract Plan

### 4.1 Required API groups

The worker already mounts `/v1/themes`, but the theme route should be expanded into a complete Admin/Flutter contract.

Required canonical endpoints:

```text
GET    /v1/themes
GET    /v1/themes/:themeId
GET    /v1/themes/:themeId/schema
POST   /v1/stores/:storeId/themes/:themeId/install
GET    /v1/stores/:storeId/theme
GET    /v1/stores/:storeId/theme/draft
PUT    /v1/stores/:storeId/theme/draft
DELETE /v1/stores/:storeId/theme/draft
POST   /v1/stores/:storeId/theme/publish
POST   /v1/stores/:storeId/theme/preview-token
GET    /v1/storefront/:subdomain/theme
```

If route ownership stays under `/v1/themes`, use:

```text
POST   /v1/themes/:themeId/install
GET    /v1/themes/:themeId/editor
PUT    /v1/themes/:themeId/editor/draft
POST   /v1/themes/:themeId/editor/publish
```

But store-scoped routes are clearer because ownership is tenant-scoped by store first.

### 4.2 Required validation schemas

Add worker schemas:

```text
backend/workers/api/src/schemas/theme.schema.ts
```

Schemas:

```text
ThemeIdParamSchema
StoreIdParamSchema
InstallThemeSchema
GetThemeEditorQuerySchema
SaveThemeDraftSchema
PublishThemeSchema
PreviewTokenSchema
ThemeSectionSchema
ThemeSettingsSchema
```

`SaveThemeDraftSchema` must validate:

- Theme ID matches installed theme.
- `template_config.themeId` equals canonical theme slug.
- Sections are known for the theme schema.
- Section settings conform to that section schema.
- Global settings conform to settings schema.
- No unknown dangerous keys that can inject scripts.

### 4.3 Theme list response shape

Canonical response:

```json
{
  "themes": [
    {
      "id": "uuid",
      "slug": "urban-kicks",
      "name": "Urban Kicks",
      "category": "Fashion",
      "site_type": "ecommerce",
      "description": "...",
      "thumbnail_url": "...",
      "preview_url": "...",
      "is_premium": true,
      "price": 0,
      "rating_avg": 4.8,
      "features": [],
      "tags": [],
      "installed": true,
      "active": true
    }
  ],
  "current_theme": {
    "slug": "urban-kicks",
    "name": "Urban Kicks",
    "status": "published",
    "has_draft": true
  }
}
```

Both Admin and Flutter should render from this shape.

### 4.4 Theme editor load response shape

```json
{
  "store": {
    "id": "uuid",
    "name": "Urban Kicks Demo",
    "subdomain": "urban-kicks",
    "status": "published"
  },
  "theme": {
    "id": "uuid",
    "slug": "urban-kicks",
    "name": "Urban Kicks",
    "renderer_key": "urban-kicks",
    "schema_version": 1
  },
  "template_config": {
    "themeId": "urban-kicks",
    "themeSettings": {},
    "sections": {}
  },
  "draft": {
    "exists": true,
    "updated_at": "timestamp",
    "updated_by": "uuid"
  },
  "schemas": {
    "sections": {},
    "settings": {}
  },
  "version": 12
}
```

### 4.5 Theme draft save request

```json
{
  "template_config": {},
  "base_version": 12,
  "client": "admin-web"
}
```

Response:

```json
{
  "ok": true,
  "draft": {
    "updated_at": "timestamp",
    "version": 13
  }
}
```

Flutter uses the same request with `"client": "flutter-builder"`.

### 4.6 Publish request

```json
{
  "base_version": 13,
  "publish_message": "Updated hero and product grid",
  "make_store_live": true
}
```

Response:

```json
{
  "ok": true,
  "store": {
    "id": "uuid",
    "theme_id": "urban-kicks",
    "status": "published"
  },
  "published_at": "timestamp",
  "preview_url": "https://example.letbuyy.store"
}
```

### 4.7 Payment API contract fix

Current problem:

- `POST /v1/payments/razorpay/order` accepts `amount`.
- `POST /v1/payments/stripe/checkout` accepts client-side `line_items` prices.

Target:

```text
POST /v1/payments/razorpay/order
```

Request:

```json
{
  "order_id": "uuid",
  "idempotency_key": "client-generated-key"
}
```

Worker behavior:

- Authenticates customer/merchant depending surface.
- Loads order by ID.
- Verifies tenant/store ownership or customer ownership.
- Recalculates payable amount from stored authoritative order totals.
- Creates Razorpay order with server-side amount only.
- Persists provider order ID.
- Returns publishable key ID from environment.

Stripe checkout request:

```json
{
  "order_id": "uuid",
  "success_url": "https://...",
  "cancel_url": "https://...",
  "idempotency_key": "client-generated-key"
}
```

No client-supplied price or total is allowed.

### 4.8 Upload route type fix

The current TypeScript blocker is in `backend/workers/api/src/routes/upload.ts`.

Fix:

```ts
const entry = formData.get('file')

if (!(entry instanceof File)) {
  return c.json(
    { success: false, error: { message: 'File is required' } },
    400,
  )
}

const file = entry
const folderEntry = formData.get('folder')
const folder = typeof folderEntry === 'string' && folderEntry.trim()
  ? folderEntry.trim()
  : 'uploads'
```

This removes the `FormDataEntryValue | null` to `File` unsafe cast.

---

## Part 5 - Admin Web Implementation Plan

### 5.1 Admin target state

Admin Web should become the primary browser UI for merchants to:

- Select a store.
- Manage products.
- Manage orders.
- Install a theme.
- Customize a theme.
- Preview draft storefront.
- Publish theme changes.
- Configure checkout settings.
- Configure shipping/tax/payment settings.

The Admin app should call the canonical worker for business logic.

### 5.2 Admin theme list refactor

Current file:

```text
apps/web/consumer/admin/src/app/[store]/online-store/themes/page.tsx
```

Current behavior:

- Calls local `/api/themes?store_name=...`.
- Shows current theme and theme grid.
- Uses hardcoded UrbanKicks preview-like mockup.

Target behavior:

- Server component loads store identity from route and session.
- Server-side fetches `/v1/stores/:storeId/theme` or `/v1/themes?store_id=...`.
- Client component handles install/publish actions through server actions or thin BFF.
- Theme cards reflect installed/current/draft state from backend.
- UrbanKicks can be installed, customized, previewed, and published from the same UI.

Implementation tasks:

1. Add API client helper in Admin:
   - `apps/web/consumer/admin/src/lib/api/client.ts`
2. Helper responsibilities:
   - Resolve API base URL from env.
   - Attach Supabase access token or session cookie-derived bearer.
   - Add request ID.
   - Parse worker response envelope.
3. Replace direct Supabase theme queries in local Next handlers.
4. Keep local handlers only as BFF wrappers if needed.
5. Add typed theme response using `packages/typescript/api-types`.
6. Remove hardcoded current theme fallback except when backend explicitly returns no installed theme.

### 5.3 Admin theme editor refactor

Current file:

```text
apps/web/consumer/admin/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx
```

Current issue:

- Starts from `DEFAULT_TEMPLATE`.
- Does not load actual backend template/draft.
- Save writes template config but initial source is wrong.

Target behavior:

1. On page load:
   - Resolve route store.
   - Load editor payload from worker.
   - Initialize editor state from:
     - draft config if present,
     - else published template_config,
     - else theme default_template.
2. Editor state stores:
   - `template_config`
   - selected section
   - dirty flag
   - version
   - last saved timestamp
   - conflict state
3. Autosave:
   - Debounced `PUT /v1/stores/:storeId/theme/draft`.
   - Includes `base_version`.
   - Handles version conflict by showing compare/reload options.
4. Publish:
   - `POST /v1/stores/:storeId/theme/publish`.
   - Copies draft to published config server-side.
   - Refreshes preview and public store URL.

### 5.4 Admin local theme API cleanup

Current local handlers:

```text
apps/web/consumer/admin/src/app/api/themes/route.ts
apps/web/consumer/admin/src/app/api/themes/install/route.ts
apps/web/consumer/admin/src/app/api/themes/publish/route.ts
apps/web/consumer/admin/src/app/api/themes/[themeId]/editor/route.ts
apps/web/consumer/admin/src/app/api/themes/[themeId]/editor/draft/route.ts
apps/web/consumer/admin/src/app/api/themes/[themeId]/sections/route.ts
```

Target options:

Option A:

- Delete local business logic handlers.
- Use server actions or direct server fetch to worker.
- Best long-term boundary.

Option B:

- Keep handlers as thin authenticated proxies.
- Each handler:
  - validates request,
  - resolves session,
  - forwards to worker,
  - returns worker response.
- No direct Supabase writes.

Recommended:

- Use Option B first for low-risk migration.
- Later collapse into server actions where appropriate.

### 5.5 Admin theme schema source

Current:

```text
apps/web/consumer/admin/src/lib/theme-schemas.ts
```

Target:

- Admin should render schemas from backend response.
- Keep `theme-schemas.ts` only as a local development fallback.
- Backend `themes.section_schemas` and `themes.settings_schema` become canonical.

Implementation:

1. Move UrbanKicks default schema into migration seed JSON or a backend seed file.
2. Worker returns schema through `/v1/themes/:themeId/schema`.
3. Admin `SchemaFormRenderer` renders generic schema fields.
4. Flutter Builder renders the same schema fields using Dart widgets.

### 5.6 Admin preview target

Current:

- Center panel has placeholder preview components.
- Some hardcoded UrbanKicks labels exist.

Target:

- Preview must use the same storefront renderer as public storefront.
- Preferred preview mechanism:
  - Admin creates preview token.
  - Preview iframe loads storefront route with `?preview_token=...`.
  - Storefront loads draft config if preview token is valid.

Preview URL:

```text
https://{storeSubdomain}.letbuyy.store?preview_token=...
```

Local preview URL:

```text
http://localhost:300X/store/{subdomain}?preview_token=...
```

### 5.7 Admin ownership checks

For every Admin action:

- Store ID must be resolved from authenticated merchant session.
- Worker must verify `store.user_id === auth.user.id`.
- Do not trust route `[store]` string alone.
- Do not rely only on RLS.

Affected local handlers:

- Theme install.
- Theme publish.
- Theme editor save.
- Theme draft save/delete.
- Product create/update/delete.
- Order update.
- Upload.
- Payment/subscription actions.

---

## Part 6 - Flutter Builder Implementation Plan

### 6.1 Flutter target state

Flutter Builder should be a native merchant client for the same platform.

It should support:

- Auth with Supabase.
- Store selection.
- Store creation.
- Product management.
- Order management.
- Theme selection.
- Theme editing.
- Theme preview.
- Theme publish.
- Media upload.
- Analytics views.

It should not use separate backend rules from Admin Web.

### 6.2 Fix package paths

Current `apps/flutter/builder/pubspec.yaml` paths are wrong.

Change:

```yaml
letbuyy_core:
  path: ../../../packages/core
letbuyy_models:
  path: ../../../packages/models
letbuyy_services:
  path: ../../../packages/services
letbuyy_ui_kit:
  path: ../../../packages/ui_kit
```

To:

```yaml
letbuyy_core:
  path: ../../../packages/dart/core
letbuyy_models:
  path: ../../../packages/dart/models
letbuyy_services:
  path: ../../../packages/dart/services
letbuyy_ui_kit:
  path: ../../../packages/dart/ui_kit
```

Then run:

```text
flutter pub get
flutter analyze
```

### 6.3 Fix Flutter environment config

Current:

```text
apps/flutter/builder/lib/config/supabase_config.dart
```

Target:

```dart
class SupabaseConfig {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.letbuyy.store/v1',
  );
  static const storefrontBaseUrl = String.fromEnvironment(
    'STOREFRONT_BASE_URL',
    defaultValue: 'https://letbuyy.store',
  );
  static const razorpayKeyId = String.fromEnvironment('RAZORPAY_KEY_ID');
}
```

Validation:

- App startup should fail with clear message if required public config is missing.
- Do not ship placeholder `your-project.supabase.co`.
- Do not ship secret keys.

### 6.4 Fix stale API constants

Current stale file:

```text
packages/dart/core/lib/src/constants/api_constants.dart
```

Issue:

- Uses `https://api.agrimate.com`.
- Uses stale `/api/v1` assumptions.
- Contains endpoint names not clearly mapped to LetBuyy worker.

Target:

- Replace with LetBuyy constants or deprecate in favor of app config.
- Use `/v1` worker path.
- Do not duplicate endpoint constants in multiple packages.

Recommended structure:

```text
packages/dart/core/lib/src/config/letbuyy_endpoints.dart
```

Fields:

```dart
class LetBuyyEndpoints {
  static const stores = 'stores';
  static const products = 'products';
  static const orders = 'orders';
  static const themes = 'themes';
  static const upload = 'upload';
  static String store(String id) => 'stores/$id';
  static String storeTheme(String storeId) => 'stores/$storeId/theme';
}
```

### 6.5 Flutter API client rules

`apps/flutter/builder/lib/services/api_client.dart` is the right central place.

Target behavior:

- Adds `Authorization: Bearer <supabase-access-token>`.
- Adds `X-Request-ID`.
- Adds `X-Client: flutter-builder`.
- Encodes errors into typed failure objects.
- Supports idempotency key headers for mutations.
- Never catches and hides backend validation details needed for form display.

### 6.6 Flutter theme service

Add or refactor:

```text
apps/flutter/builder/lib/services/theme_service.dart
```

Methods:

```dart
Future<ThemeListResponse> listThemes(String storeId);
Future<ThemeEditorResponse> loadEditor(String storeId, String themeId);
Future<ThemeDraftResponse> saveDraft(String storeId, ThemeTemplateConfig config, int baseVersion);
Future<void> deleteDraft(String storeId);
Future<ThemePublishResponse> publish(String storeId, int baseVersion);
Future<PreviewTokenResponse> createPreviewToken(String storeId);
```

Use same backend endpoints as Admin Web.

### 6.7 Flutter theme editor

The Flutter editor should be schema-driven.

Field types supported:

- Text.
- Textarea.
- Number.
- Toggle.
- Select.
- Color.
- Image picker.
- Product picker.
- Collection/category picker.
- Link picker.
- Repeater/list.

Do not hardcode UrbanKicks-only screens. UrbanKicks is a theme schema consumed by generic editor controls.

### 6.8 Flutter preview service fix

Current:

- `preview_service.dart` references Firebase hosting.

Target:

- Use `SupabaseConfig.storefrontBaseUrl`.
- Local dev supports:
  - `http://localhost:300X/store/{subdomain}`
- Production supports:
  - `https://{subdomain}.letbuyy.store`
  - custom domains after verification.

Preview should load draft only through preview token.

### 6.9 Flutter payment config

Hardcoded Razorpay keys in Flutter must be removed.

Use:

- `String.fromEnvironment('RAZORPAY_KEY_ID')` for publishable key only.
- Backend for secret key.
- Backend for order amount.
- Backend for payment verification.

Flutter should call:

```text
POST /v1/payments/razorpay/order
POST /v1/payments/razorpay/verify
```

It must never calculate final payable amount for authority.

---

## Part 7 - UrbanKicks Theme Integration Plan

### 7.1 Canonical UrbanKicks identity

Use:

```text
urban-kicks
```

Every location must align:

- Database `themes.slug`.
- `sites.theme_id`.
- Admin route `[themeId]`.
- Storefront checks.
- Flutter theme IDs.
- Dynamic renderer `THEME_ID`.

Change:

```ts
export const THEME_ID = 'urban_kicks'
```

To:

```ts
export const THEME_ID = 'urban-kicks'
```

### 7.2 UrbanKicks schema

UrbanKicks sections should be fully independent and merchant-configurable:

- Header.
- Hero banner.
- Category grid.
- Product grid.
- Brand marquee.
- Trust badges.
- Testimonials.
- Newsletter.
- Footer.

Each section needs:

- Stable `id`.
- `type`.
- `enabled`.
- `sort_order`.
- `settings`.
- Optional block children.

Example section shape:

```json
{
  "id": "hero-main",
  "type": "heroBanner",
  "enabled": true,
  "sort_order": 10,
  "settings": {
    "title": "Step Into Style",
    "subtitle": "Premium sneakers for every street.",
    "backgroundImage": "...",
    "primaryButtonText": "Shop Now",
    "primaryButtonLink": "/products"
  }
}
```

### 7.3 Storefront UrbanKicks rendering target

Current storefront has two possible UrbanKicks renderers:

- `urban-kicks-home.tsx`
- `consumer-storefront/stores/urban-kicks/dynamic/section-renderer.tsx`

The target should make one canonical renderer.

Recommended:

- Use `dynamic/section-renderer.tsx` as canonical.
- Make `urban-kicks-home.tsx` a thin adapter or delete once migrated.
- Page-level code should iterate sections and call canonical renderer for each section.

Target route flow:

```text
apps/web/consumer/storefront/src/app/store/[subdomain]/page.tsx
  -> fetch store
  -> resolve active or preview template_config
  -> normalize sections
  -> if theme_id == urban-kicks:
       render UrbanKicksSectionRenderer for every enabled section
     else:
       render generic DynamicSectionRenderer
```

### 7.4 Storefront preview token

Admin and Flutter previews should not directly expose unpublished draft config.

Flow:

```text
Admin/Flutter
  -> POST /v1/stores/:storeId/theme/preview-token
  -> receives short-lived token
  -> opens storefront preview URL
  -> storefront validates token server-side
  -> storefront renders draft template_config
```

Token properties:

- Store ID.
- User ID.
- Theme ID.
- Expiry.
- Nonce.
- HMAC signature or database persisted token.

### 7.5 UrbanKicks product data

Product grid must use real store products.

Rules:

- Section settings can select:
  - manual product IDs,
  - category ID,
  - featured flag,
  - newest,
  - best selling.
- Storefront fetches products server-side.
- Storefront respects stock/status visibility.
- Client does not inject product prices.

### 7.6 UrbanKicks theme settings

Global settings:

- Colors.
- Typography.
- Layout width.
- Button style.
- Header style.
- Footer style.
- Announcement bar.
- Product card shape.
- Image aspect ratio.

Storefront should convert settings to CSS variables:

```css
:root {
  --theme-primary: ...;
  --theme-background: ...;
  --theme-text: ...;
  --theme-radius: ...;
}
```

Admin and Flutter should edit the settings through the same schema.

---

## Part 8 - P0/T0 Error And Security Plan

### 8.1 T0 TypeScript error

Fix:

- `backend/workers/api/src/routes/upload.ts`

Expected result:

- Worker typecheck passes.

### 8.2 T0 Flutter dependency errors

Fix:

- `apps/flutter/builder/pubspec.yaml`

Expected result:

- `flutter pub get` resolves local packages.
- `flutter analyze` moves from path errors to actual code warnings/errors.

### 8.3 T0 lint config failure

Observed:

- App-store/theme-marketplace lint config circular load failure.

Fix:

- Normalize ESLint config imports.
- Ensure each app has one local config extending root shared config.
- Avoid requiring itself through package resolution.

Expected result:

- `npm run lint` reaches source linting instead of config crash.

### 8.4 P0 secret rotation

This cannot be fully completed by code inside the repository because real provider dashboards and deployed environment variables are involved.

Required runbook:

1. Rotate all exposed or historically committed provider secrets.
2. Rotate Supabase service role keys if they were ever committed.
3. Rotate Razorpay, Stripe, PayPal keys that appeared in source.
4. Rotate Resend/API/mail keys if present in env history.
5. Remove committed `all.env` or any env file from git if still present.
6. Add secret scanning to CI.
7. Verify production env vars are set in Cloudflare/Vercel only.

Code-side changes:

- Remove hardcoded key IDs.
- Replace with env names.
- Ensure docs never print secret values.

### 8.5 P0 server-side price recalculation

Current order service already recalculates order totals during order creation.

Payment endpoints still need enforcement:

- Razorpay order creation must use stored order total.
- Stripe checkout must use stored order total or server-side product lookup.
- PayPal routes must follow same rule if present.

Implementation:

1. Change payment schemas.
2. Add payment service function:
   - `loadPayableOrder(orderId, userId/storeId/customerId)`
3. Verify order status is payable.
4. Verify not already paid.
5. Create provider payment using server amount.
6. Store provider order/session ID.
7. Return client secret/session/order ID.

### 8.6 P0 webhook idempotency

Webhooks currently verify signatures.

Add:

- Durable event table.
- Unique `(provider, provider_event_id)`.
- Transactional side effects.
- Retry-safe processing.

### 8.7 P0 CSRF

CSRF applies mainly to browser-cookie mutation routes.

Worker bearer-token API is less exposed to CSRF if it does not accept cookie auth. Admin Next route handlers are exposed if they use cookies.

Implementation:

- For local Admin BFF routes:
  - Require CSRF token on `POST`, `PUT`, `PATCH`, `DELETE`.
  - SameSite cookies.
  - Origin check.
  - Reject missing/invalid token.
- Prefer server actions or worker bearer calls where possible.

### 8.8 P0 tenant isolation

Fix pattern:

```text
auth.user.id
  -> load store by ID and user_id
  -> fail if missing
  -> perform mutation scoped by store ID
```

Apply to:

- Theme install.
- Draft save/delete.
- Theme publish.
- Upload.
- Product mutation.
- Order mutation.
- Store settings.
- Payment setup.

### 8.9 P0 hardcoded payment keys

Known surfaces:

- Storefront checkout client.
- Admin subscribe route.
- Flutter subscription/connect screens.
- Dart core/services packages.
- Legacy cloud functions if still active.

Target:

- Publishable keys come from public env/config endpoint.
- Secret keys only exist in server/worker env.
- No literal `rzp_`, `pk_test`, `sk_test`, `stripe` secret-style strings in committed source.

Verification:

```text
rg -n "rzp_|pk_test|sk_test|RAZORPAY_KEY|STRIPE_SECRET|PAYPAL_SECRET" .
```

---

## Part 9 - Synchronization Contract

### 9.1 Shared store contract

Admin and Flutter must agree on:

```text
Store
  id
  name
  subdomain
  status
  site_type
  theme_id
  template_config
  logo_url
  custom_domain
  created_at
  updated_at
```

### 9.2 Shared theme contract

```text
Theme
  id
  slug
  name
  renderer_key
  site_type
  category
  description
  thumbnail_url
  preview_url
  is_premium
  price
  schema_version
  features
  tags
```

### 9.3 Shared template contract

```text
TemplateConfig
  themeId
  themeSettings
  sections
  layout
  metadata
```

Sections must be normalized either as array or object, not both.

Recommended shape:

```json
{
  "themeId": "urban-kicks",
  "themeSettings": {},
  "sections": [
    {
      "id": "header",
      "type": "header",
      "enabled": true,
      "sort_order": 0,
      "settings": {}
    }
  ]
}
```

If legacy object format remains, add a normalizer in the backend and storefront.

### 9.4 Shared product contract

```text
Product
  id
  store_id
  name
  slug
  description
  price
  compare_at_price
  currency
  images
  status
  inventory_quantity
  category_id
  created_at
  updated_at
```

### 9.5 Shared order contract

```text
Order
  id
  store_id
  customer_id
  order_number
  status
  payment_status
  fulfillment_status
  subtotal
  tax_total
  shipping_total
  discount_total
  total
  currency
  items
  created_at
  updated_at
```

### 9.6 Shared API error contract

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": []
  },
  "request_id": "..."
}
```

Admin and Flutter should both render:

- field errors,
- global errors,
- retryable errors,
- auth expiry,
- tenant access denied.

---

## Part 10 - UI Wireframes

All wireframes below are ASCII-only and are intended as implementation structure, not visual branding.

### 10.1 Admin store dashboard

```text
+--------------------------------------------------------------------------------+
| LetBuyy Admin                                      Store: Urban Kicks    User v |
+----------------------+---------------------------------------------------------+
| Sidebar              | Dashboard                                               |
|----------------------|---------------------------------------------------------|
| Overview             | +----------------+ +----------------+ +----------------+ |
| Orders               | | Today Sales    | | Orders         | | Conversion     | |
| Products             | | INR 24,560     | | 18             | | 3.8%           | |
| Customers            | +----------------+ +----------------+ +----------------+ |
| Online Store         |                                                         |
|   Themes             | +-----------------------------------------------------+ |
|   Navigation         | | Setup checklist                                     | |
|   Pages              | | [x] Store created                                   | |
| Marketing            | | [x] Products added                                  | |
| Analytics            | | [ ] Payment provider connected                      | |
| Settings             | | [ ] Theme published                                 | |
|                      | +-----------------------------------------------------+ |
|                      |                                                         |
|                      | +-------------------------+ +-------------------------+ |
|                      | | Recent orders           | | Top products            | |
|                      | | #1008  INR 2,499        | | Sneaker A               | |
|                      | | #1007  INR 1,299        | | Sneaker B               | |
|                      | +-------------------------+ +-------------------------+ |
+----------------------+---------------------------------------------------------+
```

### 10.2 Admin theme library

```text
+--------------------------------------------------------------------------------+
| Online Store / Themes                                      [Preview store]      |
+--------------------------------------------------------------------------------+
| Current theme                                                                 |
| +----------------------------------------------------------------------------+ |
| | Urban Kicks                                           Status: Published     | |
| | Modern sneaker commerce theme                       Draft: Unsaved changes | |
| | [Customize] [Preview draft] [Publish] [More]                              | |
| +----------------------------------------------------------------------------+ |
|                                                                                |
| Theme marketplace                                                              |
| +----------------------+ +----------------------+ +----------------------+     |
| | Urban Kicks          | | Minimal Commerce     | | Creator Portfolio    |     |
| | Installed / Active   | | Free                 | | Free                 |     |
| | [Customize]          | | [Install]            | | [Install]            |     |
| +----------------------+ +----------------------+ +----------------------+     |
|                                                                                |
| Filters: [All] [Ecommerce] [Portfolio] [Blog] [Free] [Premium]                 |
+--------------------------------------------------------------------------------+
```

### 10.3 Admin theme editor desktop

```text
+--------------------------------------------------------------------------------+
| Theme Editor: Urban Kicks             Saved 12:40 PM       [Preview] [Publish] |
+----------------------+--------------------------------------+------------------+
| Sections             | Preview                              | Settings         |
|----------------------|--------------------------------------|------------------|
| Header               | +----------------------------------+ | Header           |
| Hero banner          | | URBAN KICKS        Home Products | | Logo text       |
| Category grid        | |                                  | | [Urban Kicks]   |
| Product grid         | | Step Into Style                  | |                 |
| Brand marquee        | | Premium sneakers for every       | | Menu items      |
| Trust badges         | | street.                          | | + Home          |
| Testimonials         | | [Shop now] [Explore]             | | + Products      |
| Newsletter           | |                                  | | + Contact       |
| Footer               | | [Hero image]                     | |                 |
|                      | +----------------------------------+ | Sticky header    |
| [+ Add section]      |                                      | [x] Enabled      |
|                      | +----------------------------------+ |                  |
| History              | | Product grid                     | | [Save draft]    |
| Undo  Redo           | | [Shoe] [Shoe] [Shoe] [Shoe]      | |                  |
+----------------------+--------------------------------------+------------------+
```

### 10.4 Admin theme editor conflict state

```text
+--------------------------------------------------------------------------------+
| Theme Editor: Urban Kicks                                      Conflict found   |
+--------------------------------------------------------------------------------+
| Another session saved this theme after your editor loaded.                      |
|                                                                                |
| Your draft version:        12                                                   |
| Server draft version:      13                                                   |
|                                                                                |
| [Reload latest] [Overwrite with my draft] [Compare changes]                     |
+--------------------------------------------------------------------------------+
```

### 10.5 Admin product manager

```text
+--------------------------------------------------------------------------------+
| Products                                                [Import] [Add product]  |
+--------------------------------------------------------------------------------+
| Search [________________________] Status [All v] Category [All v]               |
|                                                                                |
| +----+-------------------------+----------+----------+---------+-------------+  |
| | [] | Product                 | Status   | Price    | Stock   | Actions     |  |
| +----+-------------------------+----------+----------+---------+-------------+  |
| | [] | Street Runner           | Active   | 2499     | 42      | Edit More   |  |
| | [] | Court Classic           | Draft    | 1999     | 0       | Edit More   |  |
| +----+-------------------------+----------+----------+---------+-------------+  |
|                                                                                |
| Bulk: [Activate] [Archive] [Delete]                                             |
+--------------------------------------------------------------------------------+
```

### 10.6 Admin checkout/payment settings

```text
+--------------------------------------------------------------------------------+
| Settings / Payments                                                            |
+--------------------------------------------------------------------------------+
| Payment providers                                                              |
| +----------------------------------------------------------------------------+ |
| | Razorpay                                                   Status: Connected | |
| | Key ID: rzp_live_****                                      [Manage] [Test]  | |
| +----------------------------------------------------------------------------+ |
| | Stripe                                                     Status: Disabled  | |
| | [Connect Stripe]                                                            | |
| +----------------------------------------------------------------------------+ |
|                                                                                |
| Security                                                                        |
| [x] Server-side price recalculation                                             |
| [x] Webhook signature verification                                              |
| [x] Idempotency keys required                                                   |
| [ ] Test payment flow completed                                                 |
+--------------------------------------------------------------------------------+
```

### 10.7 Flutter builder home

```text
+--------------------------------------+
| LetBuyy Builder              Store v |
+--------------------------------------+
| Sales today                          |
| INR 24,560                           |
|                                      |
| +----------------+ +---------------+ |
| | Orders         | | Products      | |
| | 18             | | 42 active     | |
| +----------------+ +---------------+ |
|                                      |
| Quick actions                         |
| [Add product]                         |
| [Customize theme]                     |
| [Preview store]                       |
|                                      |
| Recent orders                         |
| #1008    INR 2,499        Paid        |
| #1007    INR 1,299        Pending     |
+--------------------------------------+
```

### 10.8 Flutter theme library

```text
+--------------------------------------+
| Themes                       Search  |
+--------------------------------------+
| Current                              |
| +----------------------------------+ |
| | Urban Kicks                      | |
| | Published                        | |
| | [Customize] [Preview]            | |
| +----------------------------------+ |
|                                      |
| Marketplace                          |
| +----------------------------------+ |
| | Urban Kicks                      | |
| | Installed                        | |
| | [Customize]                      | |
| +----------------------------------+ |
| +----------------------------------+ |
| | Minimal Commerce                 | |
| | Free                             | |
| | [Install]                        | |
| +----------------------------------+ |
+--------------------------------------+
```

### 10.9 Flutter theme editor

```text
+--------------------------------------+
| Urban Kicks                  Publish |
+--------------------------------------+
| [Sections] [Settings] [Preview]      |
|                                      |
| Sections                             |
| +----------------------------------+ |
| | Header                         > | |
| | Hero banner                    > | |
| | Category grid                  > | |
| | Product grid                   > | |
| | Brand marquee                  > | |
| | Trust badges                   > | |
| | Testimonials                   > | |
| | Newsletter                     > | |
| | Footer                         > | |
| +----------------------------------+ |
|                                      |
| [Add section]                         |
|                                      |
| Autosaved 12:40 PM                    |
+--------------------------------------+
```

### 10.10 Flutter section settings

```text
+--------------------------------------+
| Hero banner                   Save   |
+--------------------------------------+
| Enabled                              |
| [x]                                  |
|                                      |
| Title                                |
| [Step Into Style________________]    |
|                                      |
| Subtitle                             |
| [Premium sneakers for every_____]    |
| [street.________________________]    |
|                                      |
| Background image                     |
| +----------------------------------+ |
| | image preview                    | |
| +----------------------------------+ |
| [Replace image]                       |
|                                      |
| Primary button text                  |
| [Shop now_______________________]    |
|                                      |
| Primary button link                  |
| [/products______________________]    |
+--------------------------------------+
```

### 10.11 Storefront UrbanKicks rendering

```text
+--------------------------------------------------------------------------------+
| Announcement bar                                                               |
+--------------------------------------------------------------------------------+
| URBAN KICKS                                      Home  Products  About  Cart    |
+--------------------------------------------------------------------------------+
|                                                                                |
| Step Into Style                                                                |
| Premium sneakers for every street.                                             |
| [Shop now] [Explore collection]                                                |
|                                                                                |
|                            +----------------------+                            |
|                            | Hero product image   |                            |
|                            +----------------------+                            |
|                                                                                |
+--------------------------------------------------------------------------------+
| Shop by category                                                               |
| [Running] [Streetwear] [Basketball] [Limited drops]                            |
+--------------------------------------------------------------------------------+
| Featured products                                                              |
| [Product card] [Product card] [Product card] [Product card]                    |
+--------------------------------------------------------------------------------+
```

### 10.12 Backend theme flow

```text
+-------------+       +------------------+       +---------------------------+
| Admin Web   | ----> | API Worker /v1   | ----> | Supabase                  |
| Flutter     |       |                  |       | sites/themes/store_themes |
+-------------+       +------------------+       +---------------------------+
      |                       |                               |
      | GET theme editor      | verify store owner            |
      |---------------------->| load theme schema             |
      |                       | load draft/published config   |
      |<----------------------| return editor payload          |
      |                       |                               |
      | PUT draft             | validate schema               |
      |---------------------->| upsert draft                  |
      |<----------------------| version response               |
      |                       |                               |
      | POST publish          | validate ownership/version    |
      |---------------------->| copy draft to sites config    |
      |<----------------------| published response             |
```

### 10.13 Payment flow

```text
+-------------+       +------------------+       +----------------+       +----------+
| Storefront  | ----> | API Worker       | ----> | Supabase       | ----> | Provider |
+-------------+       +------------------+       +----------------+       +----------+
      |                       |                    |                         |
      | Create order          | calculate totals   | insert order/items      |
      |---------------------->|------------------->|                         |
      |<----------------------| order id           |                         |
      |                       |                    |                         |
      | Create payment        | reload order total |                         |
      |---------------------->|-------------------------------------------->|
      |<----------------------| provider order id                            |
      |                       |                    |                         |
      | Verify payment        | verify signature   | update payment state    |
      |---------------------->|------------------->|                         |
```

---

## Part 11 - Implementation Roadmap

### Phase 0 - Freeze contracts

Goal:

- Stop adding more divergent routes while the sync refactor happens.

Tasks:

1. Declare API worker `/v1` as canonical backend.
2. Declare `sites` as canonical DB storage and `stores` as API/UI abstraction.
3. Declare `urban-kicks` as canonical theme slug.
4. Declare theme schemas backend-owned.
5. Declare Admin local theme handlers temporary BFF only.

### Phase 1 - Fix build blockers

Tasks:

1. Fix upload route TypeScript narrowing.
2. Fix Flutter local package paths.
3. Fix stale Flutter config defaults.
4. Fix ESLint config circular failure.
5. Verify:
   - worker typecheck,
   - root lint,
   - Flutter analyze.

### Phase 2 - Backend theme contract

Tasks:

1. Add theme schemas to worker.
2. Add store-scoped theme endpoints.
3. Add ownership checks.
4. Add draft save/load/delete.
5. Add publish endpoint.
6. Add preview token endpoint.
7. Add schema validation.
8. Add tests for:
   - installing UrbanKicks,
   - saving draft,
   - publishing,
   - denied cross-tenant access.

### Phase 3 - Admin theme integration

Tasks:

1. Add Admin API client for worker.
2. Replace direct Supabase theme writes.
3. Load editor initial state from backend.
4. Save drafts to worker.
5. Publish through worker.
6. Render schema from backend response.
7. Add preview iframe token flow.
8. Remove hardcoded `DEFAULT_TEMPLATE` as authoritative source.

### Phase 4 - Storefront UrbanKicks rendering

Tasks:

1. Normalize `urban-kicks` slug.
2. Use canonical UrbanKicks section renderer.
3. Render every enabled section from template config.
4. Support draft preview token.
5. Ensure product grid uses real store products.
6. Ensure header/footer respect merchant settings.

### Phase 5 - Flutter sync

Tasks:

1. Fix package paths.
2. Fix env config.
3. Add Flutter `ThemeService`.
4. Add shared Dart models for theme editor response.
5. Build schema-driven Flutter section editor.
6. Use same preview token flow.
7. Remove stale Firebase preview URL.

### Phase 6 - P0 payment and security

Tasks:

1. Remove hardcoded payment keys.
2. Change payment schemas to `order_id` based requests.
3. Recalculate payment totals server-side.
4. Add webhook event idempotency.
5. Add CSRF to cookie-backed Admin BFF mutations.
6. Add stricter auth rate limits to auth mutation endpoints.
7. Add tenant isolation tests.

### Phase 7 - Verification

Commands:

```text
npm run typecheck
npm run lint
npm run test
flutter pub get
flutter analyze
rg -n "console\.log|rzp_|pk_test|sk_test|as any|TODO|FIXME" .
```

Expected result:

- No T0 type/path/config blockers.
- Known non-P0 warnings moved into debt register.
- Admin and Flutter both install/customize/publish UrbanKicks through same backend.

---

## Part 12 - File-Level Change Plan

### 12.1 Backend files

Modify:

```text
backend/workers/api/src/routes/upload.ts
backend/workers/api/src/routes/themes.ts
backend/workers/api/src/routes/payments.ts
backend/workers/api/src/schemas/order.schema.ts
backend/workers/api/src/schemas/theme.schema.ts
backend/workers/api/src/services/theme.service.ts
backend/workers/api/src/services/payment.service.ts
backend/workers/webhooks/src/index.ts
```

Add migration:

```text
backend/supabase/migrations/031_theme_versions_and_payment_webhook_events.sql
```

Potential additions:

```text
backend/workers/api/src/services/tenant.service.ts
backend/workers/api/src/services/theme-validation.service.ts
```

### 12.2 Admin files

Modify:

```text
apps/web/consumer/admin/src/app/[store]/online-store/themes/page.tsx
apps/web/consumer/admin/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx
apps/web/consumer/admin/src/components/theme-editor/*
apps/web/consumer/admin/src/lib/theme-schemas.ts
apps/web/consumer/admin/src/app/api/themes/*
```

Add:

```text
apps/web/consumer/admin/src/lib/api/client.ts
apps/web/consumer/admin/src/lib/api/theme-client.ts
apps/web/consumer/admin/src/lib/csrf.ts
```

### 12.3 Storefront files

Modify:

```text
apps/web/consumer/storefront/src/app/store/[subdomain]/layout.tsx
apps/web/consumer/storefront/src/app/store/[subdomain]/page.tsx
apps/web/consumer/storefront/src/app/store/[subdomain]/urban-kicks-home.tsx
apps/web/consumer/storefront/src/lib/store-service.ts
apps/web/consumer/storefront/consumer-storefront/stores/urban-kicks/dynamic/index.ts
apps/web/consumer/storefront/consumer-storefront/stores/urban-kicks/dynamic/section-renderer.tsx
```

Add:

```text
apps/web/consumer/storefront/src/lib/preview-token.ts
apps/web/consumer/storefront/src/lib/theme-normalizer.ts
```

### 12.4 Flutter files

Modify:

```text
apps/flutter/builder/pubspec.yaml
apps/flutter/builder/lib/config/supabase_config.dart
apps/flutter/builder/lib/services/api_client.dart
apps/flutter/builder/lib/services/preview_service.dart
packages/dart/core/lib/src/constants/api_constants.dart
```

Add:

```text
apps/flutter/builder/lib/services/theme_service.dart
apps/flutter/builder/lib/models/theme_editor_models.dart
apps/flutter/builder/lib/screens/themes/theme_library_screen.dart
apps/flutter/builder/lib/screens/themes/theme_editor_screen.dart
apps/flutter/builder/lib/screens/themes/section_settings_screen.dart
```

### 12.5 Shared package files

Modify or add:

```text
packages/typescript/api-types/src/index.ts
packages/dart/models/lib/src/theme.dart
packages/dart/models/lib/src/template_config.dart
packages/dart/services/lib/src/theme_service.dart
```

---

## Part 13 - Acceptance Criteria

### 13.1 Backend acceptance

- `/v1/themes` returns install/current state for authenticated merchant.
- `/v1/stores/:storeId/theme` returns current theme state.
- `/v1/stores/:storeId/theme/draft` loads and saves draft config.
- `/v1/stores/:storeId/theme/publish` publishes draft to storefront.
- Cross-tenant theme access returns 403.
- Theme draft save validates schema.
- Payment creation does not accept client amount.
- Webhooks are idempotent.
- Upload route typecheck passes.

### 13.2 Admin acceptance

- Merchant can open Online Store -> Themes.
- UrbanKicks appears with correct active/installed state.
- Merchant can click Customize.
- Editor loads actual backend template or draft.
- Merchant can edit hero title.
- Autosave persists draft.
- Preview shows edited hero through storefront preview.
- Publish makes public storefront show edited hero.
- Refreshing Admin editor preserves draft/published state.

### 13.3 Flutter acceptance

- `flutter pub get` succeeds.
- Builder starts with real Supabase/API config.
- Merchant logs in.
- Store list loads from `/v1/stores`.
- Theme list loads from same theme API as Admin.
- UrbanKicks editor loads same sections as Admin.
- Draft save persists and appears in Admin.
- Admin draft save appears in Flutter.
- Publish from Flutter updates public storefront.

### 13.4 Storefront acceptance

- Published UrbanKicks store renders from `sites.template_config`.
- Draft preview renders only with valid preview token.
- Product grid uses real products.
- Header/footer use merchant settings.
- All UrbanKicks sections can be enabled/disabled/reordered.
- Theme slug mismatch is eliminated.

### 13.5 Security acceptance

- No hardcoded provider secrets or key IDs.
- Payment totals recalculated server-side.
- Webhook signatures verified before processing.
- Webhook events persisted idempotently.
- Admin BFF mutations have CSRF or are replaced by server-authenticated worker calls.
- Store ownership is checked before every mutation.

---

## Part 14 - Detailed Execution Checklist

### 14.1 Immediate T0 fixes

- [ ] Fix `backend/workers/api/src/routes/upload.ts` File narrowing.
- [ ] Fix `apps/flutter/builder/pubspec.yaml` Dart package paths.
- [ ] Replace placeholder Supabase defaults in Flutter config.
- [ ] Replace stale Agrimate API constants.
- [ ] Fix ESLint config circular load failure.

### 14.2 Theme backend

- [ ] Add `theme.schema.ts`.
- [ ] Add `theme.service.ts`.
- [ ] Add store-scoped theme endpoints.
- [ ] Add schema validation.
- [ ] Add tenant ownership guard.
- [ ] Add preview token service.
- [ ] Backfill UrbanKicks schemas into database.

### 14.3 Admin

- [ ] Add worker API client.
- [ ] Convert theme list to worker data.
- [ ] Convert install to worker endpoint.
- [ ] Convert editor load to worker endpoint.
- [ ] Convert draft save/delete to worker endpoint.
- [ ] Convert publish to worker endpoint.
- [ ] Replace placeholder preview with storefront preview.
- [ ] Remove hardcoded UrbanKicks as authoritative template.

### 14.4 Storefront

- [ ] Normalize `urban-kicks`.
- [ ] Use canonical section renderer.
- [ ] Render all sections from config.
- [ ] Implement preview token draft loading.
- [ ] Ensure product grid uses real products.

### 14.5 Flutter

- [ ] Add theme service.
- [ ] Add theme editor models.
- [ ] Add theme library screen against worker.
- [ ] Add schema-driven section settings screen.
- [ ] Add preview token open flow.
- [ ] Remove Firebase preview URL.

### 14.6 Payments and security

- [ ] Remove hardcoded payment keys.
- [ ] Change Razorpay order schema to `order_id`.
- [ ] Change Stripe checkout schema to `order_id`.
- [ ] Add server-side payable order loader.
- [ ] Add webhook event idempotency table.
- [ ] Add webhook side-effect transaction logic.
- [ ] Add CSRF to cookie-backed mutation routes.
- [ ] Add auth rate limits to sensitive account flows.

### 14.7 Verification

- [ ] Run full typecheck.
- [ ] Run full lint.
- [ ] Run tests.
- [ ] Run Flutter analyze.
- [ ] Scan hardcoded values.
- [ ] Scan console logs.
- [ ] Scan `any` casts.
- [ ] Scan TODO/FIXME.
- [ ] Browser-test Admin customize/publish flow.
- [ ] Browser-test storefront preview and public render.
- [ ] Emulator-test Flutter draft sync.

---

## Part 15 - Final Operating Model

When this plan is complete, LetBuyy should operate like this:

1. A merchant signs in through Accounts.
2. The merchant opens Admin Web or Flutter Builder.
3. Both clients use the same Supabase identity.
4. Both clients call the same `/v1` worker API.
5. Store ownership is checked by the worker.
6. The merchant installs UrbanKicks.
7. The worker writes installation state to `store_themes`.
8. The merchant edits sections through schema-driven controls.
9. Draft config is saved to backend draft storage.
10. Preview token renders the draft in the real storefront runtime.
11. Publish copies the draft into the active store template.
12. Public shoppers see the published UrbanKicks storefront.
13. Checkout creates orders with server-side totals.
14. Payments are created from stored order totals.
15. Webhooks verify signatures and process idempotently.
16. Admin and Flutter remain synchronized because neither owns duplicate business logic.

This is the required architecture for a Shopify-class builder platform: one backend, one database contract, multiple clients, one theme runtime contract, and strict tenant/payment boundaries.
