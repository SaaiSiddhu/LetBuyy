# AGENT C — CATALOG / PRODUCTS / COLLECTIONS / MERCHANDISING — DISCOVERY NOTES

Run: `docs/merchant-system-discovery/2026-08-04T225330+0530-bf35062e`
Branch `stepup/main` @ `bf35062e`. Read-only discovery. No repository file was modified except this notes file.

Governance read before inspection:
- `apps/merchant-control-plane/AGENTS.md` (25 lines) — boundary ownership only, no catalog rules.
- `services/api-gateway/AGENTS.md` (34 lines) — "Every merchant-owned mutation must resolve `site_id` or prove explicit store ownership."

---

## 0. HEADLINE

The catalog is **not shippable as-is**. Static analysis plus one executed reproduction of the real tenant-guard
module found **three independent P0-class breaks** on the primary merchant and shopper paths, a **money-type
constitutional violation** (catalog prices are `numeric(10,2)` rupee floats, not bigint paise), **zero per-site
uniqueness** on SKU / handle / barcode, **no storefront cache invalidation on any catalog mutation**, and a
**Categories capability whose backing table does not exist in any migration**. Every "end-to-end" catalog test in
the repository is a regex match over source text — none executes catalog code.

---

## 1. INVENTORY — WHAT EXISTS

### 1.1 Merchant surfaces (`apps/merchant-control-plane/src/app/[store]/`)

| Page | File | Lines | Notes |
|---|---|---|---|
| Product list | `products/page.tsx` | 443 | client component, `limit=100` fixed |
| Product create | `products/new/page.tsx` | 1300 | also serves edit |
| Product edit | `products/[productId]/page.tsx` | 1 | `export { default } from '../new/page'` |
| Collections | `products/collections/page.tsx` | 555 | manual assignment UI |
| Smart collections | `products/smart-collections/page.tsx` | 606 | preview only |
| Categories | `categories/page.tsx` | 487 | backing table missing (§4.6) |
| Export/Import | `export/page.tsx` | 480 | client-side CSV export |
| Gift cards | `products/gift-cards/page.tsx` | — | Agent B/other domain |
| Inventory / locations / transfers / suppliers / POs / receipts / reservations / operations-dashboard | `products/*` | — | Agent D (inventory) domain |

Catalog-relevant same-origin proxies (`apps/merchant-control-plane/src/app/api/stores/[store]/`):
`products/route.ts`, `products/[productId]/route.ts`, `products/import/route.ts`,
`collections/route.ts`, `collections/[collectionId]/route.ts`, `collections/[collectionId]/products/route.ts`,
`smart-collections/route.ts`, `smart-collections/[id]/route.ts`, `smart-collections/[id]/preview/route.ts`,
`categories/route.ts`, `categories/[categoryId]/route.ts`, `media/route.ts`, `media/[mediaId]/route.ts`,
`upload/route.ts`, `themes/media-library/route.ts`.

**No proxy exists for `/v1/export/*` job endpoints and none for `/v1/metafields/*`.**

### 1.2 Gateway routes (`services/api-gateway/src/routes/`)

| File | Lines | Catalog surface |
|---|---|---|
| `products.ts` | 1242 | products CRUD + bulk + barcode + collections CRUD + collection assignment + sample |
| `categories.ts` | 287 | `product_categories` CRUD (table does not exist) |
| `smart-collections.ts` | 272 | list/create/patch/preview (no delete, no materialisation) |
| `media.ts` | 472 | media library + signed R2 upload intent |
| `metafields.ts` | 501 | definitions + values CRUD (`store_metafield_*`) |
| `upload.ts` | 277 | direct multipart upload through the worker to R2 |
| `export.ts` | 835 | products/orders/customers CSV export jobs + `POST /export/import-products` |
| `resource-search.ts` | 323 | typed picker search (product/collection/page/blog/menu) |
| `storefront/public-routes.ts` | — | public products / product-detail / collection-detail / categories |
| `storefront.ts` | — | `queryPublicProducts` cascade, variant hydration |

Execution: `services/api-gateway/src/execution/product-execution.adapter.ts` (664 lines).
Domain planning/validation: `packages/commerce-core/src/index.ts`.

### 1.3 Catalog tables actually present in `database/supabase/migrations/`

| Table | DDL | Tenant col |
|---|---|---|
| `products` | `000_baseline.sql:10583` | `store_id` (FK `sites.id`), `site_id` (FK, **never written**) |
| `product_variants` | `000_baseline.sql:10512` | via `product_id` only |
| `product_options` | `000_baseline.sql:10472` | via `product_id` only |
| `collections` | `000_baseline.sql:8733` | `store_id` |
| `collection_products` | `000_baseline.sql:8721` | none (via `collection_id`) |
| `smart_collections` | `000_baseline.sql:12165` | `store_id` |
| `media` / `media_assets` | baseline + `154_executable_analytics_media_ai_seam.sql` | `store_id` / `site_id` |
| `store_metafield_definitions`, `store_metafield_values` | `138_mobile_store_metafields.sql:4,43` | store-scoped |
| `product_categories` | **DOES NOT EXIST** | — |

Reserved-service check (constitutional): `services/media-service`, `search-service`, `checkout-runtime`,
`event-bus`, `notification-service`, `analytics-pipeline` each contain **only** `AGENTS.md` +
`runtime.manifest.json`. **No violation.** [PROVIDER_OR_CONFIG_EVIDENCE]

---

## 2. END-TO-END TRACES

Legend: each hop is `path:line`. `MISSING` = link absent. `BROKEN` = link present but proven non-functional.

### 2.1 CREATE PRODUCT

| Hop | Evidence |
|---|---|
| Merchant entry | `apps/merchant-control-plane/src/app/[store]/products/new/page.tsx:596-640` builds payload (`price: parseFloat(price) || 0`, line 600) |
| App proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/products/route.ts:51-71`; `resolveOwnedStoreId` at :57; **`store_id: resolved.storeId`** injected server-side at :64 (client `store_id` overridden — CORRECT) |
| Typed client | `packages/typescript/api-client/src/index.ts:4784-4785` → `POST /products` |
| Gateway route | `services/api-gateway/src/routes/products.ts:1103-1127` |
| Validation | `validate('json', CreateProductSchema)` → `packages/commerce-core/src/index.ts:23-62` |
| AuthZ | `assertStaffPermission(c, body.store_id, customUser.id, 'products:write')` `products.ts:1113`; then `assertStoreOwnership` in adapter `product-execution.adapter.ts:140` → `verifySiteOwnership` :325 |
| Quota | `assertProductQuota` :141 / :345-363 (plan `limits.products`) |
| Plan | `planProductCreate` `commerce-core/src/index.ts:1132-1177` |
| DB write | `products` insert `product-execution.adapter.ts:145-149`; `product_options` :384-399; `product_variants` :401-507; inventory RPC `set_inventory_level_available` / `set_inventory_levels_available_batch` :633,:651 |
| **Variant JSONB cache** | `refreshProductVariantJsonbCache` :561-588 — `.from('products').update({variants}).eq('id', productId)` → **BROKEN by tenant guard, see G-C-01** |
| Usage meter | `recordProductUsage` :365-382 |
| Event | `emitProductEvent` `products.ts:1118-1124` → `EventExecutionAdapter.emitDomainEvent` |
| Storefront consequence | **MISSING** — no cache-version bump, no revalidateTag (see G-C-04) |
| Tests | `services/api-gateway/src/__tests__/products.test.ts:19-31` — regex over source only |
| Runtime observation | NONE — no credentials, production forbidden |

**Status: BROKEN** (`refreshProductVariantJsonbCache` is on the create path at `product-execution.adapter.ts:155`
and is unconditionally executed for every create).

### 2.2 EDIT PRODUCT

| Hop | Evidence |
|---|---|
| Entry | same form (`products/[productId]/page.tsx:1` re-exports `new/page`) |
| Proxy | `products/[productId]/route.ts:31-45` — PATCH; **no store scoping at the proxy** (unlike GET :21) |
| Client | `api-client/src/index.ts:4788-4789` → `PATCH /products/:id` |
| Gateway | `products.ts:1130-1154`; staff perm on `auth.user.storeId` :1141 |
| Ownership | `ProductExecutionAdapter.updateProduct` → `getOwnedProduct` `:329-343` — `.from('products').select('id, store_id, price').eq('id', productId).is('deleted_at', null).maybeSingle()` → **BROKEN by tenant guard (G-C-01)** |
| Field allowlist | `PRODUCT_UPDATE_FIELDS` `commerce-core/src/index.ts:603-633` |
| Optimistic concurrency | **MISSING** — `version` accepted by `UpdateProductSchema:96` but absent from `PRODUCT_UPDATE_FIELDS`; `planProductUpdate` never compares it. Trigger `trg_products_version` (`000_baseline.sql:19561`) increments the column but nothing reads it (G-C-09) |
| Storefront consequence | MISSING (G-C-04) |

**Status: BROKEN.**

### 2.3 VARIANTS / OPTIONS MATRIX

| Hop | Evidence |
|---|---|
| UI | `products/new/page.tsx:519-565` (`rebuildMatrix`), :1103-1150 (matrix table: price / compare / SKU / stock) |
| Schema | `ProductVariantSchema` `commerce-core/src/index.ts:6-15` — max 100 variants, options `record<string,string>` |
| Option schema | `ProductOptionSchema` :17-21 — max 10 options, max 100 values |
| Write | `replaceProductOptions` `product-execution.adapter.ts:384-399` (delete-all + insert); `replaceProductVariants` :401-507 (identity-keyed diff, feature-flagged `PRODUCT_VARIANT_DIFF`) |
| Identity key | `variantIdentityKey` :89-100 — SKU if present, else title+option1..3 shape |
| Dual write | relational `product_variants` **and** JSONB `products.variants` cache :561-588 |
| Read | `hydrateProductVariants` `products.ts:204-240` when `PRODUCT_VARIANTS_RELATIONAL_READS != 'off'` (default `on`, `wrangler.toml:51,142,268`) |
| Barcode | `product_variants.barcode` exists in DDL but **`normalizeProductVariant` never writes it** (`product-execution.adapter.ts:590-609` has no `barcode` field) — merchant-entered variant barcodes are silently dropped (G-C-11) |
| `image_url`, `weight`, `weight_unit` per variant | in DDL + read views, **never written** by either write path (:455-473, :519-535) |

**Status: PARTIAL** (option matrix + price/SKU/stock write; barcode/weight/image per variant are read-only ghosts).

### 2.4 MEDIA UPLOAD / ORDERING / ALT TEXT

| Hop | Evidence |
|---|---|
| UI | `products/new/page.tsx:465-516` — append-only; `removeImage` :515; **no reorder, no alt text, no primary-image selector** |
| Proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/upload/route.ts:23-24` sets `folder = {storeId}/products` and `store_id` — **tenant-scoped object key (CORRECT)** |
| Gateway | `services/api-gateway/src/routes/upload.ts:119-225` — multipart **through the worker**, not presigned direct-to-storage |
| MIME gate | `validateUploadMime` :151 (SVG rejected) |
| Size caps | 10 MB standard / 100 MB video / 50 MB model :9-11 |
| Key | `${folder}/${auth.user.id}/${Date.now()}-${uuid}.${ext}` :168 |
| Storage | `c.env.R2_BUCKET.put` :195; prod fail-closed without R2 :171-173; dev inline base64 data-URL :175-187 |
| Public URL | `ASSET_PUBLIC_BASE_URL + key` :207 — unauthenticated public object, no signed URL |
| Media-library row | `apiClient.media.create(...).catch(() => null)` `upload/route.ts:32-40` — **best-effort, silent failure** (G-C-12) |
| Signed direct upload | `media.ts:44-86` (`SignedMediaUploadSchema`, `planSignedR2UploadIntent`) exists but the product form does **not** use it |
| `products.thumbnail_url` | column exists (`000_baseline.sql`), **never written** by create or update (absent from `productInsert` and `PRODUCT_UPDATE_FIELDS`) |
| Reserved `services/media-service` | manifest-only — compliant |

