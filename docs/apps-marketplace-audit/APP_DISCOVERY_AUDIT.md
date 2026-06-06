# App Discovery Audit (Phase 8)

Can a merchant actually *find* a useful app? Audits search, categories, collections, featured/trending/popular/recommended surfaces. Parent: [Master Audit](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md).

## Verdict: discovery is scaffolding, not a system

With an empty catalog there is nothing to discover today; even fully seeded, the discovery model is a flat, single-axis directory with decorative facets.

## 1. Search

- **Entry:** header search is a link to `/search`; `/search` is a client component that calls `/api/apps/search?q=` then `/api/apps`.
- **Backend:** `GET /app-store/apps` builds `query.or('name.ilike.%q%,tagline.ilike.%q%')` — substring match on **name and tagline only**. No description, keywords, category, or developer match; no relevance ranking; no typo tolerance; no synonyms. (Migration `084_trigram_search_indexes` adds trigram indexes, but the query doesn't use similarity ranking.)
- **Security:** the raw query string is interpolated into a PostgREST `.or()` expression — a filter-injection vector (see [Architecture audit](APP_PLATFORM_ARCHITECTURE_AUDIT.md) §security).
- **Facets:** the sidebar Category list works (re-fetches), but **Pricing and Rating facets are dead** — static `<div>`s, no state, no handlers (`search/page.tsx`).
- **Sorting:** done client-side after fetch ("in case API doesn't fully sort"), which masks backend sort gaps and breaks once results are paginated.

## 2. Categories

- 29 categories are **hard-coded** in `constants/categories.ts` (grouped: Products, Selling, Orders, Marketing, Conversion, Design, Support, Analytics, Finance).
- The backend has a real `app_categories` table and `GET /categories`, but the UI nav doesn't use it — so the **taxonomy can drift** from the data, and category filtering by slug depends on matching DB rows that **aren't seeded**.
- Category landing pages show "{total} apps available" from the API, but there's no app-count per category in the nav, no hiding of empty categories, and the sort control is inert.
- **Icon bug:** category icon name strings render as literal text on the category header and search sidebar (see [Content gap](APPS_CONTENT_GAP_ANALYSIS.md) §4).

## 3. Collections

Three collections exist (`collections/[slug]/page.tsx`) and are **cosmetic**:

| Collection | Claim | Reality |
|---|---|---|
| `staff-picks` | "Hand-picked by the LetBuyy team" | `listApps({ sort: 'rating' })` — no curation table |
| `trending` | "Most installed and talked-about right now" | `listApps({ sort: 'popular' })` — all-time install_count, not trending |
| `made-in-india` | "Apps built by Indian developers" | `listApps({ sort: 'recent' })` — **no country filter** |

There is no admin/editorial mechanism to actually curate a collection, and no schema for collection membership.

## 4. Featured / trending / popular / recommended

- **Featured:** none. The home page is a filterable directory with a search/category/sort form; no hero/featured rail.
- **Trending:** none (the "trending" collection is all-time popularity).
- **Popular:** only as a sort (`install_count` desc).
- **Recommended/personalized:** none. App detail shows up to 3 same-category apps as "You might also like" (`listApps({category})` minus self) — the only recommendation primitive, and it's not personalized.

## 5. What's missing vs. Shopify

- Data-driven categories **with counts** and empty-state suppression.
- **Real trending** (install velocity over a window) and **editorial collections** with a membership model.
- **Recommendations** (similar apps, "merchants also installed," category leaders).
- **Search relevance** (full-text + ranking by relevance, performance, rating, recency) and **synonyms**; Shopify made semantic search mandatory in 2025.
- **Multi-tag** apps (LetBuyy has a single `category_id`).
- **Pagination/infinite scroll** (current cap is 24 on home, 20 elsewhere).

## 6. Highest-leverage fixes

1. Seed catalog + categories so discovery has anything to do.
2. Drive category nav from `GET /categories` with counts; hide empties.
3. Make collections real (membership table + curation UI + trending math + India filter).
4. Wire the dead pricing/rating facets to query params and backend filters.
5. Replace `ILIKE`-OR search with ranked full-text (use the trigram indexes already shipped) and sanitize input.
6. Add a recommendations surface beyond same-category sampling.
