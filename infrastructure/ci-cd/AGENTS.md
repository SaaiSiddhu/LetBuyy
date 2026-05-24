# CI/CD Infrastructure Governance

Purpose: CI validation, architecture enforcement, build matrices, deployment checks, and release automation policy.

Boundary: `infrastructure/ci-cd`.

Rules:

- Architecture validation must run before topology changes merge.
- Runtime builds should be added incrementally as dependency blockers are removed.
- CI must avoid provider secrets unless explicitly required by a deployment job.
