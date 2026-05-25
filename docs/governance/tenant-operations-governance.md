# Tenant Operations Governance

Status: Phase 3 operations-final tenant operations foundation.

## Authority

- Tenant scalability policy lives in `packages/distributed-runtime/src/tenant-scalability-runtime.ts`.
- Tenant fairness, tenant operational projections, workload admission, and tenant diagnostics live in `packages/distributed-runtime/src/tenant-operations-runtime.ts`.

## Rules

- Tenant workloads must route by tenant partition key.
- Noisy-neighbor enforcement must isolate or throttle tenants before shared queues degrade.
- Tenant replay and queue operations must remain tenant-scoped when tenant metadata is available.
- Tenant operational metrics must not expose secrets or cross-tenant payloads.

## Enforcement

- Runtime manifests must declare `tenantScalingOwnership` and tenant operational execution through operational fields.
- `tenant_execution_quotas` and `tenant_operation_projections` are the interim persistence surfaces.
- Validators hard fail tenant operations contract leakage outside `packages/distributed-runtime`.
