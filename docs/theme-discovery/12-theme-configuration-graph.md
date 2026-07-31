# Theme Configuration Graph

> Document 12 — Theme Discovery Series  
> Source files: `packages/theme-engine/src/theme-bundle.ts`, `apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts`, `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx`, `services/api-gateway/src/routes/themes.ts`, `services/api-gateway/src/execution/theme-execution.adapter.ts`, `services/api-gateway/src/schemas/theme.schema.ts`

---

## 1. Configuration Hierarchy (Top to Bottom)

The following tree shows every configuration point from the platform level down to per-block settings. Field names come directly from the Zod schemas in `theme-bundle.ts` and the DB record interfaces in `theme-execution.adapter.ts`.

```
LetBuyy Platform
└── sites (tenant/store table)
    │   id, user_id, custom_user_id, store_name, subdomain, status
    │   theme_id (→ theme slug, FK to themes.slug)
    │   template_config (JSONB — the live published config blob)
    │   current_theme_release_id (→ theme_releases.id)
    │   storefront_release_version (integer monotonic counter)
    │
    ├── theme_releases (immutable published snapshots)
    │   │   id, store_id, theme_id (slug), release_version (int)
    │   │   release_config (JSONB — full templateConfig at publish time)
    │   │   template_snapshot (JSONB — alias for release_config)
    │   │   settings_snapshot (JSONB — themeSettings extracted)
    │   │   release_manifest (JSONB — engine metadata)
    │   │   is_current (bool), release_status, published_by, published_at
    │   │   theme_instance_id (→ theme_instances.id)
    │   │   theme_package_version_id (→ theme_package_versions.id)
    │   │   schema_manifest_version, engine_version
    │   │   source_draft_id, source_draft_version
    │   │   rollback_of_release_id (self-FK for audit trail)
    │   │   asset_manifest, cache_manifest, data_binding_manifest (JSONB)
    │   │
    │   └── ThemePackageBundle (in-memory, parsed from release_config)
    │           schema_version   ("2026-05-json-contract" | "2026-06-liquid-sections")
    │           package          (metadata — see §6)
    │           renderer         (engine, renderer_version, liquid_ready, assets{})
    │           │
    │           ├── config/settings_schema  (ThemeBundleSettingsSchema)
    │           │       schema_version
    │           │       settings: Record<groupKey, {
    │           │           label, description
    │           │           fields: Record<fieldKey, ThemeBundleSettingFieldSchema>
    │           │       }>
    │           │
    │           ├── config/settings_data  (ThemeBundleSettingsDataSchema)
    │           │       current: Record<string, JsonValue>   ← merchant-live values
    │           │       presets: Record<presetName, Record<string, JsonValue>>
    │           │
    │           ├── templates/[key]  (ThemeBundleTemplateSchema)
    │           │       name?          (display label, e.g. "Home page")
    │           │       layout?        (layout file key, e.g. "theme")
    │           │       order          (string[] — ordered section IDs)
    │           │       sections: Record<sectionId, ThemeBundleTemplateSectionSchema>
    │           │           type           (→ sections/<type> definition key)
    │           │           settings       (Record<string, JsonValue> — per-instance overrides)
    │           │           disabled       (bool)
    │           │           block_order    (string[] — ordered block IDs)
    │           │           blocks: Record<blockId, ThemeBundleTemplateBlockSchema>
    │           │               type       (→ blocks/<type> definition key)
    │           │               settings   (Record<string, JsonValue>)
    │           │               disabled   (bool)
    │           │
    │           ├── sections/[type]  (ThemeBundleSectionDefinitionSchema)  ← JSON-contract engine
    │           │       type, name, description
    │           │       renderer_key     (maps to React component key, e.g. "core.hero-banner")
    │           │       settings_schema  (Record<fieldKey, ThemeBundleSettingFieldSchema>)
    │           │       defaults         (Record<string, JsonValue>)
    │           │       block_types      (string[] — allowed block type keys)
    │           │       accepts_app_blocks (bool)
    │           │       presets[]        (name + settings{})
    │           │       enabled_on.templates (string[] — "*" = all)
    │           │
    │           ├── sections/[type].liquid  (ThemeLiquidSectionFileSchema) ← Liquid engine
    │           │       path   ("sections/<type>.liquid")
    │           │       source (Liquid template string, max 200 kB)
    │           │       schema (ThemeLiquidSectionSchema)
    │           │           name, tag, class?
    │           │           settings[]   (ThemeLiquidSchemaSettingFieldSchema — id, type, label, default…)
    │           │           blocks[]     (inline block defs or @app sentinel)
    │           │           presets[]    (name + settings{} + blocks[])
    │           │           enabled_on.templates[], disabled_on.templates[]
    │           │
    │           ├── blocks/[type]  (ThemeBundleBlockDefinitionSchema)  ← JSON-contract engine
    │           │       type, name, description
    │           │       settings_schema (Record<fieldKey, ThemeBundleSettingFieldSchema>)
    │           │       defaults        (Record<string, JsonValue>)
    │           │
    │           ├── blocks/[type].liquid  (ThemeLiquidBlockFileSchema)   ← Liquid engine
    │           │       path ("blocks/<type>.liquid")
    │           │       source (Liquid template string)
    │           │       schema (ThemeLiquidReusableBlockSchema)
    │           │           name
    │           │           settings[] (ThemeLiquidSchemaSettingFieldSchema)
    │           │           presets[]
    │           │
    │           ├── layout/theme.liquid  (Liquid engine only)
    │           │       source — wraps {{ content_for_layout | raw }},
    │           │               {{ content_for_header | raw }},
    │           │               {{ content_for_footer | raw }}
    │           │
    │           └── locales/[lang]  (ThemeBundleLocaleSchema)
    │                   e.g. en, hi, bn, mr, ta, te, kn
    │                   key paths accessed via "t:" prefix in settings values
    │
    ├── theme_editor_drafts (merchant working copy, per template_key)
    │       id, store_id, theme_id (slug), template_key
    │       draft_config (JSONB — templateConfig blob)
    │       version (integer, increments on each save)
    │       auto_saved_at
    │
    ├── theme_instances (package-version-scoped install record)
    │       id, store_id, theme_package_id, theme_package_version_id
    │       theme_slug, instance_status ('active'|'installed'|'inactive')
    │       installed_config (JSONB), settings (JSONB)
    │       active_release_id (→ theme_releases.id)
    │       current_draft_id (→ theme_instance_drafts.id)
    │       activated_at
    │
    ├── theme_instance_drafts (package-aware draft, per theme_instance)
    │       id, theme_instance_id, store_id
    │       base_release_id (→ theme_releases.id)
    │       draft_status ('active'|'published')
    │       draft_version (integer)
    │       working_manifest (JSONB — full templateConfig)
    │       schema_manifest_version, auto_saved_at
    │
    └── theme_draft_patches (append-only patch log per draft)
            id, draft_id, store_id, patch_sequence
            patch_type ('set'), operation (JSONB JSON-Patch op)
            path, value (JSONB), actor_id, request_id
            client_revision, server_revision, metadata
```

