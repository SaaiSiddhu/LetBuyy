# LetBuyy India SEO audit

**Target:** [https://www.letbuyy.com/in](https://www.letbuyy.com/in)  
**Audit date:** 29 October 2026, Asia/Kolkata  
**Business:** India-focused commerce SaaS / online store builder  
**Scope:** Public English India marketing site, sitemap/discovery checks, desktop/mobile homepage and rendered pricing, plus limited Tamil/Hindi samples. This is an audit artifact, not project governance or an implementation/release decision.

## Executive assessment

The site is accessible and provides substantial server-rendered marketing and article content. Its largest measured weaknesses are inconsistent canonical URLs, an incomplete article sitemap, and contradictions in pricing/capability and compliance content. Fix correctness before expanding the content footprint. No site-wide indexing block or critical penalty was established.

**SEO Health Score: withheld.** PageSpeed quota prevented lab/field performance evidence, and Search Console, analytics, backlinks and AI citation measurements were unavailable. Category findings below are qualitative, with no invented 0–100 scores. Missing data is neither a failure nor a pass. No Google ranking, traffic or conversion impact has been measured.

| Measured item | Result |
|---|---:|
| Main crawl URL attempts | 171 |
| English India HTML pages returning 200 | 163 |
| English articles discovered | 35 |
| English tag archives | 89 |
| XML sitemap entries / English entries | 99 / 33 |
| Discovered English articles listed in XML sitemap | 0 / 35 |
| Locale-stripped canonicals | 101 |
| Other pages canonicalizing to homepage | 2 |
| JSON-LD syntax errors | 0 |
| English img occurrences / missing alt attribute | 1,471 / 0 |
| Lighthouse / CrUX / GSC / backlinks / AI citations | Unmeasured |

The 171 attempts comprise 163 English 200 HTML pages, two localized homepages, three root/alias requests that ultimately returned 200, one RSS response, one optional llms.txt 404, and one signup redirect stopped at accounts.letbuyy.com. Four additional locale pages and three canonical-target samples were fetched separately. Robots/sitemaps/assets/PSI probes are separate from that page count. All 33 English sitemap entries were fetched. Other-language sitemap entries were inventoried, not fully crawled. No query/filter URL expansion occurred.

## Highest priorities

| ID | Priority | Observed issue | First action |
|---|---|---|---|
| SEO-01 | High | 101 resource canonicals strip /in; representative targets redirect back | Use final intended locale canonical URLs |
| SEO-02 | High | GST guide conflicts with official TCS/exemption material | Correct with a qualified reviewer and primary sources |
| SEO-03 | High | Free-plan schema/copy conflicts with paid plans/trial; feature status differs | Reconcile visible offer and JSON-LD from approved facts |
| SEO-04 | High | All 35 English articles absent from sitemap | Build canonical published-article sitemap coverage |
| SEO-05 | Medium | Prices absent from initial HTML; pricing has no H1 | Server-render public plan facts and proper main heading |

Quick wins: Fix the existing canonical URL helper for affected resource templates. Remove unsupported free-forever offer claims after confirming the actual offer. Add the 35 published English articles to a canonical-only sitemap. Give pricing a descriptive title and primary heading. Correct the 1.7%→4.6% percentage calculation and synchronized headline.

## What already works

- Homepage returns HTTPS 200, permits indexing and self-canonicalizes to /in. No blanket robots block was found.
- Homepage and sampled article/contact locale variants have reciprocal en-IN/ta-IN/hi-IN/x-default alternates and translated visible copy. Categories can use sitemap hreflang; absence of duplicate HTML hreflang alone is not a defect.
- All 163 English HTML pages have descriptions and canonical elements. All 35 English articles have Article and BreadcrumbList JSON-LD, with visible bylines, dates and author pages. Syntax parses; semantic accuracy and rich-result eligibility remain separate checks.
- Internal category/tag/related-guide links expose the article library. RSS exists. Search results contain LetBuyy pages, though this does not establish Google index coverage.
- Modern image formats, lazy loading and dimension attributes are present. Many empty alts belong to redundant/decorative art; there is no basis for a blanket “missing alt” warning.
- Mobile homepage had no horizontal overflow in the measured snapshot, named actions and a menu button. Provider-dependency and illustrative-data labels appear in parts of the site; preserve these useful trust signals.
- HTTPS security headers include HSTS, CSP and nosniff. This is an observation, not a security certification or ranking guarantee.

## Technical SEO and indexing

### SEO-01 — Canonical URLs disagree with locale routing (High)

**Observed:** 101 English pages (7 resource categories, 89 tags, 5 authors) declare canonicals with /in removed. For example /in/resources/payments declares https://www.letbuyy.com/resources/payments. Three representative category/tag/author targets returned 307 to the corresponding /in page, which declares the redirecting URL again. Separately, /in/create has distinct content and H1 Create Your Site but inherits the homepage title/description and canonical; /in/resources/search also canonicalizes to the homepage. Evidence: page-inventory.csv, evidence/canonical-targets.json, evidence/analysis-summary.json.

**Change:** Use the final, intended indexable locale URL consistently in canonicals, navigation, structured data and sitemaps. Give /in/create its own metadata and canonical if it is intended as an organic landing page; otherwise make its consolidation explicit. Treat internal search separately, as SEO-07 describes. Keep homepage and article self-canonicals that already work.

**Dependencies:** Agree which archives and creation pages should be indexed; reuse the existing URL/locale metadata utilities, without adding a parallel SEO system.

**Validation:** Recrawl every affected route: each intended indexable URL has one absolute self-canonical returning 200 with no redirect. Inspect sample Google-selected canonicals in Search Console when access is available.

**Leading indicator:** Count of intended indexable pages whose declared canonical redirects or differs from their final URL: target 0.

**Failure check:** Failure is any remaining locale-stripped canonical or Google selecting an unintended canonical after recrawl; do not treat changed HTML alone as proof of indexing.


The seven category pages, 89 tag pages and five author pages comprise the 101 locale-stripped canonicals. Three sampled redirect chains are saved in evidence/canonical-targets.json. This creates contradictory signals; it does not prove that Google rejected those pages. Root /, /pricing and /resources return temporary 307 redirects to /in equivalents. They work; stable public aliases can be reviewed for permanent redirects later if appropriate, without changing locale/user routing indiscriminately.

### SEO-04 — XML sitemap omits the entire discovered article library (High)

**Observed:** /sitemap.xml contains 99 URLs, 33 per locale; all 35 discovered English article URLs are absent. Categories and internal links make them crawlable, so omission is not proof that they are unindexed. All 99 lastmod values are 2026-06-04 although sampled article/release content has later displayed dates. /in/create and /in/resources/search are listed despite canonicalizing to the homepage. Robots also declares three satellite sitemaps (themes/apps/developer) that failed DNS resolution in this audit.

**Change:** Generate sitemap entries from the existing published article registry and locale availability; include only canonical, indexable final URLs. Use real significant modification dates or omit untrustworthy lastmod values. Remove search/alias URLs as appropriate. Confirm ownership/DNS intent and remove stale satellite sitemap declarations; keep frozen services dormant.

**Dependencies:** SEO-01 and SEO-07 canonical/indexing decisions; trustworthy published/modified fields. Do not include all archive/filter URLs automatically.

**Validation:** Expected published English article set minus sitemap article set is empty; every sitemap URL returns 200, is indexable and agrees with its canonical. Validate locale alternates. Recheck all declared sitemap endpoints from another resolver, and inspect sitemap processing in Search Console when connected.

**Leading indicator:** Eligible English articles represented: target 35/35 for the current crawl; invalid/redirecting/noncanonical sitemap URLs: target 0.

**Failure check:** Failure is a new published article omitted again, a blanket build-time lastmod refresh, or continuing declarations of confirmed retired hosts.


All 99 sitemap timestamps are identical. Do not replace them with the current build time: significant updates should drive lastmod, or omit the field when no trustworthy date exists. Google ignores sitemap priority/changefreq and uses lastmod when verifiably accurate. [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

### SEO-07 — Search and tag archives need an intentional indexing policy (Medium)

**Observed:** The crawl found 89 indexable English tag pages for 35 articles. Their raw main text ranges from 92 to 232 whitespace-delimited tokens including headings/cards. /in/resources/search is index, follow, appears in the sitemap, has no H1 and canonicalizes to the homepage. Tag canonicals also have the locale problem in SEO-01. Counts/lengths are diagnostics, not a Google minimum or proof of a penalty.

**Change:** Keep useful category/tag hubs that serve a distinct need and enrich their descriptions/curation. Consolidate overlapping tags or use noindex for low-value navigation archives where appropriate. Normally exclude internal search results from indexing and sitemaps, with a deliberate canonical policy. Preserve crawlable links to articles. Do not apply noindex solely because a page is short.

**Dependencies:** Article coverage and internal-link inventory; Search Console impressions/canonical data before broad pruning.

**Validation:** Recrawl both kept and excluded archive classes; ensure all 35 articles remain internally reachable and important hubs remain indexable. Validate noindex in HTML rather than blocking crawler access to the directive.

**Leading indicator:** Approved archive/indexing policy applied consistently; orphaned published articles: target 0.

**Failure check:** Failure is removing useful landing pages or making article discovery depend solely on search/filter controls.


The optional llms.txt 404 is excluded from broken-link defect counts. No in-scope marketing HTML 404 or 500 was observed. Signup redirects were not followed into accounts; this is not an auth failure. Satellite sitemap DNS failures need another-resolver confirmation before changes.

## Content correctness, expertise and trust

### SEO-02 — GST guide contains outdated or overgeneralized tax guidance (High)

**Observed:** /in/resources/payments/gst-for-ecommerce-india says marketplace TCS is 1% and marketplace GST registration is mandatory regardless of turnover. The GST Council July 2024 newsletter documents a reduction from 1% to 0.5%; Notification 34/2023 provides a conditional registration exemption for qualifying intra-state goods sellers through ecommerce operators. The page provides no linked official editorial sources. Both sampled Tamil/Hindi versions repeat the substantive guidance. This audit establishes conflicts with official material, not a comprehensive legal opinion on every rate or exception.

**Change:** Review the guide and its translations with a qualified tax reviewer; correct TCS, registration exceptions, category-rate tables and filing schedules against applicable current notifications. Add inline primary sources, effective dates, real reviewer attribution and a meaningful reviewed date. Review adjacent GST/invoicing guides for propagation.

**Dependencies:** Current official notifications and a real qualified reviewer; do not invent credentials or replace business policy.

**Validation:** Every tax rate, threshold and mandatory statement has a supporting current primary source and applicable conditions; verify all three language versions together.

**Leading indicator:** Number of unresolved factual conflicts in sampled compliance guides: target 0; percentage of tax claims with dated official sources.

**Failure check:** Failure is retained blanket advice contradicted by a source, or translations still repeating the removed claim.


The official [July 2024 GST Council newsletter](https://gstcouncil.gov.in/sites/default/files/2024-08/july_newsletter.pdf) records the TCS reduction. [Notification 34/2023](https://gstcouncil.gov.in/sites/default/files/2024-05/gst-ct-34-2023.pdf) describes the conditional registration exemption and its intra-state/enrollment requirements. The guide’s unconditional statements conflict with those sources. Other rates, filing obligations and exceptions need a current full review; this audit does not substitute a new generic tax rule.

### SEO-06 — Numerical growth claims lack sources; one contains a calculation error (Medium)

**Observed:** /in/resources/ecommerce/how-product-reviews-increase-conversion says conversion changes from 1.7% to 4.6% and calls it a 270% lift. The relative increase is (4.6−1.7)/1.7 ≈170.6%; 4.6 is about 270.6% of the original. The article also asserts a 3x WhatsApp response advantage without an editorial source link. None of the 35 English articles contains an external non-social/non-profile reference link under the documented link heuristic; absence of links is not proof every statement is false.

**Change:** Correct the percentage and headline, or replace the claim with faithfully scoped original research. Attribute study population, date, method and limitations; do not generalize global samples to Indian merchants without support. Source material performance/comparison claims and verify genuine author credentials. Keep team authors as an organization where appropriate.

**Dependencies:** Access to the actual underlying research or owned measurement; genuine editorial ownership.

**Validation:** Recompute every displayed comparison; verify that citations support the exact claim and geography. Check synchronized titles, summaries, schema and translations.

**Leading indicator:** Material numerical claims with verifiable sources and correct calculations; target 0 unsupported claims in priority guides.

**Failure check:** Failure is a corrected body retaining an inaccurate 270% headline, or a source that discusses a different outcome/sample.


Bylines and author bios exist. The audit did not verify people’s qualifications, employment history, cited results or first-hand product use. Keep only supportable credentials. Practical original walkthroughs, verified screenshots and named real reviewers provide stronger evidence than adding generic words to meet an arbitrary length target. The 35-article library already covers store setup, payments, GST, fulfillment and growth; improve these existing pages before creating parallel pages targeting the same intent.

## On-page signals and search experience

### SEO-05 — Pricing depends on client rendering and lacks a primary heading (Medium)

**Observed:** /in/pricing returned 200 with title Pricing, no H1, and no visible rupee-denominated plan prices in initial main HTML. Its later rendered DOM contained the paid plans and comparison table, but still no H1. Homepage pricing likewise populated after client loading. Initial browser snapshots briefly showed no plan cards. This does not prove Google fails to render the prices.

**Change:** Render public plan names, prices, trial conditions and availability in initial HTML using the existing pricing authority, with an honest fallback if unavailable. Use an H1 for the pricing page’s main heading and a specific title such as LetBuyy Pricing — Plans for Indian Online Stores. Preserve availability labels for future plans.

**Dependencies:** SEO-03 confirmed commercial facts; existing pricing data/cache contract.

**Validation:** Fetch with JavaScript disabled and confirm visible actual plan prices and conditions, then compare to hydrated values. Verify exactly one meaningful H1. Test loading/failure behavior without a false success state.

**Leading indicator:** Public pricing facts present in initial HTML and matching the hydrated page; missing-H1 count on commercial landing pages: target 0.

**Failure check:** Failure is raw markup containing only a loading placeholder or schema prices disagreeing with visible prices.


Prices appeared in the browser after client loading; they were not permanently absent. This is a reliance on rendering, with weaker immediate machine access, not a confirmed Google rendering failure. The homepage’s initial HTML includes illustrative product prices; those must not be confused with the subscription plans.

### SEO-08 — Homepage category and India intent can be clearer (Medium)

**Observed:** /in title is LetBuyy — India-first commerce operating system | LetBuyy; H1 is More than a store. Your Commerce OS. The description already says online store in India with UPI/COD/GST. A focused web-search sample for online store builder India UPI GST zero commission returned product/home/feature landing pages emphasizing store creation, local payments and price. This is an intent hypothesis, not a geolocated Google ranking study. At the measured 390×844 viewport the H1 began near y=432 and the Start Free CTA near y=577, after the illustration.

**Change:** Keep the Commerce OS positioning but add plain buyer vocabulary near the main heading: online store builder for Indian businesses, UPI/COD, and the approved subscription/trial terms. Consider title Online Store Builder in India, 0% Commission | LetBuyy. Reduce duplicated brand text. On mobile, test moving the main promise and action ahead of the large illustration without changing the established visual identity.

**Dependencies:** SEO-03 truthful pricing; actual Search Console query/CTR and conversion baseline before claiming a lift.

**Validation:** Confirm raw/rendered/mobile copy agreement, no overflow and accessible actions. Compare query-relevant CTR and engaged signup starts on adequate data, accounting for query mix.

**Leading indicator:** Qualified non-brand impressions/CTR and homepage-to-signup starts when measurable; no ranking target is promised.

**Failure check:** Failure is more clicks with fewer qualified signup starts, or a title promising capabilities not generally available.


The focused search sample supports a commercial product-landing page, so no page-type mismatch is established. Detailed user stories and five official product-page comparisons are in findings/sxo.md. No search volumes, controlled SERP positions, click forecasts or persona scores are claimed. Homepage description is already specific to India/UPI/COD/GST. Exact metadata duplicates are limited to /in versus /in/create, and resource-index versus search titles; do not label every templated archive title a spam defect.

## Structured data and commercial consistency

### SEO-03 — Free-plan and capability claims conflict across the site (High)

**Observed:** The global JSON-LD on all 163 English HTML pages contains SoftwareApplication.offers.price="0" and describes a free launch tier. Homepage/pricing CTAs also claim a free-forever plan, while rendered pricing displays Launch at ₹199/month founding price (₹299 regular), Growth at ₹699 (₹999 regular), and a 14-day trial. The app-marketplace guide describes browsing/installing reviewed apps, while /in/legal/terms says public publishing surfaces are not open. Homepage/FAQ mentions AI/B2B and 50+ AI capabilities, while the Commerce OS plan labels AI Copilot/B2B coming soon. These are observed inconsistencies; actual provider readiness and paid signup behavior were not tested.

**Change:** Reconcile the published offer and availability against the approved product/pricing source. Distinguish zero platform commission, free trial, any genuine free plan, paid subscription and third-party charges. Generate visible copy and offers from that same existing source. Remove or correct unsupported free-offer markup and qualify planned/provider-dependent capabilities. Correct promises rather than activating a dormant marketplace to satisfy copy.

**Dependencies:** Approved commercial and feature-availability facts. Preserve the project’s 0% storefront transaction-fee rule; the audit does not authorize new rates or marketplace activation (WIN-R4, NEVER-R3/R5).

**Validation:** Compare raw HTML, hydrated pricing, CTA copy, FAQ, legal text and JSON-LD for the same offer. Validate syntax and run Google Rich Results Test; valid JSON alone is not rich-result eligibility. Never invent reviews/ratings to obtain eligibility.

**Leading indicator:** Count of contradictory offer/feature statements across the sampled surfaces: target 0.

**Failure check:** Failure is price=0 without a corresponding genuine visible free offer, or a guide representing a closed/planned capability as generally available.


[Google’s structured-data policy](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) calls for accurate, visible information. A free trial, 0% commission and free lifetime software access are different assertions. Resolve the offer before choosing a corrected price/schema. [Software-app eligibility](https://developers.google.com/search/docs/appearance/structured-data/software-app) is a separate test; no rich result is promised.

The site’s app guide describes reviewed apps and an installation flow; legal terms describe publishing surfaces as closed, and releases discuss partner submissions. This may reflect separate audiences/statuses but needs explicit explanation. The recommendation is truthful documentation, not activating dormant app-marketplace/developer runtimes. It preserves project rules WIN-R4 and NEVER-R3.

### SEO-09 — Article entities use relative URLs and omit useful image/author connections (Medium)

**Observed:** All 35 article pages include parseable Article and BreadcrumbList JSON-LD. In sampled articles, mainEntityOfPage.@id is /resources/... without the locale, publisher.logo.url is relative, and breadcrumb items use /resources and /resources/<category>. Article.image and author.url are absent in these samples despite visible illustrations and author pages. Team authors are represented as Person. JSON parsing found no syntax errors across the 163 English pages; no full schema validator or rich-results eligibility test was run.

**Change:** Use absolute final locale URLs for article IDs and breadcrumbs, absolute accessible image/logo URLs, and real linked author identities. Add a relevant visible representative article image where accurate. Model the editorial team as Organization. Keep the existing Organization/WebSite entities; avoid multiplying SEO components.

**Dependencies:** SEO-01 canonical URL policy; real author and image facts.

**Validation:** Parse all JSON-LD, validate sampled pages in Schema Markup Validator/Google Rich Results Test, and dereference the final entity/image URLs. Check that markup describes visible content.

**Leading indicator:** Article identity URLs matching the canonical: target 35/35; representative article image and genuine author connections present.

**Failure check:** Failure is structurally valid JSON with redirecting or incorrect entities, or fabricated author/rating data.


Do not add FAQ schema as a Google rich-result growth tactic: current [Google documentation updates](https://developers.google.com/search/updates) record FAQ rich-result retirement in 2026. Helpful visible answers remain useful.

## Performance and images

### SEO-10 — Measure and reduce unnecessary early image work (Medium)

**Observed:** Raw homepage HTML includes 16 image preload links and 22 loading=eager image elements, including capability and lower-page surface art. Decoded homepage HTML is 339,643 bytes; the compressed crawl response transferred 40,805 bytes. Three measured image assets returned 200: storefront illustration 107,040 bytes, bottom CTA 128,004 bytes, social image 52,770 bytes. Public PageSpeed Insights returned HTTP/API 429 RESOURCE_EXHAUSTED; LCP, INP, CLS, Lighthouse score and Agentic Browsing X/N are unavailable.

**Change:** Obtain a successful mobile/desktop Lighthouse lab run and CrUX/Search Console field data first. Reserve early preloads/eager fetching for actual critical above-fold content, lazy-load lower sections and serve appropriately sized variants. Profile animated illustration CPU/motion costs. Treat any speed improvement as a hypothesis until measured.

**Dependencies:** Available PageSpeed quota or an authorized local lab runner; CrUX/RUM field access if there is enough traffic.

**Validation:** Compare equivalent before/after lab runs and field LCP/INP/CLS separately; verify no new layout shift, visual break or delayed hero asset. Do not infer CWV from HTTP fetch time or HTML size.

**Leading indicator:** Critical-request/image bytes before LCP, followed by measured LCP/INP/CLS when available.

**Failure check:** Failure is reducing preload count without improving measured experience, or causing late hero rendering.


No lab or field LCP, INP or CLS was measured. No mobile/desktop Lighthouse score or Lighthouse Agentic Browsing X/N is available. The public PSI response is saved; repeated quota retries were avoided. A 0 score would be misleading. The raw transfer-size samples are resource observations, not a speed benchmark or CrUX substitute.

### SEO-11 — Complete social-preview metadata (Low)

**Observed:** Homepage has twitter:card=summary_large_image and twitter:image, but its raw and rendered metadata lack og:image, og:url and og:type. The declared social image is accessible at 1200×630, 52,770 bytes. Organization logo returns 200 at 512×512. All 1,471 img occurrences across English pages have an alt attribute; 1,369 are empty, frequently decorative/repeated UI art. Homepage has 53 img elements with empty alt; empty alt is not automatically an accessibility defect.

**Change:** Add a coherent Open Graph image, final page URL and appropriate type, with descriptive image metadata where useful. Keep empty alt on decorative/redundant illustrations; audit meaningful article/tutorial screenshots for descriptive alternatives. Use responsive variants where originals greatly exceed display size.

**Dependencies:** Existing page metadata utility and canonical URL policy.

**Validation:** Inspect server HTML and a social preview debugger; manually verify representative meaningful images against their context and accessible name.

**Leading indicator:** Intended preview image and canonical URL rendered by preview consumers; meaningful images without alternatives: target 0.

**Failure check:** Failure is decorating every image with repetitive keyword alt text or declaring an inaccessible preview image.


The measured Open Graph image is 1200×630. The organization PNG is 512×512 and 225,263 bytes; it is not the header SVG. The storefront/CTA WebPs are 107,040 and 128,004 bytes. These measurements do not prove an oversized LCP element. Check critical request waterfalls before changing asset priority.

## AI search and agent readiness

### SEO-12 — Machine access is open; special AI files are optional (Info)

**Observed:** robots.txt has one wildcard group allowing / and disallowing /signup; no named training/search/agent groups were observed. /llms.txt returned 404. Initial HTML contains substantial page/article content; pricing is the important client-rendered exception. Navigation, named CTAs, tabs, FAQ controls and responsive menu appeared in the browser accessibility tree. No UA spoofing matrix, action submission, WebMCP inventory or Lighthouse agentic suite was executed.

**Change:** Prioritize truthful, source-linked answers and consistent canonical entities over new discovery files. If the owner wants a distinct training/search/user-agent policy, document it separately and verify current crawler tokens before changing robots. An optional llms.txt may help selected consumers, but is not required for Google AI features and has no guaranteed citation benefit.

**Dependencies:** SEO-01/02/03/05; an explicit owner policy for any crawler-access change.

**Validation:** Recheck actual crawler access/server logs and primary crawler documentation before policy edits; measure real citations only with a reproducible query set and available tools.

**Leading indicator:** Priority answers present in initial HTML and backed by primary sources; actual citations remain unmeasured.

**Failure check:** Failure is treating an optional file as a ranking requirement or claiming visibility from robots access alone.


Google says ordinary SEO applies to its AI features and no special AI files/schema are required. [Google AI feature guidance](https://developers.google.com/search/docs/appearance/ai-features). Accurate citations, direct explanations, consistent entities and accessible initial HTML are the useful shared improvements. Schema and robots access do not establish actual AI citations.

The manual browser sample showed semantic links, named CTAs, tabs, FAQ controls and a mobile menu. This is not an accessibility or end-to-end agent-action certification. No WebMCP standards-compliance claim is made. Training/search/user-triggered policy lines are documented separately in findings/geo.md and findings/agentic.md.

## Locale coverage, authority and excluded specializations

Homepage, contact and one GST-guide family were sampled in English/Tamil/Hindi; translated body text and reciprocal self-referencing alternates are present in these samples. The GST errors repeat in both translations, so corrections must travel together. This sample does not certify all translated pages or sitemap alternates. See [Google localized-page guidance](https://developers.google.com/search/docs/specialty/international/localized-versions).

Local GBP/Maps/NAP and merchant-product feed audits are not applicable to the observed SaaS marketing site without evidence of a relevant physical local-business presence or a consumer product catalog. Backlinks, brand authority, GSC/GA4/Matomo, keyword volumes and actual AI citations were unavailable. No comparable prior production drift baseline was used; existing local development evidence is a different environment.

## Action order and verification

Follow [ACTION-PLAN.md](ACTION-PLAN.md). First confirm truthful offers/compliance and canonical policy; then repair the existing metadata/pricing output, regenerate the sitemap and entities, and verify through the normal authorized release process. Content expansion, broad archive pruning and performance changes follow supporting evidence. Estimated working windows are planning suggestions, not delivery commitments.

The project received only audit artifacts under this report folder. Existing source changes were preserved; no code, pricing, DNS, robots, analytics, indexing settings, forms, accounts or deployments were changed. Governance plan/inventory and the architecture validator passed; this is not a full governance or production release certification. Full-gate cleanup was intentionally not run against unrelated local build outputs. Report JSON/CSV/count/link validation is recorded in evidence/deliverable-validation.json.

## Deliverables and limits

- FULL-AUDIT-REPORT.md: this comprehensive report.
- ACTION-PLAN.md: dependency-aware actions, evidence, leading indicators and failure checks.
- audit-data.json: structured envelope; missing metrics/scores are null.
- page-inventory.csv: all 163 English HTML pages with metadata, canonical, headings and schema types.
- findings/: technical, sitemap, content, on-page, schema, performance, images, GEO, agentic, visual, SXO and coverage findings.
- evidence/: saved HTTP/HTML, crawl data, locale and canonical-target samples, rendered homepage/pricing, PSI quota response, analysis and limited governance checks.
- screenshots/: desktop/mobile homepage, article and pricing snapshots.

No numeric aggregate is issued. The fixed skill weights (technical 22%, content 23%, on-page 20%, schema 10%, performance 10%, AI 10%, images 5%) were not used to fill gaps with zeros or guesses. The managed skill runtime was absent; no global installation was attempted. Public fetches used TLS verification, public-IP validation/pinning, redirect bounds, robots rules, five-worker maximum and one-second spacing within the main crawl. Categories shared one crawl. Small focused supplementary checks followed.

A PDF/HTML version can be generated on request. The current Markdown/JSON retains the missing-data caveats rather than presenting placeholder metrics as real measurements.

At the next audit, check for zero redirecting canonicals on intended indexable pages, all 35 eligible articles in the sitemap, consistent paid/free/trial claims, reviewed tax/statistical facts across locales, prices present before hydration, and successful lab/field measurements. Then inspect Google-selected canonicals and qualified non-brand impressions after recrawl; no immediate ranking gain is promised.
