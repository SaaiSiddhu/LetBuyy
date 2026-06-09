# Foundation Wave 3 Shared-Env Apply Runbook

Status: `SKIP-DEPLOY`. Codex must not execute this against staging or production.

## Preconditions

- Run `node scripts/foundation/production-safety-preflight.mjs` in the approved operator shell for the target shared environment.
- Confirm `RATE_LIMIT_BACKEND_READY=true`, `RUNTIME_TELEMETRY_READY=true`, and `MONEY_LEDGER_RECONCILIATION_ALERT_READY=true`.
- Confirm every required secret is provisioned in the provider secret store and no required value is a `SKIP_NEEDS_HUMAN_*` sentinel.

## Apply

- Human applies provider-owned PITR/Sentry/DNS changes only after provider credentials and approval are present.
- Human runs deployment and migration workflows from the governed CI environment only.

## Verify

- Rate-limit backend unavailable path returns `RATE_LIMIT_UNAVAILABLE`.
- Runtime request telemetry is visible and redacted.
- Money ledger reconciliation-break alert fires on a seeded non-production break and clears after reconciliation.
- DNS/custom-domain health checks pass for the approved target.

## Rollback

- Disable the cutover flag or revert the DNS/custom-hostname change.
- Revert the deployment through the governed rollback workflow.
- Keep ledger reconciliation reads fail-closed until zero-variance evidence is restored.