---

## 2. Static vs Dynamic Configuration

### Static (immutable after publish)

These fields are fixed at the time the theme bundle is uploaded to the marketplace and cannot be changed without submitting a new package version.

| Artifact | Fixed Fields |
|---|---|
| `ThemeBundlePackageMetadataSchema` | `slug`, `author_name`, `pricing_type`, `price`, `currency`, `version`, `version_number`, `compatibility_range`, `checksum` |
| Section definitions (`sections/[type]`) | `type`, `renderer_key`, `settings_schema` (field types and labels), `block_types` (allowed block types), `accepts_app_blocks`, `enabled_on` |
| Block definitions (`blocks/[type]`) | `type`, `settings_schema` |
| Liquid section files | `path`, `source` (Liquid template body), `schema.name`, `schema.settings[].id` and `.type` |
| Bundle renderer manifest | `engine`, `renderer_version`, `liquid_ready`, `assets` (asset registry with checksums) |
| Locale dictionaries (`locales/[lang]`) | All translation keys and values (shipped in bundle) |
| Release records (`theme_releases`) | Once written by `publish_theme_release` RPC: `release_version`, `release_config`, `template_snapshot`, `published_at`, `published_by`, `rollback_of_release_id` |

### Dynamic — Merchant-Editable via Editor

