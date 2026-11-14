# Branded-search research and correction of earlier assumptions

30 October 2026 · Asia/Kolkata · target: https://www.letbuyy.com/in

## What the research establishes

This specialist executed **27 individual public searches**, producing **133 returned result records**, **54 distinct URLs** and **30 distinct URLs on LetBuyy-owned-domain candidates**. The exact queries, returned titles/URLs/snippet excerpts and tool-provided crawl ages are in [query-log.json](../evidence/query-log.json). The count describes this selected query set, not Google's total index, search demand or search visibility.

The search tool does not expose its underlying engine, country/city, device or personalization settings. The queries were typed in English; that does not establish a browser-language preference or a geolocated English Google result. Result sequences are tool output, not verified Google rank positions.

The screenshot evidence is a separate observation: [screenshot-observations.json](../evidence/screenshot-observations.json) records one supplied Google result for `letbuyy`, with the main site name/title, snippet and six visible sitelink labels. Its hidden destination URLs and user settings are unknown. The screenshot supports a discussion of that result layout; it does not show that all users receive it or that every item is wrong.

## Query findings

| Query | Selected exact returned result | Supplied crawl age | What can be concluded |
|---|---|---|---|
| `LetBuyy` | `LetBuyy — India-first commerce operating system \| LetBuyy` → https://www.letbuyy.com/in | 4 weeks ago | The current intended merchant-site identity is discoverable in this query sample |
| `letbuyy pricing` / quoted brand variant | `Pricing` → https://www.letbuyy.com/in/pricing | 4 weeks ago | The commercial URL is discoverable; the generic title is confirmed separately in fresh HTML |
| `"LetBuyy" support` | `Support centre — LetBuyy` → https://www.letbuyy.com/in/support | 2 days ago | A useful branded support page is returned; it is not an unwanted result by default |
| `"LetBuyy" "LetBuyy Admin"` | `LetBuyy Admin` → https://admin.letbuyy.com/ and https://admin.letbuyy.com/auth/login | 4 months ago | Old admin records appear in search; current HTTP probes must determine their present behavior |
| `"LetBuyy" "Developers"` | `LetBuyy Developers` → https://developer.letbuyy.com/api | last month | An old developer URL remains in returned search data; this does not prove the host still resolves |
| `"LetBuyy" "online shopping"` | `LetBuyy - Online Shopping Marketplace` → https://seller.letbuyy.com/ | 4 months ago | The old consumer/seller identity is present in search records |
| `"LetBuyy" site:play.google.com/store/apps/details` | `LetBuyy - אפליקציות ב-Google Play` → https://play.google.com/store/apps/details?hl=he&id=com.letbuyy.letbuyy | last month | The returned listing explicitly includes a Hebrew URL parameter; it does not prove LetBuyy's site targets Hebrew |
| `site:www.letbuyy.com` and `site:letbuyy.com` | Empty tool result | Not supplied | This is not proof of non-indexing: narrower `/in` queries and brand queries returned own-site results in the same session |
| `site:www.letbuyy.com/in-ta` | English `/in` homepage among returned results | 4 weeks ago | The tool's site filtering is not a reliable locale-selection test; inspect actual locale tags and Google URL Inspection instead |

No `Sitemap` result was reproduced in the focused web-tool queries, even though that label is visible in the supplied Google screenshot. The two observations must coexist. Do not treat either as a universal ranking layout, and do not invent its hidden destination URL.

## Two search-discovered destinations are confirmed NXDOMAIN; two admin redirects work

Search records show four distinct old endpoints: admin root, admin login, seller root and developer API. The parent's independent fresh [external probes](../evidence/external-surface-probes.json) show:

