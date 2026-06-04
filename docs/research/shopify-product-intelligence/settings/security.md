# Settings Deep Dive - Security

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/security`
- Purpose: User activity logs, collaborators, collaborator code, and account security operations.
- LetBuyy recommendation: Expose collaborator access as a governed security workflow with audit trail and code rotation.

## Fields And Controls

- User activity logs
- Collaborator review link
- Collaborator code
- Generate new code
- Copy code
- Delete code

## Dependencies

- Audit log service
- External collaborator workflow
- User permissions

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Expose collaborator access as a governed security workflow with audit trail and code rotation.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
