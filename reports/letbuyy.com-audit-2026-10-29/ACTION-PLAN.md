# Prioritized SEO action plan

29 October 2026 · Live target: https://www.letbuyy.com/in

No deployment or source change is authorized by this audit. Estimated windows below are sequencing proposals, not delivery promises.

## Phase 1: correctness — Next 1–3 working days

### SEO-01 — Canonical URLs disagree with locale routing (High)

**Observed:** 101 English pages (7 resource categories, 89 tags, 5 authors) declare canonicals with /in removed. For example /in/resources/payments declares https://www.letbuyy.com/resources/payments. Three representative category/tag/author targets returned 307 to the corresponding /in page, which declares the redirecting URL again. Separately, /in/create has distinct content and H1 Create Your Site but inherits the homepage title/description and canonical; /in/resources/search also canonicalizes to the homepage. Evidence: page-inventory.csv, evidence/canonical-targets.json, evidence/analysis-summary.json.

**Change:** Use the final, intended indexable locale URL consistently in canonicals, navigation, structured data and sitemaps. Give /in/create its own metadata and canonical if it is intended as an organic landing page; otherwise make its consolidation explicit. Treat internal search separately, as SEO-07 describes. Keep homepage and article self-canonicals that already work.

**Dependencies:** Agree which archives and creation pages should be indexed; reuse the existing URL/locale metadata utilities, without adding a parallel SEO system.

**Validation:** Recrawl every affected route: each intended indexable URL has one absolute self-canonical returning 200 with no redirect. Inspect sample Google-selected canonicals in Search Console when access is available.

**Leading indicator:** Count of intended indexable pages whose declared canonical redirects or differs from their final URL: target 0.

**Failure check:** Failure is any remaining locale-stripped canonical or Google selecting an unintended canonical after recrawl; do not treat changed HTML alone as proof of indexing.

### SEO-02 — GST guide contains outdated or overgeneralized tax guidance (High)

**Observed:** /in/resources/payments/gst-for-ecommerce-india says marketplace TCS is 1% and marketplace GST registration is mandatory regardless of turnover. The GST Council July 2024 newsletter documents a reduction from 1% to 0.5%; Notification 34/2023 provides a conditional registration exemption for qualifying intra-state goods sellers through ecommerce operators. The page provides no linked official editorial sources. Both sampled Tamil/Hindi versions repeat the substantive guidance. This audit establishes conflicts with official material, not a comprehensive legal opinion on every rate or exception.

**Change:** Review the guide and its translations with a qualified tax reviewer; correct TCS, registration exceptions, category-rate tables and filing schedules against applicable current notifications. Add inline primary sources, effective dates, real reviewer attribution and a meaningful reviewed date. Review adjacent GST/invoicing guides for propagation.

**Dependencies:** Current official notifications and a real qualified reviewer; do not invent credentials or replace business policy.

**Validation:** Every tax rate, threshold and mandatory statement has a supporting current primary source and applicable conditions; verify all three language versions together.

**Leading indicator:** Number of unresolved factual conflicts in sampled compliance guides: target 0; percentage of tax claims with dated official sources.

**Failure check:** Failure is retained blanket advice contradicted by a source, or translations still repeating the removed claim.

### SEO-03 — Free-plan and capability claims conflict across the site (High)

**Observed:** The global JSON-LD on all 163 English HTML pages contains SoftwareApplication.offers.price="0" and describes a free launch tier. Homepage/pricing CTAs also claim a free-forever plan, while rendered pricing displays Launch at ₹199/month founding price (₹299 regular), Growth at ₹699 (₹999 regular), and a 14-day trial. The app-marketplace guide describes browsing/installing reviewed apps, while /in/legal/terms says public publishing surfaces are not open. Homepage/FAQ mentions AI/B2B and 50+ AI capabilities, while the Commerce OS plan labels AI Copilot/B2B coming soon. These are observed inconsistencies; actual provider readiness and paid signup behavior were not tested.

**Change:** Reconcile the published offer and availability against the approved product/pricing source. Distinguish zero platform commission, free trial, any genuine free plan, paid subscription and third-party charges. Generate visible copy and offers from that same existing source. Remove or correct unsupported free-offer markup and qualify planned/provider-dependent capabilities. Correct promises rather than activating a dormant marketplace to satisfy copy.

**Dependencies:** Approved commercial and feature-availability facts. Preserve the project’s 0% storefront transaction-fee rule; the audit does not authorize new rates or marketplace activation (WIN-R4, NEVER-R3/R5).

