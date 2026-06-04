# Settings Deep Dive - Customer Accounts

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/customer_accounts`
- Purpose: Sign-in links, account configuration, authentication methods, returns, store credit, and customer-account URL.
- LetBuyy recommendation: Customer account should be a product surface, not just auth toggles.

## Fields And Controls

- Sign-in links toggle
- Customize apps/branding/features
- Manage sign-in methods
- Self-serve returns
- Store credit
- URL copy

## Dependencies

- Checkout sign-in requirement
- Returns rules
- Authentication providers
- Customer privacy

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Customer account should be a product surface, not just auth toggles.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
