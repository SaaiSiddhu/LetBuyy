# Settings Deep Dive - Customer Events

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/customer_events`
- Purpose: Pixels and customer-event tracking via app pixels and custom pixels.
- LetBuyy recommendation: Pixel management belongs near privacy and analytics, with app pixels preferred over custom code.

## Fields And Controls

- App pixels tab
- Custom pixels tab
- Search/sort
- Explore pixel apps
- No app pixels empty state

## Dependencies

- Customer privacy
- Consent mode
- App permissions
- Analytics

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Pixel management belongs near privacy and analytics, with app pixels preferred over custom code.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
