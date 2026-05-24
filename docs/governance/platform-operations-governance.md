# Platform Operations Governance

## Operator Surfaces

Platform operations are split between:

- `apps/platform-console`: super admin governance and platform control.
- `apps/platform-operations-portal`: employee support, moderation, and operational workflows.
- `apps/mobile/operator-app`: native operator scaffold.
- `apps/mobile/operator-team-app`: native employee scaffold.

## Production Requirements

Before any operator surface is production-ready it must enforce:

- Email allowlist.
- MFA/TOTP.
- RBAC with explicit permission scopes.
- Audit logging for reads and writes.
- Reason capture for sensitive actions.
- IP/VPN controls where production risk requires them.
- Sanitized errors and redacted logs.

## Operational Data Rules

- Operators may not bypass tenant context, RLS, service-layer authorization, or audit requirements.
- Bulk operations require dry-run, confirmation, idempotency, and rollback strategy.
- Customer, merchant, payment, and subscription data access must be least-privilege and logged.

