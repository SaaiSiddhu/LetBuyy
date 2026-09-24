# Platform Console

`apps/internal/console` is the canonical super-admin control plane for LetBuyy platform governance.

## Ownership

- Owns privileged platform administration, users, stores, subscriptions, employees, audit logs, analytics, MFA, and platform settings.
- Must enforce operator allowlists, MFA, RBAC, reason capture, and audit logging before production use.
- Must not absorb employee support workflows that belong in `apps/frozen/operations-portal`.

## Runtime Boundary

This app may call versioned service APIs and shared packages. It must not import sibling apps, legacy code, infrastructure modules, generated build output, or deprecated runtime aliases.
