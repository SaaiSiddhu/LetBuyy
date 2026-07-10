# LetBuyy Theme Developer Docs

This directory documents the developer-facing surface of `@letbuyy/theme-engine`:
the Theme SDK, the Theme CLI, Liquid section authoring, and the committed example artifacts.

| Doc | Purpose |
|-----|---------|
| [01-theme-sdk-api.md](./01-theme-sdk-api.md) | Public SDK function reference (TypeScript) |
| [02-theme-cli.md](./02-theme-cli.md) | CLI command reference (`letbuyy-theme`) |
| [03-liquid-section-authoring.md](./03-liquid-section-authoring.md) | How to write and validate Liquid section files |
| [04-example-artifacts.md](./04-example-artifacts.md) | Committed example fixtures and drift-detection tests |

## Quick start

```bash
# Validate a bundle JSON
npx tsx packages/theme-engine/src/theme-cli.ts validate my-bundle.json

# Lint a bundle for content issues
npx tsx packages/theme-engine/src/theme-cli.ts lint my-bundle.json

# Compile a portable config to a LiquidThemePackageBundle
npx tsx packages/theme-engine/src/theme-cli.ts compile my-config.json

# Export a bundle to on-disk files
npx tsx packages/theme-engine/src/theme-cli.ts export my-bundle.json
```

## Key invariants

- `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` — Liquid rendering is off by default (canary).
- `theme-registry.ts` is frozen (ART-17). Never add new section types there.
- All money mutations use server-side RPCs; the SDK never writes to the database.
- DOMPurify config (`FORBID_TAGS`, `FORBID_ATTR`) is the single source of truth for what the linter flags.
