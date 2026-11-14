# LetBuyy live SEO audit — executive summary

**Audited:** https://www.letbuyy.com/in · **Date:** 29 October 2026, Asia/Kolkata. Capture timestamps are preserved in UTC.

**Assessment:** The public site is accessible and provides substantial server-rendered content. The most pressing problems are inconsistent locale identities, contradictory commercial facts and unsourced or outdated advice. Fix correctness and discovery signals before expanding the content footprint. No site-wide indexing block, critical incident, penalty or measured ranking loss was demonstrated.

## Business context established from the site

Observed: LetBuyy presents a Commerce OS and online-store/merchant operations platform; marketing, subscription pricing and educational resources are the main page types. Copy explicitly targets Indian sellers, UPI/COD/GST use cases, INR prices, and English/Tamil/Hindi. Main actions are account signup, plan review, demo and contact. Public guides also target developers/agencies and existing operators. These are website observations, not inferences from the user’s timezone. The origin is a SaaS marketing property, not an inspected customer SKU store or eligible in-person local business.

Observed technology: Next.js script/image/rendering signals and Vercel headers; repository source confirms Next.js16/React19 and existing gateway-backed pricing. Local source differs from production. HTML, rendered DOM and source observations are identified separately.

## Coverage

- **499 distinct crawl/probe URLs discovered and inspected; 500 designated crawl attempts including one retry.** The initial crawl had 496 attempts; reconciliation fetched 3 ordinary tag/cart pages and retried one legal-page timeout. The final dataset has 497 HTTP 200 responses and two probe 404 responses (generic missing page and optional llms.txt).
- **489 clean marketing HTML pages:163 per language**, excluding aliases and deliberate invalid/error/discovery probes. All 99 root XML sitemap URLs inspected ; 105 article equivalents (35 per language), 267 known tag archives, 21 category pages and15 author pages are represented.
- **23 rendered samples** cover all major templates; homepage/pricing/article/contact/support have additional mobile samples. Four homepage viewport screenshots and other representative screenshots are saved. Six separate diagnostic browser performance samples cover 3 templates × 2 devices.
- Five primary competitor pages fetched and parsed; focused search-query evidence recorded. One selected public backlink verified. 16 image assets, three satellite sitemap hosts and two RSS feeds sampled. Public signup destination returned 200; no signup/form action was submitted.

## Findings

**23 unique findings:** 0 Critical, 7 High, 12 Medium, 3 Low, 1 Informational. These counts include opportunities and needs-verification items: 17 Confirmed, 2 Needs verification, 4 Opportunity. Affected counts overlap; do not sum them into unique broken pages.

- 303 resource canonicals omit the served locale; 309 total canonical mismatches include create/search inheritance.
- All 105 discovered localized articles are absent from the 99-entry XML sitemap;27 listed URLs disagree with their canonicals.
- All 489 clean locale pages carry a free-offer schema, while rendered acquisition pages show paid subscriptions/trials.
- The GST guide contains documented conflicts with official material, and the 270% conversion headline miscalculates the stated numbers.
- 19 English articles have quantified claims without in-body source links; merchant outcome and expert biographies require provenance verification.
- Subscription plan cards/prices depend on client fetching; all 3 pricing pages lack H1.
- Article structured-data identities/breadcrumbs omit locales; arbitrary nonexistent tag returns indexable 200.
- Three declared satellite sitemap hosts return NXDOMAIN. Social metadata and RSS identity also need consistency work.


## Method and evidence interpretation

Robots-respecting crawl capped at 500 attempts including reconciliation, five worker maximum, one-second launch spacing, maximum 3 redirect hops,30-second request budget,4 MiB page cap, public-IP checks and TLS verification. Seed sources: live robots/root sitemap and locale home/navigation/footer links, plus bounded normalization/404/tag probes. Queries/actions/cart/logout/purchases/tracking loops excluded. The cart-tag false-positive was corrected before final reporting. No crawl queue remains; this exhausts the discovered safe graph, not unknowable orphan URLs or the entire domain estate. Supplementary resources/browser/measurements and competitor fetches are counted separately.

Raw visible-word counts include visible navigation/decorative copy and may include collapsed sections. They are diagnostics, not content minimums. Empty-alt decorative images are not missing accessibility text. HTTP200/robotsallow, JSON parsing, schema eligibility and actual indexing are distinct.

## Confirmed problems, verification items and opportunities

### AUD-01 — Free launch offer markup conflicts with paid plans and trial messaging

**High · Confirmed · confidence: High · 489 inspected pages · Template-wide**

**Evidence:** All 489 clean locale pages emit SoftwareApplication.offers.price="0" and a free launch tier. Live rendered home/pricing samples show Launch ₹199/month (regular ₹299), Growth ₹699 (regular ₹999), and Scale/Commerce OS coming soon. Free-forever CTA text and 14-day trial messaging coexist. Observed price is not an owner-approved policy determination.

**Representative URLs:** [https://www.letbuyy.com/in](https://www.letbuyy.com/in) · [https://www.letbuyy.com/in-ta](https://www.letbuyy.com/in-ta) · [https://www.letbuyy.com/in-hi](https://www.letbuyy.com/in-hi) · [https://www.letbuyy.com/in/pricing](https://www.letbuyy.com/in/pricing)

**Why it matters:** Inconsistent acquisition promises can mislead readers and machine consumers about subscription obligations; no revenue or ranking impact is quantified.

**Fix:** Resolve the approved current offer with the existing product/pricing authority. Synchronize visible copy, plan HTML, CTA, FAQ, translations, metadata and offer schema. Distinguish subscription, trial, zero commission, provider charges and GST. Remove an unsupported offer or generate an accurate one; do not invent a free plan or alter pricing to satisfy schema.

**Owner / estimated effort:** Product/commercial owner + frontend engineer · 0.5–1 engineer day after offer decision; editorial/translation time additional

**Dependencies:** Approved offer facts; existing gateway pricing authority; coordinate AUD-03.

**Validation:** Compare initial HTML, hydrated plan cards, CTA/FAQ/legal copy and JSON-LD across all locales, including missing-price/provider-failure behavior. No contradictory free-forever promise may remain.

**Success indicator:** Zero contradictory offer statements across inspected surfaces; visible offer and schema agree.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json), [evidence/browser-samples.json](evidence/browser-samples.json), [evidence/home-desktop-rendered.html](evidence/home-desktop-rendered.html), [evidence/pricing-desktop-rendered.html](evidence/pricing-desktop-rendered.html)

**Primary references:** [source 1](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)


### AUD-02 — GST guide repeats superseded and overgeneralized guidance

**High · Confirmed · confidence: High · 3 inspected pages · Template-wide**

**Evidence:** English guide states TCS 1%, marketplace registration mandatory regardless of turnover, and apparel above ₹1,000 taxed at 12%. Translated equivalents repeat substantive guidance. Official records document the 2024 TCS reduction and conditional ecommerce registration exemption; 2025 rate changes include a ₹2,500 apparel threshold. The claimed June 2026 update did not remove these conflicts. All tax obligations were not exhaustively re-adjudicated.