**Status: PARTIAL.** Alt text: **NOT_IMPLEMENTED** for product images. Ordering: **NOT_IMPLEMENTED**.

### 2.5 PUBLISH / UNPUBLISH / ARCHIVE

| Hop | Evidence |
|---|---|
| UI | `products/page.tsx:127-137` `patchProductStatus` sends `{status, is_active}`; tabs All/Active/Draft/Archived :24-29 |
| Zod | `UpdateProductSchema` has **no `status` field** → zod strips it; only `is_active` survives |
| Derivation | `planProductUpdate` `commerce-core/src/index.ts:1190-1192` — `status = is_active ? 'active' : 'draft'` |
| Consequence | **"Archived" is unrepresentable** — Archive and Draft both write `is_active=false, status='draft'` (G-C-08) |
| List filter | proxy `normalizeStatus` `products/route.ts:6-10` maps `draft|inactive|archived → 'inactive'`; gateway `ListProductsQuery.status` enum is `active|inactive|all` (`commerce-core:101`) → **Draft and Archived tabs return identical rows**; the client does not re-filter by tab (`page.tsx:194-205` filters on search only) |

**Status: BROKEN (archive), PARTIAL (publish/unpublish).**

### 2.6 DELETE / ARCHIVE / DUPLICATE

- Soft delete: `products.ts:1188-1212` → `ProductExecutionAdapter.softDelete` :229-243 (`is_active=false`, `deleted_at=now`). Ownership via `getOwnedProduct` → **BROKEN by G-C-01**.
- Bulk: `POST /products/bulk` `products.ts:1157-1185` → `bulkAction` :248-317; `.in('id', productIds)` at :262 → **BROKEN by G-C-01**. **The merchant UI never calls this endpoint** (`grep -rn "/bulk" apps/merchant-control-plane/src` → no hits); the list page issues N sequential PATCHes instead (`products/page.tsx:161-192`).
- **Duplicate product: NOT_IMPLEMENTED** — no gateway route, no client method, no UI (`grep -rni "duplicate" apps/merchant-control-plane/src` → no product hits).

### 2.7 COLLECTIONS (manual)

| Hop | Evidence |
|---|---|
| UI | `products/collections/page.tsx:111,169,217-218,259` |
| Product picker | `page.tsx:217` fetches `/api/stores/{store}/products?limit=200` |
| Proxy | `products/route.ts:27` forwards `limit=200` verbatim |
| Gateway | `ListProductsQuery.limit = z.coerce.number().int().min(1).max(100)` `commerce-core:105` → `validate` returns **400** (`middleware/validation.ts:58-60`) → **picker cannot load products** (G-C-07) |
| List | `GET /products/collections` `products.ts:583-622` — `.select('*')`, **no limit, no pagination** (CODE-R4 violation) |
| Create | `products.ts:625-675` — direct `.insert` on `collections` |
| Patch | `products.ts:678-742` — `.eq('id', collectionId)` → **BROKEN by G-C-01** (`collections` is a registered tenant table, `tenant-tables.registry.ts:546`) |
| Assignment read | `products.ts:745-825` — `collection_products` select, **no pagination** |
| Assignment write | `products.ts:828-932` — validates all product IDs belong to the store (:874-898, CORRECT), delete-all + upsert, capped at 500 IDs :844 |
| Delete | `products.ts:935-997` — `.eq('id', collectionId)` → **BROKEN by G-C-01** |
| Storefront | `storefront/public-routes.ts:911-999` — resolves collection **by UUID only**; the code comment at :907-909 states "the baseline schema has no slug column". Confirmed: `collections` DDL `000_baseline.sql:8733-8747` has **no slug** |
| Product cap | `queryPublicProducts(..., limit: Math.min(productIds.length, 100))` :974 — collections >100 products silently truncate |

**Status: BROKEN** (edit/delete/picker), **PARTIAL** (create/assign/read). SEO: **NOT_IMPLEMENTED** (UUID URLs).

### 2.8 SMART COLLECTIONS (automated)

| Hop | Evidence |
|---|---|
| Table | `smart_collections` `000_baseline.sql:12165-12179`; **unique `(store_id, slug)`** at :15800 (the only per-site uniqueness anywhere in the catalog) |
| Gateway | `smart-collections.ts` — `GET /` :47, `POST /` :81, `PATCH /:id` :145, `GET /:id/preview` :220 |
| Ownership | `verifySiteOwnership` :62, :103, :168, :240 |
| Tenant guard | `.eq('id', collectionId)` at :163 and :230 → **BROKEN by G-C-01** (`smart_collections` registered at `tenant-tables.registry.ts:2445`) |
| Delete | **MISSING** — no `router.delete` in `smart-collections.ts` |
| Evaluation | `filterProducts` (`lib/smart-collection-eval`) over max 500 products :22, :251 |
| **Materialisation** | **MISSING** — nothing writes matched products into `collection_products` or any projection |
| **Storefront exposure** | **MISSING** — `grep -rn "smart_collections" services/api-gateway/src/routes apps/storefront-runtime/src` matches only `smart-collections.ts` itself |

**Status: BROKEN + UI_ONLY.** Smart collections are a merchant-side preview calculator that no shopper can ever see.

### 2.9 CATEGORIES

| Hop | Evidence |
|---|---|
| UI | `apps/merchant-control-plane/src/app/[store]/categories/page.tsx` (487 lines, full CRUD UI) |
| Proxy | `api/stores/[store]/categories/route.ts`, `.../[categoryId]/route.ts` |
| Gateway | `categories.ts` — all 5 handlers target `public.product_categories` |
| **Table** | **DOES NOT EXIST.** `grep -rn "product_categories" database/` returns exactly one hit: `194_demo_requests.sql:45` — a `text[]` **column** on `demo_requests`, unrelated |
| `products.category_id` | **DOES NOT EXIST** — the products DDL has only `category text`. `categories.ts:243-246` updates `products.category_id`, and `:174` uses PostgREST embed `products(count)` which needs an FK that does not exist |
| Observed behaviour | GET → `isMissingTableError` → `success([])` :94-96; POST → 503 `CATEGORIES_SCHEMA_MISSING` :144-152; DELETE → `.eq('category_id', ...)` on `products` (a registered tenant table) → tenant-guard rejection → unhandled throw |
| Storefront | `storefront/public-routes.ts:1014` selects from `product_categories` with error ignored → always `success([])` |

