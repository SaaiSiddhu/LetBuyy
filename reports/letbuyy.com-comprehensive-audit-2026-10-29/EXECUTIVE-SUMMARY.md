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

## First five actions

1. Confirm approved offer/availability facts; align copy and schema and correct material editorial/compliance claims across languages.
2. Reuse the existing locale metadata helper in the three bypassing resource templates; decide create/search and unknown-tag policies.
3. Server-render approved pricing through the existing gateway authority and add page-level H1/title without duplicating plan ownership.
4. Generate the approved article sitemap, truthful lastmod and final schema/feed identities; remove retired sitemap declarations.
5. Establish controlled lab and available first-party measurement; then test image priority, archive curation and category/CTA clarity.

## Measurement limits

Overall/category SEO scores are withheld: no transparent calibrated category scoring is justified here. The skill weights remain 22% technical, 23% content, 20% on-page, 10% schema, 10% performance, 10% AI, 5% images, but missing metrics are not zeros or passes. GSC/GA4/CrUX and paid-provider access were not configured; actual rankings, index coverage, traffic, conversion and AI citations are unmeasured. PSI was quota-limited, Unlighthouse timed out, and browser diagnostic paint observations are not field CWV. No geolocated top-10 dataset, keyword volumes or full backlinks inventory exists. Native-language quality and consequential user journeys remain unverified.

Start with [the full audit](FULL-SEO-AUDIT.md), [issue register](ISSUE-REGISTER.csv), [repair briefs](IMPLEMENTATION-BRIEFS.md), [prioritized plan](PRIORITIZED-ACTION-PLAN.md) and [all 35 route coverage](TOOLKIT-COVERAGE.md). This audit changed no website/application source, production settings, DNS, analytics, GBP, submissions or schedules.
