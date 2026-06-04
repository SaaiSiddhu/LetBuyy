# Settings Deep Dive - Billing

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/billing`
- Purpose: Billing profile, upcoming bill, payment method, invoices, plan settings, and country-specific requirements.
- LetBuyy recommendation: Billing should combine current bill, payment methods, invoice history, and compliance warnings.

## Fields And Controls

- Billing profile
- Upcoming bill
- Add payment method
- Past bills tabs
- Search/filter invoices
- Jurisdiction warning

## Dependencies

- Legal address
- Payment method
- Plan
- Tax/GST/VAT rules

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Billing should combine current bill, payment methods, invoice history, and compliance warnings.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