**Status: NOT_IMPLEMENTED (data layer) with UI_ONLY + BROKEN gateway on top.**

### 2.10 TAGS

- Stored as `products.tags text[]` (`000_baseline.sql`); schema `z.array(z.string().max(50)).max(30)` (`commerce-core:36`).
- UI: comma-separated free text (`products/new/page.tsx:254, 324`).
- **No tag registry, no per-site tag list endpoint, no tag-based storefront filter route.** `ListProductsQuery` has no `tag` param (`commerce-core:99-110`), unlike `ListCustomersQuery` which does (:205).
- Smart-collection conditions can match tags (in-memory only, §2.8).

**Status: PARTIAL** (stored + editable; not queryable, not merchandisable).

### 2.11 METAFIELDS

| Hop | Evidence |
|---|---|
| Gateway | `metafields.ts` — 8 handlers, `store_metafield_definitions` / `store_metafield_values`, `owner_type` enum includes `product`, `variant`, `collection` (:32) |
| Tables | `138_mobile_store_metafields.sql:4,43` |
| App proxy | **MISSING** — no `api/stores/[store]/metafields*` route |
| Merchant UI | `[store]/settings/custom-data/page.tsx` renders `BackendNeededPane` with the literal text *"No `metafields`, `metaobjects`, or custom-data gateway route was found in current services/packages."* |
| Product form | **MISSING** — no metafield editor |

**Status: BACKEND_ONLY** + **CONTRADICTORY_EVIDENCE** (the shipped UI asserts a backend absence that is false).

### 2.12 CSV IMPORT

| Hop | Evidence |
|---|---|
| UI | `export/page.tsx:290-345` |
| Proxy | `api/stores/[store]/products/import/route.ts:16-22` (injects `store_id` server-side — CORRECT) |
| Client | `api-client/src/index.ts:4822-4823` → `POST /export/import-products` |
| Gateway | `export.ts:747-812` — ownership `verifySiteOwnership` :767; cap `PRODUCT_IMPORT_MAX_ROWS = 500` :119; CSV parked in R2 :790; job in R2 :793 |
| Processor | `processProductImport` `export.ts:596-646` — `c.executionCtx.waitUntil` :810, **sequential per-row `createProduct`** :622-632 |
| Columns supported | name, price, description, category, stock, tags, images (`:608-614`) |
| Columns NOT supported | **sku, barcode, hsn_code, compare_price, cost, weight, variants, options, url_handle, seo_title, seo_description, vendor, product_type, is_active** |
| Upsert | **MISSING** — always `createProduct` → re-import duplicates the catalog |
| Dry run / error report | **MISSING** |
| Partial failure | one throw marks the whole job failed; already-created rows stay (`:638-645`) |
| UI feedback | `export/page.tsx:326-337` — reports "queued", **never polls `GET /export/jobs/:id`**; no proxy for it exists |
| Blocked by | every row calls `refreshProductVariantJsonbCache` → G-C-01 |

**Status: BROKEN.**

### 2.13 CSV EXPORT

Two disconnected implementations:

1. **Gateway job pipeline** — `export.ts:686-704` (`GET /export/products`), 1000-row batches :118, streamed to R2, HMAC-signed download token :666-670, 7-day TTL :126. Headers `export.ts:83`: `id, name, description, price, compare_price, category, stock, is_active, is_featured, tags, images, created_at`. **Omits sku, barcode, hsn_code, url_handle, seo_*, weight, vendor, product_type, variants** → not round-trippable with import, and **HSN (GST-critical) cannot be exported**.
2. **What the merchant actually gets** — `export/page.tsx:151` fetches `/api/stores/{store}/products?limit=100` and builds the CSV in the browser (`downloadCsv` :83-91). **Capped at 100 products.** No merchant proxy for `/v1/export/*` exists.

**Status: PARTIAL / CONTRADICTORY_EVIDENCE** (a correct server pipeline exists and is unreachable from the product).

### 2.14 SEARCH / FILTER / SORT ON THE PRODUCT LIST

| Layer | Evidence |
|---|---|
| Gateway | `products.ts:440-532` — cursor + offset pagination, `withCount`, `search` → `ilike('name', %q%)` :478, `category` :475, `status` :476-477, sort enum `created_at\|price\|name\|stock\|display_order` (`commerce-core:108`), `limit` max 100 |
| Trigram index | `084_trigram_search_indexes.sql:7` gin(name gin_trgm_ops) — supports the ilike |
| Proxy | `products/route.ts:22-33` — forwards search/category/sort/order/page/limit |
| **UI** | `products/page.tsx:100-105` — hard-codes `limit: '100', sort: 'created_at', order: 'desc'`; **never sends `search`, never sends `page`, never uses `cursor`** |
| **UI search** | `page.tsx:194-205` — `Array.filter` over the loaded ≤100 rows |
| **UI sort** | `page.tsx:207-210` — `Array.sort` over the loaded ≤100 rows |
| Pagination UI | **MISSING** — no next/prev control anywhere in `products/page.tsx` |

**Consequence:** a merchant with >100 products can neither see nor search product 101+. **Status: BROKEN at scale.**

**Unpaginated list endpoints found (CODE-R4 violations):**
- `products.ts:583-622` `GET /products/collections` — `.select('*')`, no limit.
- `products.ts:745-825` `GET /products/collections/:id/products` — no limit on the assignment read.
- `categories.ts:63-110` `GET /categories` — no limit.
- `smart-collections.ts:47-78` `GET /smart-collections` — no limit.
- `storefront/public-routes.ts:960-968` collection assignment read — no limit.
- `storefront/public-routes.ts:1014` categories — no limit.

### 2.15 SEO

| Field | Stored | Validated | Reaches storefront |
|---|---|---|---|
| `seo_title` | `products.seo_title text` | max 70 (`commerce-core:52`) | YES — `product/[productId]/page.tsx:24` |
| `seo_description` | `products.seo_description text` | max 160 (:53) | YES — :23 |
| `url_handle` / `slug` | both columns exist | `url_handle` max 200; `slug` generated | **NO** — canonical path is `/product/${product.id}` (UUID), `page.tsx:29` |
| Uniqueness | **NONE** (§3) | — | — |

`generateProductSlug` `commerce-core/src/index.ts:787-794`:
```
name.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,100)
```
- Strips every non-ASCII character → a Devanagari/Tamil/Bengali product name yields the **empty string**, and
  `planProductCreate:1165` then sets `url_handle: input.url_handle || slug` = `''`. India-first break (G-C-10).
- No leading/trailing hyphen trim, no collision suffix.
- `planProductUpdate:1186-1188` **silently regenerates `url_handle` from the name** whenever the name changes and
  `url_handle` was not explicitly sent — merchant-authored handles and any live SEO link are destroyed by a rename.

### 2.16 STOREFRONT PROPAGATION AFTER PUBLISH

| Layer | Mechanism | Invalidated on catalog change? |
|---|---|---|
| Cloudflare `caches.default` in the gateway | `lib/storefront-cache.ts:107-130` `cachedJson`, key versioned by KV `storefront-cache-version:<handle>` :70-72; `Cache-Control: public, max-age=60, stale-while-revalidate=300` :12-13, :24-26 | **NO** |
| `bumpStorefrontCacheVersion` | `storefront-cache.ts:83-90` | called from **exactly one place**: `routes/themes.ts:154` (theme publish). Never from `products.ts`, `categories.ts`, `smart-collections.ts`, or `export.ts` |
| `purgeStorefrontCache` | `storefront-cache.ts:132-136` | called only from `themes.ts:155`, and only for the literal version-`0` bootstrap key |
| Next.js data cache | `apps/storefront-runtime/src/lib/api/client.ts:24-30` `storefrontReadInit(revalidate, tags)`; products list 60 s, detail 30 s (`product-service.ts:9-10`); collection 30 s | tags **declared** (`storefront:{subdomain}:products`, `…:product:{id}`) but `grep -rn "revalidateTag" apps/ services/ packages/` → **zero hits**. Time-based only |

**Cached storefront endpoints affected:** `products` (`public-routes.ts:763`), `products-by-ids` (:797),
`product-detail` (:823), `collection-detail` (:923), `categories` (:1005), `bootstrap` (:571).

**Status: MISSING.** Automatic invalidation does not exist; propagation is purely time-based, and there is no
manual "refresh storefront" control in the merchant UI.

---

## 3. PER-SITE UNIQUENESS — PROVEN ABSENT

Full sweep: `grep -rn "ON public.products\|ALTER TABLE ONLY public.products\|ALTER TABLE public.products" database/supabase/migrations/*.sql`

