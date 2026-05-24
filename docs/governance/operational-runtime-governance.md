# Operational Runtime Governance

Status: Phase 3 operations platform foundation.

## Authority

- Runtime inspection, health contracts, control commands, execution diagnostics, dashboard metric contracts, and operational recovery contracts live in `packages/distributed-runtime/src/operations-runtime.ts`.
- API/service operations endpoints may expose approved views and commands but must enforce platform-operator authorization.
- UI dashboards are not required in Phase 3; contracts and persistence are required.

## Metrics

The execution dashboard foundation tracks:

- workflow state
- execution count
- replay count
- queue depth
- dead-letter count
- retry count
- tenant runtime metrics
- execution audit metrics
- provider health metrics

## Audit

Runtime control commands and replay/redrive operations require `execution_audit_trail` entries with request, correlation, trace, actor, resource, and tenant metadata.