- Both admin URLs now redirect to `accounts.letbuyy.com/lookup`, with the login request retaining a return destination. The final public account page returned 200 and `noindex, nofollow`. An indexed old title is not proof that the current account page is indexable or that the private console is exposed.
- Seller and developer hosts failed DNS resolution in the audit resolver. A second check through Google Public DNS returned DNS `Status: 3` (NXDOMAIN) for both exact host A queries. The two independent observations establish that the search-discovered seller root and developer API destination were unreachable at capture time. This is a confirmed observed discovery/journey problem; it does not establish whether retirement was intentional or justify reactivating either runtime. See [secondary DNS evidence](../evidence/secondary-dns-check.json).
- Public account lookup/signup pages observed in the parent sample are marked noindex. That is appropriate for the account journey unless an explicit organic landing-page strategy says otherwise; it does not repair old search records instantly.

The practical question is which public brand surfaces should remain discoverable and what should happen to intentionally retired destinations. The affected count in BR-EXT-01 is **two unreachable search-discovered URLs**; the two working admin redirects are context and are not counted as broken endpoints. Keep private accounts protected through authentication, preserve valid user return paths, and avoid restoring a frozen runtime merely to satisfy an old search result. If a host is intentionally retired, choose a truthful terminal status or relevant migration destination only after the topology/lifecycle decision; do not redirect every unrelated old page to the marketing homepage.

## Google Play: live consumer listing confirmed, relationship still needs explanation

The installed URL-safe fetcher successfully retrieved the **English public Google Play listing** with HTTP 200. Its title is `LetBuyy - Apps on Google Play`; its description presents shopping, product reels and buyer discovery. Its visible website/privacy links point to `https://letbuy-y.web.app` and `https://letbuy-y.web.app/privacy-policy`. Sanitized evidence, raw-content hash and the requested language parameter are in [play-listing-sanitized.json](../evidence/play-listing-sanitized.json). Unnecessary personal contact details were omitted.

The parent then fetched both legacy destinations directly: each returned HTTP 200, title `Create Next App`, the same ETag, and matching captured merchant-landing text rather than distinct privacy content. That text includes seller-count and processed-volume claims, plus the older `.store` domain representation. These are observed destination facts, not verified merchant/volume metrics. See [legacy destination evidence](../evidence/legacy-app-destinations.json). A managed-browser check of the privacy route is being evaluated separately by the parent; do not infer full rendered/privacy adequacy from status 200 alone.

This changes two earlier limitations: the listing's current public description/links are observed directly, and its destinations have been inspected. The fact that buyer and merchant products share a brand still does **not** establish an identity error. Confirm the intended relationship and current availability before revising app copy, links or identity markup. If they are related, make buyer versus merchant roles and support routes explicit. Never add this listing to `sameAs` or assert a migration solely from a name/package match. BR-EXT-02 remains a relationship/lifecycle item needing verification; the parent owns any distinct confirmed privacy-destination finding to avoid counting the same defect twice.

## Correct interpretation of Google features

**Site name is distinct from the page title.** The screenshot already displays LetBuyy as the site identity, and fresh HTML includes a WebSite node. Google derives site names automatically from the homepage and references. It supports domain/subdomain names, not a separate site name for each `/in` language subdirectory. A root redirect is explicitly addressed in Google's guidance: confirm the target is accessible; it is not automatically a site-name defect. Do not add another WebSite entity or alternateName as though the name is missing. [Google site-name guidance](https://developers.google.com/search/docs/appearance/site-names).

**Sitelinks are automated shortcuts.** Good information architecture, relevant concise anchors and descriptive titles can improve inputs; sitemap ordering, schema ordering or a preferred navigation list does not command the six links or their order. A human HTML sitemap is a valid useful page; appearing first is not by itself a defect. Support is a useful branded journey. A merchant guide is appropriate if it answers the searcher's task. [Google sitelink guidance](https://developers.google.com/search/docs/appearance/sitelinks).