These fields are what merchants change using the theme editor UI (`GET /:slug/editor`, `PUT /:slug/editor/draft`, `POST /:slug/publish`).

| Configuration Layer | Field / Path | What It Controls |
|---|---|---|
| Global settings | `settings_data.current.*` | Colors, fonts, global toggles (primary color, brand tokens) |
| Template section order | `templates/[key].order` | Section render sequence on a page |
| Template section inclusion | `templates/[key].sections.*` (add/remove entries) | Which sections appear on a given page template |
| Section instance settings | `templates/[key].sections/[id].settings.*` | Per-section configurable values (heading text, column count, toggle flags) |
| Section disabled state | `templates/[key].sections/[id].disabled` | Temporarily hides a section |
| Block order within a section | `templates/[key].sections/[id].block_order` | Reorder blocks (testimonials, nav links, slides) |
| Block instance settings | `templates/[key].sections/[id].blocks/[id].settings.*` | Per-block values (slide image, link label) |
| Block disabled state | `templates/[key].sections/[id].blocks/[id].disabled` | Temporarily hides a block |
| App blocks | `appBlocks[]` (on `sites.template_config`) | Third-party app blocks injected per slot |

### Dynamic — AI-Editable via API

An AI agent with merchant credentials can call the same REST routes the editor UI uses. There is no separate AI-only surface.

| REST Route | What an AI Can Change |
|---|---|
| `PUT /v1/themes/:slug/editor/draft` (body: `SaveThemeDraftSchema`) | Any merchant-editable field listed above; submits a `template_config` blob with `store_id`, `template_key`, `base_version` |
| `POST /v1/themes/:slug/publish` (body: `PublishThemeSchema`) | Promotes a draft or a direct `template_config` blob to live; `make_store_live` bool controls whether `sites.status` flips to `published` |
| `POST /v1/themes/:slug/install` (body: `InstallThemeSchema`) | Installs a different theme; can supply `config_overrides` |
| `POST /v1/themes/:slug/releases/:releaseId/rollback` | Reverts to a previous release snapshot |

The AI agent operates under the same `verifySiteOwnership` guard that the editor enforces.

### Dynamic — Runtime (per-request)

These are not stored configuration — they are computed fresh for every storefront HTTP request.

| Runtime Drop | How It Changes Per Request |
|---|---|
| `cart` | Browser-hydrated client-side; at SSR time totals are `null`, hydrated by `lb-cart-drawer` island |
| `customer` | Resolved from the customer HS256 session cookie; varies by logged-in user |
| `customer.wishlist` | Loaded from `customer_wishlist` table rows for the current customer |
| `product` | Resolved from the route path segment (`/products/:slug`) |
| `collection.products` | Loaded from `ProductService` based on `route.resourceSlug` or section `productIds` setting |
| `order` | Resolved from path segment on `customer_order` routes |
| Route context (`route.type`, `route.path`) | Derived from the incoming URL by `storefront-runtime/src/proxy.ts` |
| `request.locale` | From `Accept-Language` header or store locale setting |

---

## 3. Data Binding — How Commerce Data Reaches Templates

The path from the database to the Liquid/React context is:

