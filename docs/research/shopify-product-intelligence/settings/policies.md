# Settings Deep Dive - Policies

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/legal`
- Purpose: Return rules and written policies for refund, privacy, terms, shipping, contact, and legal notices.
- LetBuyy recommendation: Policies should distinguish generated, missing, required, published, and custom states.

## Fields And Controls

- Return rules
- Return and refund policy
- Privacy policy
- Terms of service
- Shipping policy
- Contact information
- Legal notice
- Online store menu help

## Dependencies

- Online store
- Customer privacy
- Returns
- Checkout legal links

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Policies should distinguish generated, missing, required, published, and custom states.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
