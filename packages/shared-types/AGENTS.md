# Shared Types Package Governance

Purpose: Incubating canonical package for cross-runtime TypeScript contracts and API/domain types.

Boundary: `packages/shared-types`.

Status: Incubating. Existing contracts remain in `packages/typescript/api-types` until migration.

Rules:

- No runtime side effects.
- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Public contract changes require version-aware rollout notes.
