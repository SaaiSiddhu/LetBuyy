# Technical, schema, sitemap, images and international audit

Completed shared-crawl analysis: 2026-10-29T18:12:15.092782+00:00. This specialist made no additional site crawl. Counts cover 489 clean requested HTTPS marketing HTML pages across {"in": 163, "in-ta": 163, "in-hi": 163}; aliases, deliberate invalid-tag/error probes and non-HTML resources are treated separately.

## Measured coverage

- XML sitemap: 99 entries, all inspected in the shared crawl except any explicitly recorded transport failure/retry. 105 article equivalents identified from Article JSON-LD; 105 absent from XML sitemap.
- Canonical mismatch diagnostics: 309 pages, including 303 locale-stripped resource canonicals plus create/search inheritance.
- JSON-LD syntax errors: 0. Main entity types: Organization: 597, WebSite: 489, SoftwareApplication: 489, ContactPage: 3, Article: 105, BreadcrumbList: 105.
- Images: 4413 occurrences / 95 distinct source URLs; 0 missing alt attributes, 4107 empty alts, 0 missing width/height pairs. Decorative/redundant images may correctly have empty alt. These are not unique-image accessibility failures.
- Image loading: {"default": 1464, "lazy": 1059, "eager": 1890}; 18 occurrences have srcset. Source uses unoptimized illustrations in many components. Responsive-variant/priority changes are opportunities requiring byte/display-size/waterfall evidence, not a blanket instruction to add keyword alts or convert every image.
- A successful HTTP response and index/follow directive mean technically eligible to crawl/index; actual Google indexing and selected canonical remain unmeasured without GSC.
- No laboratory or field performance values are inferred from HTML. See parent performance/browser evidence for measured values and limits.

## Findings

### TECH-01 — Resource category, tag and author canonicals remove the locale

**High · Confirmed · confidence: High · 303 affected inspected URLs · Template-wide**

**Evidence:** 303 live pages declare a locale-free canonical. The source category/tag/author generateMetadata functions return /resources/... instead of the actual /in, /in-ta or /in-hi URL. Shared normalization probes demonstrate representative locale-free targets redirecting to /in. Current raw evidence and all affected URLs are listed in evidence/technical-analysis.json.

