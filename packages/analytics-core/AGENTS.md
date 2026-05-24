# Analytics Core Package Governance

Purpose: Incubating domain package for analytics event contracts, metric definitions, attribution keys, dashboard aggregates, and privacy-safe reporting shapes.

Boundary: `packages/analytics-core`.

Status: Incubating. Extract analytics contracts before moving pipelines.

Rules:

- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Events must include tenant and actor context where applicable.
- Customer-identifying data must be minimized.
