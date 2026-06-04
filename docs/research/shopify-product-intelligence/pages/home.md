# Page Analysis - Home

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Page Summary

- Route: `/`
- Parent navigation: Home
- Purpose: Onboarding dashboard and next-best-action launchpad.
- Primary user: Store owner or operator
- Frequency: Daily during setup, weekly after launch
- Access status: Observed via redacted screenshot
- Primary CTA: Add product / choose theme / activate payments depending on task card
- Secondary actions: Setup domain, store name, shipping rates, plan selection
- LetBuyy equivalent: Merchant home should be a readiness cockpit, not a generic dashboard.

## Layout And Components

- onboarding cards: observed as part of the workflow surface.
- task grid: observed as part of the workflow surface.
- visual product illustrations: observed as part of the workflow surface.
- trial card: observed as part of the workflow surface.
- global search: observed as part of the workflow surface.

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

- Merchant home should be a readiness cockpit, not a generic dashboard.
- Use shared admin components rather than bespoke page styling.
- Provide loading, empty, disabled, success, error, and permission states.
- Connect the route to tenant-aware API contracts and audit where mutations occur.
- Avoid final persistent action during research-style QA unless explicit test data is prepared.
