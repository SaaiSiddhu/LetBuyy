# Settings Deep Dive - Checkout

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/checkout`
- Purpose: Checkout configuration, customer contact, customer information, marketing opt-in, subscriptions disclaimer, tipping, language, address collection, and rules.
- LetBuyy recommendation: Checkout needs staged sections with risk-aware copy and app-powered extension points.

## Fields And Controls

- Checkout configuration card
- Customize/Duplicate
- Phone or email radios
- Require sign-in
- Customer info controls
- Email/SMS marketing controls
- Subscription disclaimer radios
- Tipping checkbox
- Checkout language
- Address collection
- Add-to-cart limit
- Checkout rules apps

## Dependencies

- Customer accounts
- Notifications
- Subscriptions
- Markets
- Apps

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Checkout needs staged sections with risk-aware copy and app-powered extension points.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
