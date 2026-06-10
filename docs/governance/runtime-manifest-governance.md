# Runtime Manifest Governance

Runtime manifests describe deployable and reserved roots. They are topology metadata, not permission to create new runtimes.

## Authority

- Supreme authority remains `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`.
- Operating authority remains root `AGENTS.md`.
- Runtime winner authority remains `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md`.
- Manifests must conform to the one-region modular-monolith topology and must not reintroduce distributed, CQRS, replay, failover, chaos, or multi-region ownership fields.

## Required Shape

Each active runtime manifest must declare:

- `runtimeName`, `runtimeRoot`, `actorType`, `runtimeCategory`, and `runtimeClassification`.
- `ownership.sourceAuthority` and current `ownership.governanceDocs`.
- `allowedDependencies.workspacePackages` and `allowedDependencies.runtimeImports`.
- `forbiddenDependencies`.
- `executionOwnership`, `providerOwnership`, `executionBoundaries`, `securityOwnership`, `productionOwnership`, and `deploymentOwnership`.
- `deploymentAuthority`, `environmentAuthority`, and `observabilityAuthority`.

Reserved runtime manifests must additionally declare `implementationStatus.status = "reserved-not-implemented"` and stay manifest-only.

## Forbidden Drift

- Do not add `distributedExecutionOwnership`, `cqrsOwnership`, `regionalOwnership`, replay ownership, failover ownership, chaos ownership, or load-testing ownership fields.
- Do not point `governanceDocs` at archived theater documents or rejected multi-region governance.
- Do not mark reserved services as production deployables.
- Do not use runtime manifests to justify app-to-app imports, service-to-app imports, direct provider SDK ownership, or new runtime roots.

## Validation

- `scripts/validators/runtime-manifest-validator.mjs` checks manifest existence, dependency honesty, governance doc existence, and reserved-root honesty.
- `scripts/validators/runtime-validator.mjs` checks canonical runtime roots and reserved-root source constraints.
- `scripts/validators/no-reserved-service-activation-validator.mjs` fails if reserved roots gain deployable source.
- `scripts/validators/whole-repo-end-state-validator.mjs` checks reserved services are represented as non-deployable in production topology.

## Migration Notes

The previous manifest schema contained fields for distributed execution, CQRS, replay, failover, chaos, and multi-region ownership. Those fields described the rejected architecture and were removed from the active schema. Historical copies belong only under `docs/archive/**`.
