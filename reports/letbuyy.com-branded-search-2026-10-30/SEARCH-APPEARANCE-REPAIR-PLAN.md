# Search appearance repair plan

30 October 2026 · Local implementation briefs only. No edits or publication performed. Existing dirty local changes must be reviewed before any future patch. Estimates assume an engineer familiar with the marketing app and exclude approval/recrawl time.

## First five actions

| Order | Action | Owner / effort | Completion evidence |
|---|---|---|---|
|1|Verify authorized ownership and repair the app-linked privacy destination; it currently serves the homepage.|App release + privacy/product + host owner;0.5 engineering day after approved content.|Exact app-store link opens the actual reviewed app-specific policy on direct visit and refresh.|
|2|Give the old seller/developer/admin surfaces an explicit lifecycle disposition.|Domain/platform + identity + SEO;0.5–1 review day.|Seller/developer NXDOMAIN issue has a relevant approved disposition; admin account return paths and intentional noindex remain functional.|
|3|Remove repeated branding from home and resource title inheritance.|Frontend + SEO editor;0.5–1 engineer day for both chains.|Rendered/raw titles across representative templates/locales contain one intentional brand and distinct page purpose.|
|4|Improve pricing identity and synchronize the hero, first FAQ and product availability/offer facts.|Product + frontend + content;1–2 days after facts approved.|Pricing has descriptive title/H1, authoritative visible plan content; definition and free/trial/paid claims agree. No invented capability or customer proof.|
|5|Finish canonical/sitemap correctness, then resolve HTML-directory visibility as a separate product policy.|Frontend + SEO; see prior TECH-01/02/04 briefs.|Locale resource URLs are self-canonical, articles are included appropriately in XML, create has its own metadata, HTML-directory policy is consistent.|

Actions1–2 involve external ownership and can progress alongside main-site repairs. Title and copy cleanup can be implemented before the utility-page policy is decided. Correctness and truthful user journeys take precedence over trying to reproduce a particular set of sitelinks.

## Brief A — Repair the actual privacy document journey

**Finding:** BR-PUB-01. **Observed URL:** https://letbuy-y.web.app/privacy-policy. Public listing: https://play.google.com/store/apps/details?id=com.letbuyy.letbuyy&hl=en.

The exact destination returns the old sales homepage after JavaScript executes. Do not infer that a footer link saying Privacy Policy means the policy exists. Confirm the authorized publisher/host owner and the actual app's data practices first. Prepare an owner-reviewed notice for that app, and make the exact linked route serve it or point to its correct canonical location through the normal authorized release process. A merchant-platform notice may describe different processing and must not be substituted without review.

No repository file location is proposed for this Firebase-hosted legacy deployment because its source authority was not established. Do not recreate its app or add a second privacy system in the active repository just to make a URL work. Review the existing canonical public policy publishing mechanism before implementation.

Also repair the old page's tested Help Center, Contact Us and Terms of Service placeholder links (BR-PUB-02) using verified appropriate destinations. Review its starter title/description and intended canonical/public lifecycle. DOM inventory alone is not interaction proof, but these3 links were clicked and left the same homepage visible. [Click evidence](evidence/legacy-link-checks.json).

**Acceptance:** final response200, after any approved relevant redirect, with an app-specific title/H1 and accurate notice; distinct content from homepage; all app-store policy links resolve; deep-link refresh works; no private data or fabricated legal statements. Validate the actual notice with its responsible owner, not merely a keyword checker. [Rendered evidence](evidence/legacy-app-rendered.json).

## Brief B — Resolve legacy hosts without resurrecting old topology

