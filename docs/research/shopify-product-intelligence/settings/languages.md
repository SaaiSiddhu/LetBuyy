# Settings Deep Dive - Languages

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/languages`
- Purpose: Published languages, domains, default language, and translation app recommendations.
- LetBuyy recommendation: Language management should combine native status with translation app extension.

## Fields And Controls

- Add language
- Language table
- Status
- Domains
- Default badge
- Translate app card
- Install app

## Dependencies

- Markets
- Domains
- Theme content
- Checkout content
- Apps

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Language management should combine native status with translation app extension.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
