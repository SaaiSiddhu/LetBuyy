# Settings Deep Dive - General

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/general`
- Purpose: Store identity, contact, defaults, order processing, order ID format, assets, and transfer controls.
- LetBuyy recommendation: Split General into store identity, operational defaults, order processing, and ownership controls with a single page overview.

## Fields And Controls

- Business details
- Store contact details
- Store defaults
- Order ID prefix and suffix
- Order processing radios
- Auto archive checkbox
- Store assets links

## Dependencies

- Markets for currency display
- Account settings for email/preferences
- Brand/metafield systems

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Split General into store identity, operational defaults, order processing, and ownership controls with a single page overview.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
