# Runtime Orchestration Governance

Status: Phase 2.75 governance foundation. This document describes repository-enforced runtime orchestration contracts only. It is not live deployment, rollback, recovery, or production survivability evidence.

## Authority

- Runtime orchestration authority lives in `config/runtime/runtime-orchestration-manifest.json`.
- Manifest checksum authority lives in `config/runtime/manifest-lineage.json`.
- Reconciliation and orchestration runtime primitives live in `packages/distributed-runtime`.
- Projection reconciliation primitives live in `packages/projection-runtime`.
- Cloudflare worker and binding authority remains `config/runtime/cloudflare-binding-ownership.json` plus each service `wrangler.toml`.

## Reconciliation Rules

- Desired runtime state is sourced from checked-in manifests, not from generated output.
- Worker, queue, projection, and replay ownership must reconcile against runtime topology before activation.
- Missing resources are planned as `create-missing`.
- Drift is planned as `update-drift` and must block activation.
- Orphan resources are planned as `quarantine-orphan`.
- `assertRuntimeReconciliationClean` is the fail-closed runtime assertion for clean reconciliation.

## Deployment Orchestration Rules

- Deployment stages are ordered `local -> dev -> staging -> production`.
- Stage activation must reuse deployment topology startup order.
- Production activation requires governance, reconciliation, runtime, replay, rollback, queue, deployment, and Cloudflare gates.
- Raw deployment execution remains forbidden outside governed wrappers.

## Rollback Orchestration Rules

- Rollback requires an approved previous Worker version id and a human-readable reason.
- Rollback steps must preserve replay, projection, queue, migration, and deployment lineage safety.
- Rollback orchestration is deterministic and bound to `config/runtime/deployment-lineage-manifest.json`.
- Rollback must not mutate the event store, drop migration state, or cross queue environments.

## Replay Recovery Rules

- Replay recovery plans use deterministic fixture checksums from `config/runtime/replay-evolution-manifest.json`.
- Global and stream positions must be strictly increasing.
- Recovery plans must validate expected projection checksums before promotion.
- These plans prove repository determinism contracts only; they are not live production replay evidence.

## Projection And Queue Recovery Rules

- Projection reconciliation is owned by `services/queue-workers`.
- Projection recovery must block owner drift, rebuild version drift, restore missing snapshots, and fail on integrity hash mismatch.
- Queue recovery must reconcile retry backlog deterministically, quarantine poison messages, and require operator-approved dry-run redrive for dead-letter recovery.
- Queue recovery policies are derived from `config/runtime/queue-lifecycle-manifest.json`.

## State Machine Rules

- Runtime, deployment, rollback, replay, projection, and queue lifecycles each have explicit state machines.
- Terminal states cannot have outbound transitions.
- Every transition declares required gates.
- Validators fail closed on unreachable states, missing gates, lineage drift, or implicit transitions.

## Required Validators

- `runtime-reconciliation-validator`
- `deployment-orchestration-validator`
- `rollback-orchestration-validator`
- `replay-recovery-validator`
- `projection-reconciliation-validator`
- `queue-recovery-validator`
- `runtime-state-machine-validator`
- `manifest-lineage-validator`

## Execution Boundary

This phase does not claim live recovery evidence. Execute-mode operational proof requires real provider credentials and fresh evidence from deployment, rollback, replay, and recovery runs. Until then, this repository contains executable governance contracts and fail-closed validation only.
