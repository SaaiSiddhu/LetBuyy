# Shadow Traffic Governance

Shadow traffic validates runtime changes without production side effects.

## Allowed Uses

- Provider migration.
- Queue migration.
- Transactional outbox evolution.
- Infrastructure migration.

## Required Controls

- Mirrored traffic must be tagged as shadow traffic.
- Provider calls must be non-mutating unless an explicit sandbox endpoint is used.
- Queue and outbox writes must use shadow namespaces or metadata.
- Comparison must score response shape, latency, error rate, event counts, queue lag, and materialized-read drift.
- Evidence is stored in `shadow_traffic_comparison_runs`.
