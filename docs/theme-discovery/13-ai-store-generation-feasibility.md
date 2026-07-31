# AI Store Generation Feasibility Study

**Date:** 2026-06-18
**Status:** Research synthesis — design document only, no code changes
**Sources:** `services/api-gateway/src/routes/stores.ts`, `themes.ts`, `products.ts`, `pages.ts`, `shipping-tax.ts`, `onboarding.ts`; `apps/identity-platform/src/app/onboarding/page.tsx`; `apps/identity-platform/src/app/api/auth/create-store/route.ts`; `docs/theme-research/09-target-theme-architecture.md`

---

## 1. Current Store Creation Flow

When a merchant signs up today, the following happens:

**Step 1 — Identity platform onboarding (3-step wizard in `apps/identity-platform/src/app/onboarding/page.tsx`)**
- Step 1: Merchant picks a site type (`store`, `landing`, `blog`; only `store` is active/enabled)
- Step 2: Merchant types a display name and subdomain; real-time subdomain validation via `GET /api/auth/validate-subdomain`
- Step 3: Review screen with a "Create My Site" button

**Step 2 — Store creation API call (`POST /api/auth/create-store` → `POST /v1/stores`)**
- The `create-store` Next.js route handler calls `identityApiRequest('/stores', { method: 'POST' })` which proxies to the gateway
- The gateway `POST /stores` handler inserts a `sites` row with:
  - `name`, `subdomain`, `site_type`, `status: 'draft'`
  - `theme_id` (default `'modern'`, passed as `templateId`)
  - `template_config: { templateId, survey: null }` — a bare config skeleton, not a populated theme
  - `locale: 'en-IN'`
- A `store.created` domain event is emitted (queue worker downstream)
- A store-creation welcome email is sent fire-and-forget

**Step 3 — Post-creation redirect**
- Merchant is redirected to `getAdminSelectPlanUrl(subdomain)` — the plan selection page in merchant-control-plane
- No theme is installed, no collections are created, no navigation is set, no policies exist, no products exist

**What the created store contains at this point:**
- A `sites` row with `status: 'draft'`, `theme_id: 'modern'`, and a minimal `template_config`
- Nothing else. The store is an empty shell.

**What a merchant must do manually before launch (current state):**
1. Select and install a theme
2. Add products
3. Create collections and assign products
4. Configure navigation menus
5. Write or accept policy pages (shipping, returns, privacy, terms)
6. Configure shipping zones and rates
7. Configure payment (Razorpay credentials or enable COD)
8. Set business details (GSTIN, legal name, invoice address)
9. Publish the store

---

## 2. What "AI Store Generation" Means

For this study, AI Store Generation is defined as: **given a merchant's industry/niche description at onboarding, automatically configure a complete, launch-ready storefront through the existing API surface — without requiring manual setup steps.**

The concrete scope is:

- The merchant provides a niche or business description (e.g., "I sell consumer electronics — phones, laptops, accessories")
- An AI agent, calling only gateway APIs with the merchant's auth token, configures:
  - Store settings (name, currency, locale, GST details)
  - Theme installation and preset application
  - A set of collections appropriate to the vertical
  - Navigation menus linking to those collections
  - Homepage sections and settings (hero copy, featured collections, announcement bar)
  - Policy pages with vertical-appropriate placeholder copy
  - Shipping zones and rates appropriate to the vertical
- The merchant's store is draft-ready at the end — not published, but review-able and launchable with minimal changes

