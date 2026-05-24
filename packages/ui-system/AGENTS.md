# UI System Package Governance

Purpose: Incubating canonical design-system package for web UI primitives, tokens, accessibility states, data tables, forms, and app-neutral interaction patterns.

Boundary: `packages/ui-system`.

Status: Incubating. Existing web UI package remains at `packages/typescript/ui` until exports are migrated.

Rules:

- No imports from app routes or service runtimes.
- Components must support light and dark themes, focus, hover, active, disabled, loading, empty, and error states where applicable.
- Use Lucide React for web icons.
