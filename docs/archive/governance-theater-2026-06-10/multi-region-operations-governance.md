# Multi-Region Operations Governance

Status: Phase 3 operations-final multi-region operations foundation.

## Authority

- Region-aware routing and replication contracts live in `packages/distributed-runtime/src/global-execution-runtime.ts`.
- Regional diagnostics and failover planning live in `packages/distributed-runtime/src/regional-operations-runtime.ts`.
- Deployment region metadata lives in `config/runtime/deployment-topology.json`.

## Rules

- Tenant region affinity must be explicit before write failover.
- Replay on failover is required when replication contracts mark `replayRequiredOnFailover`.
- Regional queue ownership must preserve tenant partitioning and replay checkpoints.
- Regional health decisions must consider queue lag, replication lag, read/write eligibility, and runtime health.
- Global runtime regions are governed by `config/runtime/multi-region-runtime.json`; India, APAC, EU, and US must remain explicit.
- Regional failover cannot be marked passed until replay checksum and projection comparison evidence are recorded.

## Enforcement

- Runtime manifests must declare `regionalOwnership` and `regionalExecutionOwnership`.
- `regional_execution_diagnostics` is the interim persistence surface for regional operations.
- Validators hard fail regional operations contract drift outside `packages/distributed-runtime`.
- `scripts/validators/survivability-governance-validator.mjs` hard-fails missing global region contracts and failover pairs without replay requirements.
