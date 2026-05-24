# Search Core Package Governance

Purpose: Incubating domain package for search indexing contracts, query filters, ranking metadata, and tenant-aware search document shapes.

Boundary: `packages/search-core`.

Status: Incubating. Extract typed contracts before service runtime indexing logic.

Rules:

- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Search documents must include tenant scope.
- Private merchant data must not enter public storefront indexes.
