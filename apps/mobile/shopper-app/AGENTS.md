# Mobile Shopper App Governance

Purpose: Reserved mobile shopper runtime for customer browsing, cart, checkout, account, order, and notification experiences.

Runtime boundary: `apps/mobile/shopper-app`.

Status: Incubating. Do not place production source here until shopper mobile ownership, API contracts, auth model, and release pipeline are approved.

Rules:

- Shopper auth must remain separate from merchant and platform operator auth.
- Customer-owned data must be scoped by storefront tenant and customer identity.
- Payment flows must delegate final totals, provider creation, and verification to services.
