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
