# Platform Operations Governance

## Operator Surfaces

Platform operations are split between:

- `apps/platform-console`: super admin governance and platform control.
- `apps/platform-operations-portal`: employee support, moderation, and operational workflows.
- `apps/mobile/operator-app`: native operator companion scaffold.

`apps/platform-console` and `apps/platform-operations-portal` must not collapse into one ambiguous internal app. The console owns platform-level governance and privileged administration; the operations portal owns employee workflows with narrower permissions and stronger action audit.

The retired `apps/mobile/operator-team-app` scaffold must not be recreated. Native operator work belongs in `apps/mobile/operator-app`; employee team workflows belong in the web operations portal unless a new runtime is approved through topology governance.

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
