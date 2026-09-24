# Validator Tooling

`scripts/validators/` is the canonical home for executable governance checks. Validators must be deterministic, non-interactive, CI-safe, and must not read generated artifact directories as source authority.

Shared helpers belong in `governance-common.mjs`. The one exception is `secret-scan-core.mjs`, the secret-scan library shared by `environment-validator.mjs` and `tests/governance/secret-scan-exceptions.test.mjs`, kept separate so that test can run the real validator in a throwaway repository with only three modules. It has no path exemptions: a reviewed exception binds one value in one file through `config/governance/secret-scan-exceptions.json` (APPID-P2). New validators must be wired through `scripts/validate-governance.mjs` before their enforcement is documented.

`operational-lifecycle-validator.mjs` hard-fails enterprise SDLC drift: staging lifecycle contracts, staging/production isolation, rollout controls, feature flag evaluation, sandbox providers, shadow traffic contracts, provider-failure drills, and stale live certification evidence.

Enterprise dependency and execution hardening is enforced by:

- `dependency-manifest-validator.mjs` and `undeclared-import-validator.mjs` for package-level import declarations.
- `dependency-graph-validator.mjs` and `circular-import-validator.mjs` for dependency direction and cycle prevention.
- `package-export-validator.mjs` for explicit package public APIs.
- `supply-chain-validator.mjs` for npm/npx leakage prevention in governed execution paths.
- `ci-simulation-validator.mjs` for required workflow and release-promotion gates.
- `workflow-trigger-coverage-validator.mjs` for workflow trigger coverage: every governed branch is reached by the non-deploying CI lanes, no deploy-to-production workflow is reachable from an integration branch, and `architecture-governance.yml` aggregates every gate step instead of fail-fasting on the first one. It parses workflow YAML with a self-contained reader (no undeclared dependency). GitHub-side branch protection is outside the repository and stays UNVERIFIED here; see `.github/BRANCH_STRATEGY.md`.
- `branch-dispositions-validator.mjs` for the branch model `develop → staging → main` (OWNER_DECISION D-BRANCH, 2026-09-04): `docs/active/BRANCH_DISPOSITIONS.md` is the only branch-disposition authority; it asserts `main ⊆ staging ⊆ develop`, that every `MERGED_DEVELOP` row is an ancestor of `develop`, that `ACTIVE` rows record an ancestor of their branch tip, that `LEGACY_INTEGRATED` rows never advanced past `develop`, that `Promotions` rows are ancestors of their target, and that no branch has two rows. Refs missing in a shallow CI clone are skipped, never failed; a local branch without a row is an advisory.
- `event-versioning-validator.mjs` for additive event evolution and deterministic outbox compatibility.
- queue and deployment validators for rollback, checkpoint, and integrity hash contracts.
- `queue-lifecycle-validator.mjs` for queue retry, dead-letter, poison-message, and recovery time governance.
- `rollback-integrity-validator.mjs`, `deployment-lineage-validator.mjs`, and `topology-drift-validator.mjs` for rollback-safe deployment lineage.
- `cloudflare-binding-validator.mjs` for explicit Wrangler environment binding ownership.
- `reference-isolation-validator.mjs` for the REFERENCE class (Amendment 3): nothing outside `reference/` imports, installs, builds or deploys a donor, no executable file depends on a donor system's machine path, and each donor keeps its provenance and transfer-gate record (`reference/README.md`).

`web-v1-scope-perimeter-validator.mjs` enforces `config/governance/web-v1-scope-registry.json` as a ratchet: an excluded, forbidden or unratified capability may not gain a NEW activation signal. Its `knownActivationsBaseline` is an explicit list of activations that already existed at the recorded baseline SHA — it is not a clean-state assertion. Behaviour and limitations are documented in `docs/governance/web-v1-scope-perimeter-governance.md`.