```
DB (products, orders, customers, collections, reviews)
  │
  ▼
ProductService.getProductsByIds() / getProductsByStoreSubdomain()
  │   Called in buildSectionDataPlan() — data-binding-engine.ts
  │
  ▼
Map<sectionId, SectionRenderData>
  │   { products: ProductModel[], product?: ProductModel,
  │     cart?, collection?, reviews? }
  │
  ▼  (composition-engine.tsx)
buildLiquidCommerceContext()
  │   Calls: collectLiquidProducts(), collectLiquidCart(),
  │           collectLiquidCollectionMeta(), collectLiquidProductReviews()
  │   Enriches: product.reviews, product.in_wishlist (from customer.wishlist)
  │
  ▼
LiquidCommerceDrops  (passed to createThemeRenderer('liquid').render())
  │   { shop, product, collection, collections, cart, customer, order, page? }
  │
  ▼
Liquid template evaluation (theme-renderer.ts → buildLiquidCommerceDrops())
  │   Injects into LiquidJS scope as {{ product.title }}, {{ cart.item_count }}, etc.
  │
  ▼
Sanitized HTML via DOMPurify (FORBID list locked; outputEscape: 'escape')
  │
  ▼
LiquidRenderedHtml component → dangerouslySetInnerHTML (storefront page)
```

**Section data plan determination (`buildSectionDataPlan`):**

A section requests product data if any of the following match:
- `section.type` is in `PRODUCT_SECTION_TYPES` set (`productGrid`, `featuredProducts`, `product-grid`, `featured-products`, `product-detail`)
- `section.rendererKey` is in `PRODUCT_RENDERER_KEYS` set (e.g. `core.product-detail`, `liquid.section.featured-products`)
- `section.settings.productIds` is a non-empty string array
- `section.settings.dataBinding.resource === 'products'` or `resourceType === 'products'`

**Single-product selection:**
A section gets a `product` (singular) entry if `route.type === 'product'` OR the section type/rendererKey is `product-detail`.

**Review enrichment:**
After products are collected, if `plan.route.type` has a product context the engine calls `ProductService` for review data and merges `product.reviews`, `product.rating`, `product.review_count` into the first product drop.

**Wishlist enrichment:**
On `customer_wishlist` routes, if the customer has wishlist IDs, `ProductService.getProductsByIds(customer.wishlist, subdomain)` is called to hydrate full product drops at `customer.wishlist_products`.

---

## 4. Configuration Points Table

| Configuration Level | Field | Type | Merchant-Editable | AI-Editable | Runtime |
|---|---|---|---|---|---|
| Global settings schema | `config.settings_schema.settings.*.label` | string | No (bundle static) | No | No |
| Global settings schema | `config.settings_schema.settings.*.fields.*` | SettingField | No (bundle static) | No | No |
| Global settings values | `config.settings_data.current.*` | JsonValue | Yes | Yes | No |
| Global settings presets | `config.settings_data.presets.*` | Record | Yes | Yes | No |
| Template layout key | `templates/[key].layout` | string | Yes (via draft) | Yes | No |
| Template section order | `templates/[key].order` | string[] | Yes | Yes | No |
| Template section type | `templates/[key].sections/[id].type` | string | Yes (add/swap section) | Yes | No |
| Section instance settings | `templates/[key].sections/[id].settings.*` | JsonValue | Yes | Yes | No |
| Section disabled flag | `templates/[key].sections/[id].disabled` | boolean | Yes | Yes | No |
| Section block order | `templates/[key].sections/[id].block_order` | string[] | Yes | Yes | No |
| Block type | `templates/[key].sections/[id].blocks/[bId].type` | string | Yes (add block) | Yes | No |
| Block instance settings | `templates/[key].sections/[id].blocks/[bId].settings.*` | JsonValue | Yes | Yes | No |
| Block disabled flag | `templates/[key].sections/[id].blocks/[bId].disabled` | boolean | Yes | Yes | No |
| Section definition type | `sections/[type].type` | string | No (bundle static) | No | No |
| Section renderer key | `sections/[type].renderer_key` | string | No (bundle static) | No | No |
| Section settings schema | `sections/[type].settings_schema.*` | SettingField | No (bundle static) | No | No |
| Section enabled_on | `sections/[type].enabled_on.templates` | string[] | No (bundle static) | No | No |
| Block settings schema | `blocks/[type].settings_schema.*` | SettingField | No (bundle static) | No | No |
| App blocks | `appBlocks[]` on `sites.template_config` | AppBlockInstance[] | Yes (via install) | Yes | No |
| Locale dictionary | `locales/[lang].*` | JsonRecord | No (bundle static) | No | No |
| Active locale | `request.locale` | string | Indirect (store locale) | No | Yes |
| Product data | `product.*` | LiquidProductDrop | No | No | Yes |
| Collection data | `collection.*` | LiquidCollectionDrop | No | No | Yes |
| Cart state | `cart.*` (totals null at SSR) | LiquidCartDrop | No | No | Yes (browser) |
| Customer identity | `customer.*` | LiquidCustomerDrop | No | No | Yes |
| Customer wishlist | `customer.wishlist[]` | string[] | No | No | Yes |
| Order detail | `order.*` | LiquidOrderDrop | No | No | Yes |
| Route context | `route.type`, `route.path`, `route.resourceSlug` | string | No | No | Yes |
| Release version | `sites.storefront_release_version` | integer | No (set on publish) | Indirect (via publish) | No |
| Section data binding | `section.settings.dataBinding.*` | Record | Yes | Yes | No |
| Section productIds override | `section.settings.productIds` | string[] | Yes | Yes | No |

