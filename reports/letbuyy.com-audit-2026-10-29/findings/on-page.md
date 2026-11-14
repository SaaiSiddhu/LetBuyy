# On-Page SEO

Audit date: 29 October 2026, Asia/Kolkata. Status: qualitative; no numeric category score.

Measured: all titles/descriptions/headings plus desktop/mobile homepage and rendered pricing. All 163 English HTML pages have a meta description and canonical. Two title-duplication groups and one exact description-duplication group were observed; no broad duplicate-description epidemic was found. Duplicate cases are /in vs /in/create and resource index vs search. /in/pricing and /in/resources/search have no H1.

### SEO-05 — Pricing depends on client rendering and lacks a primary heading (Medium)

**Observed:** /in/pricing returned 200 with title Pricing, no H1, and no visible rupee-denominated plan prices in initial main HTML. Its later rendered DOM contained the paid plans and comparison table, but still no H1. Homepage pricing likewise populated after client loading. Initial browser snapshots briefly showed no plan cards. This does not prove Google fails to render the prices.

**Change:** Render public plan names, prices, trial conditions and availability in initial HTML using the existing pricing authority, with an honest fallback if unavailable. Use an H1 for the pricing page’s main heading and a specific title such as LetBuyy Pricing — Plans for Indian Online Stores. Preserve availability labels for future plans.

**Dependencies:** SEO-03 confirmed commercial facts; existing pricing data/cache contract.

**Validation:** Fetch with JavaScript disabled and confirm visible actual plan prices and conditions, then compare to hydrated values. Verify exactly one meaningful H1. Test loading/failure behavior without a false success state.

**Leading indicator:** Public pricing facts present in initial HTML and matching the hydrated page; missing-H1 count on commercial landing pages: target 0.

**Failure check:** Failure is raw markup containing only a loading placeholder or schema prices disagreeing with visible prices.

### SEO-08 — Homepage category and India intent can be clearer (Medium)

**Observed:** /in title is LetBuyy — India-first commerce operating system | LetBuyy; H1 is More than a store. Your Commerce OS. The description already says online store in India with UPI/COD/GST. A focused web-search sample for online store builder India UPI GST zero commission returned product/home/feature landing pages emphasizing store creation, local payments and price. This is an intent hypothesis, not a geolocated Google ranking study. At the measured 390×844 viewport the H1 began near y=432 and the Start Free CTA near y=577, after the illustration.

**Change:** Keep the Commerce OS positioning but add plain buyer vocabulary near the main heading: online store builder for Indian businesses, UPI/COD, and the approved subscription/trial terms. Consider title Online Store Builder in India, 0% Commission | LetBuyy. Reduce duplicated brand text. On mobile, test moving the main promise and action ahead of the large illustration without changing the established visual identity.

**Dependencies:** SEO-03 truthful pricing; actual Search Console query/CTR and conversion baseline before claiming a lift.

**Validation:** Confirm raw/rendered/mobile copy agreement, no overflow and accessible actions. Compare query-relevant CTR and engaged signup starts on adequate data, accounting for query mix.

**Leading indicator:** Qualified non-brand impressions/CTR and homepage-to-signup starts when measurable; no ranking target is promised.

**Failure check:** Failure is more clicks with fewer qualified signup starts, or a title promising capabilities not generally available.
