# Theme Engine Governance

`packages/theme-engine` is the canonical package boundary for theme contracts. It prepares the future Shopify-style rendering model without moving live storefront rendering prematurely.

## Current Authority

- Theme contracts, section/block schemas, templates, releases, and hydration contracts: `packages/theme-engine`.
- Live storefront rendering modules: `apps/storefront-runtime/src/lib/theme-engine`.
- Section React components: `apps/storefront-runtime/src/components/sections`.
- Theme discovery and acquisition: `apps/theme-marketplace`.

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

## Migration Direction

Move pure template resolution, renderer contract validation, and schema lifecycle logic into `packages/theme-engine` only after behavior is covered by tests or deterministic type checks. Live customer-facing rendering remains in storefront runtime until the migration is explicit.
