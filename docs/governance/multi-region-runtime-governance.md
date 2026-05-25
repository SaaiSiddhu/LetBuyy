# Multi-Region Runtime Governance

LetBuyy is India-primary with global edge execution and an APAC failover region.

## Regions

- Primary data region: `ap-south-1`
- Failover data region: `ap-southeast-1`
- Edge execution: `global-edge`

## Rules

- Tenant affinity must be explicit in runtime metadata before active multi-primary writes.
- Queue ownership is regional and must not redrive across regions without idempotency verification.
- Cache keys must include tenant partitioning and region metadata where consistency matters.
- Regional diagnostics are written to `regional_execution_diagnostics`.
- Region failover and restore commands must be submitted through `runtime_control_commands`.
