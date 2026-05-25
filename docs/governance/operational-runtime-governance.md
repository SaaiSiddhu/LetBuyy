# Operational Runtime Governance

Status: Phase 3 operations-final platform foundation.

## Authority

- Runtime inspection, health contracts, control commands, execution diagnostics, dashboard metric contracts, and operational recovery contracts live in `packages/distributed-runtime/src/operations-runtime.ts`.
- Operational control-plane execution lives in `packages/distributed-runtime/src/control-plane-runtime.ts`.
- Queue, replay, telemetry, observability, tenant, cache, coordination, and regional operations have dedicated operation runtimes under `packages/distributed-runtime/src/*-operations-runtime.ts`.
- Deployment topology source authority lives in `config/runtime/deployment-topology.json` and `config/runtime/deployment-topology.schema.json`.
- API/service operations endpoints may expose approved views and commands but must enforce platform-operator authorization.
- UI dashboards are not required in Phase 3 operations-final; runtime contracts, persistence helpers, topology metadata, and validators are required.

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

## Enforcement

- Runtime manifests must declare operational execution fields including `operationalOwnership`, `telemetryExecutionOwnership`, `queueExecutionOwnership`, `replayExecutionOwnership`, `diagnosticsOwnership`, and `operationalControlPlaneOwnership`.
- `scripts/validators/distributed-runtime-validator.mjs` hard fails missing operational runtime files, migration helpers, deployment topology drift, and operational contract leakage.
- CI runs `node scripts/validate-governance.mjs` and the distributed runtime validator for operational topology drift.
