# Settings Deep Dive - Payments

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/payments`
- Purpose: Payment providers, PayPal/digital wallet setup, capture method, manual payments, customizations, and gift card expiry.
- LetBuyy recommendation: Payment settings should isolate provider onboarding, capture policy, manual methods, and legal gift-card rules.

## Fields And Controls

- Provider setup
- Choose provider
- PayPal activation
- Add payment method
- Payment capture radios
- Manual payment menu
- Gift card expiration radios
- Apple Wallet customize

## Dependencies

- Plan activation
- Payment providers
- Order state machine
- Gift card legal rules

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Payment settings should isolate provider onboarding, capture policy, manual methods, and legal gift-card rules.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
