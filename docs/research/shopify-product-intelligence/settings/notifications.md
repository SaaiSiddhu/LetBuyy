# Settings Deep Dive - Notifications

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/notifications`
- Purpose: Sender email, customer/staff/fulfillment/webhook notification templates and delivery configuration.
- LetBuyy recommendation: Notifications should be event-template driven, localized, and tied to order/customer states.

## Fields And Controls

- Sender email warning
- Customer notifications
- Staff notifications
- Fulfillment request
- Webhooks

## Dependencies

- Domain/email authentication
- Order state machine
- Customer language
- Marketing consent

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Notifications should be event-template driven, localized, and tied to order/customer states.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