**Validation:** Compare raw HTML, hydrated pricing, CTA copy, FAQ, legal text and JSON-LD for the same offer. Validate syntax and run Google Rich Results Test; valid JSON alone is not rich-result eligibility. Never invent reviews/ratings to obtain eligibility.

**Leading indicator:** Count of contradictory offer/feature statements across the sampled surfaces: target 0.

**Failure check:** Failure is price=0 without a corresponding genuine visible free offer, or a guide representing a closed/planned capability as generally available.

## Phase 2: crawl and page signals — Within one week

### SEO-04 — XML sitemap omits the entire discovered article library (High)

**Observed:** /sitemap.xml contains 99 URLs, 33 per locale; all 35 discovered English article URLs are absent. Categories and internal links make them crawlable, so omission is not proof that they are unindexed. All 99 lastmod values are 2026-06-04 although sampled article/release content has later displayed dates. /in/create and /in/resources/search are listed despite canonicalizing to the homepage. Robots also declares three satellite sitemaps (themes/apps/developer) that failed DNS resolution in this audit.

**Change:** Generate sitemap entries from the existing published article registry and locale availability; include only canonical, indexable final URLs. Use real significant modification dates or omit untrustworthy lastmod values. Remove search/alias URLs as appropriate. Confirm ownership/DNS intent and remove stale satellite sitemap declarations; keep frozen services dormant.

**Dependencies:** SEO-01 and SEO-07 canonical/indexing decisions; trustworthy published/modified fields. Do not include all archive/filter URLs automatically.

**Validation:** Expected published English article set minus sitemap article set is empty; every sitemap URL returns 200, is indexable and agrees with its canonical. Validate locale alternates. Recheck all declared sitemap endpoints from another resolver, and inspect sitemap processing in Search Console when connected.

**Leading indicator:** Eligible English articles represented: target 35/35 for the current crawl; invalid/redirecting/noncanonical sitemap URLs: target 0.

**Failure check:** Failure is a new published article omitted again, a blanket build-time lastmod refresh, or continuing declarations of confirmed retired hosts.

### SEO-05 — Pricing depends on client rendering and lacks a primary heading (Medium)

**Observed:** /in/pricing returned 200 with title Pricing, no H1, and no visible rupee-denominated plan prices in initial main HTML. Its later rendered DOM contained the paid plans and comparison table, but still no H1. Homepage pricing likewise populated after client loading. Initial browser snapshots briefly showed no plan cards. This does not prove Google fails to render the prices.

**Change:** Render public plan names, prices, trial conditions and availability in initial HTML using the existing pricing authority, with an honest fallback if unavailable. Use an H1 for the pricing page’s main heading and a specific title such as LetBuyy Pricing — Plans for Indian Online Stores. Preserve availability labels for future plans.

**Dependencies:** SEO-03 confirmed commercial facts; existing pricing data/cache contract.

**Validation:** Fetch with JavaScript disabled and confirm visible actual plan prices and conditions, then compare to hydrated values. Verify exactly one meaningful H1. Test loading/failure behavior without a false success state.

**Leading indicator:** Public pricing facts present in initial HTML and matching the hydrated page; missing-H1 count on commercial landing pages: target 0.

**Failure check:** Failure is raw markup containing only a loading placeholder or schema prices disagreeing with visible prices.

### SEO-09 — Article entities use relative URLs and omit useful image/author connections (Medium)

**Observed:** All 35 article pages include parseable Article and BreadcrumbList JSON-LD. In sampled articles, mainEntityOfPage.@id is /resources/... without the locale, publisher.logo.url is relative, and breadcrumb items use /resources and /resources/<category>. Article.image and author.url are absent in these samples despite visible illustrations and author pages. Team authors are represented as Person. JSON parsing found no syntax errors across the 163 English pages; no full schema validator or rich-results eligibility test was run.

**Change:** Use absolute final locale URLs for article IDs and breadcrumbs, absolute accessible image/logo URLs, and real linked author identities. Add a relevant visible representative article image where accurate. Model the editorial team as Organization. Keep the existing Organization/WebSite entities; avoid multiplying SEO components.

**Dependencies:** SEO-01 canonical URL policy; real author and image facts.

**Validation:** Parse all JSON-LD, validate sampled pages in Schema Markup Validator/Google Rich Results Test, and dereference the final entity/image URLs. Check that markup describes visible content.

