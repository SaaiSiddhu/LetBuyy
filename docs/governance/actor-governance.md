# Actor Governance

## Actor Model

LetBuyy separates four primary actor classes:

| Actor | Primary surfaces | Forbidden access |
|---|---|---|
| Shoppers | `apps/customer_web` | Merchant sessions, operator tools, draft/private tenant data |
| Merchants | `apps/merchant_web`, `apps/identity-platform` | Other merchant tenants, platform operator controls |
| Partners | `apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace` | Merchant-owned records without install/acquisition authority |
| Platform operators | `apps/admin_web`, `apps/platform-operations-portal` | Direct data mutation without RBAC, audit, and reason capture |

## Isolation Rules

- Storefront customer auth is separate from merchant auth.
- Merchant records must resolve through `site_id` or an explicit ownership check.
- Operator actions require allowlist/RBAC/MFA direction, audit events, and production network controls before being treated as production-ready.
- Partner app and theme operations must be scoped to developer, install, purchase, release, or review contracts.
- Public pages may read published tenant state only; draft, deleted, internal, private, or billing state must not leak to shoppers.

## Review Questions

Every feature must answer:

- Which actor initiated the operation?
- Which tenant path authorizes the operation?
- Which runtime enforces the boundary?
- Which package owns the domain decision?
- Which audit, event, or webhook record proves the operation happened?
