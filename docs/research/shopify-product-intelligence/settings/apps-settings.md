# Settings Deep Dive - Apps Settings

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/apps`
- Purpose: Installed apps, app discovery, and developer app entry.
- LetBuyy recommendation: Make app management permission- and billing-aware from day one.

## Fields And Controls

- Develop apps
- Explore apps
- Shopify App Store link
- Installed apps empty state

## Dependencies

- Partner permissions
- App billing
- OAuth installs
- App scopes

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Make app management permission- and billing-aware from day one.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