**Representative URLs:** [https://www.letbuyy.com/in/resources/payments/gst-for-ecommerce-india](https://www.letbuyy.com/in/resources/payments/gst-for-ecommerce-india) · [https://www.letbuyy.com/in-ta/resources/payments/gst-for-ecommerce-india](https://www.letbuyy.com/in-ta/resources/payments/gst-for-ecommerce-india) · [https://www.letbuyy.com/in-hi/resources/payments/gst-for-ecommerce-india](https://www.letbuyy.com/in-hi/resources/payments/gst-for-ecommerce-india)

**Why it matters:** Merchants may rely on materially misleading compliance advice. This is a high-priority accuracy/trust issue independent of SEO rankings.

**Fix:** Have a qualified tax reviewer resolve every threshold/rate/exemption/filing statement against applicable current notifications and conditions. Correct all languages, include dated primary references and real reviewer attribution, then review related launch/invoice/payment guides. Do not replace one blanket rule with another. A GSTR-2A mention alone is not an error: official portal help describes TCS details in Part C.

**Owner / estimated effort:** Qualified tax reviewer + editorial/translation owner · 1–3 reviewer/editor days for guide family; assumes access to current notifications and native-language review

**Dependencies:** Current applicable notifications, actual jurisdiction/product facts and real review ownership.

**Validation:** Maintain a claim-to-source ledger with effective dates, exceptions and reviewer signoff. Recheck all three language variants, article/card metadata, linked guides and update dates.

**Success indicator:** Zero unresolved documented conflicts in the reviewed guide family; every material compliance claim has an applicable dated primary source.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json), [evidence/content-analysis.json](evidence/content-analysis.json), [evidence/primary-source-log.json](evidence/primary-source-log.json)

