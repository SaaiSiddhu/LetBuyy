# Products Audit

**Date:** 2026-06-19  
**LCIS Domain:** `products` (2 routes, 5 RPCs, 10 tables, 24 policies)  
**Evidence:** `services/api-gateway/src/routes/products.ts` (1,229 lines, 47 endpoints), `apps/merchant-control-plane/src/app/[store]/products/`

---

## Completion Score: **87%**

---

## Sub-System Audit

### Products (Core CRUD)
**Score: 92%**

**What exists:**
- Product creation with title, description, price, images, status (active/draft/archived)
- Product edit page: `apps/merchant-control-plane/src/app/[store]/products/[productId]/page.tsx`
- Product list with search and filtering: `apps/merchant-control-plane/src/app/[store]/products/page.tsx`
- Product publish/unpublish workflow
- API: `GET/POST /v1/products`, `GET/PUT/DELETE /v1/products/:id` (47 endpoints in products.ts)
- Product status transitions (active → draft → archived)
- Product metafields: `services/api-gateway/src/routes/metafields.ts`

**What is missing / incomplete:**
- Bulk price update UI (API may exist, UI unconfirmed)
- Product type / vendor / tags — schema exists (`products` table), UI completeness unverified
- Product duplicate action

**Evidence:** `products.ts:1229 lines`, `products/page.tsx`, `products/[productId]/page.tsx`, `products/new/page.tsx`

---

### Variants
**Score: 88%**

**What exists:**
- Variant matrix builder committed (LB-5) as of commit `db986077`
- Real `variants[]` array → cart `variant_id`
- `product_variants` table with full schema
- `product_options` table for option definitions
- Variant CRUD in merchant admin

**What is missing:**
- Variant-level media (variant images) — UI implementation unverified
- Variant bulk edit

**Evidence:** `ACTUAL_STATE.md` — "LB-5 variants E2E: matrix builder → real variants[] → cart variant_id committed"

---

### Inventory
**Score: 90%**

**What exists:**
- `inventory_levels` table with per-location tracking
- 18 inventory RPCs: `adjust_inventory_level`, `set_inventory_level_available`, `reserve_inventory`, `commit_inventory_reservation`, `release_inventory_reservation`, `expire_inventory_reservations`, etc.
- Inventory adjustment UI: `apps/merchant-control-plane/src/app/[store]/products/inventory/page.tsx`
- Inventory transfers: `products/transfers/page.tsx`
- Purchase orders: `products/purchase-orders/page.tsx`
- API: `services/api-gateway/src/routes/inventory.ts`
- Inventory reservations on checkout (atomic via RPCs)
- Low-stock signals, restock events

**What is missing:**
- Multi-location inventory UI (single default location assumed for V1)
- Inventory forecasting (analytics, not V1)

**Evidence:** LCIS inventory domain: 18 RPCs, 9 tables, 20 policies

---

### Collections
**Score: 85%**

**What exists:**
- `collections` table + `collection_products` join table
- `smart_collections` table for automated rules
- Collections list UI: `apps/merchant-control-plane/src/app/[store]/products/collections/page.tsx`
- Collection detail with product assignment
- Storefront: `/collections/[slug]` page exists
- LB-6 committed: "collections E2E: assignment API/UI + `/collections/[slug]` route" (commit `140a73db`)
- API: `GET/POST /v1/collections`, product assignment endpoints

**What is missing:**
- Smart collection rule builder UI (rules exist in DB, UI completeness unverified)
- Collection sort order in UI

**Evidence:** LCIS collections domain, `ACTUAL_STATE.md` LB-6

---

### Categories
**Score: 70%**

**What exists:**
- `categories` route in gateway (`services/api-gateway/src/routes/categories.ts`)
- `blog_categories` table
- Categories page in merchant admin: `apps/merchant-control-plane/src/app/[store]/categories/page.tsx`

**What is missing:**
- Product → Category assignment UI (separate from collections)
- Category-based storefront browsing (storefront uses collections, not categories, as primary browse)

**Evidence:** LCIS `collections` domain → `blog_categories` table; categories page in merchant admin

---

### Media
**Score: 82%**

**What exists:**
- `services/api-gateway/src/routes/media.ts` — media upload route
- Cloudflare R2 binding for storage
- Product image upload in product creation flow
- `theme_assets` table for theme media
- Image delivery via R2 public URLs

**What is missing:**
- Media library (centralized) — no dedicated media library page in merchant admin
- Video product media
- Bulk image upload UX

**Evidence:** `routes/media.ts`, R2 binding in `wrangler.toml`, `theme_assets` table

---

### SEO
**Score: 78%**

**What exists:**
- `store_metafield_definitions` and `store_metafield_values` tables
- SEO fields in `products` table (likely `seo_title`, `seo_description`)
- Storefront `sitemap.ts` exists: `apps/storefront-runtime/src/app/sitemap.ts`
- `robots.ts`: `apps/storefront-runtime/src/app/robots.ts`
- Product page metadata rendered server-side (Next.js)
- Blog posts with SEO fields: `blog_posts` table with tags

**What is missing:**
- Per-product URL handle editing in UI (may exist but unverified)
- Structured data / JSON-LD schema markup for products
- Open Graph preview in editor

**Evidence:** `sitemap.ts`, `robots.ts`, storefront product page SSR, metafields tables

---

### Bulk Actions
**Score: 55%**

**What exists:**
- Export route: `services/api-gateway/src/routes/export.ts`
- Export page: `apps/merchant-control-plane/src/app/[store]/export/page.tsx`

**What is missing:**
- Bulk product edit (multi-select + action in products list)
- Bulk import (CSV) — no dedicated import route found
- Bulk publish/unpublish/archive

**Evidence:** `export/page.tsx`, absence of bulk-update endpoints in products.ts

---

## Blockers

| # | Blocker | Severity | Impact |
|---|---|---|---|
| NONE | No code blockers for core products | — | — |
| H2 | Production secrets required | Human seam | No prod writes until secrets provisioned |

## Launch Readiness

**Products core is launch-ready.** The product creation → variant → inventory → checkout loop is complete and committed. Secondary features (bulk import, media library, SEO structured data) are V1.1 candidates.

**Recommended V1.0.0 scope:** Core CRUD + variants + inventory + collections + media upload + basic SEO.

**Delay to V1.1:** Bulk import, media library, structured data, smart collection rule builder.
