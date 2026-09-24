# Platform Operations Portal

`apps/frozen/operations-portal` is the canonical employee operations runtime for LetBuyy.

## Ownership

- Owns support, moderation, store operations, user assistance, marketing operations, and invite workflows for platform employees.
- Must enforce least-privilege RBAC, MFA, audit logging, reason capture, and production access controls before live use.
- Must not absorb super-admin governance surfaces that belong in `apps/internal/console`.

## Runtime Boundary

This app may call versioned service APIs and shared packages. It must not import sibling apps, legacy code, infrastructure modules, generated build output, deprecated app aliases, or retired duplicate mobile-team source.
