# Branded-search source forensics

30 October 2026 · Read-only source and parent-supplied fresh public samples. No application source, live content, DNS or indexing setting was changed.

## Evidence boundaries

- Fresh sample evidence: evidence/live-samples.json,26 focused resources/pages including 25 HTML pages, captured 29 October 2026 approximately 18:37–18:38 UTC (30 October 2026 in Asia/Kolkata). This specialist made no extra public crawl.
- Dated breadth baseline:29 October comprehensive 499 unique-request inventory,489 clean locale HTML pages,105 article variants. Broader affected counts below are explicitly dated, not a second fresh full crawl.
- Current local source has existing user-owned changes and can differ from deployed source. Exact read-only file hashes are preserved in evidence/source-file-manifest.json. Code line references describe the current local checkout; a deployed observation requires fresh HTTP evidence.
- Google site name, page title link, snippet and sitelinks are different outputs. Sitelinks are automated. None of the source checks establishes why Google selected one particular branded result.

## Findings and opportunities

### BR-SRC-01 — Resource titles repeat the brand because page strings and parent template both add it

**Medium · Confirmed · High · 3 fresh affected URLs**

**Observed:** Fresh English Payments title is "Payments — LetBuyy Resources | LetBuyy Resources"; Hindi/Tamil versions repeat LetBuyy with translated Resources then the English layout suffix. Source category/author functions insert brand text, while resources/layout.tsx applies %s | LetBuyy Resources. Changelog/releases also include LetBuyy in their title strings. Dated comprehensive capture supports 42 category/author/release/changelog variants with repeated brand (36 category/author + 6 release/changelog).

**Why it matters:** Consumes compact title space and reduces distinction between page purpose and brand. It can make title selection less clear; it does not prove this caused the observed branded result or a Google title rewrite.

**Fix:** Choose one branding layer. Keep concise page-specific titles (Payments, Priya Sharma, Changelog, Platform Releases) and let one parent template add the brand, or use an explicit absolute title when a full title is intentional. Localize the suffix deliberately rather than retaining English Resources everywhere. Preserve existing canonical repair work.

**Owner/effort:** Frontend engineer + SEO editor · 0.25–0.5 engineer day including representative title assertions

**Dependencies:** Existing metadata helper and page identity; no redesign required.

**Validation:** Inspect generated raw titles for category/author/tag/article/changelog/releases across 3 locales; check brand appears only once unless legitimately part of a quoted proper title. Confirm canonical/title/H1 agreement and later inspect real search snippets without promising display.

**Indicator:** 0 unintended repeated brand/suffix strings across the affected templates.

**Limits:** No demonstrated causation for Google ranking, snippets, indexing or sitelinks.

**Source:** [layout.tsx:11](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/[locale]/resources/layout.tsx:11), [page.tsx:35](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/[locale]/resources/[category]/page.tsx:35), [page.tsx:34](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/[locale]/resources/authors/[slug]/page.tsx:34), [page.tsx:18](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/[locale]/resources/releases/page.tsx:18)

