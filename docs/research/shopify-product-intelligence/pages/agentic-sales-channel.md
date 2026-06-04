# Page Analysis - Agentic Sales Channel

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Page Summary

- Route: `/apps/agentic`
- Parent navigation: Sales channels > Agentic
- Purpose: AI or agentic sales channel surface inside admin.
- Primary user: Merchant experimenting with new sales channels
- Frequency: Low
- Access status: Route discovered through sidebar
- Primary CTA: Configure channel where available
- Secondary actions: Channel settings, app controls
- LetBuyy equivalent: Sales channels and apps should share embedding rules but differ in IA placement.

## Layout And Components

- embedded app frame: observed as part of the workflow surface.
- channel nav: observed as part of the workflow surface.
- gated setup: observed as part of the workflow surface.

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

- Sales channels and apps should share embedding rules but differ in IA placement.
- Use shared admin components rather than bespoke page styling.
- Provide loading, empty, disabled, success, error, and permission states.
- Connect the route to tenant-aware API contracts and audit where mutations occur.
- Avoid final persistent action during research-style QA unless explicit test data is prepared.
