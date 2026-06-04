# Settings Deep Dive - Sales Channels

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/sales_channels`
- Purpose: Installed sales channels and marketplace for channels.
- LetBuyy recommendation: Channels should be distinct from apps because they alter where products can sell.

## Fields And Controls

- Installed channel list
- Online Store row
- Point of Sale row
- More actions
- Sort
- App Store link

## Dependencies

- Apps
- Channel publish state
- POS app

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Channels should be distinct from apps because they alter where products can sell.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
