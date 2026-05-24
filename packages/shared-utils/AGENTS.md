# Shared Utils Package Governance

Purpose: Incubating canonical package for cross-runtime pure utilities that do not own business decisions.

Boundary: `packages/shared-utils`.

Status: Incubating. Existing utilities remain in `packages/typescript/utils` until migration.

Rules:

- No app routing, service env, or legacy imports.
- Utilities must be deterministic and typed.
- Business decisions belong in domain core packages, not generic utilities.
