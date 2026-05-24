# CMS Core Package Governance

Purpose: Incubating domain package for pages, blogs, portfolios, resumes, forms, navigation, media references, and content publishing rules.

Boundary: `packages/cms-core`.

Status: Incubating. Extract content contracts without coupling to app routing.

Rules:

- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Published content must remain tenant-scoped.
- Preview and production content states must remain explicit.