---

## 5. Commerce Data Graph

| Drop | Source | DB Table / API | Per-Request? | Notes |
|---|---|---|---|---|
| `shop` | `StoreModel` (tenant record) | `sites` | No (SSR cached) | `id`, `name`, `subdomain`, `url`, `locale`, `currency` always `'INR'` |
| `product` (singular) | `ProductService.getProductsByIds` | `products` | Yes | Only populated on product routes or product-detail sections |
| `product.reviews` | `ProductService` review fetch | `product_reviews` | Yes | Merged into product drop after products are fetched |
| `product.in_wishlist` | `customer.wishlist` set intersection | `customer_wishlist` | Yes | True only when customer is authenticated and product is in wishlist |
| `collection.products` | `ProductService.getProductsByStoreSubdomain` or `getProductsByIds` | `products` | Yes | All products or filtered by section `productIds`/`collectionHandle` |
| `collection` (meta) | `SectionRenderData.collection` or route-derived | `collections` / route | Yes | `id`, `handle`, `title`, `description` |
| `collections[]` | Same as `collection` but as a one-element array | Same | Yes | Liquid compatibility |
| `cart` | Browser-hydrated (SSR stub) | `carts` / `lb-cart-drawer` island | Yes (browser) | At SSR: `item_count: null`, `subtotal: null` — real values come from `/api/storefront/:subdomain/cart` |
| `customer` | `getStorefrontCustomerDrop(storeId, {includeOrders})` | `store_customers`, `orders` | Yes | Resolved from customer HS256 session cookie |
| `customer.wishlist_products` | `ProductService.getProductsByIds(customer.wishlist)` | `products` | Yes | Only on `customer_wishlist` routes |
| `order` | `getCustomerOrderDetailDrop(storeId, orderId)` | `orders`, `order_items` | Yes | Only on `customer_order` routes |
| `search` | Not yet populated server-side | N/A | N/A | Defined in `LiquidCommerceDrops` interface but not populated in current engine |
| `request.locale` | Store `locale` field | `sites.locale` | Yes | Passed as rendering context; used for locale dictionary resolution |
| `page` | `liquidPage` prop (from route handler) | `pages` table (route-resolved) | Yes | Optional; passed explicitly to `composition-engine` from route handler |

---

## 6. Theme DB Schema

Reconstructed from `theme-execution.adapter.ts` interfaces and the route handler queries in `themes.ts`.

