# LetBuyy branded-search forensic review

**Audited:** https://www.letbuyy.com/in · **30 October 2026, Asia/Kolkata**. Evidence captures dated 29 October UTC fall on 30 October locally. This is a focused supplement to the [comprehensive audit](../letbuyy.com-comprehensive-audit-2026-10-29/EXECUTIVE-SUMMARY.md), not a replacement crawl or proof that every possible problem has been found. No live site, source code, DNS, app listing or indexing configuration was changed.

## Assessment

The screenshot exposes weak presentation inputs and a search-result mix that may serve a prospective merchant poorly. It does **not** establish that every result is defective. The displayed site name is correct, a working favicon is present, and support can be a useful branded destination. Google selects title links, snippets and sitelinks automatically. The most consequential additional discovery is outside the screenshot: the app listing's privacy link leads to an old sales homepage, and two historical brand subdomains no longer resolve.

The original audit investigated many real technical/content defects but did not sufficiently test the actual branded result as one user journey. This follow-up traces the screenshot wording to raw live HTML, checks metadata inheritance in source, quantifies actual links, inspects current legacy destinations, and corrects causal overstatements. [Google's sitelink guidance](https://developers.google.com/search/docs/appearance/sitelinks) supports improving site structure and descriptive inputs, not prescribing exact shortcuts or their order.

## What was actually inspected

| Evidence | Scope and limit |
|---|---|
| Supplied Google screenshot | One `letbuyy` result, main name/title/snippet and six visible sitelink labels. Exact destinations and Google language/location settings are not exposed. |
| Fresh main-site sample | 26 public URLs/resources: 25 HTML pages plus XML sitemap. Home, pricing, HTML sitemap, support, merchant guide, resources index and Payments category in EN/HI/TA; English create, contact, demo and terms. All26 returned200. |
| Host/language behavior | 12 bounded HTTP probes; explicit locale paths, negotiated root/alias, apex/www/HTTP, two simulated crawler user agents. Simulated agents do not establish real Googlebot access. |
| Existing shared crawl | Dated489 clean pages for link-frequency and wider metadata-template breadth; not freshly recrawled in this follow-up. Original inventory has499 distinct request URLs. |
| Public search | 27 individual queries;133 returned records;54 distinct URLs,30 own-domain candidate URLs. Engine, country/device and personalization unavailable. These are not Google rank positions. |
| External surfaces | Six exact admin/account/seller/developer requests; one direct English Google Play listing; two app-linked legacy destinations. Two additional Public DNS queries verify the discovered nonexistent hosts. No form submissions. |
| Rendering | Two isolated Chromium renders of legacy homepage/privacy route, with screenshots, body hashes and headings; one additional context tested3 utility-navigation actions. No new Lighthouse or field CWV measurement. |
| Favicon | Two advertised image assets; SVG and multi-resolution ICO both200. ICO sizes16/32/48/256 square. |
| Source | Current marketing metadata/layout/routing/navigation files. Local source may differ from the deployment; file hashes and explicit live corroboration are retained. |

A controlled new Google browser SERP was **not captured**: computer-use returned `Local browser use is disabled in Work settings`. The supplied screenshot remains the only direct Google-layout observation. The SEO skill's separately authorized managed Chromium successfully checked the two public legacy destinations; that is not a substitute Google SERP observation. GSC/GA4 and measured branded CTR/canonical/index status remain unavailable. [Browser coverage](evidence/browser-coverage.json), [query evidence](evidence/query-log.json).

## Screenshot, item by item

| Visible feature | Evidence-backed interpretation | Response |
|---|---|---|
| Site name `LetBuyy` | Correct in screenshot; existing WebSite entity present. | Preserve one consistent brand entity. Do not invent a missing-site-name defect. |
| Purple favicon | Displayed; current advertised ICO is available and has256×256 size. | Eligibility input is present. A small mark's aesthetics are a design choice; no favicon outage found. |
| Main title repeats LetBuyy | The exact repeated string is in fresh raw HTML for all3 homepages. | BR-MAIN-01: fix metadata inheritance so the brand appears once. |
| Broad AI/OS snippet | Text matches the first live homepage FAQ answer, rather than the current meta description. | Align the actual explanatory copy; do not treat normal body extraction as a missing meta tag. |
| `Sitemap` | Candidate EN HTML directory is intentionally indexable, self-canonical, XML-listed and site-wide linked. Actual screenshot destination hidden. | Make an explicit utility-page search policy; its mere appearance is not an error. |
| `Support centre` | Candidate EN page is useful,200, self-canonical and localized correctly. | Keep support available; improve task clarity where useful. |
| `The Merchant Control Plane` | Candidate is an indexable public guide, not proof that a private dashboard was exposed. | Consider merchant-friendly wording such as “Merchant dashboard guide,” preserving the article's actual purpose and availability facts. |
| Hindi support / Tamil directory / Hindi dashboard label | Candidate pages are genuine translations with matching titles. The screenshot alone cannot explain Google's selection. | Verify exact result URLs/settings and owned indexing evidence before blaming localization or deleting languages. |

The candidates above match live titles, but are **not verified screenshot hyperlink destinations**.

## Confirmed additional problems

### 1. The app-store privacy journey leads to sales content — High, BR-PUB-01

[Google Play's public app listing](https://play.google.com/store/apps/details?id=com.letbuyy.letbuyy&hl=en) links the privacy destination to [letbuy-y.web.app/privacy-policy](https://letbuy-y.web.app/privacy-policy). Both that deep URL and the legacy root return200 with title `Create Next App`. Fresh Chromium renders show the same3289-character visible body and identical SHA-256, with merchant pitches, plans and testimonials. The page has a footer privacy-link label, but no policy document. This is a directly demonstrated task failure, not a legal judgment.

Evidence: [listing extract](evidence/play-listing-sanitized.json), [HTTP responses](evidence/legacy-app-destinations.json), [render comparison](evidence/legacy-app-rendered.json), [privacy-route screenshot](evidence/legacy-privacy.png). Verify the authorized app/host owner and supply the accurate app-specific notice through a separately authorized release. Do not substitute unrelated merchant privacy wording.

### 2. Two old brand destinations do not exist in DNS — Medium, BR-EXT-01

The query set returns [seller.letbuyy.com](https://seller.letbuyy.com/) and [developer.letbuyy.com/api](https://developer.letbuyy.com/api) as historical marketplace/developer records. Both fail the audit resolver; Google Public DNS independently returns Status3/NXDOMAIN for exact A queries at capture time. This is stronger evidence than merely reading an old search excerpt. It does not prove how frequently real searchers see/click these results.

Evidence: [exact returned records](evidence/query-log.json), [direct probes](evidence/external-surface-probes.json), [second resolver](evidence/secondary-dns-check.json). Decide each URL's legitimate retirement/migration treatment. Do not restore a rejected runtime or redirect every old URL to an unrelated homepage. Admin root/login are different: they currently redirect to an account page marked noindex; those2 are **not** counted as broken endpoints.

### 3. Branding is repeated in two separate title chains — Medium, BR-MAIN-01 and BR-SRC-01

Fresh home: `LetBuyy — India-first commerce operating system | LetBuyy`. Fresh Payments category: `Payments — LetBuyy Resources | LetBuyy Resources`. All3 locale homepages repeat the brand; all3 sampled Payments variants repeat it too. The dated prior capture finds42 affected category/author/release/changelog variants;42 is not a fresh full-site count.

Source confirms a complete branded page string plus a parent title template adds another suffix. This is a real implementation defect in compact presentation. It does not establish a penalty, ranking loss or a particular Google title-rewrite reason. Use one branding layer and verify actual emitted titles across layouts/locales. [Source forensics and exact locations](findings/source-forensics.md).

### 4. The graph and locale metadata contain smaller accuracy defects — Low

All25 fresh HTML pages repeat global navigation graph nodes using locale-free content aliases; these differ from final localized navigation identities, and account navigation is conflated with marketing WebSite content membership (BR-SRC-03). This is a semantic precision issue, not a demonstrated Schema.org syntax error. SiteNavigationElement order does not set Google sitelink order.

Four sampled translated resource hubs/categories declare `og:locale=en_IN` (BR-SRC-06). This is incorrect social-preview metadata; it is not evidence of Google's language detection failing. Fourteen translated fresh documents initially declare root `html lang=en`, mitigated by correct nested language wrappers and a hydration update (BR-SRC-04). Address initial document-language accessibility using the existing framework; its actual assistive-technology effect was not measured. Google uses visible content to detect language, not the HTML lang value. [Google localized-version guidance](https://developers.google.com/search/docs/specialty/international/localized-versions).

### 5. Legacy help/contact/terms links are placeholders — Medium, BR-PUB-02

The app-linked old landing page has `href="#"` for Help Center, Contact Us and Terms of Service. A fresh managed Chromium context clicked each exact link; the URL remained `https://letbuy-y.web.app/#` and the visible body hash remained unchanged. These3 tested actions fail to provide their advertised destinations. Other placeholder anchors are inventoried but were not individually interaction-tested. [DOM inventory](evidence/legacy-dom-inventory.json), [click evidence](evidence/legacy-link-checks.json).

That property also still exposes the starter description `Generated by create next app`, title `Create Next App`, and no canonical link in the captured DOM. These are confirmed inputs on an app-linked legacy property; intended continued search eligibility and ownership remain part of BR-EXT-02. Do not infer private app deployment details from these public fields.

## Important interpretation and strategy mistakes

### We treated metadata as if it were the whole snippet

The screenshot's broad operating-system sentence matches `FAQ.tsx:31`. The current homepage meta description instead explains launching a store in India with UPI/COD/GST/shipping and0% commission. Google may select body text for a query, so changing only the description leaves the same FAQ sentence available. This is consistent with documented snippet generation; extraction internals and the historical indexing version are unobservable. [Google snippet guidance](https://developers.google.com/search/docs/appearance/snippet).

Rework the first answer and primary promise together around approved, currently available merchant tasks. Keep AI/operations claims specific and provable; distinguish available from planned features. This extends prior EXT-01 and CONTENT-04, rather than counting another duplicate defect. A shorter candidate definition is “LetBuyy helps Indian businesses build an online store and manage products and orders.” Product owners must confirm each capability before use. Do not add price/free promises before prior AUD-01 is resolved. `data-nosnippet` is a selective exclusion mechanism, not a guarantee of replacement text; improve useful copy first.

### We blamed link scarcity without counting it

The dated163-page English set links pricing from162 distinct pages, including162 headers and162 footers, with327 total anchor occurrences. Sitemap/support each receive162 distinct source pages and167 occurrences. Merchant guide receives9 distinct sources/18 occurrences. Pricing is **already strongly linked**; these counts cannot explain why Google selected the screenshot's shortcuts. [Link-frequency data](evidence/link-and-snippet-analysis.json).

The actual pricing input problem is narrower and already recorded as TECH-06: all3 fresh pricing pages have a generic localized title and **no H1**. Give the page a useful title/heading and visible plan explanation, while preserving current header/footer links. Prior AUD-03 also requires server-visible plan data verification; this follow-up did not rerender main-site prices.

### We assumed every commercially preferred destination was eligible

Fresh `/in/demo` explicitly says `noindex, follow`. The previous desired “Demo” sitelink suggestion must respect that deliberate policy. Keep a lead form noindexed if that is its intended role; an indexable product overview needs genuine helpful content and a product decision. Noindex is not an unwanted-sitelink-only removal: it excludes the whole page once processed. [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

### We did not separate utility-page policy from defects

The3 HTML sitemap pages are in the99-entry XML feed and linked site-wide. That makes them eligible public pages by design; it does not force Google to select them. If the directory is meant only for navigation, a reviewed noindex policy plus removal of these3 HTML URLs from the XML sitemap is an option. Keep XML sitemap delivery and useful user links. Do not remove support, translations or legal links as an untested link-sculpting tactic. BR-SRC-02 is an **Opportunity**, not a confirmed bug.

### The brand estate lacks a verified lifecycle/relationship inventory

The public app listing describes consumer shopping/reels. Its website points to an older merchant-sales landing page with `Create Next App`, Free/Pro/Max pricing,500+ seller/₹2Cr+ processed claims and testimonials. The current marketing pricing metadata describes Launch from₹299. Different products/eras can legitimately have different offers, but their relationship and continued validity are not explained by the fetched evidence. Ownership, actual availability, price currency and historical claim provenance need verification (BR-EXT-02). This audit does not assert fake reviews, ownership mismatch, impersonation or illegal claims.

Review these public surfaces together with the already reported free-offer conflict (AUD-01), availability ambiguity (CONTENT-04), and testimonial/biography provenance (CONTENT-03). A perfect main title does not repair an app listing leading people to a different public representation.

## Localization: what passed and what remains wrong

Fresh home/support/HTML-directory/merchant-guide triplets are200, self-canonical, and declare matching alternate language URLs. Explicit `/in` stays English under Tamil Accept-Language; `/in-hi` stays Hindi under English Accept-Language. The root negotiates `/in`, `/in-hi` or `/in-ta` using request language. Those are important counterexamples to a blanket “all locale routing is broken” claim.

The resource Payments category triplet still canonicalizes to the same locale-stripped `/resources/payments` alias. This freshly corroborates prior TECH-01 for3 examples; the303-resource mismatch count is from the dated489-page crawl. These categories are not the screenshot's visible support/sitemap/guide candidates, so this cannot be assigned as their proven language-selection cause.

The negotiated root307 responses lack a Vary header in the captured sample. That merits cache-behavior verification, but no wrongly cached language response was reproduced, so it is **not** promoted to a confirmed incident. The synthetic public-origin fallback issue BR-SRC-05 likewise has0 demonstrated affected production URLs. The current apex/HTTPS normalization works; do not describe a live split-host index failure from a synthetic missing-config test.

## Existing problems this review corroborates

| Prior ID | Fresh observation | Count boundary |
|---|---|---|
| TECH-01 | Payments categories strip locale from canonical. |3 fresh samples;303 dated resource mismatches. |
| TECH-02 | `/in/create` inherits home title/canonical/alternates instead of a distinct creation identity. |1 fresh example;3 dated locale variants. |
| TECH-04 |99-entry XML sitemap still lists HTML directories but not any of the3 freshly fetched merchant-guide URLs. | Full99 feed parsed now; all105 missing article variants established by dated crawl, not105 fresh fetches. |
| TECH-06 | Generic pricing titles and no H1. |3 fresh locale pages. |
| TECH-08 | Social metadata review missed a specific resource `og:locale` error. |4 fresh translated examples; BR-SRC-06 extends the old issue. |

Do not add these again to the original23 and claim a larger count of independent root causes. The branded register tracks11 records, including an explicit social-metadata extension and preventive/relationship review items. It is not “11 new severe bugs.”

## Limits and next proof required

No current GSC selected-canonical/index coverage, impressions, branded CTR, query-volume, manual-action status or traffic trend was available. The search tool's engine/geolocation is unknown; empty site: results are not proof of deindexing. There is one actual Google screenshot, not a repeated controlled SERP study. The exact screenshot sitelink destinations, current indexed document version and recurrence across devices/languages remain unverified. No CWV, ranking penalty, causal ranking loss, forecast revenue or promised search-display outcome is asserted.

The [repair plan](SEARCH-APPEARANCE-REPAIR-PLAN.md) gives concrete source locations, proposed inputs, dependencies and verification gates. [Register JSON](BRANDED-ISSUE-REGISTER.json) and [CSV](BRANDED-ISSUE-REGISTER.csv) include severity, state, evidence, affected counts, owner, effort and success checks for each material follow-up record. The [audit corrections](AUDIT-CORRECTIONS.md) explain what should change in earlier interpretation without silently rewriting dated evidence.
