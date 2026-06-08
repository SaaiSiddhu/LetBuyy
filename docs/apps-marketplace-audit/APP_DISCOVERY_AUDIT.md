# App Discovery Audit (Phase 8)

**Parent:** [`../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md`](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md) · **Date:** 2026-06-07

**Central question:** *Can a merchant actually find a useful app — or is discovery a set of polished surfaces over an empty room?* Answer: the discovery *machinery* (search, sort, category filter) is wired and server-backed, but it is **built on hardcoded taxonomy over an empty catalog, with curation that is faked and admits it**. Discovery currently fails not because it's broken, but because there is nothing to discover and the surfaces over-promise.

## 1. Search

`(store)/search/page.tsx` (client) debounces 300ms and hits `/api/apps/search` (or `/api/apps` when blank), which proxy to the gateway `GET /app-store/apps` (`app-store.ts:31`). Query is sanitized (`marketplace-display.ts:78`).

| Facet | Wiring | Verdict |
|---|---|---|
| Text query | Server-side | ✅ |
| Category | Server-side, but sidebar only shows `APP_CATEGORIES.slice(0,15)` → **14 of 29 categories unselectable** (`search/page.tsx:154`) | ⚠️ |
| Sort (popular/rating/newest/A–Z) | Server-side (`:67`) | ✅ |
| Pricing (free/freemium/paid) | Server-side (`paid→recurring`) + client re-filter (`:68,82`) | ✅ |
| Rating (any/4+/3+) | **Client-only over the ≤20 fetched rows; never sent to backend** (`:83`) — a 4★ app on "page 2" can't surface | ❌ |
| Pagination | **None** (limit 20, no offset) (`:69`) | ❌ |

Empty/loading/error states are good ("No apps found" + suggestions; skeletons; `MarketplaceUnavailable` with retry). **Search grade: C+** — solid skeleton, two real holes (hidden categories, shallow rating filter), no pagination.

## 2. Categories

29 categories are **hardcoded** in `constants/categories.ts:5-52` (header: "App categories from Doc 15 §4"), grouped into Products/Selling/Orders/Marketing/Conversion/Design/Support/Analytics/Finance. `getCategoriesWithFallback()` prefers live API categories but **falls back to the hardcoded 29** when the catalog is empty (`app-service.ts:131-135`). Two consequences:

1. **Every category tile renders even with an empty catalog** → all 29 dead-end to "No apps yet."
2. **Category detail 404s for any live-only slug**: `categories/[slug]` calls `notFound()` unless the slug is in the hardcoded list (`categories/[slug]/page.tsx:61`). If the platform ever adds a category the constant doesn't know, its page is unreachable.

**Categories grade: C** — taxonomy should live in the DB and be admin-governed, and tiles should reflect real depth.

## 3. Collections (the weakest discovery surface)

`(store)/collections/[slug]/page.tsx:10-29` defines exactly **3 hardcoded collections**, each merely a sort hint over the generic catalog — they are **not curated sets**, and the copy admits it:

- `staff-picks` → "Currently sorted by rating until LetBuyy editorial curation is connected." (`:13`)
- `trending` → "Currently sorted by install count until rolling trend data is connected." (`:19`)
- `made-in-india` → "India developer filtering is not connected yet; this view currently shows recent marketplace apps." (`:25`) — a "Made in India" rail with **zero India filtering**.

There is **no `/collections` index**, and `trending` + `made-in-india` have **no inbound links** (orphans); Header/Footer link only `staff-picks` (`Header.tsx:36`, `Footer.tsx:20`). **Collections grade: D** — this is curation theater; either build a real curation table or remove the surface until it exists.

## 4. Featured / trending / recommended rails

- **Featured:** one home rail, gated on `marketplaceCapabilityEnabled('featuredRails')` **and** real `app.is_featured` data (`page.tsx:115-117,281`). Off by default; copy is honest ("shown only when the marketplace receives explicit featured data"). No featured-inventory model exists to populate it.
- **Trending:** none (the "trending" collection is a re-sort, not a trend signal — no rolling-window data).
- **Recommended / personalized:** none. App detail shows only "You might also like" = up to 3 same-category apps (`apps/[slug]/page.tsx:183-185`). No recommendation service, no "works with," no "alternatives," no "merchants also installed."

## 5. Are apps hidden, or simply absent?

Both. **Absent:** the catalog has no seed data, so every path ends in an honest empty state. **Hidden (structurally):** even with a catalog, 14 categories are unreachable from search, live-only categories 404, two collections are orphaned, the rating filter can't reach beyond the first 20 results, and there's no pagination — so a real catalog would still be under-discoverable.

## 6. Discovery instrumentation

There is **no discovery analytics**: search terms, zero-result queries, category click-through, and rail performance are not captured (`telemetry.ts` only dispatches a browser event with no sink). You cannot improve discovery you don't measure.

## 7. Recommendations

1. **Gate discovery rails on real catalog depth** — don't render 29 categories and 3 collections over 0 apps.
2. **Move taxonomy to the DB** and render all categories everywhere from the API.
3. **Push the rating filter server-side** and add pagination/infinite scroll.
4. **Replace fake collections** with a real curation table + `/collections` index, or remove them.
5. **Build recommendations** ("works with," "alternatives," "also installed") and a featured-inventory model.
6. **Instrument discovery** (search terms, zero-results, CTR) via the analytics pipeline.

Until the catalog is seeded (Master #1), discovery cannot be evaluated in practice — but the structural fixes above are needed regardless.
