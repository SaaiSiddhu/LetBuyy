# Settings Deep Dive - Taxes and Duties

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/taxes`
- Purpose: Regional sales tax, tax services, duties/import taxes, customs, and global tax settings.
- LetBuyy recommendation: Taxes should be a guided compliance cockpit with region state, product metadata dependencies, and global toggles.

## Fields And Controls

- Tax service status
- Region table
- Search/sort/pagination
- Setup duties
- Country of origin
- HS codes
- Include tax in prices
- Charge tax on shipping
- VAT on digital goods

## Dependencies

- Markets
- Products category/HS code
- Shipping profiles
- Business entity
- Provider tax service

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Taxes should be a guided compliance cockpit with region state, product metadata dependencies, and global toggles.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
