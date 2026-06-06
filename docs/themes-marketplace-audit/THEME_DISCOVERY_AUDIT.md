# Theme Discovery Audit (Phase 8)

**Question:** can a merchant actually discover the *best* theme — or are themes hidden behind broken discovery and an empty catalog?
**Answer:** discovery is partly real, partly decorative, and ultimately moot today because the catalog holds one theme.

## Discovery surfaces inventory

| Surface | Real? | Evidence | Notes |
|---|---|---|---|
| Global navbar search (⌘K) | ❌ | `navbar.tsx:124-201` | Input doesn't search; only static "Quick Actions"; "Documentation" → `#` |
| Catalog text search (`q`) | ✅ | `themes/page.tsx:264,278-285` | Passed to API `search` param; works if catalog seeded |
| Category filter (5) | ✅ | `themes/page.tsx:389-402` | Real API `category` param |
| Free/Paid filter | ✅ (partial) | `themes/page.tsx:109-113` | "paid" maps to `one_time` only; subscription not represented |
| Industry filter | ❌ | `themes/page.tsx:427-451` | "Industry filters need seeded theme industry data" |
| Layout-type filter | ❌ | `themes/page.tsx:454-473,517-521` | Admits it "need[s] backend support before they change API results" |
| Price-range filter | ❌ | `themes/page.tsx:102-113,485-521` | Min/Max USD inputs not applied server-side |
| Sort (popular/rating/recent/name/price) | ✅ | `themes/page.tsx:534-552` | Real API `sort` |
| Autocomplete suggestions | ⚠️ | `themes/page.tsx:235-256,342-367` | Built only from the *current page's* rows; warns it needs seeded data |
| Featured (home, sort=rating) | ✅ | `page.tsx:38-42` | Real API; empty today |
| Category counts (home) | ✅ | `page.tsx:45-50` | Real API; renders "0 themes" |
| "Top themes" / category cards | ✅ link | `page.tsx:294-345` | Link to `/themes?category=`; faux-browser chrome implies preview |
| "Trending" (mobile drawer) | ❌ | `navbar.tsx:642` | Just links to `/themes` |
| Collections / curation / editor's picks | ❌ | absent | Not implemented |
| Similar themes (detail) | ✅ | `[slug]:280-289` | Needs ≥2 themes in category |
| Pagination | ❌ | `themes/page.tsx:284` | `limit: 30`, no next-page UI |

## Ranking & relevance
- The only ranking signal is the API `sort` value. There is no composite trust ranking (rating × installs × recency × support quality) of the kind Shopify uses. With reviews/installs unseeded, "Most popular" and "Highest rated" cannot differentiate anything.
- No personalization, no "recommended for your store type," no merchandising of free vs. paid.

## Can the best theme surface?
- **No** — for three compounding reasons:
  1. **Catalog depth = 1.** There is nothing to rank.
  2. **Three of six filters are inert** (industry, layout, price), so even a populated catalog can't be narrowed the way the UI implies.
  3. **No curation/trending/collections**, so discovery depends entirely on search + category, with no editorial path to "the best."

## Shopify contrast
Shopify's 2024–2025 redesign leaned into discovery: industry facets (up to 2 of 20), **catalog-size** facets (4 tiers), curated collections, and trust-ranked results. LetBuyy has the *scaffolding* for facets but the facets don't filter, and there's no curation layer at all.

## Fastest path to credible discovery
1. Seed a real catalog (prerequisite to everything).
2. Make industry/layout/price filters back real API params (or hide them).
3. Make the navbar ⌘K search actually query the catalog and route to `/themes?q=`.
4. Add collections + trending + "new this month" rows.
5. Introduce a composite ranking once reviews/installs are real.
6. Add pagination / infinite scroll.
