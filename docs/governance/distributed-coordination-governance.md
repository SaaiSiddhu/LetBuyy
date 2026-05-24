# Distributed Coordination Governance

Status: Phase 3 final coordination foundation.

## Authority

- `packages/distributed-runtime/src/distributed-coordination-runtime.ts` owns leases, locks, fencing tokens, leader election results, execution ownership claims, and execution heartbeats.
- Services may claim, renew, heartbeat, and release leases through runtime adapters or database helper functions. They do not define coordination policy locally.
- Apps do not own coordination. UI retries or operator controls must call service APIs.

## Rules

- Every distributed worker claim requires an owner id, resource type, resource id, TTL, correlation id, and fencing token.
- Mutating execution after a lease claim must assert the fencing token before completion, retry, redrive, or recovery.
- Leader election is metadata only until dedicated coordination infrastructure is introduced; the package owns deterministic election and token formation.
- Expired heartbeats are recovery signals, not proof that side effects are safe to repeat. Recovery must use idempotency and checkpoints.

## Enforcement

- Runtime manifests must declare `coordinationOwnership`.
- `scripts/validators/distributed-runtime-validator.mjs` hard fails coordination contract definitions outside `packages/distributed-runtime`.
- Database helper `claim_runtime_lease` is the interim durable lease boundary until a dedicated coordination provider is introduced.
