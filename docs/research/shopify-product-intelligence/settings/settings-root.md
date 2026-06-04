# Settings Deep Dive - Settings Root

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings`
- Purpose: Central configuration hub across store, billing, users, commerce, channels, apps, legal, and data.
- LetBuyy recommendation: LetBuyy settings should become a real architecture, not scattered account/store pages.

## Fields And Controls

- settings search
- store card
- category links
- close button

## Dependencies

- Authenticated merchant session
- store ownership

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- LetBuyy settings should become a real architecture, not scattered account/store pages.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
