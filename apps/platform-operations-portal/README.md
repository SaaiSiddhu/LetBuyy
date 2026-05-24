# Platform Operations Portal

`apps/platform-operations-portal` is the canonical employee operations runtime for LetBuyy.

## Ownership

- Owns support, moderation, store operations, user assistance, marketing operations, and invite workflows for platform employees.
- Must enforce least-privilege RBAC, MFA, audit logging, reason capture, and production access controls before live use.
- Must not absorb super-admin governance surfaces that belong in `apps/platform-console`.

## Runtime Boundary

This app may call versioned service APIs and shared packages. It must not import sibling apps, legacy code, infrastructure modules, generated build output, deprecated app aliases, or the retired `apps/mobile/operator-team-app` scaffold.
