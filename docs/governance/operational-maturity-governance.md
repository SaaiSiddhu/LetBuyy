# Operational Maturity Governance

Operational maturity is measured by real recovery capability, not by documents alone.

## Required Capabilities

- SEV lifecycle, escalation ownership, postmortems, and rollback authority.
- Health gates for deployments, queues, Workers, database, replay, observability, and migrations.
- Evidence windows for certification and stale evidence failure.
- Provider outage, rollback, failover, replay recovery, and queue redrive drills.
- Plan-vs-execute detection must fail closed when provider credentials or execution tools are missing.

## Evidence Rules

- Plan mode may validate contracts and missing prerequisites.
- Execute mode must use live credentials and persist fresh evidence.
- Repository validators are prerequisites only. They do not certify production health.
- Execute-mode operational evidence must be recorded through the operations control plane before production can be called live certified.
- Execute-mode survivability also requires explicit operator approval through `LETBUYY_SURVIVABILITY_EXECUTION_APPROVED=true`; credentials alone are not sufficient.
- Live evidence rows with `planned`, `requested`, `pending`, `pending-live-evidence`, or `measurement-required` status do not count as passed certification evidence.
