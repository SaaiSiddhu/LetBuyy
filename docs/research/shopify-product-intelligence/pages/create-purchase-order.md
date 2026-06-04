# Page Analysis - Create Purchase Order

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Page Summary

- Route: `/products/purchase_orders/new`
- Parent navigation: Products > Purchase orders > Create
- Purpose: Create a draft procurement document with supplier, destination, shipment, products, and cost summary.
- Primary user: Inventory and procurement operator
- Frequency: Medium
- Access status: Observed via screenshot and modal
- Primary CTA: Save as draft, not executed
- Secondary actions: Discard, browse products, create supplier, manage taxes
- LetBuyy equivalent: Separate receiving/procurement from selling inventory; compute costs live.

## Layout And Components

- save bar: observed as part of the workflow surface.
- supplier picker: observed as part of the workflow surface.
- destination picker: observed as part of the workflow surface.
- shipment fields: observed as part of the workflow surface.
- product search: observed as part of the workflow surface.
- cost summary: observed as part of the workflow surface.
- additional details: observed as part of the workflow surface.
- supplier modal: observed as part of the workflow surface.

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

- Separate receiving/procurement from selling inventory; compute costs live.
- Use shared admin components rather than bespoke page styling.
- Provide loading, empty, disabled, success, error, and permission states.
- Connect the route to tenant-aware API contracts and audit where mutations occur.
- Avoid final persistent action during research-style QA unless explicit test data is prepared.
