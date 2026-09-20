# Liquid Theme Completion (V2) — Phases 5, 9, 10, 11

**Type:** Research / design — no implementation. **Date:** 2026-06-16.
Parent: [LIQUID_COMMERCE_ARCHITECTURE.md](LIQUID_COMMERCE_ARCHITECTURE.md).

---

## PART A — Orders model (Phase 5)

### A1. LetBuyy audit
- **Reads:** `order-service.ts` (gateway-owned; client lookups `throw`, `:15,48`). Order mapper `:105-159` already shapes: `order_number, customer{name,email,phone,address}, items[], pricing{subtotal, deliveryCharge, discount, total}, payment{method,status,...}, status, tracking{number,carrier}`.
- **RPCs:** `create_order_fulfillment`, `create_order_return_and_refund` (`order-execution.adapter.ts`), `complete_order_refund` (`returns.ts`), `restore_gift_card_on_refund` (`orders.ts`).
- **Tables:** `orders` (`order_number, subtotal, shipping_cost, discount, total, payment_method, payment_status, payment_id, status, tracking_number, carrier`), `order_items` (`productId, name, price, quantity, image, variant`).
- **Liquid:** dormant order templates referencing `customer.orders` (`theme-bundle.ts:2195`) and `order.line_items` (`:2209`) — **unrouted, no drop**.

### A2. Designed Liquid order model (Shopify-aligned)
```liquid
customer.orders = [ order_summary ]   // list view
order = {
  id, name,               // "#"+order_number
  order_number,
  created_at,
  financial_status,       // payment_status (pending|paid|failed|refunded)
  fulfillment_status,     // status (confirmed|processing|shipped|delivered|cancelled)
  customer: { name, email, phone },
  shipping_address: address,           // GST-aware (see customer system)
  line_items: [ {
    product_id, title, variant_title, quantity,
    price, line_price, image, properties
  } ],
  subtotal_price,         // subtotal
  total_shipping,         // shipping_cost
  total_discount,         // discount
  total_tax,              // GST
  total_price,            // total
  payments: [ { method, status, reference } ],          // payment_method/status/payment_id
  fulfillments: [ { status, tracking_number, carrier, tracking_url } ],   // create_order_fulfillment
  refunds: [ { amount, reason, status, created_at } ],  // create_order_return_and_refund / complete_order_refund
  cancelled, cancel_reason, note
}
```
**Frontend:** `customer/account.orders` + `order` Liquid templates (bundle markup exists `:2195,2209`), route-wired through the composition engine, fed by `customerOrders` + fulfillment/refund reads. **Returns/refunds are presentation over existing RPCs — no money-path change.**

---

## PART B — CMS, Blog & Content (Phase 9)

### B1. Audit
- **`ContentResourceRenderer`** (`components/content/content-resource-renderer.tsx`) renders CMS pages (`[...path]/page.tsx`) and is **React**. Blog is React (`blog/[slug]/page.tsx`). Policy pages are React (`privacy/terms/shipping/returns`).
- **Data exists:** `storefront_pages` (+ `storefront_page_revisions`), `blog_posts`/`blog_tags`/`blog_post_tags`/`blog_comments`/`blog_categories`, `storefront_policies`, `pages` (`domain-intel.json` storefront tables). `ContentService.getPageBySlug` already reads pages.
- **Liquid:** `rich-content` section exists (`theme-bundle.ts:1066`) but no `page`/`blog`/`article`/`policy` templates wired to routes.

### B2. Designed Liquid content architecture (Shopify-aligned)
Shopify uses `page`, `blog`, `article`, `policy` templates with `page`, `blog`, `article` objects.
```liquid
page    = { id, title, handle, content, seo, published_at, template_suffix }
blog    = { title, handle, articles: [ article ], tags, paginate }
article = { id, title, handle, content, excerpt, author, published_at, image, tags, comments, comment_count }
policy  = { title, body }        // storefront_policies
```
**Frontend:** `page`/`blog`/`article`/`policy` Liquid templates + content drops from `ContentService`; route-wire `[...path]`, `blog/[slug]`, and policy pages through the composition engine. Sanitization stays the locked DOMPurify pass (`theme-renderer.ts:114-167`).

---

## PART C — Theme architecture (Phase 10) — every theme, every surface

### C1. Audit — current state
- **Only Urban Kicks ships a Liquid bundle** (commit `57760d0c`); `resolveLiquidBundle` returns `undefined` → React for all other themes (`template-resolver.ts:110-125`).
- **Demo-fixture fallback** in the production mapper: `store-service.ts:670-673` returns `createUrbanKicksLiquidThemeBundleFixture()` when a store's bundle is missing → a real store can inherit the demo theme.
- Default `themeId='urban-kicks'` (`store-service.ts:557`).

### C2. Required theme contract (no special-casing, no fallback)
Define a **base theme contract** every theme must implement (Shopify's required template set), validated at publish:

| Template | Status today (Urban Kicks bundle) |
|---|---|
| `index` (home) | ✅ `theme-bundle.ts:1955` |
| `collection` | ✅ `:2131` |
| `product` | ✅ `:2116` |
| `search` | ✅ template exists `:2140` (no backend) |
| `cart` | ✅ template exists `:2149` (unrouted) |
| `account` / `customer` | 🟡 markup exists `:2195`, no route/drop |
| `page` / `policy` | ❌ |
| `blog` / `article` | ❌ |
| `checkout` (shell) | ❌ |
| `404` | verify |

**Build:** author the missing templates **per theme**, add a **theme-contract validator** (publish-time: reject a theme missing required templates), **remove the demo-fixture fallback** (`store-service.ts:670-673`) and the `'urban-kicks'` default identity (`:557`). No theme may depend on the demo bundle.

---

## PART D — Theme editor for all surfaces (Phase 11)

### D1. Audit
- Editor (`editor/page.tsx`, 1897 lines) edits **section settings + order + theme settings**, panels `sections|settings|versions` (rollback), draft auto-save with `base_version` concurrency (`editor/draft/route.ts:77`), publish + rollback gateway-backed (`theme-execution.adapter.ts:1157,1311,1416`).
- The draft route already accepts a `template_key` (`editor/draft/route.ts:52,64`) and can carry `liquidBundle`/`liquidRenderingCanary` (`:23-36`) — so **multi-template, Liquid-aware editing is partially wired**.
- **Gap:** the editor UI is catalog-section-centric; it does not expose cart/checkout/account/search/blog template editing, and cannot author Liquid template code (only settings).

### D2. Required
- Extend the editor template switcher to all required templates (cart/checkout/account/search/page/blog/policy), reusing the existing `template_key` draft mechanism.
- draft → preview → publish → rollback must work for **every** template (preview already renders Liquid via the same composition engine, `preview/page.tsx:370`).
- Decision needed: section-settings editing (today) vs Liquid template authoring/import (for partners). For 100% parity, a **theme-package import** path is sufficient; full in-editor Liquid authoring is optional.

---

## Build summary (Phases 5, 9, 10, 11)

| System | Backend build? | Frontend |
|---|:--:|---|
| Orders/fulfillment/refund drops | No (RPCs exist) | order templates + drops + route wiring |
| CMS / blog / policies | No (data + `ContentService` exist) | page/blog/article/policy templates + drops + route wiring |
| Per-theme template coverage | No | author required templates per theme + **theme-contract validator** + remove demo fallback |
| Editor for all surfaces | No | extend template switcher (mechanism exists) |

**All of Phases 5/9/10/11 are presentation + validation work over existing data and RPCs — no backend builds.**