Everything that exists on `products`:
```
000_baseline.sql:14826  products_pkey PRIMARY KEY (id)
000_baseline.sql:22220  products_site_id_fkey  FOREIGN KEY (store_id) REFERENCES sites(id) ON DELETE CASCADE
000_baseline.sql:22228  products_site_id_fkey1 FOREIGN KEY (site_id)  REFERENCES sites(id) ON DELETE CASCADE
000_baseline.sql:18067  idx_products_active     btree (site_id) WHERE deleted_at IS NULL      -- non-unique
000_baseline.sql:18074  idx_products_store      btree (store_id)                              -- non-unique
000_baseline.sql:18081  idx_products_store_hsn  btree (store_id, hsn_code) WHERE hsn_code IS NOT NULL -- non-unique
084_trigram_search_indexes.sql:7  gin (name gin_trgm_ops)
157_product_metadata.sql:23       gin (metadata) WHERE deleted_at IS NULL
000_baseline.sql  CONSTRAINT products_hsn_code_format_check CHECK (hsn_code ~ '^\d{4,8}$')
157_product_metadata.sql  CONSTRAINT products_metadata_object_check CHECK (jsonb_typeof(metadata)='object')
```
And on `product_variants`: only `idx_product_variants_product_id` (`000_baseline.sql:18032`), non-unique.

| Field | Unique per site? | Unique globally? | Any constraint? |
|---|---|---|---|
| `products.sku` | **NO** | NO | **NONE** |
| `products.barcode` | **NO** | NO | **NONE** |
| `products.slug` | **NO** | NO | **NONE** |
| `products.url_handle` | **NO** | NO | **NONE** |
| `product_variants.sku` | **NO** | NO | **NONE** |
| `product_variants.barcode` | **NO** | NO | **NONE** |
| `collections` (any handle) | n/a — **no slug column at all** | — | — |
| `smart_collections.slug` | **YES** — `smart_collections_store_id_slug_key` `000_baseline.sql:15800` | — | the only correct one |

Downstream proof of harm:
- `storefront/public-routes.ts:837` resolves product detail with `.or('slug.eq.X,id.eq.X').single()` — duplicate slugs make `.single()` fail → 404.
- `products.ts:242-266` `loadProductByBarcode` uses `.maybeSingle()` on `(store_id, barcode)` → duplicate barcode → PGRST116 → returns `null` → scan silently reports "Product not found".
- `products.ts:387-401` `loadExistingSampleProduct` `.maybeSingle()` on `(store_id, sku)` — same failure mode.
- `products.ts:268-308` `loadVariantProductByBarcode` queries `product_variants` by barcode **with no store filter at all** (`.eq('barcode', barcode).limit(20)`), then loops filtering by store — cross-tenant rows are read into the worker before being discarded.

---

## 4. HIGH-STAKES / INVARIANT FINDINGS

### 4.1 [HIGH-STAKES] Catalog money is rupee floats, not bigint paise

- `MoneySchema` `packages/shared-types/src/index.ts:52-55` = `z.number().min(0).max(99_999_999.99)`.
  No `.int()`, no minor-unit contract. Accepts `10.999`.
- `products.price numeric(10,2)`, `compare_price numeric(10,2)`, `cost_price numeric(10,2)`,
  `cost_per_item numeric(10,2)` — `000_baseline.sql:10583+`.
- `product_variants.price numeric(10,2)`, `compare_price numeric(10,2)` — `000_baseline.sql:10512+`.
- UI: `parseFloat(price) || 0` (`products/new/page.tsx:600, 628`).
- Adapter: `numericValue()` `product-execution.adapter.ts:75-82` — plain JS float, `Number(...)`.
- Import: `parseFloat(row[priceIdx]) || 0` `export.ts:626`.

This is a direct deviation from ART-10/R-5 ("money is bigint minor units (paise) everywhere"). Practical effects:
silent rounding of a merchant-entered `₹10.999`, float compare in `variantWriteChanged`
(`product-execution.adapter.ts:102-113`) driving spurious or missed variant updates, and a hard `₹99,999,999.99`
price ceiling. It also means the catalog price type differs from the order/ledger money type, so every read of
`products.price` into checkout crosses a representation boundary.

Also `CreateProductSchema.refine` `commerce-core:59-62` compares `compare_price > price` as floats.

### 4.2 [HIGH-STAKES] `site_id` is declared as the tenant column and is never written

- `planProductCreate` `commerce-core/src/index.ts:1141-1175` sets `store_id` only. `site_id` is absent.
- `PRODUCT_UPDATE_FIELDS` :603-633 does not contain `site_id`.
- `grep -rn "from('products')" services/api-gateway/src | grep insert/update` → the only writers are the
  adapter (create/update/bulk/softDelete/cache) — none sets `site_id`.
- Yet `tenant-tables.registry.ts:1737-1746` declares `products.tenantColumn = "site_id"`.
- And `tenantScoped()` `services/api-gateway/src/tenant/tenant-scoped.ts:19` filters on `entry.tenantColumn`.

So `products.site_id` is permanently NULL, `idx_products_active` (on `site_id`) is dead weight, and any future use
of `tenantScoped('products', …)` returns zero rows. RLS survives only because every policy uses
`COALESCE(site_id, store_id)` (`163_d2_live_data_leak_rls.sql:35`).

### 4.3 [HIGH-STAKES] RLS is present but bypassed in practice; `products` lacks FORCE

- Policies: `products_tenant_site_guc` / `service_role_products` `163_d2_live_data_leak_rls.sql:26-36`;
  child tables via `EXISTS(products …)` :38-88; `app_tenant_*` role variants `164_d4_tenant_role_guc.sql:87-131`.
- `164_d4_tenant_role_guc.sql:87-88, 110-111` runs `ENABLE`+`FORCE ROW LEVEL SECURITY` for `product_variants` and
  `product_options`. **`ALTER TABLE public.products FORCE ROW LEVEL SECURITY` appears nowhere** — sweep of all 56
  `FORCE ROW LEVEL SECURITY` statements matches only `media_assets`, `analytics_rollups_daily`,
  `ai_capability_seams` (`154_executable_analytics_media_ai_seam.sql:71,80,149`). `products` has only
  `ENABLE` (`000_baseline.sql:25556`).
- The gateway connects as **service_role** (`lib/supabase.ts:13-19` → `createSupabaseServiceClient`), for which
  `service_role_products` is `USING (true) WITH CHECK (true)`. RLS therefore provides **no** isolation on the
  merchant path; isolation depends entirely on the JS proxy in `tenant/tenant-scoped.ts` plus
  `verifySiteOwnership` in each handler.
- Legacy PUBLIC policies survive: `store_owner_products` `000_baseline.sql:27148` and
  `public_view_active_products` :25838 have no `TO` clause, so they apply to PUBLIC. The latter grants anon
  `SELECT` on every active product of every published site — intentional for storefront reads, but it is a
  PUBLIC-scoped policy on a tenant table and should be recorded.

### 4.4 [HIGH-STAKES] `store_id` is client-supplied on several gateway endpoints

Pattern used throughout: the client sends `store_id` in the body/query and the handler calls
`verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId)` before acting.
Verified at `products.ts:1113` (create), `:1167` (bulk), `:635` (collection create), `:545` (barcode),
`:1015` (sample), `categories.ts:122`, `smart-collections.ts:103`, `export.ts:767`, `resource-search.ts:291`,
`upload.ts:146`.

The merchant proxies overwrite the client value with the server-resolved store
(`products/route.ts:64`, `import/route.ts:18-19`, `upload/route.ts:23-24`) — correct for the web app.
The gateway is nonetheless directly reachable by any holder of a merchant token, so the effective control is
`verifySiteOwnership` cross-checked against the session-bound `auth.user.storeId`. That is a real check, not a
violation, but it is **application-level only** given §4.3 — there is no DB backstop.

