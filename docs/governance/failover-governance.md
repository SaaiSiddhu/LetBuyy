# Failover Governance

LetBuyy failover is active/passive for stateful data and active/active at the edge where provider support exists.

## Rules

- Region failover must be represented by `runtime_control_commands` and `failover_drill_runs`.
- Database failover requires PITR, replica health, replication lag, and connection-pool status checks.
- Queue failover requires consumer pause, DLQ inspection, and idempotency verification before redrive.
- Provider failover requires circuit breaker state, alternate provider readiness, and audit records.

## Required Drills

- Regional outage
- Queue outage
- Cache failure
- Telemetry outage
- Provider outage
- Database failover rehearsal

## Execution

- Failover evidence is recorded in `failover_drill_runs`.
- Regional overrides are recorded in `regional_routing_overrides`.
- Operator procedure lives in `docs/runbooks/regional-failover.md`.
