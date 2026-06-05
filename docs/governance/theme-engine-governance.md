# Theme Engine Governance

`packages/theme-engine` is the canonical package boundary for theme contracts. It prepares the future Shopify-style rendering model without moving live storefront rendering prematurely.

## Current Authority

- Theme contracts, section/block schemas, templates, releases, and hydration contracts: `packages/theme-engine`.
- Live storefront rendering modules: `apps/storefront-runtime/src/lib/theme-engine`.
- Section React components: `apps/storefront-runtime/src/components/sections`.
- Theme marketplace DTOs, filters, purchases, reviews, and installation contracts: `packages/theme-engine`.
- Theme discovery and acquisition runtime composition: `apps/theme-marketplace`.

## Rendering Authority Model

```text
theme-engine contracts
  -> storefront section renderer
  -> merchant theme config
  -> CMS content
  -> storefront runtime composition
```

## Rules

- Theme packages must define schemas before runtimes depend on them.
- Section renderer components may consume theme-engine contracts but must not become domain authority.
- Merchant config owns theme selection and settings, not arbitrary executable code.
- CMS content supplies data; it does not own renderer lifecycle.
- Hydration contracts must declare section id, renderer key, data dependencies, and client requirements.
- Theme marketplace may own pages, data fetching, and checkout composition, but it must not define reusable theme DTOs locally.

## Reserved Theme Tables

The active theme runtime is JSON package/release based. These normalized tables exist in the baseline schema but are schema-reserved until a migration wires them into package upload, publish, preview, and storefront read paths:

- `theme_assets`
- `theme_layouts`
- `theme_templates`
- `theme_section_definitions`
- `theme_block_definitions`
- `theme_template_assignments`
- `theme_migrations`
- `theme_presets`

`theme_draft_patches` is a write-only audit trail for editor snapshot compatibility, not a read-side source of truth. It must not be documented as powering undo, replay, or live preview until a reader exists.

`theme_reviews` is a catalog read model only. Theme detail pages may read published review aggregates, but the review submission surface is not implemented; do not claim buyer theme reviews are live until a governed write/moderation path exists.

## Migration Direction

Move pure template resolution, renderer contract validation, and schema lifecycle logic into `packages/theme-engine` only after behavior is covered by tests or deterministic type checks. Live customer-facing rendering remains in storefront runtime until the migration is explicit.