**Primary references:** [source 1](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2087659&lang=2&reg=48), [source 2](https://gstcouncil.gov.in/sites/default/files/2024-05/gst-ct-34-2023.pdf), [source 3](https://www.pib.gov.in/FactsheetDetails.aspx?ModuleId=16&NoteId=150293&id=150293&lang=2&reg=48), [source 4](https://tutorial.gst.gov.in/userguide/returns/GSTR_2A.htm)


### CONTENT-01 — Conversion-lift headline and calculation overstate the example

**High · Confirmed · confidence: High · 3 inspected pages · Shared article record across three locales**

**Evidence:** Shared live HTML in three locale variants retains 1.7%, 4.6% and 270%. (4.6-1.7)/1.7*100=170.5882%; absolute change=2.9 percentage points. The title also promotes 270%. Underlying study/sample was not identified in the article.

**Representative URLs:** [https://www.letbuyy.com/in/resources/ecommerce/how-product-reviews-increase-conversion](https://www.letbuyy.com/in/resources/ecommerce/how-product-reviews-increase-conversion) · [https://www.letbuyy.com/in-ta/resources/ecommerce/how-product-reviews-increase-conversion](https://www.letbuyy.com/in-ta/resources/ecommerce/how-product-reviews-increase-conversion) · [https://www.letbuyy.com/in-hi/resources/ecommerce/how-product-reviews-increase-conversion](https://www.letbuyy.com/in-hi/resources/ecommerce/how-product-reviews-increase-conversion)

**Why it matters:** Readers receive a materially incorrect quantitative conclusion; it also propagates to titles and article/card text. No ranking loss is established.

**Fix:** Correct the relative-increase calculation and all synchronized titles, summaries, schema/cards and translations. Alternatively remove the numerical promise until a faithfully scoped original source is available. Do not present arithmetic correction as validation of the original study.

**Owner / estimated effort:** Editor + analytics/research reviewer · 2-6 hours assuming translation support and underlying source access

**Dependencies:** Claim/source ledger; translation review

**Validation:** Recompute from cited original values; compare title, H1, body, summaries and schema in all three languages; verify the source population/date/outcome.

**Success indicator:** Zero arithmetic contradictions across the three article variants and their metadata.

**Evidence files:** [evidence/pages/039da40a874dfba0.html](evidence/pages/039da40a874dfba0.html), [evidence/pages/d0869f91e7e79151.html](evidence/pages/d0869f91e7e79151.html), [evidence/pages/16bcad3c293bfcc4.html](evidence/pages/16bcad3c293bfcc4.html), [evidence/crawl.json](evidence/crawl.json)


### CONTENT-02 — Quantified article claims lack traceable in-body references

**High · Confirmed · confidence: High for missing references; truth of most figures unverified · 19 inspected pages · 19 English article pages; related translations require synchronized review**

**Evidence:** Within all 35 English articles, body-container extraction finds no external reference anchors. 19 English articles contain percentage-pattern claims. Examples include exact payment shares/performance gains and growth/retention statistics. UPI guide also makes categorical zero-failure, fee and settlement assertions. Absence of citations does not prove every claim false; current fee and other factual applicability remain unverified.

**Representative URLs:** [https://www.letbuyy.com/in/resources/operations/order-fulfillment-guide](https://www.letbuyy.com/in/resources/operations/order-fulfillment-guide) · [https://www.letbuyy.com/in/resources/growth/email-marketing-ecommerce](https://www.letbuyy.com/in/resources/growth/email-marketing-ecommerce) · [https://www.letbuyy.com/in/resources/ecommerce/how-to-start-an-online-store-india](https://www.letbuyy.com/in/resources/ecommerce/how-to-start-an-online-store-india) · [https://www.letbuyy.com/in/resources/payments/upi-vs-cod-india](https://www.letbuyy.com/in/resources/payments/upi-vs-cod-india)

**Why it matters:** Material numerical and financial assertions are difficult for readers or reviewers to verify; generic nationwide claims can be misapplied to a merchant.

**Fix:** Build a source ledger for each material figure/categorical assertion: exact statement, source URL, date, sample/population, metric definition, scope and review owner. Cite primary sources beside claims, qualify estimates and remove unsupported guarantees. Distinguish national payment volume from ecommerce share, transfer confirmation from merchant settlement, and RTO from customer returns. Add safe link/citation capability to the existing content contract/renderer when needed.

**Owner / estimated effort:** Subject editor + product/payments specialist; web engineer for citation support · 3-7 working days for the first 19 English articles plus scoped translations, assuming source access; not a delivery promise

**Dependencies:** Current primary data/provider terms; safe citation rendering; qualified review for financial/tax statements

**Validation:** Verify every retained material numerical claim against the exact primary source and effective date; check citations appear as crawlable links in initial HTML; translations preserve scope. Review facts, not merely link counts.

**Success indicator:** All retained material claims in the priority article set have a supporting source/methodology or a visible illustrative/estimate label.

**Evidence files:** [evidence/pages/10eff7edf6816a14.html](evidence/pages/10eff7edf6816a14.html), [evidence/pages/240e5124fc4dfa6a.html](evidence/pages/240e5124fc4dfa6a.html), [evidence/pages/b7182a42ce7e1a51.html](evidence/pages/b7182a42ce7e1a51.html), [evidence/pages/30be81c250683ada.html](evidence/pages/30be81c250683ada.html), [evidence/pages/638b30fbe426959e.html](evidence/pages/638b30fbe426959e.html), [evidence/pages/914dabbc2ca5b649.html](evidence/pages/914dabbc2ca5b649.html), [evidence/pages/0c3c0e21e6ea7625.html](evidence/pages/0c3c0e21e6ea7625.html), [evidence/pages/6d149bd3b79fd270.html](evidence/pages/6d149bd3b79fd270.html), [evidence/pages/5978e72464fe6e7d.html](evidence/pages/5978e72464fe6e7d.html), [evidence/pages/3bd74482f63458aa.html](evidence/pages/3bd74482f63458aa.html), [evidence/pages/86ee7a67bfd0cfbb.html](evidence/pages/86ee7a67bfd0cfbb.html), [evidence/pages/039da40a874dfba0.html](evidence/pages/039da40a874dfba0.html), [evidence/pages/5c1bb96eb593039b.html](evidence/pages/5c1bb96eb593039b.html), [evidence/pages/5cffd01670f9f882.html](evidence/pages/5cffd01670f9f882.html), [evidence/pages/4f2ea1ca5df3d84d.html](evidence/pages/4f2ea1ca5df3d84d.html), [evidence/pages/9b220f18c83f69e3.html](evidence/pages/9b220f18c83f69e3.html), [evidence/pages/f7bfec8ba6cc4abe.html](evidence/pages/f7bfec8ba6cc4abe.html), [evidence/pages/1ea25c06c96e8c74.html](evidence/pages/1ea25c06c96e8c74.html), [evidence/pages/bd52cabad7646686.html](evidence/pages/bd52cabad7646686.html), [evidence/crawl.json](evidence/crawl.json)


### TECH-01 — Resource category, tag and author canonicals remove the locale

**High · Confirmed · confidence: High · 303 inspected pages · Template-wide**

**Evidence:** 303 live pages declare a locale-free canonical. The source category/tag/author generateMetadata functions return /resources/... instead of the actual /in, /in-ta or /in-hi URL. Shared normalization probes demonstrate representative locale-free targets redirecting to /in. Current raw evidence and all affected URLs are listed in evidence/technical-analysis.json.

**Representative URLs:** [https://www.letbuyy.com/in/resources/ecommerce](https://www.letbuyy.com/in/resources/ecommerce) · [https://www.letbuyy.com/in-ta/resources/ecommerce](https://www.letbuyy.com/in-ta/resources/ecommerce) · [https://www.letbuyy.com/in-hi/resources/ecommerce](https://www.letbuyy.com/in-hi/resources/ecommerce) · [https://www.letbuyy.com/in/resources/growth](https://www.letbuyy.com/in/resources/growth)

**Why it matters:** Contradictory canonical/redirect signals complicate page consolidation; translated pages nominate the same locale-free identity. This does not establish Google-selected canonicals or an indexing loss.

**Fix:** Reuse existing localizeMetadata/buildAlternates in /Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/i18n/metadata.ts and routing.ts. Change the three resource templates to generate absolute final locale canonicals; preserve navigation, sitemap and schema agreement. Do not rewrite a working helper or create a second SEO system.

**Owner / estimated effort:** Frontend engineer · 0.5–1 engineer day including template tests; excludes release

**Dependencies:** Decide which archive types should remain indexable; preserve genuine translated equivalents.

**Validation:** Recrawl every category/tag/author in all three locales; each retained indexable page has one absolute self-canonical returning200. Test sampled language alternates and URL normalization. Later inspect Google-selected canonicals when GSC is available.

**Success indicator:** 0 redirecting or locale-stripped canonicals among retained intended indexable pages.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json)

**Primary references:** [source 1](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [source 2](https://developers.google.com/search/docs/specialty/international/localized-versions)


### TECH-04 — XML sitemap omits every discovered localized article

**High · Confirmed · confidence: High · 105 inspected pages · Template-wide**

**Evidence:** 105/105 inspected localized articles are absent from the 99-entry XML sitemap. The static sitemap source expands core/category/legal paths only; getAllArticlesForSitemap() already exists in src/lib/resources/utils.ts but is unused by the sitemap.

**Representative URLs:** [https://www.letbuyy.com/in-hi/resources/ai-commerce/ai-commerce-explained](https://www.letbuyy.com/in-hi/resources/ai-commerce/ai-commerce-explained) · [https://www.letbuyy.com/in-hi/resources/ai-commerce/ai-product-recommendations](https://www.letbuyy.com/in-hi/resources/ai-commerce/ai-product-recommendations) · [https://www.letbuyy.com/in-hi/resources/ai-commerce/automating-operations-ai](https://www.letbuyy.com/in-hi/resources/ai-commerce/automating-operations-ai) · [https://www.letbuyy.com/in-hi/resources/ai-commerce/commerce-copilot-guide](https://www.letbuyy.com/in-hi/resources/ai-commerce/commerce-copilot-guide)

**Why it matters:** Weakens an important discovery/canonical inventory channel; articles remain internally linked, so omission does not prove they are unindexed.

**Fix:** Generate entries from the existing published article registry and actually available translations. Include approved, indexable final200 URLs with canonical agreement and correct alternates; remove search/noncanonical aliases according to policy. Correct public content claims before amplifying discovery. Do not create another article authority.

**Owner / estimated effort:** Frontend engineer + editor · 0.5–1 engineer day plus editorial eligibility review

**Dependencies:** TECH-01/02/03 canonical/indexing decisions; CONTENT factual/availability corrections.

**Validation:** Compare expected approved article set to sitemap set; set difference must be empty. Fetch each intended sitemap URL, check status/index directive/canonical, and validate reciprocal alternate sets. Confirm GSC processing later if access exists.

**Success indicator:** 100% coverage of approved indexable published article equivalents;0 invalid/noncanonical/excluded sitemap URLs.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json)

**Primary references:** [source 1](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)


### CONTENT-03 — Merchant outcomes and expert biographies need provenance verification

**High · Needs verification · confidence: High for observed wording; underlying provenance unverified · 4 inspected pages · One English article and three English author profiles**

**Evidence:** The live launch guide describes a Jaipur merchant migration in April2026 with conversion changing34% to61% in60days and COD orders doubling, labelled Commerce Example rather than explicitly hypothetical. Inspected author pages claim prior employer experience, a GST-consultant role and work with200brands. Page-level evidence does not substantiate those identities/outcomes. This audit has not established that they are false.

**Representative URLs:** [https://www.letbuyy.com/in/resources/ecommerce/how-to-start-an-online-store-india](https://www.letbuyy.com/in/resources/ecommerce/how-to-start-an-online-store-india) · [https://www.letbuyy.com/in/resources/authors/priya-commerce](https://www.letbuyy.com/in/resources/authors/priya-commerce) · [https://www.letbuyy.com/in/resources/authors/neha-payments](https://www.letbuyy.com/in/resources/authors/neha-payments) · [https://www.letbuyy.com/in/resources/authors/ravi-operations](https://www.letbuyy.com/in/resources/authors/ravi-operations)

**Why it matters:** Specific-looking customer results and professional credentials can affect merchant trust and financial decisions; markup cannot compensate for unsupported provenance.

**Fix:** Obtain authorized records for actual results and biographies. Retain only accurate claims; otherwise remove unsupported credentials or use an honest team byline. Explicitly label hypothetical teaching scenarios and inputs. Keep actual customer data private and publish only authorized evidence.

**Owner / estimated effort:** Editorial owner + business/product owner; real named reviewers where applicable · 1-3 days to resolve priority claims if records/owners are available; otherwise remove/qualify pending verification

**Dependencies:** Human-owned factual records and consent; truthful author/entity policy

**Validation:** For each result, verify data window, denominator, calculation, confounders and publishing permission. For each biography, verify actual identity/role and consent. Check article, author page, schema and translations agree.

**Success indicator:** Zero unverified customer outcomes or credentials presented as established facts in the reviewed set.

**Evidence files:** [evidence/pages/b7182a42ce7e1a51.html](evidence/pages/b7182a42ce7e1a51.html), [evidence/pages/6275c8f02d2cb141.html](evidence/pages/6275c8f02d2cb141.html), [evidence/pages/a5140cbacbb6cf9d.html](evidence/pages/a5140cbacbb6cf9d.html), [evidence/pages/1ea885b14915fe0d.html](evidence/pages/1ea885b14915fe0d.html), [evidence/crawl.json](evidence/crawl.json)


### AUD-03 — Public subscription prices arrive only after client fetching

**Medium · Confirmed · confidence: High · 6 inspected pages · Template-wide**

**Evidence:** Initial home/pricing HTML contains loading skeletons in the pricing component, without actual plan cards/prices; rendered English home and pricing show ₹199/₹699 after waiting for the plan-card selector. Source Pricing.tsx fetches /api/founding-pricing in useEffect. Homepage illustrative product prices are not subscription-plan evidence.

**Representative URLs:** [https://www.letbuyy.com/in](https://www.letbuyy.com/in) · [https://www.letbuyy.com/in/pricing](https://www.letbuyy.com/in/pricing) · [https://www.letbuyy.com/in-ta](https://www.letbuyy.com/in-ta) · [https://www.letbuyy.com/in-ta/pricing](https://www.letbuyy.com/in-ta/pricing)

**Why it matters:** Public price/availability facts depend on additional rendering and network success; this is not proof Google cannot render them.

**Fix:** Fetch approved public plan facts on the server through the existing gateway contract and seed the interactive client comparison. Keep one plan authority, bounded timeout/cache freshness, availability labels and truthful error/empty fallback. Isolate live slots-counter availability from otherwise valid public plans where the existing contract permits. Coordinate H1/title repair without making the homepage subsection another H1.

**Owner / estimated effort:** Frontend/backend integration engineer · 1–2 engineer days including timeout/cache/error/hydration verification

**Dependencies:** AUD-01 approved offer; existing public gateway pricing contract; TECH-06.

**Validation:** With JS disabled, actual eligible plan name/price/trial conditions are visible; hydration agrees. Test upstream timeout/error/empty plans and stale counter without silently showing free/success. Verify all locales.

**Success indicator:** Approved public plan facts visible before hydration and consistent after hydration, including honest unavailable states.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json), [evidence/browser-samples.json](evidence/browser-samples.json), [evidence/pricing-desktop-rendered.html](evidence/pricing-desktop-rendered.html)


### AUD-04 — Robots declares three sitemap hosts that do not resolve

**Medium · Confirmed · confidence: High · 3 inspected resources · Three declared sitemap resources**

**Evidence:** Live robots.txt advertises these three satellite sitemap URLs. URL-safe resource fetches fail DNS resolution, and public dns.google A lookups return Status 3 (NXDOMAIN) for each. Root sitemap works. These are three declared resources, not three failed marketing HTML pages.

**Representative URLs:** [https://themes.letbuyy.com/sitemap.xml](https://themes.letbuyy.com/sitemap.xml) · [https://apps.letbuyy.com/sitemap.xml](https://apps.letbuyy.com/sitemap.xml) · [https://developer.letbuyy.com/sitemap.xml](https://developer.letbuyy.com/sitemap.xml)

**Why it matters:** Publishes dead discovery destinations and obscures which sitemap represents the active public estate; no site-wide crawl block was found.

**Fix:** Confirm current ownership/intended publishing state, then remove stale declarations from the existing platform-links sitemap authority and retain active sitemap URLs. Do not activate dormant services or provision domains as an SEO repair.

**Owner / estimated effort:** Frontend/platform owner · 0.25–0.5 engineer day after ownership confirmation

**Dependencies:** Authoritative active sitemap/domain inventory; no new runtime activation.

**Validation:** Fetch deployed robots and every declared sitemap from two resolvers/locations; each must resolve and return valid intended XML, with scope and canonical agreement.

**Success indicator:** Zero nonresolving or retired sitemap declarations.

**Evidence files:** [evidence/robots.txt](evidence/robots.txt), [evidence/resource-probes.json](evidence/resource-probes.json), [evidence/crawl.json](evidence/crawl.json)


### TECH-02 — Creation chooser inherits homepage metadata and language alternatives

**Medium · Confirmed · confidence: High · 3 inspected pages · Template-wide**

**Evidence:** All captured locale creation pages display Create Your Site (translated where applicable) but inherit homepage title/description/canonical and homepage hreflang targets. Their distinct chooser is listed in the XML sitemap.

**Representative URLs:** [https://www.letbuyy.com/in/create](https://www.letbuyy.com/in/create) · [https://www.letbuyy.com/in-ta/create](https://www.letbuyy.com/in-ta/create) · [https://www.letbuyy.com/in-hi/create](https://www.letbuyy.com/in-hi/create)

**Why it matters:** A distinct acquisition page is described as a homepage duplicate; metadata does not express its task. Whether it should be an organic landing page is a product decision.

**Fix:** In /Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/[locale]/create/page.tsx, provide task-specific localized metadata/self-canonical if retained for indexing, or deliberately noindex/exclude the chooser if it is only a signup step. Keep homepage consolidation only if the page is actually duplicative.

**Owner / estimated effort:** Product owner + frontend engineer · 0.25–0.5 engineer day after indexability decision

**Dependencies:** Creation-page purpose; TECH-01 URL policy.

**Validation:** Check all three locale source responses, headings, canonical/alternates, index directive and sitemap agreement; complete a safe chooser navigation sample without submitting signup.

**Success indicator:** 3/3 chooser URLs follow the chosen consistent indexing/metadata policy.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json)

**Primary references:** [source 1](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)


### TECH-03 — Internal search pages are indexable, sitemap-listed and canonicalize to home

**Medium · Confirmed · confidence: High · 3 inspected pages · Template-wide**

**Evidence:** The three base resource-search pages emit index/follow, inherit homepage canonical and homepage hreflang, reuse a resource index title and have no H1. All three appear in sitemap.xml. Query-result variants were deliberately not expanded.

**Representative URLs:** [https://www.letbuyy.com/in/resources/search](https://www.letbuyy.com/in/resources/search) · [https://www.letbuyy.com/in-ta/resources/search](https://www.letbuyy.com/in-ta/resources/search) · [https://www.letbuyy.com/in-hi/resources/search](https://www.letbuyy.com/in-hi/resources/search)

**Why it matters:** Unrelated consolidation and public indexing signals disagree. This is not proof of large-scale search-result index bloat.

**Fix:** Choose an explicit internal-search indexing policy. Usually noindex the search UI/results and remove them from sitemap; keep crawler access to see noindex and preserve category/article links. Give the page a useful main heading for users. Do not indiscriminately robots-block the pages before Google can read exclusion directives.

**Owner / estimated effort:** SEO lead + frontend engineer · 0.25–0.5 engineer day

**Dependencies:** TECH-01 final URL policy; preserve article discovery.

**Validation:** Check initial HTML robots directives, H1 and exclusion from sitemap for all locales; verify all approved articles remain reachable from normal links. Sample only a bounded real query after policy is implemented.

**Success indicator:** All 3 search routes have intentional indexing policy; no search URLs in the canonical sitemap when excluded.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json)

**Primary references:** [source 1](https://developers.google.com/search/docs/crawling-indexing/block-indexing)


### TECH-06 — Pricing lacks a primary heading and descriptive page title

**Medium · Confirmed · confidence: High · 3 inspected pages · Template-wide**

**Evidence:** All three pricing source responses have zero H1 headings; the reusable Pricing component renders its main heading as H2. English title is simply Pricing. Other locales also have no H1. Client-only plan loading is handled in the content/performance findings, not duplicated here.

**Representative URLs:** [https://www.letbuyy.com/in/pricing](https://www.letbuyy.com/in/pricing) · [https://www.letbuyy.com/in-ta/pricing](https://www.letbuyy.com/in-ta/pricing) · [https://www.letbuyy.com/in-hi/pricing](https://www.letbuyy.com/in-hi/pricing)

**Why it matters:** The commercial page lacks a clear primary document heading and specific search-result title; this is not a standalone indexing blocker.

**Fix:** Add a page-level localized H1 and a descriptive title using approved offer facts. Make the shared pricing section accept heading context or use a separate page wrapper so the homepage subsection remains H2. Synchronize visible prices, metadata and schema with the canonical pricing authority.

**Owner / estimated effort:** Frontend engineer + product marketer · 0.25 engineer day, excluding commercial-fact review

**Dependencies:** Approved offer facts; pricing SSR work coordinated separately.

**Validation:** Check raw/rendered HTML for one useful H1 on each pricing page; homepage retains its own primary H1 and pricing H2. Validate price/title truth against the actual public offer.

**Success indicator:** 3/3 pricing routes have task-specific titles and one meaningful primary heading.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json)

**Primary references:** [source 1](https://developers.google.com/search/docs/appearance/title-link)


### TECH-07 — Article entities and breadcrumbs do not use final localized identities

**Medium · Confirmed · confidence: High · 105 inspected pages · Template-wide**

**Evidence:** All 105 captured articles use locale-free relative mainEntityOfPage.@id and relative breadcrumb items. Article.image and author.url/sameAs are absent; 30 article variants model LetBuyy Team as Person. All inspected JSON-LD parses; syntax success is not semantic validation.

**Representative URLs:** [https://www.letbuyy.com/in/resources/platform/how-themes-work](https://www.letbuyy.com/in/resources/platform/how-themes-work) · [https://www.letbuyy.com/in/resources/platform/introduction-to-apps](https://www.letbuyy.com/in/resources/platform/introduction-to-apps) · [https://www.letbuyy.com/in/resources/operations/order-fulfillment-guide](https://www.letbuyy.com/in/resources/operations/order-fulfillment-guide) · [https://www.letbuyy.com/in/resources/growth/email-marketing-ecommerce](https://www.letbuyy.com/in/resources/growth/email-marketing-ecommerce)

**Why it matters:** Creates inconsistent identities between visible final page URL, article entity and hierarchy; omits helpful genuine author/image connections. Relative JSON-LD URLs alone are not a syntax failure; author/image fields are recommendations, not universal Article requirements.

**Fix:** Use absolute final locale URL for article @id/url/mainEntityOfPage and breadcrumb items. Reuse Organization @id for publisher. Link genuine bylines to final author profiles; use Organization for the team. Add an accurate representative visible article image with an absolute URL if useful. Do not invent reviewers or credentials.

**Owner / estimated effort:** Frontend engineer + editor · 0.5–1 engineer day plus identity/content verification

**Dependencies:** TECH-01 final URLs; verified author facts; approved representative artwork.

**Validation:** Parse every block; assert identity and breadcrumbs match final canonical hierarchy. Dereference selected author/image URLs, check visible truth, and run Schema Markup Validator plus Google Rich Results Test on samples. Do not treat tool eligibility as guaranteed display.

**Success indicator:** All approved article entities match final locale canonical; team/individual authors represented truthfully.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json)

**Primary references:** [source 1](https://developers.google.com/search/docs/appearance/structured-data/article), [source 2](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)


### TECH-09 — Unknown tags return indexable empty 200 archives

**Medium · Confirmed · confidence: High · 1 inspected pages · One live negative probe; likely template-wide by source**

**Evidence:** The deliberate unknown-tag probe returns200, index/follow, the arbitrary slug in title/H1, and0articles / No articles found for this tag. Canonical also points to an unlocalized arbitrary tag. Exactly one invalid tag was tested; unbounded acceptance is also visible in source, not inferred as thousands of indexed URLs.

**Representative URLs:** [https://www.letbuyy.com/in/resources/tag/seo-audit-nonexistent-20261029](https://www.letbuyy.com/in/resources/tag/seo-audit-nonexistent-20261029)

**Why it matters:** Allows empty URL variants to look like valid indexable archive pages. Google soft404 classification and actual index bloat are unverified.

**Fix:** Check the existing tag registry before metadata/rendering and return notFound() for unknown tags. Preserve intentional known tags and their links. Do not solve an absent-content page solely with a homepage canonical.

**Owner / estimated effort:** Frontend engineer · 0.25–0.5 engineer day including negative cases

**Dependencies:** Existing tag registry; TECH-01 archive canonical policy.

**Validation:** Known tags still return 200 with correct content; unknown tags in each served locale return 404 with noindex and useful navigation. Do not generate or crawl a large invalid-slug corpus.

**Success indicator:** 0 indexable200 responses in bounded invalid-tag tests.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json)

**Primary references:** [source 1](https://developers.google.com/search/docs/crawling-indexing/http-network-errors)


### AUD-05 — Audit the homepage’s broad early image priority

**Medium · Opportunity · confidence: High for loading counts; medium for proposed benefit · 1 inspected pages · Template-wide**

**Evidence:** Raw homepage has 16 image preloads and 22 eager images, including lower-page capabilities/surfaces. Browser samples, 16 image-resource checks and unthrottled diagnostic paint observations were captured. PSI mobile/desktop hit quota limits; Unlighthouse timed out after 240s without route scores. No field CWV or proven performance regression exists.

**Representative URLs:** [https://www.letbuyy.com/in](https://www.letbuyy.com/in)

**Why it matters:** Unnecessary early images may compete for bandwidth/CPU on constrained devices, but bytes/priority counts alone do not demonstrate slow LCP.

**Fix:** Collect repeatable production-equivalent mobile/desktop Lighthouse/network waterfalls and field data where enough traffic exists. Reserve eager/preload for actual critical content; measure responsive variants and motion CPU cost before changing lower sections. Preserve the real LCP asset priority. Use reduced-motion behavior and image dimensions already present.

**Owner / estimated effort:** Frontend performance engineer · 0.5 day measurement + 0.5–2 days targeted work if a bottleneck reproduces

**Dependencies:** Working Lighthouse or equivalent controlled lab; field/RUM access when available; stable before/after build.

**Validation:** Compare equivalent throttling/device/network builds; repeat anomalous runs. Separate LCP/CLS diagnostic samples, Lighthouse lab/TBT and field INP. Verify image/animation visual parity and no new layout shift.

**Success indicator:** Measured reduction in critical request contention/bytes with no visual or actual LCP/CLS regression; no promised score gain.

**Evidence files:** [evidence/browser-performance.json](evidence/browser-performance.json), [evidence/pagespeed.json](evidence/pagespeed.json), [evidence/unlighthouse-mobile.json](evidence/unlighthouse-mobile.json), [evidence/resource-probes.json](evidence/resource-probes.json), [evidence/crawl.json](evidence/crawl.json)


### AUD-06 — Curate tag landing pages before expanding the indexable archive set

**Medium · Opportunity · confidence: Medium · 267 inspected pages · Known tag template across three languages; opportunity, not a defect count**

**Evidence:** 267 known tag pages (89 per language) serve 35 articles per language. Many archives consist mostly of labels/cards. Their existence and length alone do not prove low quality, index bloat, doorway behavior or a penalty. Actual Google index/query data is unavailable.

**Representative URLs:** [https://www.letbuyy.com/in/resources/tag/upi](https://www.letbuyy.com/in/resources/tag/upi) · [https://www.letbuyy.com/in/resources/tag/gst](https://www.letbuyy.com/in/resources/tag/gst) · [https://www.letbuyy.com/in/resources/tag/cod](https://www.letbuyy.com/in/resources/tag/cod) · [https://www.letbuyy.com/in/resources/tag/inventory](https://www.letbuyy.com/in/resources/tag/inventory)

**Why it matters:** Overlapping navigation archives may have little distinct search purpose; helpful hubs may also be valuable. A deliberate policy avoids both indiscriminate expansion and harmful pruning.

**Fix:** Keep and strengthen useful topic hubs; consolidate redundant tags or exclude navigation-only archives when justified by content/intent/discovery evidence. Keep all approved guides internally linked. Do not noindex simply for word count or remove all tags en masse.

**Owner / estimated effort:** SEO/editorial owner + frontend engineer · 1–2 days editorial mapping plus implementation once policy is chosen

**Dependencies:** TECH-01 archive URLs; actual first-party query/index data when available; content/topic map.

**Validation:** Document each kept/consolidated/excluded class and its user purpose; verify article reachability and inspect relevant search behavior after recrawl. No new orphan articles or broken saved tag links.

**Success indicator:** Approved archive policy consistently applied, with zero orphaned approved articles.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json), [cluster-plan.json](cluster-plan.json), [evidence/technical-analysis.json](evidence/technical-analysis.json)


### CONTENT-04 — Feature-action guides leave general availability unclear

**Medium · Needs verification · confidence: High for wording; actual general availability unverified · 2 inspected pages · Two English task guides; availability review applies to related guides**

**Evidence:** Live guides present app installation and an always-on AI copilot as actionable current experiences. Pricing labels Scale/Commerce OS coming soon; legal text distinguishes closed publishing surfaces. Installing curated apps can coexist with closed public publishing, so this is an availability ambiguity, not proof the product is absent. Actual entitlement and provider readiness were not exercised.

**Representative URLs:** [https://www.letbuyy.com/in/resources/platform/introduction-to-apps](https://www.letbuyy.com/in/resources/platform/introduction-to-apps) · [https://www.letbuyy.com/in/resources/ai-commerce/commerce-copilot-guide](https://www.letbuyy.com/in/resources/ai-commerce/commerce-copilot-guide)

**Why it matters:** Visitors may follow a task guide to an action they cannot access or purchase, weakening task completion and offer clarity.

**Fix:** Reconcile each documented action with the product/plan/realm/provider availability authority. Add clear available-now, restricted-access, setup-required or planned labels and prerequisites. Separate concepts from procedures. Correct promises without activating frozen runtimes or inventing release dates.

**Owner / estimated effort:** Product documentation owner + product/billing owner · 0.5-2 days for reviewed status matrix and priority guides, assuming availability facts exist

**Dependencies:** Approved feature/entitlement facts; current pricing/legal wording

**Validation:** Trace each guide step to an actual authorized product path and eligible plan; verify accessible alternatives for ineligible users; compare guides, FAQ, prices and legal status. No real transaction required.

**Success indicator:** Every actionable priority guide states accurate access prerequisites and current availability.

**Evidence files:** [evidence/pages/da34607248e5ee0f.html](evidence/pages/da34607248e5ee0f.html), [evidence/pages/a524ca561a953ae8.html](evidence/pages/a524ca561a953ae8.html), [evidence/crawl.json](evidence/crawl.json)


### CONTENT-05 — Article bodies omit contextual links to prerequisite and next-step guides

**Medium · Opportunity · confidence: High for body-link absence; benefit is a hypothesis · 35 inspected pages · Shared article-body pattern across35 English pages**

**Evidence:** All 35 English article-body containers have zero contextual internal anchors in the shared live HTML. Heading self-links exist; breadcrumbs, tags and related cards provide article discovery outside the body. This is not evidence of orphan pages or a required link-count violation.

**Representative URLs:** [https://www.letbuyy.com/in/resources/platform/how-themes-work](https://www.letbuyy.com/in/resources/platform/how-themes-work) · [https://www.letbuyy.com/in/resources/platform/introduction-to-apps](https://www.letbuyy.com/in/resources/platform/introduction-to-apps) · [https://www.letbuyy.com/in/resources/operations/order-fulfillment-guide](https://www.letbuyy.com/in/resources/operations/order-fulfillment-guide) · [https://www.letbuyy.com/in/resources/growth/email-marketing-ecommerce](https://www.letbuyy.com/in/resources/growth/email-marketing-ecommerce)

**Why it matters:** Readers must leave the task context to find prerequisite detail; source references and next-step guidance are less direct.

**Fix:** Add relevant contextual links at actual decision points using the existing localized link/content contract. Prioritize launch→GST/payments/shipping, UPI/COD→setup/refunds, and supported procedure→troubleshooting. Use the proposed44-link matrix as editorial guidance, not a mechanical quota.

**Owner / estimated effort:** Content editor + web engineer · 1-3 days for initial launch/payment clusters, assuming safe link rendering

**Dependencies:** Corrected target content; canonical/locale URL policy; safe content contract

**Validation:** Verify links in initial HTML, correct locale/final200 destination, meaningful anchor and reader relevance. Preserve related cards and discovery; check no article becomes orphaned.

**Success indicator:** Every priority task guide links directly to the prerequisites and next steps necessary for its task; zero broken proposed links after implementation.

**Evidence files:** [evidence/pages/625c7e4f1132c147.html](evidence/pages/625c7e4f1132c147.html), [evidence/pages/da34607248e5ee0f.html](evidence/pages/da34607248e5ee0f.html), [evidence/pages/10eff7edf6816a14.html](evidence/pages/10eff7edf6816a14.html), [evidence/pages/240e5124fc4dfa6a.html](evidence/pages/240e5124fc4dfa6a.html), [evidence/pages/b7182a42ce7e1a51.html](evidence/pages/b7182a42ce7e1a51.html), [evidence/pages/30be81c250683ada.html](evidence/pages/30be81c250683ada.html), [evidence/pages/638b30fbe426959e.html](evidence/pages/638b30fbe426959e.html), [evidence/pages/914dabbc2ca5b649.html](evidence/pages/914dabbc2ca5b649.html), [evidence/pages/0c3c0e21e6ea7625.html](evidence/pages/0c3c0e21e6ea7625.html), [evidence/pages/6d149bd3b79fd270.html](evidence/pages/6d149bd3b79fd270.html), [evidence/pages/3128241d1c002f2c.html](evidence/pages/3128241d1c002f2c.html), [evidence/pages/5978e72464fe6e7d.html](evidence/pages/5978e72464fe6e7d.html), [evidence/pages/3bd74482f63458aa.html](evidence/pages/3bd74482f63458aa.html), [evidence/pages/86ee7a67bfd0cfbb.html](evidence/pages/86ee7a67bfd0cfbb.html), [evidence/pages/039da40a874dfba0.html](evidence/pages/039da40a874dfba0.html), [evidence/pages/5c1bb96eb593039b.html](evidence/pages/5c1bb96eb593039b.html), [evidence/pages/76cae80576586e53.html](evidence/pages/76cae80576586e53.html), [evidence/pages/2d4bced4f76195ea.html](evidence/pages/2d4bced4f76195ea.html), [evidence/pages/5cffd01670f9f882.html](evidence/pages/5cffd01670f9f882.html), [evidence/pages/4f2ea1ca5df3d84d.html](evidence/pages/4f2ea1ca5df3d84d.html), [evidence/pages/9b220f18c83f69e3.html](evidence/pages/9b220f18c83f69e3.html), [evidence/pages/72e802892955c3c6.html](evidence/pages/72e802892955c3c6.html), [evidence/pages/65f53d61d5c9f58c.html](evidence/pages/65f53d61d5c9f58c.html), [evidence/pages/12752e90285e017a.html](evidence/pages/12752e90285e017a.html), [evidence/pages/e11fb77cd637faa5.html](evidence/pages/e11fb77cd637faa5.html), [evidence/pages/2cfbc716223ed339.html](evidence/pages/2cfbc716223ed339.html), [evidence/pages/cbbd93ec064d5eb2.html](evidence/pages/cbbd93ec064d5eb2.html), [evidence/pages/abe4302a08cd9659.html](evidence/pages/abe4302a08cd9659.html), [evidence/pages/a524ca561a953ae8.html](evidence/pages/a524ca561a953ae8.html), [evidence/pages/511e5afa09688682.html](evidence/pages/511e5afa09688682.html), [evidence/pages/f7bfec8ba6cc4abe.html](evidence/pages/f7bfec8ba6cc4abe.html), [evidence/pages/1ea25c06c96e8c74.html](evidence/pages/1ea25c06c96e8c74.html), [evidence/pages/77d2b83cc7da1d7c.html](evidence/pages/77d2b83cc7da1d7c.html), [evidence/pages/bd52cabad7646686.html](evidence/pages/bd52cabad7646686.html), [evidence/pages/70412326e2249118.html](evidence/pages/70412326e2249118.html), [evidence/crawl.json](evidence/crawl.json)


### EXT-01 — Pair Commerce OS positioning with explicit store-builder language near the primary promise

**Medium · Opportunity · confidence: Medium · 1 inspected pages · Homepage opportunity; counted English page only, translations require localized editorial review**

**Evidence:** Fresh crawl homepage H1 is More than a store. Your Commerce OS.; plain online store wording appears deeper in the journey. Actual English query samples returned software/category pages; five primary competitor samples show product category, workflow, or price/fee distinctions. evidence/crawl.json; evidence/external/*-parsed.json; evidence/external/search-and-source-log.json

**Representative URLs:** [https://www.letbuyy.com/in](https://www.letbuyy.com/in)

**Why it matters:** An unfamiliar seller needs to recognize the product category and the next step. This is a clarity hypothesis; no measured ranking or conversion loss is established.

**Fix:** Keep the Commerce OS identity and add a concise plain-language explanation near the main promise, connecting verified supported India commerce needs and truthful trial terms to pricing/setup/demo. Avoid launching duplicate keyword landing pages.

**Owner / estimated effort:** Product marketing with SEO and frontend owner · 0.5–1 working day for copy, localized review and metadata/browser verification; assumes offer decisions are settled, excludes deployment and experimentation observation.

**Dependencies:** Approved commercial and feature-availability facts; Existing metadata/canonical consistency repairs; Available conversion baseline before claiming uplift

**Validation:** Inspect initial and rendered HTML at desktop/mobile widths in each supported language; confirm clear category/action and no conflicting promise; compare qualified signup/demo starts and relevant non-brand CTR when sufficiently observed.

**Success indicator:** Approved category/offer description is visible near the primary action and consistent across locales. Any CTR or conversion change remains a measured outcome, not a promised percentage.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json)


### TECH-05 — Sitemap lastmod is a fixed June date despite later release content

**Low · Confirmed · confidence: High · 99 inspected pages · Template-wide**

**Evidence:** All 99 sitemap lastmod values equal 2026-06-04T00:00:00.000Z. Changelog/releases visibly include 22 July 2026 updates. Source hardcodes one June 4 Date for every route, so this is stronger evidence than identical dates alone.

**Representative URLs:** [https://www.letbuyy.com/in](https://www.letbuyy.com/in) · [https://www.letbuyy.com/in-ta](https://www.letbuyy.com/in-ta) · [https://www.letbuyy.com/in-hi](https://www.letbuyy.com/in-hi) · [https://www.letbuyy.com/in/pricing](https://www.letbuyy.com/in/pricing)

**Why it matters:** Misrepresents significant updates on at least the release/changelog pages; does not prove all 99 pages changed after June 4 or that Google penalized the site.

**Fix:** Use real significant content modification dates owned by each content source; omit lastmod where no trustworthy value exists. Do not replace the fixed date with build time. priority/changefreq are ignored by Google and need not become a separate fix.

**Owner / estimated effort:** Frontend engineer + editorial owner · 0.25–0.5 engineer day

**Dependencies:** Trustworthy content modification fields and TECH-04 sitemap generation.

**Validation:** Inspect all lastmod values against corresponding significant-content history. A no-content-change rebuild must not advance them; a real release/article edit should advance the correct entry only.

**Success indicator:** No known stale or fabricated lastmod values; unaffected URLs retain their true dates.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json)

**Primary references:** [source 1](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)


### TECH-08 — Social previews lack consistent page images and final URLs

**Low · Confirmed · confidence: High · 489 inspected pages · Template-wide**

**Evidence:** Within inspected locale pages, 486 lack og:image, 483 lack og:url, 69 lack og:type; 6 explicit og:url values differ from canonical. Homepage lacks image/url/type; English pricing points og:url to/pricing although canonical is /in/pricing. Local source has some image work not yet reflected in live HTML.

**Representative URLs:** [https://www.letbuyy.com/in](https://www.letbuyy.com/in) · [https://www.letbuyy.com/in-hi](https://www.letbuyy.com/in-hi) · [https://www.letbuyy.com/in-hi/contact](https://www.letbuyy.com/in-hi/contact) · [https://www.letbuyy.com/in-hi/create](https://www.letbuyy.com/in-hi/create)

**Why it matters:** Can produce incomplete or inconsistent shared-link previews; do not describe missing Open Graph fields as a demonstrated Google ranking loss.

**Fix:** Complete existing metadata inheritance: final localized URL, appropriate website/article type and accessible preview image with dimensions/alt. Preserve completed local image work. Prefer a supported raster preview rather than relying on the pricing page's narrow SVG logo. Make live output the acceptance target after authorized release.

**Owner / estimated effort:** Frontend engineer + designer · 0.5 engineer day plus image QA

**Dependencies:** TECH-01 final URL policy; existing brand/social assets.

**Validation:** Inspect raw source for all representative templates/locales and preview with actual social consumers. Check final200 image URLs, preview crop and matching og:url/canonical. Recheck deployed output independently of localhost.

**Success indicator:** Intended preview image, URL and type are consistent across approved shareable pages.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json)

**Primary references:** [source 1](https://ogp.me/)


### TECH-10 — RSS links and feed identity omit the served locale

**Low · Confirmed · confidence: High · 2 inspected resources · Two feed samples;35 item links per sample**

**Evidence:** Captured RSS samples contain35 item links each, all pointing to locale-free /resources/... URLs. English and sampled Tamil feed bodies identify language as en-in and publish the same English item titles; self URL omits the route locale. The feed is present and parseable; this is a consistency issue, not a missing feed.

**Representative URLs:** [https://www.letbuyy.com/in/resources/rss.xml](https://www.letbuyy.com/in/resources/rss.xml) · [https://www.letbuyy.com/in-ta/resources/rss.xml](https://www.letbuyy.com/in-ta/resources/rss.xml)

**Why it matters:** Feed readers and crawlers follow redirecting identities; a translated route suggests language-specific output but delivers English. Does not establish lost subscriptions or indexing.

**Fix:** Either provide one explicitly English feed and link all locales to that final identity, or localize feed entries/language/self URL using the existing locale/content authority. Emit final canonical article links and permalink GUIDs; changing old GUIDs may duplicate reader entries, so choose the feed migration intentionally.

**Owner / estimated effort:** Frontend engineer + editorial owner · 0.5 engineer day including feed-reader compatibility review

**Dependencies:** TECH-01 final URLs; explicit feed-language policy; article translation availability.

**Validation:** Parse feed XML; every item link resolves final200 canonical; channel language, title and atom:self agree with intended feed scope. Compare EN/TA samples and check reader deduplication behavior before changing established GUIDs.

**Success indicator:** No redirecting article item URLs; feed route/identity/content language follow documented policy.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json)

**Primary references:** [source 1](https://www.rssboard.org/rss-specification)


### TECH-11 — Software app rich-result eligibility is not established

**Informational · Confirmed · confidence: High · 489 inspected pages · Template-wide**

**Evidence:** The global SoftwareApplication graph on all 489 inspected locale pages lacks a rating/review. Google's checked SoftwareApplication feature documentation requires a genuine rating or review along with name/offer. Existing graph JSON parses.

**Representative URLs:** [https://www.letbuyy.com/in](https://www.letbuyy.com/in) · [https://www.letbuyy.com/in-ta](https://www.letbuyy.com/in-ta) · [https://www.letbuyy.com/in-hi](https://www.letbuyy.com/in-hi) · [https://www.letbuyy.com/in/pricing](https://www.letbuyy.com/in/pricing)

**Why it matters:** Cannot claim this markup is eligible for Google software-app rich results. Absence of public reviews may be correct and should not be hidden by fabricated data.

**Fix:** Keep truthful semantic markup if useful; correct the contradictory offer separately. Only include a rating/review when genuine, visible and compliant. Otherwise accept lack of this optional search feature and validate the types actually supported by the page.

**Owner / estimated effort:** SEO lead + frontend engineer · 0.25 engineer day for validation; genuine review collection is not estimated

**Dependencies:** Approved offer facts; legitimate visible review data only if available.

**Validation:** Run Google Rich Results Test on a representative page and record exact type/errors. Validate Schema.org semantics separately. No synthetic rating, review, reviewer or count may appear.

**Success indicator:** Eligibility claims match real validation;0 fabricated rating/review fields.

**Evidence files:** [evidence/crawl.json](evidence/crawl.json)

**Primary references:** [source 1](https://developers.google.com/search/docs/appearance/structured-data/software-app)

## Internal linking, information architecture and multilingual implementation

All 35 article records per language are linked through categories, related-guide/footer/navigation structures. No clean inspected content page lacked an inbound raw link in the sampled graph. Per-locale BFS and all discovered links are saved in evidence/link-graph-summary.json and URL-INVENTORY.csv. Raw anchor graph does not model a language-switcher button/router action; each language homepage is its own traversal root. This is not proof that all possible source/CMS URLs are reachable. All 105 article body containers lack contextual internal links and external reference anchors; existing related content is outside the bodies. Improve task context, not raw link count.

The three language paths are explicit equivalents. Root sitemap alternates are structurally reciprocal, but some target pages nominate incorrect canonicals (TECH-01/02/03). Both XML and HTML hreflang are permitted; duplicating methods is not automatically a defect. Canonical/alternate accuracy and actual translation availability are the priority. English/Tamil/Hindi HTML, metadata and shared claims were compared structurally; full native-language editorial accuracy and actual language-specific search performance are not certified.

Articles number 35 per language and tags 89 per language. This is a templated archive system, not an observed city doorway network. No faceted/query/calendar loops were expanded and no endless infinite-scroll discovery blocker was found in the saved raw graph. Search query variants, arbitrary tags and other subdomain estates are not exhaustively tested. Unknown tags have one explicit negative probe.

## Performance, mobile, accessibility and task journeys

See findings/performance-and-visual.md for separate browser diagnostics, screenshot observations and tool errors. Home/pricing/article/contact/support mobile samples showed no horizontal overflow at 375 px; that does not certify every viewport. Menu open/Escape-close worked in a real browser sample; the initial contact-step fields were labelled. Safe signup-destination fetch returned 200. Contact/demo are multi-step client controls; no messages, accounts, payments, empty-form submission or personal data were sent. Form validation/recovery, Turnstile delivery, provider signup and downstream conversions remain untested.

The installed agent-UX 100/100 is only its local homepage heuristic. Lighthouse Agentic Browsing X/N is unavailable. Optional Markdown/llms/ai-catalog/WebMCP discovery absence is not an SEO failure. User-agent probes are unverified requests and cannot establish real bot identity, WAF allowlisting, actual crawling or citation visibility.

## Competitors, authority and strategy

See COMPETITOR-AND-AI-VISIBILITY.md for five freshly fetched primary competitor pages, search-query/location caveats, one verified backlink and source-backed crawler distinctions. No external authority score is assigned. The Common Crawl helper returned no matching domain record in its bounded fetch; its implementation can stop after byte/time bounds, so this is not proof of absence from the full dataset or of zero authority/backlinks. Historical competitor rank/traffic and complete link data are unavailable.

CONTENT-AND-CLUSTER-PLAN.md gives four detailed existing-page upgrade briefs, seven category groups and a provisional 36-phrase map. cluster-plan.json links 17 existing priority pages; internal-link-matrix.csv proposes 44 contextual links. No controlled top-10 overlap/volume data exists, so the clusters are intent hypotheses, not measured keyword clusters or cannibalization findings. Improve existing pages before new comparison or location-page networks.

## Historical change and baseline

There was no configured earlier drift database. A real earlier same-day production capture supports a narrow 163-URL comparison; no material compared metadata changes were found. This does not establish long-term stability or rank causation. A new homepage baseline and portable 489-page observed-current baseline were created, explicitly retaining known defects. No recurring monitoring was scheduled. See findings/drift.md and evidence/current-seo-baseline.json.

## Scope exclusions and missing data

Local/maps/GBP and consumer product feeds/UCP are not applicable to the observed software marketing origin. Illustrative product cards and a mailing/contact address do not establish a live merchant catalog or eligible in-person business. No need to fabricate local profiles, product ratings or marketplace adoption. Separately scope a real merchant storefront or eligible location before those specialized checks.

No authenticated GSC/GA4/CrUX/Bing/Matomo access, paid-provider backend, controlled geolocated SERP, keyword demand, full backlink history, real AI-answer citation series or field CWV was available. Schema syntax and required/recommended property checks ran locally, but interactive Schema Markup Validator/Google Rich Results Test was not executed; no rich-result display is guaranteed. Full native-language review, all asset byte/display pairings, full accessibility conformance, exact user recovery/provider flows, query variants and nonpublic pages remain unverified.

The isolated skill Python/Chromium setup succeeded without changing documented constraints or global Python. PSI mobile/desktop rate-limit errors and Unlighthouse 240-second timeout are saved as failures. No successful tool result is implied from a recipe, credential name or missing provider. TOOLKIT-COVERAGE.md covers every requested route and its next step.

At the next authorized audit after fixes/release, compare final locale identities, approved article coverage, truthful public offer/claim/schema states, initial plan HTML, negative-tag behavior and working discovery resources against this baseline. Then add actual index/query/field measurements when available. No specific ranking or revenue gain is promised.
