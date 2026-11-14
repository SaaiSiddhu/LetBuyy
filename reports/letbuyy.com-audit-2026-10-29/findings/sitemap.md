# Sitemap evidence

99 XML URL entries; 33 English India entries; 35/35 discovered English articles absent. All 99 lastmod timestamps are 2026-06-04. Index coverage is unavailable.

### SEO-04 — XML sitemap omits the entire discovered article library (High)

**Observed:** /sitemap.xml contains 99 URLs, 33 per locale; all 35 discovered English article URLs are absent. Categories and internal links make them crawlable, so omission is not proof that they are unindexed. All 99 lastmod values are 2026-06-04 although sampled article/release content has later displayed dates. /in/create and /in/resources/search are listed despite canonicalizing to the homepage. Robots also declares three satellite sitemaps (themes/apps/developer) that failed DNS resolution in this audit.

**Change:** Generate sitemap entries from the existing published article registry and locale availability; include only canonical, indexable final URLs. Use real significant modification dates or omit untrustworthy lastmod values. Remove search/alias URLs as appropriate. Confirm ownership/DNS intent and remove stale satellite sitemap declarations; keep frozen services dormant.

**Dependencies:** SEO-01 and SEO-07 canonical/indexing decisions; trustworthy published/modified fields. Do not include all archive/filter URLs automatically.

**Validation:** Expected published English article set minus sitemap article set is empty; every sitemap URL returns 200, is indexable and agrees with its canonical. Validate locale alternates. Recheck all declared sitemap endpoints from another resolver, and inspect sitemap processing in Search Console when connected.

**Leading indicator:** Eligible English articles represented: target 35/35 for the current crawl; invalid/redirecting/noncanonical sitemap URLs: target 0.

**Failure check:** Failure is a new published article omitted again, a blanket build-time lastmod refresh, or continuing declarations of confirmed retired hosts.

## Missing English article URLs

- https://www.letbuyy.com/in/resources/platform/how-themes-work
- https://www.letbuyy.com/in/resources/platform/introduction-to-apps
- https://www.letbuyy.com/in/resources/operations/order-fulfillment-guide
- https://www.letbuyy.com/in/resources/growth/email-marketing-ecommerce
- https://www.letbuyy.com/in/resources/ecommerce/how-to-start-an-online-store-india
- https://www.letbuyy.com/in/resources/payments/upi-vs-cod-india
- https://www.letbuyy.com/in/resources/growth/first-100-orders-guide
- https://www.letbuyy.com/in/resources/operations/inventory-management-guide
- https://www.letbuyy.com/in/resources/ecommerce/product-page-optimization
- https://www.letbuyy.com/in/resources/ecommerce/store-seo-checklist
- https://www.letbuyy.com/in/resources/platform/building-first-letbuyy-store
- https://www.letbuyy.com/in/resources/growth/d2c-brand-launch-guide
- https://www.letbuyy.com/in/resources/growth/social-commerce-india
- https://www.letbuyy.com/in/resources/ecommerce/reducing-cart-abandonment
- https://www.letbuyy.com/in/resources/ecommerce/how-product-reviews-increase-conversion
- https://www.letbuyy.com/in/resources/payments/gst-for-ecommerce-india
- https://www.letbuyy.com/in/resources/payments/invoicing-india-merchants
- https://www.letbuyy.com/in/resources/payments/razorpay-integration-guide
- https://www.letbuyy.com/in/resources/payments/refunds-returns-policy-india
- https://www.letbuyy.com/in/resources/operations/shipping-india-guide
- https://www.letbuyy.com/in/resources/operations/multi-warehouse-inventory
- https://www.letbuyy.com/in/resources/operations/understanding-fulfillment
- https://www.letbuyy.com/in/resources/developers/letbuyy-api-getting-started
- https://www.letbuyy.com/in/resources/developers/webhooks-complete-guide
- https://www.letbuyy.com/in/resources/developers/building-first-letbuyy-app
- https://www.letbuyy.com/in/resources/developers/liquid-theming-guide
- https://www.letbuyy.com/in/resources/developers/custom-integrations-guide
- https://www.letbuyy.com/in/resources/platform/merchant-web-guide
- https://www.letbuyy.com/in/resources/ai-commerce/commerce-copilot-guide
- https://www.letbuyy.com/in/resources/platform/letbuyy-platform-overview
- https://www.letbuyy.com/in/resources/growth/retention-strategies-india
- https://www.letbuyy.com/in/resources/ai-commerce/ai-commerce-explained
- https://www.letbuyy.com/in/resources/ai-commerce/automating-operations-ai
- https://www.letbuyy.com/in/resources/ai-commerce/ai-product-recommendations
- https://www.letbuyy.com/in/resources/ai-commerce/workflow-automation-merchants