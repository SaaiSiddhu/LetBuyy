# Platform Memory

## Durable Identity

LetBuyy is a multi-tenant commerce operating system, not a collection of unrelated storefront demos. All future work must preserve the platform path toward Shopify-grade commerce, extensible themes, app marketplace, enterprise operations, and mobile builder parity.

## Non-Negotiable Invariants

- `sites` is the canonical tenant table.
- Do not create a `stores` table.
- Store is a URL/UI term.
- Service role keys stay server/worker only.
- Merchant tokens never go in `localStorage`.
- Payment totals are rebuilt server-side.
- Provider signatures are verified before payment side effects.
- Mutating commerce endpoints are tenant-scoped and idempotent where repeated side effects are possible.
- Theme rendering uses schema-approved renderers, not arbitrary tenant code.
- Generated docs are memory, not source authority.

## Current Source-Derived Facts

- Current scan: 1,407 first-party text/source/config/docs files.
- Package manifests: 15.
- Next route files: 254.
- Next API route handlers: 118.
- Hono route modules: 30.
- Supabase migrations: 58.
- Unique detected tables: 164.
- RLS enable statements: 171.
- Detected tests: 3, all Flutter default-style widget tests.

## Current Risk Register

- Historical committed `all.env` secret risk requires rotation discipline and never printing secret values.
- Critical security backlog includes webhook parity, auth rate limiting, CSRF, server-side price recalculation, and secret rotation.
- Typecheck/lint blockers have been observed in architecture validation logs.
- RLS and policy coverage requires manual review for operational tables flagged by static scan.
- Console/team/internal operations surfaces are scaffold-level.
- Payment, auth, storefront, app marketplace, and theme flows are under-tested.

## Architectural Direction

The platform should converge toward:

- Worker-owned business APIs.
- Thin Next app proxies.
- Shared contracts for TypeScript and Dart clients.
- Tenant-aware service methods.
- Outbox-backed side effects.
- Schema-driven theme engine.
- Operational console/team systems with MFA, allowlists, audit, and RBAC.
- Real CI/CD gates for typecheck, lint, tests, migrations, and security checks.

## Future Agent Rule

When a future task asks for implementation, start by proving which domain owns the change. If ownership is ambiguous, document the choice in this memory tree instead of creating a duplicate implementation path.