**Fresh URLs:** [https://www.letbuyy.com/in/resources/payments](https://www.letbuyy.com/in/resources/payments), [https://www.letbuyy.com/in-hi/resources/payments](https://www.letbuyy.com/in-hi/resources/payments), [https://www.letbuyy.com/in-ta/resources/payments](https://www.letbuyy.com/in-ta/resources/payments)

**Dated breadth:** {"capture": "2026-10-29 prior499-URL request inventory", "affected_template_urls": 42, "note": "42 is dated breadth, not a fresh full recrawl count"}

### BR-SRC-02 — HTML sitemap is deliberately promoted as an indexable public landing page

**Low · Opportunity · High · 3 fresh affected URLs**

**Observed:** All 3 fresh locale HTML sitemap pages return200, index/follow and self-canonical. They appear in XML sitemap and the shared footer legal row. Dated clean 489-page capture shows HTML-sitemap links from 486 pages. This is different from the XML sitemap and not an accidental noindex failure.

**Why it matters:** A utility directory can legitimately appear for branded queries. If it is not intended as a search destination, the current signals conflict with that product preference. Its existence alone is not an SEO defect, and the link count is not proof it caused Google sitelinks.

**Fix:** Make an explicit policy choice. If the directory is useful for people and organic search, retain it with accurate compact heading/title and useful links. If it should be navigation-only, keep its crawlable links and accessibility, apply noindex to the HTML page, and remove only those3HTMLpage entries from XML sitemap. Keep the actual XML sitemap available. Do not remove helpful legal/support navigation just to sculpt sitelinks.

**Owner/effort:** Product owner + SEO lead; frontend engineer implements decision · Decision review plus0.25 engineer day if excluded

**Dependencies:** Owner preference for utility page search visibility; preserve article discovery.

**Validation:** Check HTML policy and XML inventory after decision; confirm normal user access and links remain. If excluded, confirm crawl sees noindex and wait for processing; do not guarantee another named sitelink replaces it.

**Indicator:** All 3 utility routes consistently follow the approved search-visibility policy.

**Limits:** No demonstrated causation for Google ranking, snippets, indexing or sitelinks.

**Source:** [Footer.tsx:71](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/components/Footer.tsx:71), [page.tsx:19](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/[locale]/sitemap/page.tsx:19), [layout.tsx:61](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/layout.tsx:61), [sitemap.ts:44](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/sitemap.ts:44)

**Fresh URLs:** [https://www.letbuyy.com/in/sitemap](https://www.letbuyy.com/in/sitemap), [https://www.letbuyy.com/in-hi/sitemap](https://www.letbuyy.com/in-hi/sitemap), [https://www.letbuyy.com/in-ta/sitemap](https://www.letbuyy.com/in-ta/sitemap)

**Dated breadth:** {"dated_sitewide_link_source_pages": 486, "dated_clean_html_pages": 489}

### BR-SRC-03 — Global navigation schema uses redirecting locale-free page identities and overstates site membership

**Low · Confirmed · High · 25 fresh affected URLs**

**Observed:** Every one of 25 fresh HTML samples contains 9 global navigation nodes. Pricing, Themes, Apps, Developers, Resources, Contact and Legal use locale-free marketing paths; representative fresh aliases redirect to locale URLs. WebSite.hasPart also treats accounts-host Log in/Sign up destinations as pages belonging to the marketing WebSite. Source comment describes preferred ordering but expressly notes Google chooses sitelinks algorithmically.

**Why it matters:** Graph identity/hierarchy does not mirror final locale navigation destinations; cross-property account navigation and content containment are conflated. Schema.org permits broad CreativeWork membership, so this is semantic precision, not a demonstrated syntax error or unsupported assertion that cross-domain hasPart is invalid. Ordering these nodes does not choose Google sitelinks.

**Fix:** Keep one stable Organization/WebSite identity. Describe genuine final public page URLs and actual relationships. Build locale navigation from existing routing helpers where appropriate; represent account destinations as external navigation/service entry points instead of automatically declaring them marketing-site content. Either retain truthful SiteNavigationElement markup or simplify it; do not build a sitelinks-ranking subsystem. Root WebSite.url may identify the root domain even when it redirects to the homepage; that alone is not broken.

**Owner/effort:** Frontend engineer + SEO lead · 0.5 engineer day including representative graph assertions

**Dependencies:** Preferred final host/locale identity; preserve valid Organization/WebSite naming.

**Validation:** Parse fresh graph and compare every public content URL with visible navigation/final target. Validate semantic relations separately from JSON syntax. Check live results after recrawl without promising node order or exact sitelink selection.

**Indicator:** Global page identities use intended final URLs; no unsupported promise that graph order controls sitelinks.

**Limits:** No demonstrated causation for Google ranking, snippets, indexing or sitelinks.

**Source:** [layout.tsx:146](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/layout.tsx:146), [layout.tsx:169](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/layout.tsx:169), [layout.tsx:177](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/layout.tsx:177), [layout.tsx:192](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/layout.tsx:192), [platform-links.ts:16](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/platform-links.ts:16)

**Fresh URLs:** [https://www.letbuyy.com/in](https://www.letbuyy.com/in), [https://www.letbuyy.com/in-hi](https://www.letbuyy.com/in-hi), [https://www.letbuyy.com/in-ta](https://www.letbuyy.com/in-ta), [https://www.letbuyy.com/in/pricing](https://www.letbuyy.com/in/pricing), [https://www.letbuyy.com/in-hi/pricing](https://www.letbuyy.com/in-hi/pricing), [https://www.letbuyy.com/in-ta/pricing](https://www.letbuyy.com/in-ta/pricing)

### BR-SRC-04 — Tamil and Hindi documents initially declare English on the root HTML element

**Low · Confirmed · High · 14 fresh affected URLs**

**Observed:** All 14 fresh Hindi/Tamil HTML samples have root html lang=en. The correct nesteddivlang and translated main content are present, and source LocaleHtmlLang updates root lang via useEffect after hydration. Dated comprehensive capture showed the same root lang pattern on 326 non-English pages.

**Why it matters:** The root document language depends on JavaScript. Correct nested language attributes mitigate reading of translated content. The exact assistive-technology impact before hydration has not been measured. Google says it detects page language from visible content rather than HTMLlang/hreflang; this is not a confirmed Google language-detection failure or sitelink cause.

**Fix:** Plan a framework-compatible way to emit the correct document lang on the server for each actual locale, using the existing route/layout design. Preserve nested lang attributes for fallback/foreign-language passages. Do not introduce duplicate html elements, client-only redirects, or a new internationalization system. Make this a low-priority accessibility completion after correctness fixes.

**Owner/effort:** Frontend engineer + accessibility reviewer · 0.5–1 engineer day depending on existing root-layout constraints

**Dependencies:** Existing Next locale routing/layout design; no source topology changes authorized by audit.

**Validation:** Fetch with JavaScript disabled; root lang should agree with intended document language. Test hydration/client navigation and screen-reader language selection with a real native-language reviewer. Preserve explicit locale paths under opposite Accept-Language.

**Indicator:** Server and hydrated document lang agree on sampled Hindi/Tamil routes; no incorrect language switch during navigation.

**Limits:** No demonstrated causation for Google ranking, snippets, indexing or sitelinks.

**Source:** [layout.tsx:230](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/layout.tsx:230), [layout.tsx:63](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/[locale]/layout.tsx:63), [LocaleHtmlLang.tsx:20](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/components/i18n/LocaleHtmlLang.tsx:20)

**Fresh URLs:** [https://www.letbuyy.com/in-hi](https://www.letbuyy.com/in-hi), [https://www.letbuyy.com/in-ta](https://www.letbuyy.com/in-ta), [https://www.letbuyy.com/in-hi/pricing](https://www.letbuyy.com/in-hi/pricing), [https://www.letbuyy.com/in-ta/pricing](https://www.letbuyy.com/in-ta/pricing), [https://www.letbuyy.com/in-hi/sitemap](https://www.letbuyy.com/in-hi/sitemap), [https://www.letbuyy.com/in-ta/sitemap](https://www.letbuyy.com/in-ta/sitemap)

**Dated breadth:** {"dated_nonEnglish_root lang_en_pages": 326}

### BR-SRC-05 — Public-origin fallback can diverge between server and browser when canonical configuration is absent

**Low · Needs verification · High for source simulation; production configuration unverified · 0 fresh affected URLs**

**Observed:** Pure VM evaluation of the current public-urls.ts with synthetic environment values shows: explicit https://www.letbuyy.com keeps server/browser equal; absent explicit origin plus example Vercel production URL yields server example-marketing.vercel.app and browser letbuyy.com; a path-bearing explicit URL duplicates /in/in. Browser fallback stripswww through platform-root lookup while server fallback can prefer Vercel host. No real environment values were printed or assumed.

**Why it matters:** A missing/misconfigured canonical origin could produce inconsistent absolute links or metadata in a future deployment. Current fresh live canonical output uses www and normalizes apex/HTTP correctly; this is a preventive source risk, not a confirmed current host-splitting incident.

**Fix:** Retain the existing URL authority but validate the configured marketing origin as an origin-only HTTPS URL in production. Make the approved canonical host explicit and shared across server/browser paths; constrain deployment-host fallback to the intended environment. Fail clearly or use an approved deterministic origin when required configuration is missing, according to existing deployment policy. Do not change live DNS during this audit.

**Owner/effort:** Frontend/platform engineer · 0.5 engineer day for validation and config-case tests

**Dependencies:** Approved canonical host and environment policy; inspect configuration presence without exposing secret values.

**Validation:** Run isolated tests for explicit origin, missing origin, www/apex browsing, Vercel preview and path-bearing invalid input. Compare actual server source and hydrated absolute URLs on an authorized deployment. Confirm production configuration before treating source risk as live defect.

**Indicator:** Same approved origin across server/browser production generation; invalid path-bearing origins rejected.

**Limits:** No affected production URL is asserted. Simulation uses synthetic values only; evidence/public-url-source-simulation.json records exact cases.

**Source:** [public-urls.ts:52](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/public-urls.ts:52), [public-urls.ts:65](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/public-urls.ts:65), [public-urls.ts:102](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/public-urls.ts:102), [public-urls.ts:133](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/public-urls.ts:133)

### BR-SRC-06 — Translated resource hubs inherit English Open Graph locale

**Low · Confirmed · High · 4 fresh affected URLs**

**Observed:** Fresh Hindi/Tamil resource index and Payments category pages declare og:locale=en_IN despite translated page content. Shared resources/layout.tsx hardcodes en_IN, and descendant source metadata does not override that OpenGraph object for these templates. Article samples replace the object and omit locale rather than declaring the wrong value.

**Why it matters:** Misdescribes the shared preview language; it is not proof of incorrect Google language detection or ranking loss. This extends previous TECH-08 social-metadata review to a specific missed locale field.

**Fix:** Generate resource-layout sociallocale from the actual segment or have the existing metadata helper emit a complete locale-aware OpenGraph object. Preserve established image/title/description/siteName/type fields when extending nested metadata because Nextmetadata merges nested objects shallowly. Use hi_IN/ta_IN for actual Hindi/Tamil pages and verify the full object.

**Owner/effort:** Frontend engineer · 0.25–0.5 engineer day

**Dependencies:** Existing locale metadata helper; preserve current social-image repairs.

**Validation:** Inspect raw and rendered OpenGraph fields on EN/HI/TA resource-index,category,author,tag,article routes; locale should match actual language where supplied and required preview fields must survive nested replacements.

**Indicator:** 0 incorrect English og:locale values on translated retained resource pages.

**Limits:** No demonstrated causation for Google ranking, snippets, indexing or sitelinks.

**Source:** [layout.tsx:17](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/[locale]/resources/layout.tsx:17), [metadata.ts:17](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/i18n/metadata.ts:17), [page.tsx:20](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/[locale]/resources/page.tsx:20)

**Fresh URLs:** [https://www.letbuyy.com/in-hi/resources](https://www.letbuyy.com/in-hi/resources), [https://www.letbuyy.com/in-ta/resources](https://www.letbuyy.com/in-ta/resources), [https://www.letbuyy.com/in-hi/resources/payments](https://www.letbuyy.com/in-hi/resources/payments), [https://www.letbuyy.com/in-ta/resources/payments](https://www.letbuyy.com/in-ta/resources/payments)

## Navigation hierarchy: observations without invented causation

Current header source has direct links for Themes, Apps, Developers and Pricing; WhyLetBuyy / Products are menu controls. Themes andApps resolve to public explanatory guides, not running marketplaces. Footer provides Resources, Support, Contact, Legal and Sitemap links. Those links are useful and need not be deleted because a utility page appears in search. If the owner wants merchant discovery to be more prominent, concise labels such as Theme guide / App integrations and strong Pricing / Support / Getting started links can align expectations using existing canonical pages. This is an IA preference to test, not a proven ranking fix and not authorization to activate frozen services.
The product menus map many capability names to existing homepage#features / #capabilities fragments. Those IDs exist in current source and dated rendered HTML; no broken-anchor claim is established. Dedicated feature pages should only be added when there is unique verified product evidence and a real user need, not to manufacture six sitelinks.
Global navigationgraph ordering is not a supported sitelink selection API. SiteNavigationElement is a Schema.org page-navigation type, and hasPart broadly expresses creative-work membership; valid JSON does not guarantee search features. Keep truthful semantics and visible crawlable links. Root WebSite.url identifying the root domain is accepted even when that domain redirects to the accessible homepage; do not mislabel it broken merely because /in serves content.

## Existing issues traced, not recounted as new

- Existing TECH-02/03: creation/search inherit homepage canonical/metadata because locale/layout supplies homepage defaults and these descendants fail to replace them. Repair the existing inheritance, not a parallel SEO layer.
- Existing TECH-08: nested OpenGraph replacements explain why root image/siteName/type/url fields can disappear on descendants. The local locale layout already adds a social image, while the fresh deployed homepage still lacks it. This is a source/deployment distinction, not a second new image defect.
- Existing TECH-01/07: locale-free archive canonicals and article IDs remain the known finalidentity repair track; do not merge them into an unsupported assertion that locale prefixes themselves harm branded search.
- Source noindex policy for demo is explicit; root index/follow is a default, not inherently wrong. Utility page indexing needs a choice, not blanket noindex on support/legal/category pages.
- Fresh host normalization probes show HTTP→HTTPS and apex→www 308 behavior; root/locale-free redirects vary with language preference while explicit locale paths remain accessible. No current duplicate-host 200 incident is proved. Missing Vary on adaptive redirects warrants cache verification, not a confirmed cross-user cache bug; parent owns that record.

## Primary sources verified

- [Google sitelinks](https://developers.google.com/search/docs/appearance/sitelinks)
- [Google site names](https://developers.google.com/search/docs/appearance/site-names)
- [Nextmetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Schema SiteNavigationElement](https://schema.org/SiteNavigationElement)
- [Schema hasPart](https://schema.org/hasPart)
- [Google multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)

The next verification should inspect corrected raw metadata and navigation on actual deployed pages, compare approved utility indexing policy, and use authorized GSC data for Google-selected canonicals and branded query performance. Do not promise exact sitelink replacements or treat a short same-day stable snapshot as historical search-impact evidence.
