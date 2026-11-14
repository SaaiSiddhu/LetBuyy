# Schema / Structured Data

Audit date: 29 October 2026, Asia/Kolkata. Status: qualitative; no numeric category score.

Measured: JSON syntax/types and sampled semantic consistency, not Google rich-result eligibility. Every English page includes Organization/WebSite/SoftwareApplication in a global graph; all 35 articles also have Article and BreadcrumbList. Zero JSON parse errors. Software application rich-result requirements must be checked independently; do not manufacture ratings. FAQ rich results were retired in 2026 per the current Google update ledger, so adding FAQ schema is not a recommended Google rich-result quick win.

### SEO-03 — Free-plan and capability claims conflict across the site (High)

**Observed:** The global JSON-LD on all 163 English HTML pages contains SoftwareApplication.offers.price="0" and describes a free launch tier. Homepage/pricing CTAs also claim a free-forever plan, while rendered pricing displays Launch at ₹199/month founding price (₹299 regular), Growth at ₹699 (₹999 regular), and a 14-day trial. The app-marketplace guide describes browsing/installing reviewed apps, while /in/legal/terms says public publishing surfaces are not open. Homepage/FAQ mentions AI/B2B and 50+ AI capabilities, while the Commerce OS plan labels AI Copilot/B2B coming soon. These are observed inconsistencies; actual provider readiness and paid signup behavior were not tested.

**Change:** Reconcile the published offer and availability against the approved product/pricing source. Distinguish zero platform commission, free trial, any genuine free plan, paid subscription and third-party charges. Generate visible copy and offers from that same existing source. Remove or correct unsupported free-offer markup and qualify planned/provider-dependent capabilities. Correct promises rather than activating a dormant marketplace to satisfy copy.

**Dependencies:** Approved commercial and feature-availability facts. Preserve the project’s 0% storefront transaction-fee rule; the audit does not authorize new rates or marketplace activation (WIN-R4, NEVER-R3/R5).

**Validation:** Compare raw HTML, hydrated pricing, CTA copy, FAQ, legal text and JSON-LD for the same offer. Validate syntax and run Google Rich Results Test; valid JSON alone is not rich-result eligibility. Never invent reviews/ratings to obtain eligibility.

**Leading indicator:** Count of contradictory offer/feature statements across the sampled surfaces: target 0.

**Failure check:** Failure is price=0 without a corresponding genuine visible free offer, or a guide representing a closed/planned capability as generally available.

### SEO-09 — Article entities use relative URLs and omit useful image/author connections (Medium)

**Observed:** All 35 article pages include parseable Article and BreadcrumbList JSON-LD. In sampled articles, mainEntityOfPage.@id is /resources/... without the locale, publisher.logo.url is relative, and breadcrumb items use /resources and /resources/<category>. Article.image and author.url are absent in these samples despite visible illustrations and author pages. Team authors are represented as Person. JSON parsing found no syntax errors across the 163 English pages; no full schema validator or rich-results eligibility test was run.

**Change:** Use absolute final locale URLs for article IDs and breadcrumbs, absolute accessible image/logo URLs, and real linked author identities. Add a relevant visible representative article image where accurate. Model the editorial team as Organization. Keep the existing Organization/WebSite entities; avoid multiplying SEO components.

**Dependencies:** SEO-01 canonical URL policy; real author and image facts.

**Validation:** Parse all JSON-LD, validate sampled pages in Schema Markup Validator/Google Rich Results Test, and dereference the final entity/image URLs. Check that markup describes visible content.

**Leading indicator:** Article identity URLs matching the canonical: target 35/35; representative article image and genuine author connections present.

**Failure check:** Failure is structurally valid JSON with redirecting or incorrect entities, or fabricated author/rating data.
