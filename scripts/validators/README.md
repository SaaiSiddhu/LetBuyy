# Validator Tooling

`scripts/validators/` is the canonical home for executable governance checks. Validators must be deterministic, non-interactive, CI-safe, and must not read generated artifact directories as source authority.

Shared helpers belong in `governance-common.mjs`. New validators must be wired through `scripts/validate-governance.mjs` before their enforcement is documented.

`operational-lifecycle-validator.mjs` hard-fails enterprise SDLC drift: staging lifecycle contracts, staging/production isolation, rollout controls, feature flag evaluation, sandbox providers, shadow traffic contracts, load tooling, and stale live certification evidence.

Enterprise dependency and execution hardening is enforced by:

- `dependency-manifest-validator.mjs` and `undeclared-import-validator.mjs` for package-level import declarations.
- `dependency-graph-validator.mjs` and `circular-import-validator.mjs` for dependency direction and cycle prevention.
- `package-export-validator.mjs` for explicit package public APIs.
- `supply-chain-validator.mjs` for npm/npx leakage prevention in governed execution paths.
- `ci-simulation-validator.mjs` for required workflow and release-promotion gates.
- `replay-evolution-validator.mjs` and `event-versioning-validator.mjs` for additive event evolution and deterministic replay compatibility.
- `projection-recovery-validator.mjs` for projection rebuild, checkpoint, and integrity hash contracts.
- `queue-lifecycle-validator.mjs` for queue retry, dead-letter, poison-message, and recovery time governance.
- `rollback-integrity-validator.mjs`, `deployment-lineage-validator.mjs`, and `topology-drift-validator.mjs` for rollback-safe deployment lineage.
- `cloudflare-binding-validator.mjs` for explicit Wrangler environment binding ownership.