| Exact old URL | Current evidence | Required decision |
|---|---|---|
|https://seller.letbuyy.com/|A-query NXDOMAIN from Google Public DNS; returned historical marketplace result.|Verify ownership and retired-product intent. Choose a relevant migration explanation/target or appropriate retirement treatment; restoring a public hostname requires a separate authorized infrastructure change.|
|https://developer.letbuyy.com/api|A-query NXDOMAIN; returned historical developer result.|Determine whether a genuinely corresponding current developer page exists; do not blanket redirect unrelated API documentation.|
|https://admin.letbuyy.com/|307 to accounts lookup; final200 with noindex,nofollow.|Keep valid identity routing/private access. Verify old indexing record when GSC is available.|
|https://admin.letbuyy.com/auth/login|307 to accounts lookup retaining return_to; final200/noindex.|Preserve legitimate login return behavior. An old search title does not prove the private console is exposed.|

Do not reactivate `seller`/developer runtimes or create another identity service to fix search residue. Public URL lifecycle and deployment topology are distinct decisions. Domain owner must choose policy before any DNS or redirect release. A temporary removal tool would not fix the origin state and is not authorized here.

**Acceptance:**each old URL has a reviewed owner/audience/status/target entry; actual search records are checked against exact current behavior; no broken account return. Search changes may lag processing and are not guaranteed by a deadline.

## Brief C — Fix both title inheritance chains

**Current source locations, read-only verified:**

- [Root title template](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/layout.tsx:38).
- [Locale layout title](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/[locale]/layout.tsx:28).
- [English dictionary branded string](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/i18n/dictionaries/en.ts:14); matching existing `hi.ts` and `ta.ts` dictionaries.
- [Resource layout template](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/[locale]/resources/layout.tsx:11) and page-specific category/author/release metadata documented in [source forensics](findings/source-forensics.md).

Use one layer to add branding. For a child page receiving the existing `%s | LetBuyy Resources` template, its title token should be `Payments`, not `Payments — LetBuyy Resources`. For a deliberately complete title use Next Metadata's absolute title intentionally, preserving localized metadata and downstream template behavior. Do not export server metadata from the existing client homepage component without adapting the existing boundary correctly. The straightforward change may be in its existing locale-layout/dictionary ownership rather than a new component.

These are **candidate final English outputs**, not commands to hardcode all locales:

| Page | Intended final output |
|---|---|
|Home|Online Store Builder for Indian Businesses \| LetBuyy|
|Pricing|LetBuyy Pricing — Plans for Indian Businesses|
|Payments category|Payments \| LetBuyy Resources|
|Merchant guide|Merchant Dashboard Guide \| LetBuyy Resources|
|Support|LetBuyy Support — Guides and Contact|

The first home candidate reflects the visible India/store-builder proposition; product owners must approve wording and actual availability. The merchant-guide/support candidates are editorial clarity opportunities, not required fixes or guarantees of sitelink display. Translate naturally for the real locales and have native-language reviewers approve.

