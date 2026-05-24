# Theme Engine Package Governance

Purpose: Incubating domain package for theme schemas, sections, blocks, presets, template contracts, marketplace theme metadata, and rendering contracts.

Boundary: `packages/theme-engine`.

Status: Incubating. Extract theme logic without moving storefront UI composition prematurely.

Rules:

- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Theme schema changes must stay backward compatible or include migration guidance.
- Preview instance state must remain tenant and draft scoped.
