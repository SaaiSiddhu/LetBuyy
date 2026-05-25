# Runtime Survivability Intelligence Governance

Status: Phase 2.75F completion governance. This is deterministic planning, validation, and lineage governance only. It is not live rollback proof, recovery proof, replay certification, chaos evidence, or production survivability evidence.

## Authority

- Runtime survivability intelligence authority lives in `config/runtime/runtime-survivability-intelligence.json`.
- Runtime orchestration authority remains `config/runtime/runtime-orchestration-manifest.json`.
- Manifest checksum authority remains `config/runtime/manifest-lineage.json`.
- Cloudflare resource ownership remains `config/runtime/cloudflare-binding-ownership.json` plus service `wrangler.toml` files.

## Reconciliation Intelligence

- Runtime reconciliation must compile desired and observed resources into a deterministic graph.
- Convergence plans are ordered by environment, resource kind, and resource name.
- Missing resources, drifted resources, and orphan resources must produce explicit recovery actions.
- Orphans are quarantined before activation.
- Every convergence step and full convergence plan has a deterministic checksum.

## Rollback Intelligence

- Rollback planning must compile a dependency-aware DAG before rollback.
- Rollback simulation must preserve replay, projection, queue, migration, and deployment-lineage compatibility.
- Rollback blast radius must include replay, projection, queue, migration, deployment lineage, and worker traffic.
- Dependency cycles and ambiguous rollback ordering are hard failures.

## Runtime Transition Lineage

- Runtime transitions must be explicit state-machine transitions.
- Every transition journal entry must include causation, correlation, required gates, a previous checksum, and a checkpoint checksum.
- Invalid or orphan runtime states must fail closed through declared recovery transitions.
- Transition journals are replayable audit chains, not operational evidence.

## Queue Convergence

- Queue convergence compares event-store, queue-processing, and projection state.
- Idempotency is mandatory for delivery convergence.
- Missing delivery requires deterministic redrive planning.
- Missing projection application requires deterministic projection rebuild planning.
- Queue convergence hashes are required for event-store state, queue state, and projection state.

## Projection Rebuild Intelligence

- Projection rebuilds use selective replay windows before full rebuilds.
- Rebuild plans must be bounded by explicit batch sizes.
- Projection dependency graphs must be acyclic.
- Replay windows cannot regress the last healthy cursor.

## Manifest Provenance

- Runtime manifests must be tamper-detectable through SHA-256 lineage entries.
- Provenance ancestry links topology, orchestration, and survivability manifests.
- Detached signatures are required before execute-mode use; repository checksums alone are not live signature evidence.

## Replay Simulation

- Replay simulation must cover schema evolution, deployment rollback, checkpoint recovery, and alternate replay branches.
- Every branch is checksummed.
- Branches must preserve deterministic event ordering and expected projection checksums.
- Simulation is repository determinism proof, not production replay certification.

## Deployment Intelligence

- Deployment intelligence compiles target runtime roots into a dependency DAG before activation.
- Activation ordering must be deterministic and cycle-free.
- Blast radius must be computed from topology dependencies before deployment execution.

## Cloudflare Resource Lineage

- Cloudflare resource lineage must govern Worker names, vars, queue producers, queue consumers, KV, R2, Durable Objects, service bindings, and telemetry bindings.
- Wrangler environment bindings are non-inheritable, so each governed environment must define its own binding ownership.
- Remote resource reconciliation remains plan-only until execute-mode credentials exist.

## Required Completion Validators

- `reconciliation-convergence-validator`
- `rollback-intelligence-validator`
- `runtime-transition-validator`
- `queue-convergence-validator`
- `projection-rebuild-validator`
- `manifest-provenance-validator`
- `replay-simulation-validator`
- `deployment-intelligence-validator`
- `cloudflare-resource-lineage-validator`

## Execution Boundary

These contracts improve deterministic survivability planning. They do not certify live recovery, live rollback, live replay, live queue convergence, live Cloudflare reconciliation, or production survivability. Live certification still requires execute-mode credentials and fresh provider evidence.
