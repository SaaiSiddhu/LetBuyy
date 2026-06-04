# Wave 1 Report: Design Tokens

Generated: 2026-06-03
Wave owner: `packages/typescript/ui/src/tokens.ts`

## Scope

Wave 1 changed the shared web token source only. No application layouts, components, business logic, APIs, auth, payments, or database files were changed.

## Changed Files

| File | Change |
|---|---|
| `packages/typescript/ui/src/tokens.ts` | Replaced blue shared primary tokens with Purple V1; added brand, active, subtle, semantic alias, and surface/text/border CSS variable aliases |
| `LETBUYY_BRAND_PREVIEW.md` | Added Phase 0 brand preview documentation |
| `.tmp/letbuyy-brand-preview.html` | Temporary preview render target |
| `.tmp/wave1-token-preview.html` | Temporary Wave 1 token preview render target |

## Token Changes

| Token | Before | After |
|---|---:|---:|
| Light primary | `#2563eb` | `#8B5CF6` |
| Light primary hover | `#1d4ed8` | `#7C3AED` |
| Light focus ring | `#2563eb` | `#8B5CF6` |
| Dark primary | `#60a5fa` | `#8B5CF6` |
| Dark primary hover | `#93c5fd` | `#7C3AED` |
| Dark focus ring | `#93c5fd` | `#8B5CF6` |

New emitted variables:

- `--lb-color-brand-purple`
- `--lb-color-primary-active`
- `--lb-color-primary-subtle`
- `--lb-color-background`
- `--lb-color-card`
- `--lb-color-sidebar`
- `--lb-color-header`
- `--lb-color-text-primary`
- `--lb-color-text-secondary`
- `--lb-color-text-muted`
- `--lb-color-border-subtle`
- `--lb-color-border-default`
- `--lb-color-danger`

Existing compatibility variable retained:

- `--lb-color-primary-soft`

## Screenshots

| Screenshot | Path |
|---|---|
| Phase 0 preview, light | `.tmp/screenshots/phase0-brand-preview-light.png` |
| Phase 0 preview, dark | `.tmp/screenshots/phase0-brand-preview-dark.png` |
| Wave 1 token preview | `.tmp/screenshots/wave1-token-preview.png` |

## Validation

| Command | Result | Notes |
|---|---|---|
| `pnpm turbo typecheck` | Pass | 57 successful, 57 total |
| `pnpm turbo build` | Failed in sandbox | Turbopack could not create a process or bind an internal local port under sandbox restrictions |
| `pnpm turbo build` with escalated execution | Pass | 57 successful, 57 total |

## Preserved Exceptions

- Danger red remains semantic.
- Warning amber remains semantic.
- Success green remains semantic.
- Info blue remains semantic.
- No provider colors, merchant theme presets, storefront palettes, auth logic, payment logic, API logic, or database files were touched.

## Status

Wave 1 is complete. Shared UI no longer emits blue as the default primary brand token.