**Acceptance:**snapshot actual raw titles for homepage, pricing, resource index/category/tag/author/article/changelog/releases and create across3 locales. Assert no unintended duplicate brand/suffix, no missing title, matching language, and accurate purpose. Confirm inherited OG/Twitter values survive. Do not assert “Google must now display this exact string.” [Google title-link guidance](https://developers.google.com/search/docs/appearance/title-link).

## Brief D — Synchronize visible product definition, pricing and availability

The first FAQ at [FAQ.tsx:31](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/components/FAQ.tsx:31) matches the supplied main snippet. Its broad AI-native OS list competes with the homepage's store-building meta description. Google normally chooses snippets from content and can vary them by query. [Google snippet guidance](https://developers.google.com/search/docs/appearance/snippet).

Prepare one approved fact sheet: intended audience, current supported tasks, available versus coming-soon features, paid plan/trial terms, commission policy, external app relationship, substantiated customer proof. Apply it to the hero, first FAQ, pricing, CTAs, product schema and official app/profile descriptions as separately authorized. Keep the existing prior AUD-01/CONTENT-03/CONTENT-04 fact checks; do not invent social proof to improve snippets.

Pricing source: [page.tsx](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/[locale]/pricing/page.tsx:10), [Pricing.tsx](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/components/Pricing.tsx:14). Fresh raw pricing lacks H1 and uses generic titles. Add a single useful page H1 and concise page-specific description. Preserve one authoritative existing plan-data source; server-visible pricing must not become a second hardcoded price table. Keep clear runtime availability and truthful trial conditions. Main-site render/price retrieval validation belongs to prior AUD-03 and must be repeated after an implementation change.

The legacy app-linked page shows Free/Pro/Max and500+ sellers/₹2Cr+ processed, while current marketing metadata describes Launch from₹299. Verify whether these are the same product/era and whether old offers/claims remain valid before replacing them. This is not proof of intentional deception.

## Brief E — Correct canonical identities and feed membership before sitelink speculation

Use the existing implementations and prior [implementation briefs](../letbuyy.com-comprehensive-audit-2026-10-29/IMPLEMENTATION-BRIEFS.md). Fresh Payments category variants still canonicalize to the same locale-free alias. Set canonical to the actual intended localized public identity; alternate language links should refer to equivalent pages and be reciprocal. Preserve the already correct home/support/directory/guide triplets.

Fresh99-entry XML omits the3 sampled merchant-guide article URLs, consistent with prior omission of105 article variants. Repair the actual feed generator from canonical content inventory, not another hand-maintained sitemap. Preserve meaningful lastmod dates. Give `/in/create` and its equivalents explicit page identity rather than inherited homepage metadata. These are old TECH-01/02/04 findings, not newly counted bugs.

## Brief F — Choose an HTML-directory policy with the full tradeoff

The existing HTML directory is useful navigation and currently intentionally eligible. If approved for organic search, keep it indexable with a useful title and content. If it is navigation-only, use crawl-visible noindex on the3 HTML directory pages and remove those3 URLs from XML; keep the actual XML feed and accessible links. Do not robots-block the pages so Google cannot see noindex, remove all legal/support footer links, or assume another chosen page will replace the directory sitelink. Noindex removes the whole page from Google Search. [Google guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

Fresh `/in/demo` is already noindex. Preserve that policy unless an explicit helpful landing-page strategy changes it. Search-engine-selected sitelinks are not a sufficient reason to turn a form into an indexable landing page.

## Next batch — smaller graph/locale accuracy repairs

BR-SRC-03: describe final public localized navigation identities using the existing routing helper; preserve a single Organization/WebSite entity. Account destinations can be navigation links without being declared contained marketing pages. SiteNavigationElement order has no sitelink-selection setting. Root WebSite URL can remain the root identity even when it redirects to a crawlable locale target.

BR-SRC-06: correct resource-layout `og:locale` for actual HI/TA pages. Preserve complete nested OG/Twitter fields; avoid losing existing local image repairs through shallow nested metadata replacement.

BR-SRC-04: render the correct root document language on the server through a framework-compatible existing layout design; keep nested language scopes. Test client navigation/hydration and native-language assistive technology. This is an accessibility completion, not a proven fix for mixed-language Google sitelinks.

BR-SRC-05: validate canonical-origin configuration in isolated synthetic cases and confirm actual approved deployment settings before any production conclusion. Current normalization works. Also test caching of root language negotiation before declaring the absence of Vary a real incident.

## Verification after a separately authorized future release

1. Reuse the exact URL/template/locale matrix and record raw status, canonical, hreflang, title, heading, schema/OG fields and rendered main content. Inspect expected changes rather than recrawling unnecessarily.
2. Confirm app privacy content, legacy host disposition, account return paths and public listing links. Keep private console protection distinct from noindex.
3. When GSC read access exists, inspect actual index/Google-selected canonical state for home, each observed result destination and representative fixed archives. Do not equate sitemap membership or HTTP200 with indexing.
4. Capture brand-only, brand+pricing, brand+login, brand+support and brand+reviews queries on defined mobile/desktop language/country settings. Save date, query, screenshot and exact result URLs. `hl/gl/pws` request parameters alone do not prove complete depersonalization or geolocation.
5. Compare actual query/landing impressions, clicks and CTR over comparable periods with enough data, documenting other launches. No rank/revenue percentage forecast or guaranteed sitelink replacement. No recurring monitoring or indexing submission is configured by this audit.
