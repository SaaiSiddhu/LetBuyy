# Settings Deep Dive - Locations

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/locations`
- Purpose: Manage fulfillment/store locations and POS subscriptions.
- LetBuyy recommendation: Locations should power inventory, shipping, pickup, POS, and transfer logic everywhere.

## Fields And Controls

- Locations usage count
- Add location
- Tabs
- Search/filter
- Location table
- Status
- POS app installed
- Open app

## Dependencies

- Inventory
- Shipping profiles
- POS sales channel
- Transfer workflow

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Locations should power inventory, shipping, pickup, POS, and transfer logic everywhere.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