**Out of scope for this feasibility study:**
- Actual product creation (merchants own their catalog; AI seeding a catalog is a distinct product decision)
- Payment configuration (requires merchant's own Razorpay credentials)
- Domain setup (requires DNS changes by the merchant)
- Plan selection (billing is separate)

---

## 3. System Configuration Requirements

For a complete store, these systems must be configured:

| System | API Exists? | Endpoint | AI-Callable? | Notes |
|---|---|---|---|---|
| Store settings (name, currency, locale, GST) | YES | `PATCH /v1/stores/:id` | YES | Accepts `name`, `description`, `tagline`, `currency`, `locale`, `timezone`, `tax_inclusive`, `legal_name`, `gstin`, `gst_state_code`, `invoice_prefix`, `business_profile` |
| Store publication status | YES | `POST /v1/stores/:id/publish` | YES | Sets `status='published'`, `published_at` |
| Theme installation | YES | `POST /v1/themes/:slug/install` | YES | Installs theme by slug; calls `publish_theme_release` RPC |
| Theme draft/settings update | YES | `PUT /v1/themes/:slug/editor/draft` | YES | Writes `settings_data.current` including section arrangement and colors |
| Theme publish | YES | `POST /v1/themes/:slug/publish` | YES | Promotes draft to live release; triggers cache purge |
| Theme preset application | NO | — | NO | No `POST /themes/:slug/preset` or equivalent endpoint exists. Presets are in `settings_data.presets` but there is no API action to copy a named preset into `settings_data.current`. |
| Collections (create) | YES | `POST /v1/products/collections` | YES | Accepts `store_id`, `title`, `description`, `image_url` |
| Collections (product assignment) | YES | `PUT /v1/products/collections/:id/products` | YES | Replaces product set for a collection |
| Navigation (read) | YES | `GET /v1/pages/navigation?store_id=&location=` | YES | Returns menu + items for a location handle |
| Navigation (replace/write) | YES | `PUT /v1/pages/navigation/:location` | YES | Replaces all items for a named location (e.g., `main`, `footer`); auto-creates `navigation_menus` row if missing |
| CMS pages (create) | YES | `POST /v1/pages` | YES | Creates page in `storefront_pages` with `title`, `slug`, `body`, `page_type`, `status` |
| Policy pages (create/upsert) | YES | `POST /v1/pages/policies` | YES | Upserts by `store_id + policy_type`; types: `shipping_policy`, `return_policy`, `privacy_policy`, `terms_of_service` |
| Homepage sections (configure) | PARTIAL | `PUT /v1/themes/:slug/editor/draft` | PARTIAL | Section content (copy, featured collection IDs) is written via the draft mechanism; however there is no endpoint that accepts a structured "sections list" directly — the AI must construct the full `settings_data` payload matching the theme schema |
| Shipping zones (create) | YES | `POST /shipping/zones` | YES | In `shipping-tax.ts`; accepts zone name, regions |
| Shipping rates (create) | YES | `POST /shipping` | YES | Creates a rate within a zone |
| Tax rates (create) | YES | `POST /taxes` | YES | Creates GST rate entries |
| Products (create) | YES | `POST /v1/products` | YES | Full product creation with variants, inventory, pricing |
| Sample product (seed) | YES | `POST /v1/products/sample` | YES | Creates one labeled inactive sample product on an empty catalog |
| Payment config (Razorpay) | YES | `POST /v1/stores/:id/payment-config` | NO | Requires merchant's own Razorpay `key_id` and `key_secret` — cannot be AI-generated |
| COD enablement | YES | `PATCH /v1/stores/:id` via `cod_enabled` column | UNCERTAIN | `cod_enabled` is returned by the payment-config endpoint but its PATCH path through `UpdateStoreSchema` is unclear; may require a separate payment-config POST |
| Blog posts | YES | `POST /v1/blog` (route file `blog.ts` exists) | UNKNOWN | Not inspected in detail; blog module exists in route list |
| Storefront pages (contact, about) | YES | `POST /v1/pages` with `page_type: 'custom'` | YES | Generic CMS pages |

---

## 4. Per-Vertical Generation Plan

For each vertical, the exact sequence of API calls an AI agent would need to execute:

### Electronics Store

**Input:** "I sell consumer electronics — phones, laptops, accessories"

**Step 1: Store settings**
```
PATCH /v1/stores/:id
{
  "description": "Your go-to destination for smartphones, laptops, and accessories",
  "tagline": "Tech that fits your life",
  "currency": "INR",
  "locale": "en-IN",
  "tax_inclusive": false,
  "timezone": "Asia/Kolkata"
}
```

**Step 2: Theme installation and configuration**
```
POST /v1/themes/urban-kicks/install
{ "store_id": ":id" }

PUT /v1/themes/urban-kicks/editor/draft
{
  "store_id": ":id",
  "settings_data": {
    "current": {
      "primaryColor": "#1e40af",
      "accentColor": "#3b82f6",
      "announcement_bar": { "text": "Free shipping on orders above ₹999", "enabled": true },
      "hero": { "heading": "Premium Electronics. Trusted Prices.", "subheading": "Phones, Laptops, Accessories" }
    }
  }
}

POST /v1/themes/urban-kicks/publish
{ "store_id": ":id" }
```

**Step 3: Collections**
```
POST /v1/products/collections  → { "store_id": ":id", "title": "Smartphones", "description": "Latest mobiles and flagship phones" }
POST /v1/products/collections  → { "store_id": ":id", "title": "Laptops & Computers" }
POST /v1/products/collections  → { "store_id": ":id", "title": "Accessories", "description": "Cases, chargers, cables, earphones" }
POST /v1/products/collections  → { "store_id": ":id", "title": "Deals & Offers" }
```

**Step 4: Navigation**
```
PUT /v1/pages/navigation/main
{
  "store_id": ":id",
  "location": "main",
  "name": "Main menu",
  "items": [
    { "label": "Smartphones", "url": "/collections/smartphones", "target_type": "collection", "sort_order": 0, "is_visible": true },
    { "label": "Laptops", "url": "/collections/laptops-computers", "target_type": "collection", "sort_order": 1, "is_visible": true },
    { "label": "Accessories", "url": "/collections/accessories", "target_type": "collection", "sort_order": 2, "is_visible": true },
    { "label": "Deals", "url": "/collections/deals-offers", "target_type": "collection", "sort_order": 3, "is_visible": true }
  ]
}
```

**Step 5: Homepage sections**
Draft update (Step 2 covers this inline) — the AI must reference `collection_ids` from Step 3 response objects:
- Hero section with electronics-appropriate copy
- Featured collections section pointing to Smartphones + Laptops collection IDs
- Trust badges section (EMI available, warranty, free shipping)
- Newsletter/announcements section

**Step 6: Policy pages**
```
POST /v1/pages/policies → { "store_id": ":id", "policy_type": "return_policy", "title": "Return Policy", "body": "...", "status": "published" }
POST /v1/pages/policies → { "store_id": ":id", "policy_type": "shipping_policy", "title": "Shipping Policy", ... }
POST /v1/pages/policies → { "store_id": ":id", "policy_type": "privacy_policy", "title": "Privacy Policy", ... }
POST /v1/pages/policies → { "store_id": ":id", "policy_type": "terms_of_service", "title": "Terms of Service", ... }
```

**Step 7: Shipping**
```
POST /shipping/zones → { "store_id": ":id", "name": "India Standard", "regions": ["IN"] }
POST /shipping      → { "store_id": ":id", "zone_id": ":zone_id", "name": "Standard Delivery", "price": 99, "min_order_value": 0 }
POST /shipping      → { "store_id": ":id", "zone_id": ":zone_id", "name": "Free Shipping", "price": 0, "min_order_value": 999 }
```

**Step 8: Sample product**
```
POST /v1/products/sample
{ "store_id": ":id" }
```

**Gaps for electronics:**
- No `product-specs` section type in Urban Kicks (Phase D)
- No `comparison-table` section type (Phase D)
- No API to apply a named industry preset in one call — AI must construct the full `settings_data.current` payload manually

---

### Fashion Store

**Input:** "I sell women's fashion — kurtas, dresses, accessories"

**Step 1: Store settings** — `PATCH /v1/stores/:id` with fashion-appropriate description and `"currency": "INR"`

**Step 2: Theme** — Install urban-kicks, draft with `primaryColor: '#7c3aed'` (violet), fashion-appropriate hero copy. Publish.

**Step 3: Collections**
- Kurtas & Suits
- Dresses
- Accessories & Jewellery
- Sale & Clearance
- New Arrivals

**Step 4: Navigation** — `PUT /v1/pages/navigation/main` with collection links as above

**Step 5: Homepage** — Hero + featured collections + lookbook section (no `lookbook` section type exists yet — Phase D gap)

**Step 6: Policy pages** — Return policy (fashion: 7-day exchange), shipping policy, privacy, terms

**Step 7: Shipping** — Standard and express rates

**Gaps for fashion:**
- No `lookbook` section type (Phase D)
- No `size-guide` section type (Phase D)
- No size chart data model — no product attribute field for size charts
- Variant-level color swatch display requires `lb-variant-selector` island (Phase C)

---

### Dairy / Fresh Produce

**Input:** "I sell fresh dairy products — milk, paneer, curd, delivered daily"

**Step 1: Store settings** — description, `timezone: 'Asia/Kolkata'`, COD configuration preferred (fresh goods)

**Step 2: Theme** — Install, draft with `primaryColor: '#15803d'` (green), hero text around freshness/daily delivery

**Step 3: Collections**
- Fresh Milk
- Paneer & Cheese
- Curd & Yogurt
- Ghee & Butter
- Daily Subscriptions (placeholder label only)

**Step 4: Navigation** — Collection links plus "Order Now" CTA

**Step 5: Homepage** — Hero + featured products + delivery guarantee section

**Step 6: Policy pages** — Freshness guarantee (custom page type), shipping policy (same-day delivery copy), returns policy

**Step 7: Shipping** — Local delivery zone, flat-rate delivery pricing

**Gaps for dairy — critical:**
- **Subscriptions domain does not exist** (confirmed in doc 09: "Subscription journey is honestly NOT IMPLEMENTED"). Recurring daily/weekly delivery is the core of a dairy business. No `POST /v1/subscriptions`, no subscription product type, no recurring billing. This is the single largest gap for this vertical and blocks true AI store readiness.
- No `product-freshness` section type (Phase D)
- `lb-delivery-estimate` island (pincode-based ETA) does not exist (Phase D)
- COD enablement path via API is uncertain

---

### Grocery

**Input:** "I run a kirana store — staples, snacks, beverages, household items"

**Step 1: Store settings** — INR, locale, tagline around local/trusted grocery

**Step 2: Theme** — Install, `primaryColor: '#15803d'`, bright product-forward hero

**Step 3: Collections**
- Staples & Grains
- Snacks & Beverages
- Dairy & Eggs
- Household Essentials
- Fresh Fruits & Vegetables

**Step 4: Navigation** — Collection links + contact/about

**Step 5: Homepage** — Hero + featured collections + bundle-deals section (gap: no section type) + announcement bar for same-day delivery

**Step 6: Policy pages** — Returns (grocery: no returns on perishables), shipping policy, privacy, terms

**Step 7: Shipping** — Same-day local delivery zone, minimum order value threshold

**Gaps for grocery:**
- No `bundle-deals` section type (Phase D)
- No `nutrition-table` section type (Phase D)
- No minimum order value enforcement at API level (relies on client-side cart logic)
- No delivery slot / time-window API — `lb-delivery-estimate` is Phase D
- Subscriptions missing (weekly grocery orders)

---

### Furniture

**Input:** "I sell furniture — sofas, beds, wardrobes, dining sets"

**Step 1: Store settings** — INR, description around quality/craftsmanship

**Step 2: Theme** — Install, `primaryColor: '#78350f'` (warm brown), spacious hero layout

**Step 3: Collections**
- Sofas & Seating
- Beds & Mattresses
- Wardrobes & Storage
- Dining & Kitchen
- Home Office

**Step 4: Navigation** — Collection links, About Us, Contact

**Step 5: Homepage** — Hero + featured products + trust section (warranty, assembly service)

**Step 6: Policy pages** — Returns (furniture: damage-on-delivery only), shipping policy (white-glove delivery copy), privacy, terms

**Step 7: Shipping** — Furniture-specific: flat-rate heavy freight (₹499–₹999), free above ₹25,000 threshold

**Gaps for furniture:**
- No `dimensions-panel` section type (Phase D)
- No `material-options` section type (Phase D)
- `lb-delivery-estimate` (pincode-based large-item delivery ETA) does not exist (Phase D)
- No product attribute model for room dimensions, assembly requirements, or material specs
- Pincode serviceability check exists (`GET /shipping/serviceability/:pincode`) but is read-only — no API to configure which pincodes are serviceable per merchant

---

### Restaurant / Food Service

**Input:** "I run a restaurant and want to offer online ordering and delivery"

**Step 1: Store settings** — INR, locale, tagline around food delivery

**Step 2: Theme** — Install, `primaryColor: '#dc2626'` (red/appetite), food-forward hero

**Step 3: Collections**
- Starters & Snacks
- Main Course
- Breads & Rice
- Desserts
- Beverages
- Combos & Meals

**Step 4: Navigation** — "Order Now", menu collections, About, Contact

**Step 5: Homepage** — Hero with order CTA, featured dishes, delivery time badge

**Step 6: Policy pages** — Food safety/allergen notice (custom page), delivery policy, refund policy

**Step 7: Shipping** — Hyper-local delivery zone (specific pincodes), flat delivery charge

**Gaps for restaurant — critical:**
- **No menu/modifier data model.** Restaurants need add-ons, portion sizes, spice levels as variant modifiers. The current product variant model (`option1/option2/option3`) can approximate this but has no structured modifiers concept.
- **No delivery zone by pincode configuration API.** The `shipping/serviceability/:pincode` endpoint reads zone serviceability but there is no API for a merchant to configure which exact pincodes they serve. Delivery zone configuration is UI-only in the merchant-control-plane.
- **No time-slot ordering.** No reservation or delivery slot API.
- No restaurant-specific homepage section type (Phase D consideration)
- Subscriptions missing (meal plan subscriptions)

---

## 5. API Gap Analysis

### APIs That Currently EXIST and Are AI-Callable

Evidence from source files read during this research:

| API | Method | Endpoint | Source File |
|---|---|---|---|
| Create store | POST | `/v1/stores` | `stores.ts:623` |
| Update store settings | PATCH | `/v1/stores/:id` | `stores.ts:687` |
| Publish store | POST | `/v1/stores/:id/publish` | `stores.ts:750` |
| Install theme | POST | `/v1/themes/:slug/install` | `themes.ts:1025` |
| Save theme draft | PUT | `/v1/themes/:slug/editor/draft` | `themes.ts:518` |
| Publish theme | POST | `/v1/themes/:slug/publish` | `themes.ts:557` |
| List theme catalog | GET | `/v1/themes` | `themes.ts:316` |
| Create collection | POST | `/v1/products/collections` | `products.ts:623` |
| Assign products to collection | PUT | `/v1/products/collections/:id/products` | `products.ts:826` |
| List navigation | GET | `/v1/pages/navigation` | `pages.ts:547` |
| Replace navigation | PUT | `/v1/pages/navigation/:location` | `pages.ts:574` |
| Create CMS page | POST | `/v1/pages` | `pages.ts:336` |
| Create/upsert policy | POST | `/v1/pages/policies` | `pages.ts:431` |
| Create shipping zone | POST | `/shipping/zones` | `shipping-tax.ts:108` |
| Create shipping rate | POST | `/shipping` | `shipping-tax.ts:233` |
| Create tax rate | POST | `/taxes` | `shipping-tax.ts:373` |
| Create product | POST | `/v1/products` | `products.ts:1101` |
| Seed sample product | POST | `/v1/products/sample` | `products.ts:1003` |
| Mobile onboarding progress | POST | `/onboarding/mobile-progress` | `onboarding.ts:199` |

**Navigation API is fully implemented in `pages.ts` (discovered during research):**
- `GET /v1/pages/navigation?store_id=&location=` — reads a named menu with items
- `PUT /v1/pages/navigation/:location` — replaces all items for a location handle; auto-creates the `navigation_menus` row via `ensureNavigationMenu()` if it does not exist
- Navigation item fields supported: `label`, `url`, `target_type`, `target_resource_id`, `sort_order`, `is_visible`, `open_in_new_tab`, `parent_item_id`
- `syncPageNavigationItem()` is called automatically on page create/update when `show_in_nav=true` and `status='published'`

### APIs That Are MISSING and Would Need to Be Created

| Missing API | Entity/Table | Operations Needed | Notes |
|---|---|---|---|
| Preset application | `theme_releases` / `settings_data.current` | `POST /v1/themes/:slug/preset` with `{ store_id, preset_key: 'electronics' }` copies `settings_data.presets['electronics']` into `settings_data.current`, saves as draft | `settings_data.presets` contract exists in schema but no action endpoint |
| Shipping pincode serviceability config | `shipping_zones` / pincode tables | `POST /shipping/zones/:id/pincodes` to add/remove serviceable pincodes per merchant | Read endpoint exists (`GET /shipping/serviceability/:pincode`); write is absent |
| Delivery time slots | New table | Full CRUD for merchant-defined delivery windows | No such table or API |
| Restaurant menu modifiers | `product_option_values` or new table | Modifier groups (add-ons, spice level) with per-item surcharge | Current `option1/2/3` is too coarse |
| Subscription products | New domain | `POST /v1/subscriptions` — recurring order creation, plan definition, renewal billing | Subscription domain NOT IMPLEMENTED per doc 09 |
| Batch AI-init | Orchestration | `POST /v1/stores/:id/ai-init` accepting an `industry` string and applying theme preset + collections + navigation + policies in one idempotent call | Would require a new orchestration endpoint calling the above APIs in sequence |

---

## 6. Theme Preset Application API

**Does an endpoint exist to apply a preset configuration to a theme in one call?**

No. Confirmed by inspection of `themes.ts` (all 1,493 lines read). The `themes.ts` router has the following write endpoints:
- `PUT /:slug/editor/draft` — saves arbitrary `settings_data` as a draft
- `POST /:slug/publish` — publishes the current draft
- `POST /:slug/install` — installs a theme to a store

There is no `POST /:slug/preset`, `POST /:slug/apply-preset`, or equivalent. The `settings_data.presets` field is stored in the `LiquidThemePackageBundleSchema` but the only way to activate a preset is to manually copy its values into `settings_data.current` via the draft endpoint.

**What a preset-application endpoint would need to accept:**
```json
{
  "store_id": "uuid",
  "preset_key": "electronics | fashion | grocery | furniture | jewelry | dairy",
  "merge_mode": "replace | merge"
}
```
The endpoint would:
1. Load the store's installed theme bundle (from `store_themes` → `theme_releases`)
2. Find `bundle.config.settings_data.presets[preset_key]`
3. Copy (or deep-merge) those values into `settings_data.current`
4. Call `saveDraft()` via `ThemeExecutionAdapter`
5. Optionally call `publish()` if `auto_publish: true`

**Current workaround for AI agents:** An AI agent can simulate preset application by constructing the full `settings_data.current` object and submitting it via `PUT /v1/themes/:slug/editor/draft`. This requires the AI to know the expected structure of the theme's settings schema, which is available from `GET /v1/themes/:slug/schema`. The gap is ergonomics and atomicity, not absolute impossibility.

---

## 7. Navigation API Discovery

**Navigation management API exists and is complete.** It lives in `pages.ts`, not in `stores.ts` or a standalone navigation route file.

**Confirmed endpoints (from `pages.ts` lines 547–622):**

```
GET  /v1/pages/navigation?store_id=:id&location=:handle
     Returns: { menu: NavigationMenuRow | null, items: NavigationItemRow[] }

PUT  /v1/pages/navigation/:location
     Body: { store_id, location, name?, items: [{ label, url, target_type?, target_resource_id?, sort_order?, is_visible, open_in_new_tab?, parent_item_id? }] }
     Returns: { replaced: true, menu_id, count }
```

**Key behaviors:**
- `ensureNavigationMenu()` auto-creates the `navigation_menus` row for the given `(store_id, location/handle)` pair if it does not exist — the AI does not need to create menus separately
- The PUT endpoint does a full replace: it soft-deletes all existing items and inserts the new list
- Location handles are free-form strings; the convention is `'main'` (header nav), `'footer'`, `'footer-secondary'`
- The `syncPageNavigationItem()` function in `pages.ts` automatically keeps page items in the `main` menu in sync when pages are created/updated with `show_in_nav: true` — meaning if the AI creates a policy page with `show_in_nav: true, status: 'published'`, it will auto-appear in the main nav

**Current state of navigation management:** Fully implemented. The navigation system uses `navigation_menus` and `navigation_menu_items` tables with soft-delete, and the API is robust (missing-table graceful handling, schema mismatch fallbacks).

---

## 8. The "Zero to Launch" Gap

Steps that currently **cannot be automated via API** (evidence-based):

| Manual Step | Why API Cannot Do It | Evidence |
|---|---|---|
| Payment configuration (Razorpay) | Requires merchant's own Razorpay `key_id` and `key_secret`; these must come from the merchant — cannot be AI-generated | `stores.ts:351` — `POST /:id/payment-config` requires both keys |
| COD enablement | `cod_enabled` is read via the payment-config endpoint but the write path through `UpdateStoreSchema` is unclear — `cod_enabled` is not in the `allowed` array in `PATCH /stores/:id` (line 701–709) | `stores.ts:700–708` |
| Delivery zone pincode configuration | Only `GET /shipping/serviceability/:pincode` exists; no write API for per-merchant pincode allowlists | `shipping.ts:90` — read-only |
| Industry preset application (one-shot) | No `POST /themes/:slug/preset` endpoint; must construct full `settings_data.current` manually | `themes.ts` — no preset endpoint found |
| Subscription product setup | Subscriptions domain is NOT IMPLEMENTED | Doc 09, LCIS INFINITY — `NOT CONNECTED`, no `/v1/subscriptions` route file |
| Custom domain setup | Requires DNS changes by the merchant; no API can provision DNS records | `stores.ts:700` — `PATCH` can save `custom_domain` value but DNS must be set manually |
| Razorpay account creation | The merchant must have a Razorpay account; LetBuyy cannot create one on their behalf | External dependency |
| GSTIN verification | GSTIN is accepted as a string in `PATCH /stores/:id` but there is no verification API; merchant must supply a real GSTIN | `stores.ts:704` — `gstin` is accepted, not verified |
| Product images | Images require upload; `POST /v1/upload` or equivalent upload route; AI cannot generate real product photos | Out of scope for API coverage |
| Plan activation | `getAdminSelectPlanUrl()` redirect is the post-creation flow; billing is a separate domain | `create-store/route.ts:305` |

---

## 9. Feasibility Score per Vertical

| Vertical | API Coverage | Missing APIs | Feasibility | Effort to Fill Gaps |
|---|---|---|---|---|
| Electronics | ~75% | Preset-apply endpoint; no product-specs/comparison-table section types | HIGH — fully workable today with manual `settings_data` construction; section type gaps are cosmetic for MVP | 1–2 weeks (preset endpoint + Phase D sections) |
| Fashion | ~70% | Preset-apply endpoint; no lookbook/size-guide sections; no variant swatch island (Phase C) | HIGH — workable today; size guide is a content gap, not a blocking API gap | 2–3 weeks (Phase C island + Phase D sections) |
| Grocery | ~65% | Preset-apply endpoint; no bundle-deals/nutrition-table sections; no delivery slot API; subscriptions missing | MEDIUM — core commerce fully API-capable; delivery slots and subscriptions block the "full grocery" experience | 4–6 weeks for full experience; 1–2 weeks for basic |
| Furniture | ~60% | Preset-apply endpoint; no dimensions/material sections; no `lb-delivery-estimate` island; no pincode serviceability config write API | MEDIUM — commerce works; white-glove delivery experience and room planning features need Phase D work | 4–6 weeks |
| Dairy / Fresh Produce | ~40% | Preset-apply endpoint; subscriptions domain entirely missing; no freshness section; no recurring billing; no delivery slot API | LOW — the subscription gap is not a Phase D item, it is a full domain build; basic one-time purchases work | 8–12 weeks minimum for viable dairy experience |
| Restaurant / Food Service | ~35% | No menu modifier model; no delivery zone pincode config write API; no time-slot ordering; no restaurant-specific sections | LOW — basic "click-and-collect / delivery" with standard product model works; full restaurant UX (modifiers, slots, zones) requires significant new domain work | 8–16 weeks for full restaurant experience |

**Summary verdict:** The API surface today supports fully automated AI store generation for **electronics** and **fashion** with only minor UX gaps (preset-apply convenience endpoint + section types). **Grocery** and **furniture** are achievable for a basic store launch with current APIs; full vertical-specific experiences require Phase C/D work. **Dairy** and **restaurant/food service** are fundamentally blocked by missing domains (subscriptions, menu modifiers, delivery slots) that require new engineering effort beyond theme engine work.

---

*File: `/Users/saai_sidd/Git/Letbuyy_Store/docs/theme-discovery/13-ai-store-generation-feasibility.md`*
*Sources inspected: `services/api-gateway/src/routes/stores.ts`, `themes.ts`, `products.ts`, `pages.ts`, `shipping.ts`, `shipping-tax.ts`, `onboarding.ts`; `apps/identity-platform/src/app/onboarding/page.tsx`, `apps/identity-platform/src/app/api/auth/create-store/route.ts`; `docs/theme-research/09-target-theme-architecture.md`*
