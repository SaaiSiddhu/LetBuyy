# Distributed Execution Survivability Governance

Status: governance contract only. This document does not claim live production recovery, live rollback evidence, or internet-scale survivability proof.

## Scope

Phase 2.75X completes repository-enforced distributed execution governance:

- deterministic orchestration execution and checkpointing
- distributed consistency arbitration
- operational idempotency
- runtime causality lineage
- replay branch isolation
- saturation budgets for recovery systems
- compensation and saga governance
- runtime memory ownership
- failure-domain containment
- convergence invariant validation
- Cloudflare deep execution lineage

## Runtime Authority

The authoritative machine-readable contracts live in:

- `config/runtime/distributed-execution-contract.json`
- `config/runtime/distributed-consistency-contract.json`
- `config/runtime/runtime-causality-graph.json`
- `config/runtime/runtime-saturation-contract.json`
- `config/runtime/runtime-memory-model.json`
- `config/runtime/failure-domain-manifest.json`
- `config/runtime/replay-branch-registry.json`
- `config/runtime/convergence-invariants.json`

All contracts use `mode: governance-contract-not-live-evidence` and `failurePolicy: fail-closed`.

## Execution Rules

Distributed execution must progress through explicit states:

`PLANNED -> EXECUTING -> PARTIAL_FAILURE -> COMPENSATING -> RECOVERED -> VERIFIED`

Every operation requires:

- `operationId`
- `operationIdempotencyKey`
- `executionHash`
- `retryFingerprint`
- `compensationHash`
- `executionChecksum`

Retries must replay to the same execution checksum. A repeated idempotency key with a different checksum is a hard failure.

## Consistency Rules

The precedence hierarchy is:

1. event store
2. replay runtime
3. queue runtime
4. projection runtime
5. deployment runtime
6. reconciliation runtime

The event store is the source of truth for replay conflicts. Derived state must converge to the event-store-backed fixed point or runtime activation is blocked.

## Cloudflare Rules

Cloudflare execution governance inherits the repository-wide Wrangler rule: environment variables, bindings, queues, KV, R2, Durable Objects, service bindings, and secrets are non-inheritable and must be explicitly declared per environment. The Cloudflare execution lineage compiler treats Worker execution, queue producer-consumer causality, Durable Object ownership, service bindings, KV, and R2 as separate lineage edges.

## Validator Gates

The hard-fail distributed execution gate is:

`pnpm run validate:distributed-execution`

It runs:

- `execution-runtime-validator`
- `distributed-consistency-validator`
- `orchestration-idempotency-validator`
- `runtime-causality-validator`
- `replay-branch-validator`
- `saturation-governance-validator`
- `compensation-governance-validator`
- `runtime-memory-validator`
- `failure-domain-validator`
- `convergence-math-validator`
- `cloudflare-execution-governance-validator`

No validator produces warnings or bypasses. Missing contracts, missing source engines, unstable ordering, incomplete lineage, unsafe compensation, uncontrolled saturation, missing failure domains, or Cloudflare binding ambiguity are hard failures.

## Non-Claims

This phase does not certify live production survivability. Live certification still requires execute-mode credentials and real evidence from deployments, rollbacks, failovers, replay drills, and telemetry validation.