**Leading indicator:** Article identity URLs matching the canonical: target 35/35; representative article image and genuine author connections present.

**Failure check:** Failure is structurally valid JSON with redirecting or incorrect entities, or fabricated author/rating data.

## Phase 3: content and experience — Weeks 2–4

### SEO-06 — Numerical growth claims lack sources; one contains a calculation error (Medium)

**Observed:** /in/resources/ecommerce/how-product-reviews-increase-conversion says conversion changes from 1.7% to 4.6% and calls it a 270% lift. The relative increase is (4.6−1.7)/1.7 ≈170.6%; 4.6 is about 270.6% of the original. The article also asserts a 3x WhatsApp response advantage without an editorial source link. None of the 35 English articles contains an external non-social/non-profile reference link under the documented link heuristic; absence of links is not proof every statement is false.

**Change:** Correct the percentage and headline, or replace the claim with faithfully scoped original research. Attribute study population, date, method and limitations; do not generalize global samples to Indian merchants without support. Source material performance/comparison claims and verify genuine author credentials. Keep team authors as an organization where appropriate.

**Dependencies:** Access to the actual underlying research or owned measurement; genuine editorial ownership.

**Validation:** Recompute every displayed comparison; verify that citations support the exact claim and geography. Check synchronized titles, summaries, schema and translations.

**Leading indicator:** Material numerical claims with verifiable sources and correct calculations; target 0 unsupported claims in priority guides.

**Failure check:** Failure is a corrected body retaining an inaccurate 270% headline, or a source that discusses a different outcome/sample.

### SEO-07 — Search and tag archives need an intentional indexing policy (Medium)

**Observed:** The crawl found 89 indexable English tag pages for 35 articles. Their raw main text ranges from 92 to 232 whitespace-delimited tokens including headings/cards. /in/resources/search is index, follow, appears in the sitemap, has no H1 and canonicalizes to the homepage. Tag canonicals also have the locale problem in SEO-01. Counts/lengths are diagnostics, not a Google minimum or proof of a penalty.

**Change:** Keep useful category/tag hubs that serve a distinct need and enrich their descriptions/curation. Consolidate overlapping tags or use noindex for low-value navigation archives where appropriate. Normally exclude internal search results from indexing and sitemaps, with a deliberate canonical policy. Preserve crawlable links to articles. Do not apply noindex solely because a page is short.

**Dependencies:** Article coverage and internal-link inventory; Search Console impressions/canonical data before broad pruning.

**Validation:** Recrawl both kept and excluded archive classes; ensure all 35 articles remain internally reachable and important hubs remain indexable. Validate noindex in HTML rather than blocking crawler access to the directive.

**Leading indicator:** Approved archive/indexing policy applied consistently; orphaned published articles: target 0.

**Failure check:** Failure is removing useful landing pages or making article discovery depend solely on search/filter controls.

### SEO-08 — Homepage category and India intent can be clearer (Medium)

**Observed:** /in title is LetBuyy — India-first commerce operating system | LetBuyy; H1 is More than a store. Your Commerce OS. The description already says online store in India with UPI/COD/GST. A focused web-search sample for online store builder India UPI GST zero commission returned product/home/feature landing pages emphasizing store creation, local payments and price. This is an intent hypothesis, not a geolocated Google ranking study. At the measured 390×844 viewport the H1 began near y=432 and the Start Free CTA near y=577, after the illustration.

**Change:** Keep the Commerce OS positioning but add plain buyer vocabulary near the main heading: online store builder for Indian businesses, UPI/COD, and the approved subscription/trial terms. Consider title Online Store Builder in India, 0% Commission | LetBuyy. Reduce duplicated brand text. On mobile, test moving the main promise and action ahead of the large illustration without changing the established visual identity.

**Dependencies:** SEO-03 truthful pricing; actual Search Console query/CTR and conversion baseline before claiming a lift.

**Validation:** Confirm raw/rendered/mobile copy agreement, no overflow and accessible actions. Compare query-relevant CTR and engaged signup starts on adequate data, accounting for query mix.

**Leading indicator:** Qualified non-brand impressions/CTR and homepage-to-signup starts when measurable; no ranking target is promised.

**Failure check:** Failure is more clicks with fewer qualified signup starts, or a title promising capabilities not generally available.

### SEO-11 — Complete social-preview metadata (Low)

