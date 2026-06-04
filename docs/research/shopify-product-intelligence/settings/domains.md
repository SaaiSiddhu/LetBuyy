# Settings Deep Dive - Domains

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/domains`
- Purpose: Manage myshopify domain, custom domains, connection, transfer, purchase, primary domain, status, and DNS actions.
- LetBuyy recommendation: Domains need verification steps, takeover prevention, SSL status, and primary-domain promotion.

## Fields And Controls

- Connect existing domain
- Transfer domain
- Buy new domain
- Domain credit banner
- Change system domain
- Domain table
- Status badges
- Domain actions
- Connect domain modal

## Dependencies

- Plan
- DNS ownership
- SSL issuance
- Markets
- Online store

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Domains need verification steps, takeover prevention, SSL status, and primary-domain promotion.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
