# Settings Deep Dive - Plan

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/plan`
- Purpose: Trial, subscription plan, plan selection, cancellation, and linked subscriptions.
- LetBuyy recommendation: Show entitlement effects across checkout, orders, domains, analytics, and channels before plan selection.

## Fields And Controls

- Trial status
- Choose plan
- Cancel trial
- Subscriptions link
- Terms links

## Dependencies

- Billing profile
- Payment method
- Entitlements

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Show entitlement effects across checkout, orders, domains, analytics, and channels before plan selection.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
