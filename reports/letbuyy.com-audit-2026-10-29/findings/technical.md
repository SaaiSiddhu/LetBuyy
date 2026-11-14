# Technical SEO

Audit date: 29 October 2026, Asia/Kolkata. Status: qualitative; no numeric category score.

Measured: HTTP status, robots, sitemap contents, canonicals and initial HTML. The core site is accessible; no blanket homepage noindex was found. HTTPS, HSTS, nosniff and CSP headers are present. The observed 307 root/pricing/resources redirects are functional, not broken links. Google-selected canonicals, actual index coverage and historical crawl behavior are unavailable.

### SEO-01 — Canonical URLs disagree with locale routing (High)

**Observed:** 101 English pages (7 resource categories, 89 tags, 5 authors) declare canonicals with /in removed. For example /in/resources/payments declares https://www.letbuyy.com/resources/payments. Three representative category/tag/author targets returned 307 to the corresponding /in page, which declares the redirecting URL again. Separately, /in/create has distinct content and H1 Create Your Site but inherits the homepage title/description and canonical; /in/resources/search also canonicalizes to the homepage. Evidence: page-inventory.csv, evidence/canonical-targets.json, evidence/analysis-summary.json.

**Change:** Use the final, intended indexable locale URL consistently in canonicals, navigation, structured data and sitemaps. Give /in/create its own metadata and canonical if it is intended as an organic landing page; otherwise make its consolidation explicit. Treat internal search separately, as SEO-07 describes. Keep homepage and article self-canonicals that already work.

**Dependencies:** Agree which archives and creation pages should be indexed; reuse the existing URL/locale metadata utilities, without adding a parallel SEO system.

**Validation:** Recrawl every affected route: each intended indexable URL has one absolute self-canonical returning 200 with no redirect. Inspect sample Google-selected canonicals in Search Console when access is available.

**Leading indicator:** Count of intended indexable pages whose declared canonical redirects or differs from their final URL: target 0.

**Failure check:** Failure is any remaining locale-stripped canonical or Google selecting an unintended canonical after recrawl; do not treat changed HTML alone as proof of indexing.

### SEO-04 — XML sitemap omits the entire discovered article library (High)

**Observed:** /sitemap.xml contains 99 URLs, 33 per locale; all 35 discovered English article URLs are absent. Categories and internal links make them crawlable, so omission is not proof that they are unindexed. All 99 lastmod values are 2026-06-04 although sampled article/release content has later displayed dates. /in/create and /in/resources/search are listed despite canonicalizing to the homepage. Robots also declares three satellite sitemaps (themes/apps/developer) that failed DNS resolution in this audit.

**Change:** Generate sitemap entries from the existing published article registry and locale availability; include only canonical, indexable final URLs. Use real significant modification dates or omit untrustworthy lastmod values. Remove search/alias URLs as appropriate. Confirm ownership/DNS intent and remove stale satellite sitemap declarations; keep frozen services dormant.

**Dependencies:** SEO-01 and SEO-07 canonical/indexing decisions; trustworthy published/modified fields. Do not include all archive/filter URLs automatically.

**Validation:** Expected published English article set minus sitemap article set is empty; every sitemap URL returns 200, is indexable and agrees with its canonical. Validate locale alternates. Recheck all declared sitemap endpoints from another resolver, and inspect sitemap processing in Search Console when connected.

**Leading indicator:** Eligible English articles represented: target 35/35 for the current crawl; invalid/redirecting/noncanonical sitemap URLs: target 0.

**Failure check:** Failure is a new published article omitted again, a blanket build-time lastmod refresh, or continuing declarations of confirmed retired hosts.

### SEO-07 — Search and tag archives need an intentional indexing policy (Medium)

**Observed:** The crawl found 89 indexable English tag pages for 35 articles. Their raw main text ranges from 92 to 232 whitespace-delimited tokens including headings/cards. /in/resources/search is index, follow, appears in the sitemap, has no H1 and canonicalizes to the homepage. Tag canonicals also have the locale problem in SEO-01. Counts/lengths are diagnostics, not a Google minimum or proof of a penalty.

**Change:** Keep useful category/tag hubs that serve a distinct need and enrich their descriptions/curation. Consolidate overlapping tags or use noindex for low-value navigation archives where appropriate. Normally exclude internal search results from indexing and sitemaps, with a deliberate canonical policy. Preserve crawlable links to articles. Do not apply noindex solely because a page is short.

**Dependencies:** Article coverage and internal-link inventory; Search Console impressions/canonical data before broad pruning.

**Validation:** Recrawl both kept and excluded archive classes; ensure all 35 articles remain internally reachable and important hubs remain indexable. Validate noindex in HTML rather than blocking crawler access to the directive.

**Leading indicator:** Approved archive/indexing policy applied consistently; orphaned published articles: target 0.

**Failure check:** Failure is removing useful landing pages or making article discovery depend solely on search/filter controls.
