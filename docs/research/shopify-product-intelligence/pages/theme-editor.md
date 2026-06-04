# Page Analysis - Theme Editor

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Page Summary

- Route: `/themes/[theme_id]/editor`
- Parent navigation: Online Store > Themes > Edit theme
- Purpose: Customize storefront sections, blocks, settings, app embeds, responsive preview, and publishing state.
- Primary user: Storefront designer/merchant
- Frequency: Medium
- Access status: Observed authenticated, no save performed
- Primary CTA: Save when changes exist, not executed
- Secondary actions: Undo/redo, template selector, preview mode, app embeds, section actions
- LetBuyy equivalent: Builder must support section tree plus live preview, not a form-only settings page.

## Layout And Components

- section tree: observed as part of the workflow surface.
- live preview: observed as part of the workflow surface.
- template selector: observed as part of the workflow surface.
- left mode rail: observed as part of the workflow surface.
- drag handles: observed as part of the workflow surface.
- visibility toggles: observed as part of the workflow surface.
- inspector: observed as part of the workflow surface.
- responsive preview: observed as part of the workflow surface.
- save buttons: observed as part of the workflow surface.

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

- Builder must support section tree plus live preview, not a form-only settings page.
- Use shared admin components rather than bespoke page styling.
- Provide loading, empty, disabled, success, error, and permission states.
- Connect the route to tenant-aware API contracts and audit where mutations occur.
- Avoid final persistent action during research-style QA unless explicit test data is prepared.