### `themes` (marketplace theme catalog)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `slug` | text | Unique, used as FK in other tables (`theme_id` cols store the slug) |
| `name` | text | Display name |
| `description` | text | |
| `is_active` | bool | Soft-delete gate for all marketplace reads |
| `is_premium` | bool | Legacy premium flag |
| `letbuyy_pricing_type` | text | `'free'` \| `'one_time'` \| `'subscription'` |
| `letbuyy_price_inr` | numeric | Server-authoritative INR price |
| `letbuyy_price_usd` | numeric | USD price |
| `category` | text | |
| `supported_site_types` | text[] | |
| `industry` | text[] | |
| `layout` | text | |
| `tags` | text[] | |
| `features` | text[] | |
| `rating_avg` | numeric | Computed from `theme_reviews` |
| `install_count` | integer | |
| `purchase_count` | integer | |
| `sort_order` | integer | |
| `config` | jsonb | Default template config blob |
| `default_template` | jsonb | Default template structure |
| `section_schemas` | jsonb | Runtime section schema map |
| `block_schemas` | jsonb | Runtime block schema map |
| `settings_schema` | jsonb | Global settings schema |
| `renderer_manifest` | jsonb | Renderer metadata |
| `renderer_key` | text | React renderer key or `'liquid'` |
| `schema_version` | text | Bundle schema version string |
| `renderer_version` | text | |
| `author_handle` | text | FK to `developer_profiles.handle` |

### `theme_releases`

Stores every published configuration snapshot. Each publish creates a new row; rollbacks create a new row pointing back via `rollback_of_release_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `store_id` | uuid | FK `sites.id` |
| `theme_id` | text | Theme slug (FK `themes.slug`) |
| `theme_instance_id` | uuid | FK `theme_instances.id` (nullable if package schema unavailable) |
| `theme_package_version_id` | uuid | FK `theme_package_versions.id` (nullable) |
| `release_version` | integer | Monotonically incrementing per store |
| `release_config` | jsonb | Full `templateConfig` blob at publish time |
| `template_snapshot` | jsonb | Alias copy of `release_config.templates` |
| `settings_snapshot` | jsonb | Extracted `themeSettings` from `release_config` |
| `release_manifest` | jsonb | Engine metadata: `engine`, `renderer_engine`, `liquid_ready`, `approved_renderer_keys`, optional `liquidBundle` |
| `asset_manifest` | jsonb | Asset registry from renderer manifest |
| `cache_manifest` | jsonb | Cache tags: `["store:<id>", "theme:<slug>", "theme_release:<id>"]` |
| `data_binding_manifest` | jsonb | Reserved (currently `{}`) |
| `schema_manifest_version` | text | |
| `engine_version` | text | `'theme-engine-v1'` |
| `is_current` | bool | Exactly one row per store is `true` |
| `release_status` | text | `'published'` \| `'superseded'` |
| `publish_message` | text | |
| `published_by` | uuid | Actor user ID |
| `published_at` | timestamptz | |
| `source_draft_id` | uuid | FK `theme_editor_drafts.id` if promoted from draft |
| `source_draft_version` | integer | |
| `rollback_of_release_id` | uuid | Self-FK when this is a rollback release |
| `deleted_at` | timestamptz | Soft delete (nullable; some older schemas omit column) |

### `theme_editor_drafts`

Merchant working copy, scoped to a single `template_key`. One row per `(store_id, theme_id, template_key)`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `store_id` | uuid | FK `sites.id` |
| `theme_id` | text | Theme slug |
| `template_key` | text | `'index'` \| `'product'` \| `'collection'` \| etc. (added by migration 087) |
| `draft_config` | jsonb | Working `templateConfig` blob |
| `version` | integer | Increments each save; used for optimistic-lock conflict detection via `base_version` |
| `auto_saved_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `theme_instance_drafts`