**A snippet is not a literal meta-description field.** The parent matched the supplied main snippet to the live first FAQ answer. That is consistent with Google's documented use of page content and query-specific snippets. It does not establish missing metadata or broken rendering. Editing the meta description cannot guarantee replacement. `data-nosnippet` can exclude selected visible content from snippets when justified; `noindex` removes the whole page after Google sees it. Do not noindex a useful support/guide page merely to hide a sitelink. [Google snippet guidance](https://developers.google.com/search/docs/appearance/snippet), [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

**Mixed-language sitelinks do not prove a locale implementation failure.** The live sample has separate translated homepages/titles and language alternatives. Google determines content language algorithmically; hreflang supplies alternate-version relationships and is not a switch guaranteeing an all-English result for every English brand query. The screenshot lacks the settings needed to diagnose its language choice. Inspect actual pairwise tags/canonicals and owned Search Console evidence. Google treats HTML/header/sitemap hreflang methods as equivalent; a skill checklist's suggestion to prefer one is not a ranking requirement. [Google localized-page guidance](https://developers.google.com/search/docs/specialty/international/localized-versions).

**Titles can be improved without promising control.** The pricing result's generic title agrees with current HTML, while the duplicated homepage brand is a concrete input cleanup. Google may still choose a different title using headings, visible text and references. Keep titles aligned with each page's primary language; do not make all variants English to obtain an English screenshot. [Google title-link guidance](https://developers.google.com/search/docs/appearance/title-link).

**Favicon eligibility and actual display are distinct.** The primary document was updated 27 October 2026. It now specifies a square image of at least 8×8, recommends larger than 48×48, and lists BMP/GIF/ICO/PNG/JPEG/PPM/TIFF; the old “48-pixel multiple” rule should not be repeated. The parent captured a working ICO with 16/32/48/256 sizes, so the presence of an SVG declaration alone does not establish missing favicon eligibility. Check the visual and selected resource separately; display is not guaranteed even when eligible. [Google favicon guidance](https://developers.google.com/search/docs/appearance/favicon-in-search).

## What earlier statements need narrowing

1. Replace **“everything in this result is wrong”** with a feature-by-feature assessment: the site name is correct, support/guide links may be useful, generic/duplicated titles can improve, and exact sitelink destination/locale choice remain partly unverified.
2. Replace **“sitemap first means SEO is broken”** with **“the screenshot's link mix may be less useful for a prospective merchant; improve the underlying navigation and commercial page signals, then observe.”**
3. Replace **“mixed languages proves hreflang is broken”** with **“validate locale implementation and inspect the actual search settings before assigning cause.”**
4. Replace **“meta description is missing because the snippet differs”** with **“Google selected matching FAQ content; verify inputs, but accept that snippets are query-dependent.”**
5. Replace **“noindex removes only an unwanted sitelink”** with **“noindex excludes the entire page, including useful discovery.”**
6. Replace **“old subdomain search records prove those pages are live”** with **“search data is stale; current probes show working admin redirects/noindex and two independently confirmed NXDOMAIN hosts.”**
7. Replace **“we can force preferred sitelinks with schema/sitemap”** with **“we can improve inputs, not guarantee Google's selection or timing.”**

## Recommended next steps and limits

First complete the page-input repairs established by the source/live review, preserving useful support and translated content. Separately resolve the lifecycle of the two NXDOMAIN search destinations, retain the working admin/account behavior, and reconcile the public consumer-app relationship and inspected legacy destinations. After an authorized future release and normal recrawl, repeat the same query set with controlled language/location/device settings, retain exact destination URLs, and compare query-specific GSC impressions/CTR and Google-selected canonical/index results if access exists.

This specialist submitted no recrawl requests, removals or app/profile edits; no pages were deindexed or deployed. There is no claim of a manual action, penalty, rank loss, universal language problem, complete brand footprint or measured conversion impact. The final external findings are deliberately limited to two lifecycle/identity review items in [external-findings.json](external-findings.json), while the parent owns concrete live/source metadata defects.
