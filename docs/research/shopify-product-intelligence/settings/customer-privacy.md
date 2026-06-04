# Settings Deep Dive - Customer Privacy

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Summary

- Route: `/settings/privacy`
- Purpose: Privacy policy, cookie banner, data sharing opt-out, network intelligence, marketing settings, and data storage location.
- LetBuyy recommendation: Privacy should be surfaced as active operational controls, not static policy text.

## Fields And Controls

- Privacy policy
- Cookie banner
- Data sharing opt-out
- Network intelligence
- Marketing settings links
- Data storage hosting location

## Dependencies

- Policies
- Customer events
- Marketing consent
- Legal region

## Business Logic Observations

- Visible current state before mutation.
- Links to related settings instead of duplicated controls.
- Disabled or gated controls where prerequisites are missing.
- Help copy emphasizes merchant/business consequence.
- Settings belong to store scope and should be permission-audited.

## Recommended LetBuyy Design

- Privacy should be surfaced as active operational controls, not static policy text.
- Create a stable settings URL and breadcrumb.
- Use shared form/card/table primitives.
- Add validation and save-bar behavior before backend mutation.
- Record audit events for sensitive changes.