Package-aware draft linked to a `theme_instances` row. Shadows `theme_editor_drafts` for stores that have a package-version-tracked install.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `theme_instance_id` | uuid | FK `theme_instances.id` |
| `store_id` | uuid | FK `sites.id` |
| `base_release_id` | uuid | FK `theme_releases.id` (the release this draft branches from) |
| `draft_status` | text | `'active'` \| `'published'` |
| `draft_version` | integer | Increments each save |
| `working_manifest` | jsonb | Full `templateConfig` |
| `schema_manifest_version` | text | |
| `auto_saved_at` | timestamptz | |
| `updated_by` | uuid | |
| `deleted_at` | timestamptz | |

### `sites.template_config` (JSONB column on the `sites` table)

This is the live, published configuration read by the storefront at SSR time. Its structure is the `ThemePackageBundle` config shape without the static bundle artifacts:

| Key | Type | Notes |
|---|---|---|
| `templates` | Record\<string, ThemeBundleTemplate\> | All page templates with sections and blocks |
| `themeSettings` | Record\<string, JsonValue\> | Mirrors `settings_data.current` |
| `appBlocks` | AppBlockInstance[] | App block definitions (processed by `buildLiquidAppBlocks`) |
| `liquidBundle` | LiquidThemePackageBundle (optional) | Full Liquid bundle artifact (present for Liquid-engine themes) |
| `themeBundle` | same as `liquidBundle` | Redundant alias stored alongside |

---

## 7. Missing Configuration Points

The following configuration dimensions do not currently exist in the codebase and would need to be added to support the described features.

### 7.1 Per-Page Template Override

**Current state:** Template selection is entirely route-type-based (`index`, `product`, `collection`, etc.). There is no mechanism to assign a different template to a specific page slug (e.g., `/pages/about` vs. `/pages/faq` using different templates).

**What is missing:**
- A `page_template_overrides: Record<slug, templateKey>` field on `sites.template_config`
- Route resolution in `storefront-runtime/src/proxy.ts` to read the override before falling back to the default template key
- Editor UI to assign a template key to a specific page resource
- DB column on `pages` table: `template_key text` (nullable override)

### 7.2 Section Conditional Visibility

**Current state:** `ThemeBundleTemplateSectionSchema` has only a `disabled: boolean` flag. There is no conditional rule system.

**What is missing:**
- A `visibility_rules` field on the section instance schema, e.g.:
  ```ts
  visibility_rules?: {
    show_on?: ('mobile' | 'tablet' | 'desktop')[];
    hide_on?: ('mobile' | 'tablet' | 'desktop')[];
    customer_segment?: string;     // customer tag
    route_types?: StorefrontRouteType[];
  }
  ```
- CSS/JS toggle at runtime based on viewport breakpoint (client-side) or route type (SSR-side)
- Zod schema extension in `ThemeBundleTemplateSectionSchema`

### 7.3 Personalization Overrides per Customer Segment

**Current state:** The Liquid context has a `customer` drop but there is no mechanism to override section settings or template layout based on customer tags, purchase history, or cohort membership.

**What is missing:**
- A `personalization_variants: Record<segmentKey, Partial<ThemeBundleTemplateSection>>` field on section instances
- A segment-resolution step in `buildSectionDataPlan` or `buildLiquidCommerceContext` that reads `customer.tags` and applies the matching variant override before rendering
- API surface to configure segment rules without a code deploy
- Segment definitions table (`customer_segments`) with cohort rules

### 7.4 A/B Testing Variant Configuration

**Current state:** There is a `theme_instance_drafts` system but it is linear (one active draft). There is no concept of multiple parallel variants with traffic splitting.

**What is missing:**
- An `ab_variants` field on `sites.template_config` or a separate `theme_ab_experiments` table:
  ```ts
  { variant_id: string; weight: number; template_config_delta: Partial<TemplateConfig> }[]
  ```
- Variant assignment at the edge (Cloudflare Worker) via a sticky cookie or deterministic hash of visitor ID
- Metric collection hooks linking variant assignment to order conversion events
- Editor UI to create, preview, and end experiments (promote winning variant to `sites.template_config`)
- A `variant_id` field on the `request` Liquid drop so templates can branch on `{{ request.ab_variant }}`
