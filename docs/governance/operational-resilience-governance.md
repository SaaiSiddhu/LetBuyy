# Operational Resilience Governance

Operational resilience is proven by measured recovery, not by planned runbooks.

## Rules

- Plan mode may validate topology, scripts, and evidence contracts only.
- Execute mode requires `LETBUYY_SURVIVABILITY_EXECUTION_APPROVED=true` plus provider credentials and operations API access.
- Failover, chaos, load, rollback, and regional recovery evidence must remain non-passing until measured live systems record passing status.
- Certification reports must count only fresh evidence with passing operational status.
- Queue, replay, deployment, database, security, observability, and regional recovery evidence expires after the configured certification window.

## Enforcement

- `config/runtime/survivability-execution.json` defines required stages and forbidden fake-evidence states.
- `scripts/validators/survivability-governance-validator.mjs` hard-fails missing contracts and unsafe live-drill evidence.
- `infrastructure/scripts/operations/run-survivability-suite.mjs` runs plan mode without mutation and fails closed in execute mode until all capabilities are present.
