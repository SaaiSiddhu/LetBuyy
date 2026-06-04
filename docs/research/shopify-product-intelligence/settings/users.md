# Settings Deep Dive - Users

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/organization-account`
- Purpose: Invite users, list staff, manage roles and two-step authentication.
- LetBuyy recommendation: LetBuyy needs role-aware staff list with MFA status and audit-ready owner visibility.

## Fields And Controls

- Users table
- Export
- Add users
- Status
- Role
- Two-step authentication
- Store owner

## Dependencies

- Role definitions
- Security policy
- Owner account

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- LetBuyy needs role-aware staff list with MFA status and audit-ready owner visibility.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
