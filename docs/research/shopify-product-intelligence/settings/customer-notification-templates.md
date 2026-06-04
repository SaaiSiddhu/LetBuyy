# Settings Deep Dive - Customer Notification Templates

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/notifications/customer`
- Purpose: Customize customer email/SMS templates by lifecycle stage.
- LetBuyy recommendation: Use categories and toggles to keep notification complexity navigable.

## Fields And Controls

- Customize email templates
- Order processing
- Local pickup
- Local delivery
- Gift cards
- Store credit
- Order exceptions
- Payments
- POS
- Shipping updated
- Returns
- Accounts and outreach
- Marketing double opt-in

## Dependencies

- Order events
- Delivery methods
- Returns
- B2B accounts
- Marketing consent

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Use categories and toggles to keep notification complexity navigable.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
