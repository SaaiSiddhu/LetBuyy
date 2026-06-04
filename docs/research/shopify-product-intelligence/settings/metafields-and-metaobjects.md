# Settings Deep Dive - Metafields and Metaobjects

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/custom_data`
- Purpose: Define custom data models for products, variants, customers, orders, markets, shops, and structured content.
- LetBuyy recommendation: Custom data should be schema-first, typed, and reusable across admin, storefront, and apps.

## Fields And Controls

- Metafield resources
- Definition counts
- Metaobjects empty state
- Add definition

## Dependencies

- Theme editor
- Content metaobjects
- Product/customer/order models
- API/public exposure

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Custom data should be schema-first, typed, and reusable across admin, storefront, and apps.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