**Representative URLs:** [https://www.letbuyy.com/in/resources/ecommerce](https://www.letbuyy.com/in/resources/ecommerce), [https://www.letbuyy.com/in-ta/resources/ecommerce](https://www.letbuyy.com/in-ta/resources/ecommerce), [https://www.letbuyy.com/in-hi/resources/ecommerce](https://www.letbuyy.com/in-hi/resources/ecommerce), [https://www.letbuyy.com/in/resources/growth](https://www.letbuyy.com/in/resources/growth), [https://www.letbuyy.com/in-ta/resources/growth](https://www.letbuyy.com/in-ta/resources/growth), [https://www.letbuyy.com/in-hi/resources/growth](https://www.letbuyy.com/in-hi/resources/growth)

**Why it matters:** Contradictory canonical/redirect signals complicate page consolidation; translated pages nominate the same locale-free identity. This does not establish Google-selected canonicals or an indexing loss.

**Correction:** Reuse existing localizeMetadata/buildAlternates in /Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/i18n/metadata.ts and routing.ts. Change the three resource templates to generate absolute final locale canonicals; preserve navigation, sitemap and schema agreement. Do not rewrite a working helper or create a second SEO system.

**Owner / effort:** Frontend engineer · 0.5–1 engineer day including template tests; excludes release

**Dependencies:** Decide which archive types should remain indexable; preserve genuine translated equivalents.

**Validation:** Recrawl every category/tag/author in all three locales; each retained indexable page has one absolute self-canonical returning200. Test sampled language alternates and URL normalization. Later inspect Google-selected canonicals when GSC is available.

**Success indicator:** 0 redirecting or locale-stripped canonicals among retained intended indexable pages.

```ts
return localizeMetadata({ title, description }, localeSegment, `/resources/${categorySlug}`)
```

**Primary references:** [source 1](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [source 2](https://developers.google.com/search/docs/specialty/international/localized-versions)

### TECH-02 — Creation chooser inherits homepage metadata and language alternatives

**Medium · Confirmed · confidence: High · 3 affected inspected URLs · Template-wide**

**Evidence:** All captured locale creation pages display Create Your Site (translated where applicable) but inherit homepage title/description/canonical and homepage hreflang targets. Their distinct chooser is listed in the XML sitemap.

**Representative URLs:** [https://www.letbuyy.com/in/create](https://www.letbuyy.com/in/create), [https://www.letbuyy.com/in-ta/create](https://www.letbuyy.com/in-ta/create), [https://www.letbuyy.com/in-hi/create](https://www.letbuyy.com/in-hi/create)

**Why it matters:** A distinct acquisition page is described as a homepage duplicate; metadata does not express its task. Whether it should be an organic landing page is a product decision.

**Correction:** In /Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/[locale]/create/page.tsx, provide task-specific localized metadata/self-canonical if retained for indexing, or deliberately noindex/exclude the chooser if it is only a signup step. Keep homepage consolidation only if the page is actually duplicative.

**Owner / effort:** Product owner + frontend engineer · 0.25–0.5 engineer day after indexability decision

**Dependencies:** Creation-page purpose; TECH-01 URL policy.

**Validation:** Check all three locale source responses, headings, canonical/alternates, index directive and sitemap agreement; complete a safe chooser navigation sample without submitting signup.

**Success indicator:** 3/3 chooser URLs follow the chosen consistent indexing/metadata policy.

**Primary references:** [source 1](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

### TECH-03 — Internal search pages are indexable, sitemap-listed and canonicalize to home

**Medium · Confirmed · confidence: High · 3 affected inspected URLs · Template-wide**

**Evidence:** The three base resource-search pages emit index/follow, inherit homepage canonical and homepage hreflang, reuse a resource index title and have no H1. All three appear in sitemap.xml. Query-result variants were deliberately not expanded.

**Representative URLs:** [https://www.letbuyy.com/in/resources/search](https://www.letbuyy.com/in/resources/search), [https://www.letbuyy.com/in-ta/resources/search](https://www.letbuyy.com/in-ta/resources/search), [https://www.letbuyy.com/in-hi/resources/search](https://www.letbuyy.com/in-hi/resources/search)

**Why it matters:** Unrelated consolidation and public indexing signals disagree. This is not proof of large-scale search-result index bloat.

**Correction:** Choose an explicit internal-search indexing policy. Usually noindex the search UI/results and remove them from sitemap; keep crawler access to see noindex and preserve category/article links. Give the page a useful main heading for users. Do not indiscriminately robots-block the pages before Google can read exclusion directives.

**Owner / effort:** SEO lead + frontend engineer · 0.25–0.5 engineer day

**Dependencies:** TECH-01 final URL policy; preserve article discovery.

**Validation:** Check initial HTML robots directives, H1 and exclusion from sitemap for all locales; verify all approved articles remain reachable from normal links. Sample only a bounded real query after policy is implemented.

**Success indicator:** All 3 search routes have intentional indexing policy; no search URLs in the canonical sitemap when excluded.

**Primary references:** [source 1](https://developers.google.com/search/docs/crawling-indexing/block-indexing)

### TECH-04 — XML sitemap omits every discovered localized article

**High · Confirmed · confidence: High · 105 affected inspected URLs · Template-wide**

**Evidence:** 105/105 inspected localized articles are absent from the 99-entry XML sitemap. The static sitemap source expands core/category/legal paths only; getAllArticlesForSitemap() already exists in src/lib/resources/utils.ts but is unused by the sitemap.

**Representative URLs:** [https://www.letbuyy.com/in-hi/resources/ai-commerce/ai-commerce-explained](https://www.letbuyy.com/in-hi/resources/ai-commerce/ai-commerce-explained), [https://www.letbuyy.com/in-hi/resources/ai-commerce/ai-product-recommendations](https://www.letbuyy.com/in-hi/resources/ai-commerce/ai-product-recommendations), [https://www.letbuyy.com/in-hi/resources/ai-commerce/automating-operations-ai](https://www.letbuyy.com/in-hi/resources/ai-commerce/automating-operations-ai), [https://www.letbuyy.com/in-hi/resources/ai-commerce/commerce-copilot-guide](https://www.letbuyy.com/in-hi/resources/ai-commerce/commerce-copilot-guide), [https://www.letbuyy.com/in-hi/resources/ai-commerce/workflow-automation-merchants](https://www.letbuyy.com/in-hi/resources/ai-commerce/workflow-automation-merchants), [https://www.letbuyy.com/in-hi/resources/developers/building-first-letbuyy-app](https://www.letbuyy.com/in-hi/resources/developers/building-first-letbuyy-app)

**Why it matters:** Weakens an important discovery/canonical inventory channel; articles remain internally linked, so omission does not prove they are unindexed.

**Correction:** Generate entries from the existing published article registry and actually available translations. Include approved, indexable final200 URLs with canonical agreement and correct alternates; remove search/noncanonical aliases according to policy. Correct public content claims before amplifying discovery. Do not create another article authority.

**Owner / effort:** Frontend engineer + editor · 0.5–1 engineer day plus editorial eligibility review

**Dependencies:** TECH-01/02/03 canonical/indexing decisions; CONTENT factual/availability corrections.

**Validation:** Compare expected approved article set to sitemap set; set difference must be empty. Fetch each intended sitemap URL, check status/index directive/canonical, and validate reciprocal alternate sets. Confirm GSC processing later if access exists.

**Success indicator:** 100% coverage of approved indexable published article equivalents;0 invalid/noncanonical/excluded sitemap URLs.

**Primary references:** [source 1](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

### TECH-05 — Sitemap lastmod is a fixed June date despite later release content

**Low · Confirmed · confidence: High · 99 affected inspected URLs · Template-wide**

**Evidence:** All 99 sitemap lastmod values equal 2026-06-04T00:00:00.000Z. Changelog/releases visibly include 22 July 2026 updates. Source hardcodes one June 4 Date for every route, so this is stronger evidence than identical dates alone.

**Representative URLs:** [https://www.letbuyy.com/in](https://www.letbuyy.com/in), [https://www.letbuyy.com/in-ta](https://www.letbuyy.com/in-ta), [https://www.letbuyy.com/in-hi](https://www.letbuyy.com/in-hi), [https://www.letbuyy.com/in/pricing](https://www.letbuyy.com/in/pricing), [https://www.letbuyy.com/in-ta/pricing](https://www.letbuyy.com/in-ta/pricing), [https://www.letbuyy.com/in-hi/pricing](https://www.letbuyy.com/in-hi/pricing)

**Why it matters:** Misrepresents significant updates on at least the release/changelog pages; does not prove all 99 pages changed after June 4 or that Google penalized the site.

**Correction:** Use real significant content modification dates owned by each content source; omit lastmod where no trustworthy value exists. Do not replace the fixed date with build time. priority/changefreq are ignored by Google and need not become a separate fix.

**Owner / effort:** Frontend engineer + editorial owner · 0.25–0.5 engineer day

**Dependencies:** Trustworthy content modification fields and TECH-04 sitemap generation.

**Validation:** Inspect all lastmod values against corresponding significant-content history. A no-content-change rebuild must not advance them; a real release/article edit should advance the correct entry only.

**Success indicator:** No known stale or fabricated lastmod values; unaffected URLs retain their true dates.

**Primary references:** [source 1](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

### TECH-06 — Pricing lacks a primary heading and descriptive page title

**Medium · Confirmed · confidence: High · 3 affected inspected URLs · Template-wide**

**Evidence:** All three pricing source responses have zero H1 headings; the reusable Pricing component renders its main heading as H2. English title is simply Pricing. Other locales also have no H1. Client-only plan loading is handled in the content/performance findings, not duplicated here.

**Representative URLs:** [https://www.letbuyy.com/in/pricing](https://www.letbuyy.com/in/pricing), [https://www.letbuyy.com/in-ta/pricing](https://www.letbuyy.com/in-ta/pricing), [https://www.letbuyy.com/in-hi/pricing](https://www.letbuyy.com/in-hi/pricing)

**Why it matters:** The commercial page lacks a clear primary document heading and specific search-result title; this is not a standalone indexing blocker.

**Correction:** Add a page-level localized H1 and a descriptive title using approved offer facts. Make the shared pricing section accept heading context or use a separate page wrapper so the homepage subsection remains H2. Synchronize visible prices, metadata and schema with the canonical pricing authority.

**Owner / effort:** Frontend engineer + product marketer · 0.25 engineer day, excluding commercial-fact review

**Dependencies:** Approved offer facts; pricing SSR work coordinated separately.

**Validation:** Check raw/rendered HTML for one useful H1 on each pricing page; homepage retains its own primary H1 and pricing H2. Validate price/title truth against the actual public offer.

**Success indicator:** 3/3 pricing routes have task-specific titles and one meaningful primary heading.

**Primary references:** [source 1](https://developers.google.com/search/docs/appearance/title-link)

### TECH-07 — Article entities and breadcrumbs do not use final localized identities

**Medium · Confirmed · confidence: High · 105 affected inspected URLs · Template-wide**

**Evidence:** All 105 captured articles use locale-free relative mainEntityOfPage.@id and relative breadcrumb items. Article.image and author.url/sameAs are absent; 30 article variants model LetBuyy Team as Person. All inspected JSON-LD parses; syntax success is not semantic validation.

**Representative URLs:** [https://www.letbuyy.com/in/resources/platform/how-themes-work](https://www.letbuyy.com/in/resources/platform/how-themes-work), [https://www.letbuyy.com/in/resources/platform/introduction-to-apps](https://www.letbuyy.com/in/resources/platform/introduction-to-apps), [https://www.letbuyy.com/in/resources/operations/order-fulfillment-guide](https://www.letbuyy.com/in/resources/operations/order-fulfillment-guide), [https://www.letbuyy.com/in/resources/growth/email-marketing-ecommerce](https://www.letbuyy.com/in/resources/growth/email-marketing-ecommerce), [https://www.letbuyy.com/in-ta/resources/platform/how-themes-work](https://www.letbuyy.com/in-ta/resources/platform/how-themes-work), [https://www.letbuyy.com/in-ta/resources/platform/introduction-to-apps](https://www.letbuyy.com/in-ta/resources/platform/introduction-to-apps)

**Why it matters:** Creates inconsistent identities between visible final page URL, article entity and hierarchy; omits helpful genuine author/image connections. Relative JSON-LD URLs alone are not a syntax failure; author/image fields are recommendations, not universal Article requirements.

**Correction:** Use absolute final locale URL for article @id/url/mainEntityOfPage and breadcrumb items. Reuse Organization @id for publisher. Link genuine bylines to final author profiles; use Organization for the team. Add an accurate representative visible article image with an absolute URL if useful. Do not invent reviewers or credentials.

**Owner / effort:** Frontend engineer + editor · 0.5–1 engineer day plus identity/content verification

**Dependencies:** TECH-01 final URLs; verified author facts; approved representative artwork.

**Validation:** Parse every block; assert identity and breadcrumbs match final canonical hierarchy. Dereference selected author/image URLs, check visible truth, and run Schema Markup Validator plus Google Rich Results Test on samples. Do not treat tool eligibility as guaranteed display.

**Success indicator:** All approved article entities match final locale canonical; team/individual authors represented truthfully.

**Primary references:** [source 1](https://developers.google.com/search/docs/appearance/structured-data/article), [source 2](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)

### TECH-08 — Social previews lack consistent page images and final URLs

**Low · Confirmed · confidence: High · 489 affected inspected URLs · Template-wide**

**Evidence:** Within inspected locale pages, 486 lack og:image, 483 lack og:url, 69 lack og:type; 6 explicit og:url values differ from canonical. Homepage lacks image/url/type; English pricing points og:url to/pricing although canonical is /in/pricing. Local source has some image work not yet reflected in live HTML.

**Representative URLs:** [https://www.letbuyy.com/in](https://www.letbuyy.com/in), [https://www.letbuyy.com/in-hi](https://www.letbuyy.com/in-hi), [https://www.letbuyy.com/in-hi/contact](https://www.letbuyy.com/in-hi/contact), [https://www.letbuyy.com/in-hi/create](https://www.letbuyy.com/in-hi/create), [https://www.letbuyy.com/in-hi/demo](https://www.letbuyy.com/in-hi/demo), [https://www.letbuyy.com/in-hi/legal](https://www.letbuyy.com/in-hi/legal)

**Why it matters:** Can produce incomplete or inconsistent shared-link previews; do not describe missing Open Graph fields as a demonstrated Google ranking loss.

**Correction:** Complete existing metadata inheritance: final localized URL, appropriate website/article type and accessible preview image with dimensions/alt. Preserve completed local image work. Prefer a supported raster preview rather than relying on the pricing page's narrow SVG logo. Make live output the acceptance target after authorized release.

**Owner / effort:** Frontend engineer + designer · 0.5 engineer day plus image QA

**Dependencies:** TECH-01 final URL policy; existing brand/social assets.

**Validation:** Inspect raw source for all representative templates/locales and preview with actual social consumers. Check final200 image URLs, preview crop and matching og:url/canonical. Recheck deployed output independently of localhost.

**Success indicator:** Intended preview image, URL and type are consistent across approved shareable pages.

**Primary references:** [source 1](https://ogp.me/)

### TECH-09 — Unknown tags return indexable empty 200 archives

**Medium · Confirmed · confidence: High · 1 affected inspected URLs · One live negative probe; likely template-wide by source**

**Evidence:** The deliberate unknown-tag probe returns200, index/follow, the arbitrary slug in title/H1, and0articles / No articles found for this tag. Canonical also points to an unlocalized arbitrary tag. Exactly one invalid tag was tested; unbounded acceptance is also visible in source, not inferred as thousands of indexed URLs.

**Representative URLs:** [https://www.letbuyy.com/in/resources/tag/seo-audit-nonexistent-20261029](https://www.letbuyy.com/in/resources/tag/seo-audit-nonexistent-20261029)

**Why it matters:** Allows empty URL variants to look like valid indexable archive pages. Google soft404 classification and actual index bloat are unverified.

**Correction:** Check the existing tag registry before metadata/rendering and return notFound() for unknown tags. Preserve intentional known tags and their links. Do not solve an absent-content page solely with a homepage canonical.

**Owner / effort:** Frontend engineer · 0.25–0.5 engineer day including negative cases

**Dependencies:** Existing tag registry; TECH-01 archive canonical policy.

**Validation:** Known tags still return 200 with correct content; unknown tags in each served locale return 404 with noindex and useful navigation. Do not generate or crawl a large invalid-slug corpus.

**Success indicator:** 0 indexable200 responses in bounded invalid-tag tests.

**Primary references:** [source 1](https://developers.google.com/search/docs/crawling-indexing/http-network-errors)

### TECH-10 — RSS links and feed identity omit the served locale

**Low · Confirmed · confidence: High · 2 affected inspected URLs · Two feed samples;35 item links per sample**

**Evidence:** Captured RSS samples contain35 item links each, all pointing to locale-free /resources/... URLs. English and sampled Tamil feed bodies identify language as en-in and publish the same English item titles; self URL omits the route locale. The feed is present and parseable; this is a consistency issue, not a missing feed.

**Representative URLs:** [https://www.letbuyy.com/in/resources/rss.xml](https://www.letbuyy.com/in/resources/rss.xml), [https://www.letbuyy.com/in-ta/resources/rss.xml](https://www.letbuyy.com/in-ta/resources/rss.xml)

**Why it matters:** Feed readers and crawlers follow redirecting identities; a translated route suggests language-specific output but delivers English. Does not establish lost subscriptions or indexing.

**Correction:** Either provide one explicitly English feed and link all locales to that final identity, or localize feed entries/language/self URL using the existing locale/content authority. Emit final canonical article links and permalink GUIDs; changing old GUIDs may duplicate reader entries, so choose the feed migration intentionally.

**Owner / effort:** Frontend engineer + editorial owner · 0.5 engineer day including feed-reader compatibility review

**Dependencies:** TECH-01 final URLs; explicit feed-language policy; article translation availability.

**Validation:** Parse feed XML; every item link resolves final200 canonical; channel language, title and atom:self agree with intended feed scope. Compare EN/TA samples and check reader deduplication behavior before changing established GUIDs.

**Success indicator:** No redirecting article item URLs; feed route/identity/content language follow documented policy.

**Primary references:** [source 1](https://www.rssboard.org/rss-specification)

### TECH-11 — Software app rich-result eligibility is not established

**Informational · Confirmed · confidence: High · 489 affected inspected URLs · Template-wide**

**Evidence:** The global SoftwareApplication graph on all 489 inspected locale pages lacks a rating/review. Google's checked SoftwareApplication feature documentation requires a genuine rating or review along with name/offer. Existing graph JSON parses.

**Representative URLs:** [https://www.letbuyy.com/in](https://www.letbuyy.com/in), [https://www.letbuyy.com/in-ta](https://www.letbuyy.com/in-ta), [https://www.letbuyy.com/in-hi](https://www.letbuyy.com/in-hi), [https://www.letbuyy.com/in/pricing](https://www.letbuyy.com/in/pricing), [https://www.letbuyy.com/in-ta/pricing](https://www.letbuyy.com/in-ta/pricing), [https://www.letbuyy.com/in-hi/pricing](https://www.letbuyy.com/in-hi/pricing)

**Why it matters:** Cannot claim this markup is eligible for Google software-app rich results. Absence of public reviews may be correct and should not be hidden by fabricated data.

**Correction:** Keep truthful semantic markup if useful; correct the contradictory offer separately. Only include a rating/review when genuine, visible and compliant. Otherwise accept lack of this optional search feature and validate the types actually supported by the page.

**Owner / effort:** SEO lead + frontend engineer · 0.25 engineer day for validation; genuine review collection is not estimated

**Dependencies:** Approved offer facts; legitimate visible review data only if available.

**Validation:** Run Google Rich Results Test on a representative page and record exact type/errors. Validate Schema.org semantics separately. No synthetic rating, review, reviewer or count may appear.

**Success indicator:** Eligibility claims match real validation;0 fabricated rating/review fields.

**Primary references:** [source 1](https://developers.google.com/search/docs/appearance/structured-data/software-app)

## Internal linking and international checks

No raw-link orphan candidates were observed among the489 captured clean locale pages after processing all captured source links: 0 candidate(s). This is only an inventory-relative test; it cannot reveal unknown URLs absent from links/sitemaps/source data.
The language picker uses buttons/client navigation. Therefore a raw-anchor graph starting at English homepage does not traverse into Tamil/Hindi, despite their sitemap/hreflang discovery. Compute page depths from each locale homepage and do not call every translated page an orphan. Header/footer links are included; contextual editorial linking is assessed separately in the cluster plan.
Page links and article bodies are present in initial HTML. The archive/library is finite in the inspected graph; query/filter URLs were deliberately excluded from expansion. No evidence establishes an infinite-scroll-only discovery dependency.
Reciprocal article/home/contact alternate sets are assessed from captured link tags. Categories also have sitemap alternates. Broken canonical alignment is counted under TECH-01, not duplicated as a second international issue. Create/search advertise homepage alternates; counted under TECH-02/03. Missing extra duplicate HTML annotations where a complete sitemap method exists is not itself a defect.
Do not convert temporary locale-routing redirects blindly: cookie/language routing intent matters. Existing 404 probe returned404 with a noindex directive; inherited index directives do not turn that into a confirmed indexing block because restrictive instructions/status govern. The unknown-tag200 probe is a distinct confirmed issue.

## Media and limitations

Homepage raw HTML contains53 image occurrences,16 image preloads and 22 eager image occurrences, including lower-page capabilities/surface/CTA art. This is a prioritization opportunity to compare with actual request waterfalls. Many repeated icons are decorative; all dimensions are present in the inspected image elements. A sizes attribute without srcset does not create responsive variants, but the absence alone does not establish excessive bytes.
No intrusive security scanning or exploit testing was done. HTTPS/HSTS/CSP/nosniff observations do not constitute security certification or a ranking score. A transient crawl transport timeout is not a confirmed website server error; inspect parent retry evidence.
Google rich-result eligibility was checked against current primary property documentation, with JSON parsing and entity-consistency checks. A full public Rich Results Test or Schema.org validator result is not fabricated. Corrected minimal examples are in schema-examples.json.
All estimates assume one engineer familiar with the existing Next.js marketing surface, existing content authority and normal review. They exclude owner decisions, tax review, deployment and search-engine recrawl time.
At the next audit, recheck all final canonical targets/locale alternatives, intended XML/RSS inventory, invalid-tag404 behavior, factual offer agreement, article entity identities and deployed social previews. Verify actual indexing in GSC when accessible and compare performance with equivalent lab/field data.
