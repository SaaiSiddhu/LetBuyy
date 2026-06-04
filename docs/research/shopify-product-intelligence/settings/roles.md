# Settings Deep Dive - Roles

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/roles`
- Purpose: Default and custom role management across organization, store, and POS scopes.
- LetBuyy recommendation: Roles require scope, default templates, non-editable system roles, and clear permission inheritance.

## Fields And Controls

- Role table
- Export
- Add role
- Role name
- Category
- System role flags

## Dependencies

- Permissions matrix
- POS roles
- Organization ownership

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Roles require scope, default templates, non-editable system roles, and clear permission inheritance.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
