# Liquid Search, Discovery, Reviews & Analytics (V2) — Phases 6, 7, 12

**Type:** Research / design — no implementation. **Date:** 2026-06-16.
Parent: [LIQUID_COMMERCE_ARCHITECTURE.md](LIQUID_COMMERCE_ARCHITECTURE.md).

---

## PART A — Search & Discovery (Phase 6)

### A1. Shopify reference
Shopify Search & Discovery: **predictive search** (`/search/suggest.json` → products/collections/pages/queries), **search results page** (`search.terms`, `search.results[]`, `search.results_count`, `search.performed`), **storefront filters** (`collection.filters[]` / `search.filters[]` with `filter.values`, active/url), **sort** (`collection.sort_options`, `sort_by`), **pagination** (`paginate`), plus merchant-side boosts/synonyms/redirects.

### A2. LetBuyy audit — search is ABSENT (backend + frontend)
- **No storefront catalog search endpoint.** Every gateway `/search` is domains / app-marketplace / internal-console / merchants — never product catalog (verified: `grep -rniE "/search|to_tsvector|websearch_to_tsquery" services/api-gateway/src`).
- The Liquid `lb-search` island posts to `data-search-url` or `/shop?search=` (`liquid-hydration-islands.tsx:359`); `shop/page.tsx` and `products/page.tsx` **ignore the `search` param**.
- `collectionFilter` is a declared section type with **no renderer** in either engine (`index.ts:31`).
- Infra present but unwired: `SEARCH_QUEUE` (storefront domain queue, `domain-intel.json`) and `services/search-service` (reserved, not implemented, per CLAUDE.md). `products` has `name`, `description`, `tags`, `seo_*` for indexing.

**Verdict:** search/filter/sort/pagination is a **genuine net-new build** (one of only two real backend builds in V2).

### A3. Designed search/discovery
**Backend (new):** `GET /storefront/{subdomain}/search?q=&filter[]=&sort=&page=` →
- v1: Postgres full-text over `products` (`to_tsvector(name, description, tags)` + `pg_trgm` for typo tolerance), site-scoped (RLS), `is_active` only.
- predictive: `GET /storefront/{subdomain}/search/suggest?q=` (top N product/collection/query suggestions).
- indexing: feed `SEARCH_QUEUE` on product write to maintain a search projection (or query live for v1).

**Drops:**
```liquid
search = { terms, performed, results: [ product ], results_count, page, page_size, sort_by }
collection.filters = [ { label, param_name, type, values: [ { label, value, count, active, url } ] } ]
collection.sort_options = [ { name, value } ]   // price asc/desc, newest, popularity
paginate = { current_page, pages, items, next, previous }
```
**Frontend:** point existing `lb-search` island at the new endpoint; build a `search` Liquid template (the bundle already ships one, `theme-bundle.ts:2140`) + a `collection-filter`/`sort`/`pagination` Liquid section consuming the drops above. Catalog-driven, **no mocks**.

---

## PART B — Reviews (Phase 7)

### B1. LetBuyy audit — backend EXISTS, Liquid MISSING
- Table `product_reviews` (`:10486`): `rating(1-5)`, `title`, `body`, `images text[]`, `is_verified`, `is_approved`, `helpful_count`, `status(pending|approved|rejected)`, `customer_name`, `customer_email`, `created_at`.
- Gateway: `storefront.productReviews` (read), `storefront.submitProductReview` (write) — already consumed by the React `api/reviews/route.ts` (demo gated for the demo store only, `:52`).
- Products carry `avg_rating`/`review_count` in the product mapper (`product-service.ts:131-132`).
- **No Liquid reviews section/drop** (`grep type:'reviews'` in the bundle = 0).

### B2. Designed review drops + section
```liquid
product.rating        // avg_rating (0–5)
product.review_count  // review_count
product.reviews = [ {
  id, rating, title, body, images: [...],
  author,             // customer_name
  is_verified,        // verified purchase badge
  helpful_count,
  created_at
} ]
```
**Frontend:** `reviews` Liquid section rendering `product.reviews` + a star summary from `product.rating`/`product.review_count`; `lb-review-form` island posting to `submitProductReview` (rating/title/body/images) + a `lb-review-helpful` vote island. Only `status='approved'` reviews render (gateway already filters). **No mocks; demo reviews stay gated to the demo store.**

---

## PART C — Storefront Analytics (Phase 12) — CONNECTED / NOT CONNECTED only

**Honest contract (no fabricated metrics).** The storefront runtime emits **no client behavioral events** — `grep trackEvent|beacon|sendBeacon|/analytics|/events apps/storefront-runtime/src` = empty; the only emission is the canary render `console.log` (`composition-engine.tsx:405`).

| Metric | Status | Evidence |
|---|:--:|---|
| Pageviews | **NOT CONNECTED** | no client emission |
| Funnels (view→cart→checkout→purchase) | **NOT CONNECTED** | no funnel events emitted |
| Checkout steps | **NOT CONNECTED** | checkout-client emits nothing to analytics |
| Search analytics | **NOT CONNECTED** | no search exists |
| Cart analytics (add/remove/abandon) | **NOT CONNECTED** (client) / 🟡 `carts.abandoned_at` exists server-side | `carts:8644` |
| Conversion analytics | **NOT CONNECTED** (storefront) | derived only from orders server-side |
| Order/payment events | **CONNECTED (server-side)** | outbox/`EVENT_QUEUE`, `analytics_events`, `increment_analytics_rollup` |
| Live analytics values | **NOT CONNECTED** | `connections-intel.json` 0/13 (deploy-time) |

**Designed analytics layer (to make funnels CONNECTED):**
- `lb-analytics` island/beacon emitting: `page_view`, `product_view`, `search`, `add_to_cart`, `remove_from_cart`, `begin_checkout`, `add_payment_info`, `purchase` → `POST /storefront/{subdomain}/events` → `EVENT_QUEUE` → `analytics_events` → `increment_analytics_rollup` → merchant dashboard.
- Server-truth events (order/payment) already flow; the gap is **client funnel emission**.
- Live ingestion still requires the deploy-time analytics credentials (Cloudflare Analytics Engine), which remain NOT CONNECTED from the repo.

---

## Build summary (Phases 6, 7, 12)

| System | Backend build? | Frontend (drop + section/island) |
|---|:--:|---|
| Search + predictive | **YES (new endpoint + index)** | search template + filter/sort/pagination sections; repoint `lb-search` |
| Filters / sort / pagination | partial (filter data) | `collection.filters`/`sort_options`/`paginate` drops + sections |
| Reviews | No (exists) | reviews drops + section + form/helpful islands |
| Analytics funnel | YES (events endpoint + emit) | `lb-analytics` beacon island |

**Two real backend builds remain in V2: search and the analytics events endpoint.** Reviews and filtering-data are mostly presentation over existing data.