**Observed:** Homepage has twitter:card=summary_large_image and twitter:image, but its raw and rendered metadata lack og:image, og:url and og:type. The declared social image is accessible at 1200×630, 52,770 bytes. Organization logo returns 200 at 512×512. All 1,471 img occurrences across English pages have an alt attribute; 1,369 are empty, frequently decorative/repeated UI art. Homepage has 53 img elements with empty alt; empty alt is not automatically an accessibility defect.

**Change:** Add a coherent Open Graph image, final page URL and appropriate type, with descriptive image metadata where useful. Keep empty alt on decorative/redundant illustrations; audit meaningful article/tutorial screenshots for descriptive alternatives. Use responsive variants where originals greatly exceed display size.

**Dependencies:** Existing page metadata utility and canonical URL policy.

**Validation:** Inspect server HTML and a social preview debugger; manually verify representative meaningful images against their context and accessible name.

**Leading indicator:** Intended preview image and canonical URL rendered by preview consumers; meaningful images without alternatives: target 0.

**Failure check:** Failure is decorating every image with repetitive keyword alt text or declaring an inaccessible preview image.

## Phase 4: measurement and iteration — When measurement access is available; then after recrawl

### SEO-10 — Measure and reduce unnecessary early image work (Medium)

**Observed:** Raw homepage HTML includes 16 image preload links and 22 loading=eager image elements, including capability and lower-page surface art. Decoded homepage HTML is 339,643 bytes; the compressed crawl response transferred 40,805 bytes. Three measured image assets returned 200: storefront illustration 107,040 bytes, bottom CTA 128,004 bytes, social image 52,770 bytes. Public PageSpeed Insights returned HTTP/API 429 RESOURCE_EXHAUSTED; LCP, INP, CLS, Lighthouse score and Agentic Browsing X/N are unavailable.

**Change:** Obtain a successful mobile/desktop Lighthouse lab run and CrUX/Search Console field data first. Reserve early preloads/eager fetching for actual critical above-fold content, lazy-load lower sections and serve appropriately sized variants. Profile animated illustration CPU/motion costs. Treat any speed improvement as a hypothesis until measured.

**Dependencies:** Available PageSpeed quota or an authorized local lab runner; CrUX/RUM field access if there is enough traffic.

**Validation:** Compare equivalent before/after lab runs and field LCP/INP/CLS separately; verify no new layout shift, visual break or delayed hero asset. Do not infer CWV from HTTP fetch time or HTML size.

**Leading indicator:** Critical-request/image bytes before LCP, followed by measured LCP/INP/CLS when available.

**Failure check:** Failure is reducing preload count without improving measured experience, or causing late hero rendering.

### SEO-12 — Machine access is open; special AI files are optional (Info)

**Observed:** robots.txt has one wildcard group allowing / and disallowing /signup; no named training/search/agent groups were observed. /llms.txt returned 404. Initial HTML contains substantial page/article content; pricing is the important client-rendered exception. Navigation, named CTAs, tabs, FAQ controls and responsive menu appeared in the browser accessibility tree. No UA spoofing matrix, action submission, WebMCP inventory or Lighthouse agentic suite was executed.

**Change:** Prioritize truthful, source-linked answers and consistent canonical entities over new discovery files. If the owner wants a distinct training/search/user-agent policy, document it separately and verify current crawler tokens before changing robots. An optional llms.txt may help selected consumers, but is not required for Google AI features and has no guaranteed citation benefit.

**Dependencies:** SEO-01/02/03/05; an explicit owner policy for any crawler-access change.

**Validation:** Recheck actual crawler access/server logs and primary crawler documentation before policy edits; measure real citations only with a reproducible query set and available tools.

**Leading indicator:** Priority answers present in initial HTML and backed by primary sources; actual citations remain unmeasured.

**Failure check:** Failure is treating an optional file as a ranking requirement or claiming visibility from robots access alone.

## Dependency order

Confirm product/compliance facts and canonical policy → repair the existing metadata and pricing output → regenerate the published-URL sitemap and entities → validate/redeploy through the normal owner-authorized release process → inspect Google-selected canonicals and query behavior after recrawl. Archive policy depends on discovery/impression data; performance changes depend on actual measurement.

After the next deployment, re-audit for zero contradictory offers, zero redirecting canonicals, 35/35 eligible article sitemap coverage, corrected tax/statistical claims across locales, and successful lab/field measurement. Track indexed canonical pages and qualified non-brand impressions over subsequent recrawls; do not promise immediate ranking changes.