**`PATCH /products/:id` never receives a store scope at all** (`products.ts:1141` passes `auth.user.storeId` to
the staff-permission check, and the product's own `store_id` is only learned inside `getOwnedProduct`). Correct
in intent; entirely dependent on that one lookup, which is currently broken (G-C-01).

---

## 5. CONFIRMED GAPS

### G-C-01 — [HIGH-STAKES] Tenant guard rejects every by-id catalog query; product read/edit/delete/bulk/create-finalise all fail

- **Domain:** catalog core / tenancy
- **Status:** BROKEN
- **Severity:** P0 · **Likelihood:** HIGH · **Reversibility:** reversible (code-only) · **Confidence:** HIGH
- **Impact:** A merchant cannot open, edit, delete, bulk-update, or successfully finish creating a product. CSV
  import fails on every row. Collections and smart collections cannot be edited or deleted.
- **Evidence:**
  - `services/api-gateway/src/lib/supabase.ts:13-19` — every handler's `db` is
    `createTenantGuardedSupabaseClient(createSupabaseServiceClient(env))`.
  - `services/api-gateway/src/tenant/tenant-scoped.ts:52-77` `markScopeFromCall` marks a query "scoped" **only**
    when `eq`/`in`/`filter`/`match`/`or`/`insert`/`upsert` references a column in `entry.scopeColumns`.
    `update` is not handled; `id` is only added to the allowed set for the `sites` table (:42-45).
  - `tenant-scoped.ts:86-95` — if not scoped, the `then` trap returns a rejected promise.
  - `tenant-tables.registry.ts:1737-1746` — `products` scopeColumns `["site_id","store_id"]`.
    `:546` — `collections` scopeColumns `["store_id"]`. `:2445` — `smart_collections`.
  - Offending call sites (all lack a `site_id`/`store_id` predicate):
    - `services/api-gateway/src/routes/products.ts:1074-1081` (`GET /products/:id`)
    - `services/api-gateway/src/execution/product-execution.adapter.ts:330-335` (`getOwnedProduct` → PATCH + DELETE)
    - `services/api-gateway/src/execution/product-execution.adapter.ts:259-263` (`bulkAction`, `.in('id', …)`)
    - `services/api-gateway/src/execution/product-execution.adapter.ts:581-584` (`refreshProductVariantJsonbCache`, `.update({variants}).eq('id', …)`) — **on the create path at :155**
    - `services/api-gateway/src/execution/product-execution.adapter.ts:180-185` (updateProduct `.update().eq('id')`)
    - `services/api-gateway/src/routes/products.ts:689-697, 722-730, 945-953` (collections load/update/soft-delete)
    - `services/api-gateway/src/routes/smart-collections.ts:160-165, 205-210, 227-232`
    - `services/api-gateway/src/routes/categories.ts:243-246` (`products.update({category_id:null}).eq('category_id', …)`)
- **Runtime reproduction (RUNTIME_OBSERVATION):** I imported the **real** `createTenantGuardedSupabaseClient` and
  the **real** generated registry into a scratch harness and drove it with a chainable thenable standing in for a
  PostgREST builder. Result:
  ```
  FAIL products GET /:id   .select().eq('id').is().single()          -> Tenant table products requires a tenant/owner predicate before execution
  FAIL products update     .update().eq('id').select().single()      -> Tenant table products requires ...
  OK   products list       .select().in('store_id', [...])
  OK   products insert     .insert({store_id})
  FAIL collections         .select().eq('id')                        -> Tenant table collections requires ...
  FAIL collections         .update().eq('id')                        -> Tenant table collections requires ...
  OK   product_variants    .select().eq('product_id')                (not in registry — unguarded)
  OK   collection_products .delete().eq('collection_id')             (not in registry — unguarded)
  FAIL media_assets        .select().eq('id')                        -> Tenant table media_assets requires ...
  ```
  The rejected promise is produced by `tenant-scoped.ts:90-92`; `await` therefore **throws** rather than
  returning `{data, error}`, so the routes' `if (error)` branches never run and the handler 500s.
- **Expected:** by-id reads/writes on a tenant table resolve the tenant first (e.g. `.eq('store_id', ownedStoreId)`
  alongside `.eq('id', …)`), or the guard accepts a two-step ownership pattern.
- **Root cause:** `214b6357 feat(foundation): enforce wave 2 tenant isolation` introduced the fail-closed guard;
  `products.ts` / `product-execution.adapter.ts` were never adapted to it. The only test of the guard
  (`tests/governance/foundation-wave2-tenant.test.ts:58-76`) exercises the guard against a synthetic
  `.select('*').eq(scopeColumn, …)` shape — it never runs a real route's query shape, so the regression is invisible.
- **Blast radius:** all product CRUD, collections, smart collections, categories delete, CSV import, sample
  product; likely other domains using the same by-id pattern on registered tenant tables (out of my scope — flag
  to the commander for orders/customers/coupons).
- **Dependencies:** none.
- **Remediation approach:** carry the resolved owning `store_id` into every by-id query (resolve ownership first,
  then filter by both `id` and `store_id`), or extend the guard so a `.eq('id', …)` on a registered table is
  accepted only when the handler has already proven ownership through an explicit, auditable helper. Do not
  weaken the guard globally.
- **Acceptance criteria:** `GET/PATCH/DELETE /v1/products/:id`, `POST /v1/products`, `POST /v1/products/bulk`,
  `PATCH/DELETE /v1/products/collections/:id`, `PATCH /v1/smart-collections/:id` all succeed for the owner and
  return 404/403 for a non-owner, executed against a real Postgres instance.
- **Required tests:** executable integration tests (not regex) that run each route handler against a live
  Postgres/PostgREST with the guard installed, plus a cross-tenant negative case per route.
- **Required owner:** lead engineer + security.

### G-C-02 — [HIGH-STAKES] Storefront product-detail endpoint selects columns that do not exist

- **Domain:** catalog → storefront
- **Status:** BROKEN
- **Severity:** P0 · **Likelihood:** HIGH · **Reversibility:** reversible · **Confidence:** MEDIUM-HIGH
- **Impact:** Shoppers cannot open any product page; the storefront PDP returns 404.
- **Evidence:**
  - `services/api-gateway/src/routes/storefront/public-routes.ts:31-33`
    ```
    const PRODUCT_SELECT_FULL: string =
      'id,store_id,name,slug,description,short_description,price,compare_at_price,cost_price,sku,barcode,
       category_id,brand,product_type,tags,images,featured_image,inventory_quantity,track_inventory,is_active,
       is_featured,weight,dimensions,seo_title,seo_description,created_at,updated_at,variants';
    const PRODUCT_SELECT_FULL_RELATIONAL = PRODUCT_SELECT_FULL.replace(',variants','');
    ```
  - Not one of `short_description`, `compare_at_price`, `category_id`, `brand`, `featured_image`,
    `inventory_quantity`, `dimensions` exists on `products` — verified against `000_baseline.sql:10583-10627`
    and the only two subsequent alterations (`157_product_metadata.sql:4,15`, which add `metadata` alone).
  - `public-routes.ts:833-839` uses `PRODUCT_SELECT_FULL_RELATIONAL` **with no fallback cascade**:
    `const { data } = await db.from('products').select(…).eq('store_id', store.id).or(…).eq('is_active',true).single();`
    then `:840` `if (!data) return 404`. The PostgREST error is discarded.
  - The flag that selects this branch is on by default in all three environments:
    `services/api-gateway/wrangler.toml:51, 142, 268` → `PRODUCT_VARIANTS_RELATIONAL_READS = "on"`; default in code
    `storefront.ts:429` / `products.ts:153-155` is also `'on'`.
  - Consumer: `apps/storefront-runtime/src/lib/product-service.ts:66-80` →
    `packages/typescript/api-client/src/index.ts:5422-5423` → `/storefront/{subdomain}/products/{slug}`.
  - Contrast: `services/api-gateway/src/routes/storefront.ts:352-359` defines a **different** `PRODUCT_SELECT_FULL`
    for the same table (with `currency,quantity,stock_quantity,avg_rating,review_count`, also non-existent) but
    guards it with a 4-attempt cascade at `storefront.ts:1064-1108`.
- **Missing link:** the detail route has no column-fallback cascade and no error handling.
- **Confidence caveat:** I could not query the deployed database (production forbidden, no credentials). If the
  live schema has drifted *ahead* of the migrations and these columns exist there, the endpoint works in
  production and the repository's migration set is instead wrong. Either way this is a defect. **UNKNOWN which.**
- **Remediation approach:** make the PDP select the columns the canonical schema actually defines (reuse the
  vetted `storefront.ts` cascade or a single verified column list), surface the PostgREST error instead of
  swallowing it, and add a schema-conformance validator that asserts every hard-coded `select(...)` column list
  against the migration DDL.
- **Acceptance criteria:** `GET /v1/storefront/{handle}/products/{slug}` returns 200 with the product for a
  published store, executed against real Postgres; a synthetic missing-column case returns 500 with a logged
  error, never a silent 404.
- **Required tests:** executable PDP integration test + a `select`-column-vs-DDL conformance validator.
- **Required owner:** lead engineer.

### G-C-03 — [HIGH-STAKES] Storefront product list degrades to a select that drops the `is_active` and `deleted_at` filters

- **Domain:** catalog → storefront
- **Status:** BROKEN
- **Severity:** P0 · **Likelihood:** HIGH · **Reversibility:** reversible · **Confidence:** MEDIUM-HIGH
- **Impact:** Draft and soft-deleted products can be published to shoppers.
- **Evidence:** `services/api-gateway/src/routes/storefront.ts:1063-1101`
  ```
  const attempts = [
    { select: PRODUCT_SELECT_FULL(_RELATIONAL),   useDeletedAt: true,  useActive: true,  orderBy:'display_order' },
    { select: PRODUCT_SELECT_COMPAT(_RELATIONAL), useDeletedAt: true,  useActive: true,  orderBy:'display_order' },
    { select: PRODUCT_SELECT_COMPAT(_RELATIONAL), useDeletedAt: false, useActive: true,  orderBy:'display_order' },
    { select: PRODUCT_SELECT_MINIMAL,             useDeletedAt: false, useActive: false, orderBy:'created_at'    },
  ];
  …
  if (attempt.useActive)    query = query.eq('is_active', true);   // :1076
  if (attempt.useDeletedAt) query = query.is('deleted_at', null);  // :1077
  …
  if (!isSchemaMismatchError(result.error)) break;                 // :1100 — a missing column IS a schema mismatch
  ```
  - `PRODUCT_SELECT_FULL` `storefront.ts:353` requires `currency, quantity, stock_quantity, avg_rating, review_count`;
    `PRODUCT_SELECT_COMPAT` :355 still requires `currency, quantity`. **None of these five columns exists on
    `products`** (`000_baseline.sql:10583-10627`, plus `157_product_metadata.sql` adding only `metadata`).
  - `isSchemaMismatchError` `storefront.ts:441-444` matches `does not exist` → the loop advances instead of breaking.
  - Therefore attempts 1-3 fail and attempt 4 (`PRODUCT_SELECT_MINIMAL`, :356) succeeds — and attempt 4 applies
    **neither** `is_active = true` **nor** `deleted_at IS NULL`.
  - The pooled-SQL fast path `storefront.ts:689-738` uses the same broken column list and swallows failures with
    `.catch(() => null)` :728, so it always falls through to the cascade.
  - Attempt 4 also drops `slug`, `compare_price`, `stock`, `is_featured`, `status`, `display_order`, `variants`.
- **Same caveat as G-C-02** regarding possible live-schema drift. UNKNOWN.
- **Remediation approach:** never let a degraded select relax a **security or visibility** predicate. Split the
  cascade so column availability and row filters are independent, and fail closed (return an error) rather than
  publishing unfiltered rows.
- **Acceptance criteria:** a draft product and a soft-deleted product are absent from
  `GET /v1/storefront/{handle}/products` under every attempt branch, proven by an executable test that forces
  each branch.
- **Required owner:** lead engineer + security.

### G-C-04 — Storefront cache is never invalidated by any catalog mutation

- **Domain:** catalog → storefront propagation
- **Status:** NOT_IMPLEMENTED
- **Severity:** P1 · **Likelihood:** HIGH · **Reversibility:** reversible · **Confidence:** HIGH
- **Impact:** After a merchant publishes, edits, re-prices, unpublishes, or deletes a product, the storefront
  keeps serving the old state. A price correction or an unpublish is not honoured immediately; there is no manual
  refresh control.
- **Evidence:**
  - `services/api-gateway/src/lib/storefront-cache.ts:12-13` — `TTL 60s`, `SWR 300s`; `:24-26` emits
    `public, max-age=60, stale-while-revalidate=300`.
  - `:83-90` `bumpStorefrontCacheVersion` — the only invalidation primitive.
  - `grep -rn "bumpStorefrontCacheVersion" services/ apps/` → **one** caller: `routes/themes.ts:154`.
  - `grep -rn "purgeStorefrontCache" services/` → `themes.ts:155` only, and it purges only the literal
    version-`0` bootstrap key (`storefrontCacheKey('storefront-rest','bootstrap','0',handle)`).
  - `products.ts`, `categories.ts`, `smart-collections.ts`, `export.ts` do not import `lib/storefront-cache`.
  - Cached catalog endpoints: `public-routes.ts:571, 763, 797, 823, 923, 1005`.
  - Next.js layer: `apps/storefront-runtime/src/lib/api/client.ts:24-30` declares cache tags;
    `product-service.ts:9-10` sets 60 s / 30 s. `grep -rn "revalidateTag" apps/ services/ packages/` → **zero hits**
    — the tags are inert.
- **Remediation approach:** bump the per-handle storefront cache version on every product / collection /
  smart-collection / category mutation (create, update, bulk, delete, import completion), and drive the Next.js
  layer from the same signal (tag revalidation or a version-carrying key). Prefer a single publish-side hook in
  the product execution adapter so no route can forget it.
- **Acceptance criteria:** a product publish is visible on the storefront within one request, verified by an
  executable test that mutates then immediately reads the public endpoint.
- **Required owner:** lead engineer.

### G-C-05 — Product list is capped at 100 rows with client-side search and sort and no pagination

- **Domain:** catalog merchant UX
- **Status:** BROKEN (at scale) · **Severity:** P1 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Impact:** A merchant with more than 100 products cannot see, search, sort, or edit products 101+.
- **Evidence:** `apps/merchant-control-plane/src/app/[store]/products/page.tsx:100-105` (fixed
  `limit:'100'`, no `search`, no `page`, no `cursor`), `:194-205` (client `Array.filter` search),
  `:207-210` (client `Array.sort`), no pagination control in the file. The gateway already supports it:
  `services/api-gateway/src/routes/products.ts:440-532` (cursor + offset + `search` ilike + sort enum).
- **Remediation approach:** move search/sort/pagination to the server using the existing query params and cursor.
- **Required owner:** lead engineer.

### G-C-06 — No per-site uniqueness on SKU, barcode, slug, or url_handle

- **Domain:** catalog data integrity
- **Status:** NOT_IMPLEMENTED · **Severity:** P1 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Impact:** Duplicate SKUs and barcodes inside one store; barcode scanning returns "not found" on a duplicate;
  duplicate slugs make the storefront PDP 404 for one of them; two products can own the same public URL.
- **Evidence:** §3 above — full index/constraint sweep. Failure modes proven at
  `products.ts:242-266`, `products.ts:268-308`, `products.ts:387-401`,
  `storefront/public-routes.ts:837`.
- **Remediation approach:** add partial unique indexes scoped to the site and excluding soft-deleted rows
  (e.g. `(store_id, lower(sku)) WHERE sku IS NOT NULL AND deleted_at IS NULL`, likewise for `url_handle`/`slug`
  and `barcode`, and `(product_id, sku)` / a site-scoped variant barcode index), with a data-cleanup migration
  and a merchant-facing conflict error. Do **not** ship the index without first reconciling existing duplicates.
- **Required tests:** migration test asserting the constraint, plus a route test asserting a 409 on conflict.
- **Required owner:** lead engineer + ARB (schema change).

### G-C-07 — Collection product picker requests `limit=200`, which the gateway rejects with 400

- **Domain:** collections · **Status:** BROKEN · **Severity:** P1 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Impact:** The "add products to collection" picker cannot load the catalog.
- **Evidence:** `apps/merchant-control-plane/src/app/[store]/products/collections/page.tsx:217`
  (`.../products?limit=200`) → proxy passes it through `apps/merchant-control-plane/src/app/api/stores/[store]/products/route.ts:27`
  → `ListProductsQuery.limit` is `.max(100)` (`packages/commerce-core/src/index.ts:105`) →
  `services/api-gateway/src/middleware/validation.ts:58-60` returns 400.
- **Remediation approach:** paginate the picker (or use `/v1/resource-search?type=product`, which already exists at
  `services/api-gateway/src/routes/resource-search.ts:253` and caps at 50).
- **Required owner:** lead engineer.

### G-C-08 — "Archived" product state does not exist; Draft and Archived are the same rows

- **Domain:** catalog lifecycle · **Status:** BROKEN · **Severity:** P2 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Evidence:** UI offers Archived (`products/page.tsx:24-29, 32-36`); `UpdateProductSchema`
  (`commerce-core:64-97`) has no `status` field so zod strips it; `planProductUpdate:1190-1192` derives
  `status = is_active ? 'active' : 'draft'`; proxy `normalizeStatus` (`products/route.ts:6-10`) folds
  `draft|inactive|archived` into `inactive`; the gateway enum is `active|inactive|all` (`commerce-core:101`);
  the client does not re-filter by tab (`products/page.tsx:194-205`).
- **Remediation approach:** decide whether `archived` is a real lifecycle state; if yes, model it explicitly in
  the DB status check, the update schema, and the list filter — or remove the tab.
- **Required owner:** founder (product decision) then lead engineer.

### G-C-09 — Optimistic concurrency is a facade; concurrent edits silently lose data

- **Domain:** catalog integrity · **Status:** PARTIAL · **Severity:** P2 · **Likelihood:** MEDIUM · **Confidence:** HIGH
- **Evidence:** `UpdateProductSchema` accepts `version` (`commerce-core:96`, message "Version is required"), but
  `version` is absent from `PRODUCT_UPDATE_FIELDS` (:603-633) and `planProductUpdate` (:1179-1208) never compares
  it; `ProductExecutionAdapter.updateProduct` (`product-execution.adapter.ts:164-223`) issues an unconditional
  `.update()`. The DB trigger `trg_products_version` (`000_baseline.sql:19561`) increments the column, and
  `products.ts:75` selects it — nothing enforces it.
- **Remediation approach:** either enforce `.eq('version', body.version)` and return 409 on a zero-row update, or
  remove `version` from the public schema so the contract stops implying protection it does not give.
- **Required owner:** lead engineer.

### G-C-10 — Non-Latin product names produce an empty slug and empty url_handle; renames destroy handles

- **Domain:** catalog / SEO / India-first · **Status:** BROKEN · **Severity:** P2 · **Likelihood:** MEDIUM · **Confidence:** HIGH
- **Evidence:** `generateProductSlug` `packages/commerce-core/src/index.ts:787-794` strips `[^a-z0-9\s-]` after
  `toLowerCase()`, so a Devanagari/Tamil/Bengali/Gujarati name yields `''`; `planProductCreate:1133, 1165` then
  stores `slug: ''` and `url_handle: '' || '' = ''`. `planProductUpdate:1186-1188` regenerates `url_handle` from
  the name whenever the name changes and `url_handle` was not explicitly supplied.
- **Impact:** India-first stores selling under regional-language names get blank handles (colliding across the
  whole store, cf. G-C-06) and unstable public URLs after any rename.
- **Remediation approach:** transliterate or fall back to a stable generated token when the slugified name is
  empty; never silently regenerate a handle that already exists — treat handle changes as an explicit merchant
  action with a redirect record.
- **Required owner:** lead engineer + founder (URL/redirect policy).

### G-C-11 — Variant barcode, weight, weight unit and image are read but never written

- **Domain:** variants · **Status:** PARTIAL · **Severity:** P2 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Evidence:** `product_variants` DDL has `barcode, weight, weight_unit, image_url` (`000_baseline.sql:10512+`);
  `ProductVariantSchema` accepts `barcode` (`commerce-core:8`); read paths surface all four
  (`products.ts:183-202`, `product-execution.adapter.ts:561-579`); **both** write paths omit them —
  `normalizeProductVariant` `product-execution.adapter.ts:590-609` and the legacy path :519-535, and the update
  statement :457-468 lists only title/price/compare_price/sku/inventory_qty/option1-3/position.
- **Impact:** Per-variant barcodes entered by a merchant are silently discarded, so variant barcode scanning
  (`products.ts:268-308`) can never match anything a merchant entered through the product form.
- **Required owner:** lead engineer.

### G-C-12 — Media library rows are best-effort; product images have no alt text and no ordering

- **Domain:** media · **Status:** PARTIAL · **Severity:** P2 · **Likelihood:** MEDIUM · **Confidence:** HIGH
- **Evidence:** `apps/merchant-control-plane/src/app/api/stores/[store]/upload/route.ts:32-40` —
  `apiClient.media.create({...}).catch(() => null)`: a failed library write is swallowed, so R2 objects can exist
  with no `media` row (orphan storage, no reconciliation job found).
  `media` has an `alt_text` column (`services/api-gateway/src/routes/media.ts:29`) but `products.images` is a bare
  `text[]` and the product form (`products/new/page.tsx:465-516, 801-866`) offers **no alt text field and no
  reorder control** — only append and remove. `products.thumbnail_url` is never written by any code path.
- **Impact:** accessibility and image SEO gap; merchant cannot choose the primary image.
- **Required owner:** lead engineer + design.

### G-C-13 — Categories: full UI and gateway over a table that does not exist

- **Domain:** categories · **Status:** NOT_IMPLEMENTED (data) + UI_ONLY + BROKEN (gateway) · **Severity:** P1 ·
  **Likelihood:** HIGH · **Confidence:** HIGH
- **Evidence:** §2.9. `grep -rn "product_categories" database/` → only `194_demo_requests.sql:45` (an unrelated
  `text[]` column). `products.category_id` does not exist, yet `categories.ts:174` embeds `products(count)` and
  `:243-246` updates `products.category_id`. Storefront `public-routes.ts:1014` reads the same missing table and
  returns an empty list with the error discarded.
- **Impact:** A merchant can navigate to Categories, fill the form, and get a 503; the storefront category grid is
  permanently empty. Meanwhile `products.category` (free text) is the de-facto taxonomy and has no management UI.
- **Remediation approach:** founder decision — either implement `product_categories` + `products.category_id`
  properly (migration, RLS, tenant-registry regeneration, FK) or delete the Categories UI and gateway route and
  make `products.category` / collections the single merchandising taxonomy. Do not leave both.
- **Required owner:** founder + ARB (new tenant table) + lead engineer.

### G-C-14 — Smart collections never materialise and are invisible to shoppers; no delete

- **Domain:** merchandising · **Status:** UI_ONLY / BACKEND_ONLY · **Severity:** P1 · **Likelihood:** HIGH ·
  **Confidence:** HIGH
- **Evidence:** §2.8. No storefront route reads `smart_collections`; no writer populates `collection_products`
  from smart-collection conditions; `smart-collections.ts` has no `router.delete`; evaluation is capped at 500
  products in memory (`smart-collections.ts:22, 245-251`).
- **Impact:** a 606-line merchant UI that produces nothing a customer can see.
- **Required owner:** founder (scope) + lead engineer.

### G-C-15 — CSV import cannot carry SKU, barcode, HSN, variants, or SEO; no upsert, no result reporting

- **Domain:** bulk operations / GST · **Status:** BROKEN · **Severity:** P1 · **Likelihood:** HIGH ·
  **Confidence:** HIGH
- **Evidence:** §2.12. Columns parsed: `export.ts:608-614`. Always-create: `:622-632`. `waitUntil` sequential
  processing: `:810`, `:621`. UI never polls: `export/page.tsx:326-337`, and no `/v1/export/jobs/:id` proxy
  exists. Cap 500 rows: `export.ts:119`.
- **HSN specifically:** `products.hsn_code` is GST-critical (format CHECK in `000_baseline.sql`, index
  `idx_products_store_hsn` :18081), is accepted by `CreateProductSchema:50`, **and is importable by no CSV
  column, exportable by no CSV header (`export.ts:83`), and enterable in no merchant UI field**
  (`grep -rni "hsn" apps/merchant-control-plane/src` → one keyword string in
  `components/settings/settings-navigation.ts:127`). Tag: **[HIGH-STAKES]** (GST).
- **Remediation approach:** define one canonical product CSV contract covering the GST + identity fields, make
  export and import use the same header set, key the import on `(store_id, sku)` for upsert, add a dry-run
  validation pass with a per-row error report, and surface job status in the UI. Move the processing off the
  request worker if the row cap grows.
- **Required owner:** founder (contract) + lead engineer + CA-tax (HSN field semantics).

### G-C-16 — Merchant CSV export is a browser-side dump of the first 100 products; the real export pipeline is unreachable

- **Domain:** bulk operations · **Status:** CONTRADICTORY_EVIDENCE / PARTIAL · **Severity:** P2 ·
  **Likelihood:** HIGH · **Confidence:** HIGH
- **Evidence:** §2.13. `export/page.tsx:151` (`?limit=100`), `:83-91` (`downloadCsv` Blob), vs the unused
  `services/api-gateway/src/routes/export.ts:686-704` job pipeline with R2 streaming and signed download
  (`:656-684`). No merchant proxy for `/v1/export/*`.
- **Required owner:** lead engineer.

### G-C-17 — Metafields: complete backend, no product-level UI, and the shipped UI states the backend does not exist

- **Domain:** metafields · **Status:** BACKEND_ONLY + CONTRADICTORY_EVIDENCE · **Severity:** P2 ·
  **Likelihood:** HIGH · **Confidence:** HIGH
- **Evidence:** §2.11. `services/api-gateway/src/routes/metafields.ts` (501 lines, 8 handlers, tables from
  `138_mobile_store_metafields.sql`) vs
  `apps/merchant-control-plane/src/app/[store]/settings/custom-data/page.tsx` rendering `BackendNeededPane` with
  `'No metafields, metaobjects, or custom-data gateway route was found in current services/packages.'`
- **Required owner:** lead engineer (and a doc-accuracy sweep of every `BackendNeededPane` claim).

### G-C-18 — [HIGH-STAKES] Catalog money is float rupees, contradicting the bigint-paise invariant

- **Domain:** money representation · **Status:** IMPLEMENTED_NOT_RUNTIME_VERIFIED (as a deviation) ·
  **Severity:** P1 · **Likelihood:** HIGH · **Reversibility:** **partially irreversible** (data migration of
  every existing price) · **Confidence:** HIGH
- **Evidence:** §4.1.
- **Remediation approach:** ARB decision on whether the catalog price is in scope for the minor-unit invariant.
  If yes: introduce `*_minor bigint` columns, dual-write, backfill, cut reads over, then drop the numeric columns
  — never an in-place type change on live money data. In the interim, at minimum constrain `MoneySchema` to two
  decimal places so silent rounding stops.
- **Required owner:** ARB + founder + lead engineer.

### G-C-19 — Bulk product endpoint exists but the UI does N sequential PATCHes

- **Domain:** bulk operations · **Status:** PARTIAL · **Severity:** P2 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Evidence:** `services/api-gateway/src/routes/products.ts:1157-1185` and
  `packages/typescript/api-client/src/index.ts:4792-4793` expose bulk; the list page loops one PATCH per row
  (`apps/merchant-control-plane/src/app/[store]/products/page.tsx:161-192`) and counts failures client-side, so a
  bulk publish can end half-applied with only a warning toast.
- **Required owner:** lead engineer.

### G-C-20 — `products.site_id` is the declared tenant column and is never populated

- **Domain:** tenancy · **Status:** BROKEN (latent) · **Severity:** P2 · **Likelihood:** MEDIUM ·
  **Confidence:** HIGH · Tag **[HIGH-STAKES]**
- **Evidence:** §4.2.
- **Remediation approach:** pick one tenant column for `products` and make the generator, the registry, the
  writers, the indexes and the RLS policies agree. Backfill under ARB review; do not change RLS semantics until
  the backfill is verified.
- **Required owner:** ARB + lead engineer.

### G-C-21 — `products` has RLS ENABLE but not FORCE, and retains PUBLIC-scoped legacy policies

- **Domain:** tenancy/RLS · **Status:** PARTIAL · **Severity:** P2 · **Likelihood:** MEDIUM ·
  **Confidence:** HIGH · Tag **[HIGH-STAKES]**
- **Evidence:** §4.3 — `000_baseline.sql:25556` (ENABLE only); no `products FORCE` anywhere in 56 FORCE statements;
  `164_d4_tenant_role_guc.sql:87-88, 110-111` FORCEs the child tables but not the parent;
  `000_baseline.sql:27148` `store_owner_products` and `:25838` `public_view_active_products` have no `TO` clause.
- **Required owner:** security + ARB.

### G-C-22 — Every catalog test is a regex over source text

- **Domain:** test integrity · **Status:** STUB_OR_MOCK · **Severity:** P1 · **Likelihood:** HIGH ·
  **Confidence:** HIGH
- **Evidence:**
  - `services/api-gateway/src/__tests__/products.test.ts:1-103` — `readFileSync` + `assert.match` only. It asserts
    `/\.eq\('id',\s*productId\)/` **exists**, i.e. it actively pins the exact pattern that G-C-01 proves is broken.
  - `tests/launch/lb6-collections.test.mjs:1-40` — `read(path)` + `assert.match`, despite the header comment
    "collections end-to-end structural tests".
  - `tests/launch/lb5-variants.test.mjs:1-30` — same shape.
  - `services/api-gateway/src/__tests__/sample-products.test.ts` (45 lines) and
    `production-schema-drift-resilience.test.ts` (45 lines) — same shape.
  - `tests/governance/foundation-wave2-tenant.test.ts:58-90` executes the guard, but only against a synthetic
    `.select('*').eq(scopeColumn, …)` shape — never a real route query shape.
- **Impact:** none of the catalog defects above can be caught by CI. Green tests are not evidence of a working
  catalog.
- **Remediation approach:** add executable integration tests against a real Postgres (the repo already has
  `tests/executable/*-postgres.test.mjs` harnesses) for product CRUD, collection assignment, storefront PDP and
  list visibility, and CSV import; keep the regex tests only as an architecture-shape gate, clearly renamed so
  they stop reading as behavioural coverage.
- **Required owner:** lead engineer.

---

## 6. CONTRADICTIONS

1. **Two different `PRODUCT_SELECT_FULL` definitions for the same table**, both listing non-existent columns, one
   with a fallback cascade and one without: `services/api-gateway/src/routes/storefront.ts:352-359` vs
   `services/api-gateway/src/routes/storefront/public-routes.ts:31-33`.
2. **`custom-data` UI asserts no metafields backend exists** while `services/api-gateway/src/routes/metafields.ts`
   (501 lines) implements it — `apps/merchant-control-plane/src/app/[store]/settings/custom-data/page.tsx`.
3. **Two competing CSV export implementations**, only the weaker one reachable (G-C-16).
4. **Tenant registry declares `products.tenantColumn = "site_id"`** while every writer writes only `store_id`
   (`tenant-tables.registry.ts:1737-1746` vs `commerce-core/src/index.ts:1141-1175`).
5. **`products.test.ts` pins the exact query shape the tenant guard rejects** — the test suite encodes the bug as
   the contract (`__tests__/products.test.ts:37` vs `tenant/tenant-scoped.ts:60-62`).
6. **Extensive "missing column / missing table" defensive fallbacks** across `products.ts`, `categories.ts`,
   `storefront.ts` imply the deployed schema is known to differ from the migrations, but no document states which
   environments differ or how. This is itself an unresolved contradiction between the migration set and runtime
   reality.
7. **Root `AGENTS.md` "current max migration 161"** vs `database/supabase/migrations/` containing 187 files up to
   `195_*` (commander-verified; catalog-relevant ones cited above are 157, 163, 164, 170-172, 191, 194).

---

## 7. UNKNOWNS (honest)

- **U-1.** Whether the *deployed* Supabase schema contains the columns the code selects but the migrations do not
  define (`short_description`, `compare_at_price`, `category_id`, `brand`, `featured_image`,
  `inventory_quantity`, `dimensions`, `currency`, `quantity`, `stock_quantity`, `avg_rating`, `review_count`) and
  whether `product_categories` exists there. Cannot be answered without a read-only staging connection —
  **BLOCKED_EXTERNAL**. This determines whether G-C-02 / G-C-03 / G-C-13 manifest in production or whether the
  migration set is the thing that is wrong.
- **U-2.** Whether the tenant guard failures in G-C-01 are already visible as 500s in production logs. No
  observability access — **BLOCKED_EXTERNAL**.
- **U-3.** Whether `PRODUCT_VARIANTS_RELATIONAL_READS` or `PRODUCT_VARIANT_DIFF` are overridden at deploy time by
  a secret/var not present in `wrangler.toml`. Repo evidence says `"on"` for all three environments
  (`services/api-gateway/wrangler.toml:51,142,268`).
- **U-4.** Whether `getPooledSql` is configured in any environment (I did not trace its binding), which changes
  whether the storefront list uses the raw-SQL path or the Supabase cascade in G-C-03.
- **U-5.** Whether any queue worker or projection materialises smart collections outside the paths I searched
  (I searched `services/api-gateway/src` and `apps/storefront-runtime/src`; I did **not** exhaustively read
  `services/queue-workers`). Flagging for the agent owning workers.
- **U-6.** Product review moderation, wishlist and `search_documents` projection interactions with catalog
  publish state — out of my assigned scope; `querySearchDocumentProductIds` (`storefront.ts:1034-1052`) is a
  separate search-index read path I did not audit.
- **U-7.** Whether `media_assets` vs `media` are both live or one is legacy — both are in the tenant registry
  (`:1219`, `:1230`) with different tenant columns (`store_id` vs `site_id`).

---

## 8. BLOCKERS

- **B-1 (BLOCKED_EXTERNAL).** No read-only staging database access → cannot resolve U-1, which gates the severity
  of G-C-02, G-C-03, G-C-13 and the "defensive fallback" contradiction (#6).
- **B-2 (BLOCKED_EXTERNAL).** No runtime environment (no worker dev server started, production forbidden) →
  nothing in this report can be marked `VERIFIED_E2E`. The single runtime observation I made is of the tenant
  guard module in isolation (G-C-01), not of a live HTTP request.
- **B-3.** `services/queue-workers` was not read; any catalog-side effect implemented there is unassessed.

---

## 9. STATUS SUMMARY (taxonomy)

| Capability | Status |
|---|---|
| Create product | BROKEN |
| Edit product | BROKEN |
| Read single product (merchant) | BROKEN |
| List products (gateway) | IMPLEMENTED_NOT_RUNTIME_VERIFIED |
| List products (merchant UI, >100) | BROKEN |
| Delete / soft delete | BROKEN |
| Bulk activate/deactivate/delete (gateway) | BROKEN |
| Bulk from UI | PARTIAL (N sequential PATCHes) |
| Duplicate product | NOT_IMPLEMENTED |
| Variants / options matrix | PARTIAL |
| Variant barcode / weight / image | NOT_IMPLEMENTED (write) |
| Media upload | IMPLEMENTED_NOT_RUNTIME_VERIFIED |
| Media alt text | NOT_IMPLEMENTED |
| Media ordering / primary image | NOT_IMPLEMENTED |
| Media library row creation | PARTIAL (best-effort) |
| Publish / unpublish | PARTIAL |
| Archive | BROKEN |
| Collections (manual) — create/assign | PARTIAL |
| Collections — edit/delete | BROKEN |
| Collections — picker | BROKEN |
| Collections — storefront SEO handle | NOT_IMPLEMENTED |
| Smart collections | UI_ONLY (no materialisation, no storefront, no delete) |
| Categories | NOT_IMPLEMENTED (data) / UI_ONLY / BROKEN |
| Tags | PARTIAL |
| Metafields | BACKEND_ONLY |
| CSV import | BROKEN |
| CSV export (merchant path) | PARTIAL |
| CSV export (gateway job pipeline) | IMPLEMENTED_NOT_RUNTIME_VERIFIED, unreachable |
| Server-side search/filter/sort | BACKEND_ONLY |
| Pagination on catalog list endpoints | PARTIAL (products yes; collections/categories/smart-collections no) |
| SEO title/description → storefront | IMPLEMENTED_NOT_RUNTIME_VERIFIED |
| SEO handle → storefront URL | NOT_IMPLEMENTED |
| Per-site uniqueness (SKU/handle/barcode) | NOT_IMPLEMENTED |
| Storefront propagation / cache invalidation | NOT_IMPLEMENTED |
| Storefront product detail | BROKEN |
| Storefront product list visibility filters | BROKEN |
| Money in minor units (catalog) | CONTRADICTORY_EVIDENCE vs ART-10/R-5 → deviation |
| Reserved `services/media-service` empty | VERIFIED (static) — compliant |
| Catalog test coverage | STUB_OR_MOCK |

Nothing in this domain qualifies for `VERIFIED_E2E`.
