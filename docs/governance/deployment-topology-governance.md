# Deployment Topology Governance

Status: Phase 3 operations-final deployment topology foundation.

## Authority

- Deployment topology source authority lives in `config/runtime/deployment-topology.json`.
- Topology schema lives in `config/runtime/deployment-topology.schema.json`.
- Startup sequencing and topology validation contracts live in `packages/distributed-runtime/src/deployment-topology-runtime.ts`.

## Rules

- Every canonical runtime manifest root must appear in the deployment topology.
- Every topology node must declare deployment kind, platform, regions, startup order, scaling metadata, and health metadata.
- Dependencies must reference known topology nodes and must state whether they are required for startup.
- Topology files are source authority, not generated build output.

## Enforcement

- `scripts/validators/distributed-runtime-validator.mjs` hard fails missing runtime roots, invalid dependency references, missing health metadata, and missing scaling metadata.
- CI explicitly runs the distributed runtime validator after governance validation.
# Phase 4 Production Topology

Phase 4 adds production topology enforcement through `config/runtime/production-topology.json` and `scripts/validators/production-readiness-validator.mjs`.

The production topology must map every canonical runtime to:

- deployment manifests or provider config,
- observability ownership,
- queue provider ownership,
- event-store ownership,
- failover and regional routing ownership,
- incident and control-plane ownership,
- security, chaos, and load-testing ownership.
- deployment pipeline, operational dashboard, replay operations, and SRE ownership.

Topology drift is a hard validation failure. Runtime source may not claim production ownership unless the backing infrastructure file exists under `infrastructure/*`, `config/runtime/*`, `database/supabase/migrations/*`, or the runtime-owned deployment config.

Phase 4.final topology also requires executable deploy, rollback, health-gate, security-gate, chaos, and load-test scripts plus runbook references.
