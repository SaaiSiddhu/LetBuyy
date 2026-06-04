# Settings Deep Dive - Shipping and Delivery

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/shipping`
- Purpose: Shipping profiles, delivery dates, packages, shipping labels, carrier accounts, local delivery, pickup, packing slips, and fulfillment services.
- LetBuyy recommendation: Shipping settings must connect profiles, locations, packages, carrier accounts, and local methods.

## Fields And Controls

- General profile
- Add custom profile
- Estimated delivery dates
- Packages
- Carrier accounts
- Local delivery
- Pickup in store
- Sender name
- Packing slip template
- Fulfillment service

## Dependencies

- Locations
- Products weight
- Markets
- Carrier providers
- Fulfillment apps

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Shipping settings must connect profiles, locations, packages, carrier accounts, and local methods.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
