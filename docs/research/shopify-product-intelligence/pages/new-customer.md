# Page Analysis - New Customer

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Page Summary

- Route: `/customers/new`
- Parent navigation: Customers > Add customer
- Purpose: Create customer profile with contact, language, marketing consent, address, tax, notes, and tags.
- Primary user: Support operator
- Frequency: Medium
- Access status: Observed via screenshot
- Primary CTA: Save when valid, not executed
- Secondary actions: Add address, edit notes/tags
- LetBuyy equivalent: Consent and contact availability should drive disabled states and validation.

## Layout And Components

- profile card: observed as part of the workflow surface.
- language selector: observed as part of the workflow surface.
- email/phone fields: observed as part of the workflow surface.
- marketing consent: observed as part of the workflow surface.
- address card: observed as part of the workflow surface.
- tax details: observed as part of the workflow surface.
- right rail notes/tags: observed as part of the workflow surface.

## UX Intelligence

- Persistent dark top app frame with Shopify identity, global search, Sidekick, alerts, and account menu.
- Light operational canvas with a fixed left navigation rail and a single primary content column.
- Contextual subnavigation expands only when the merchant enters a domain such as products, orders, customers, marketing, markets, analytics, or settings.
- Cards use restrained radius, subtle borders, and low-contrast shadows to separate tasks without making the page feel decorative.
- Primary CTAs are placed in the page header, empty-state center, or first actionable task card depending on the merchant maturity state.
- Page-specific reading: this page presents the merchant job before implementation details.
- Empty or gated states still teach what the completed system will do.
- Actions are constrained to safe next steps until prerequisites are met.

## LetBuyy Recommendations

- Consent and contact availability should drive disabled states and validation.
- Use shared admin components rather than bespoke page styling.
- Provide loading, empty, disabled, success, error, and permission states.
- Connect the route to tenant-aware API contracts and audit where mutations occur.
- Avoid final persistent action during research-style QA unless explicit test data is prepared.
