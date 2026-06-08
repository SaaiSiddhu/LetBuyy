# Density

Source: `letbuyyDensityTokens` in `tokens.ts`. Three presets shift control heights, paddings, gaps, and icon sizes via `--lb-density-*`.

| Dimension (`--lb-density-*`) | compact | comfortable | spacious |
|---|---|---|---|
| `input-height` / `button-height` | 36 | 40 | 44 |
| `table-row-height` | 44 | 48 | 52 |
| `card-padding` | 16 | 20 | 24 |
| `page-gap` / `section-gap` | 12 | 16 | 20 |
| `header-height` | 64 | 72 | 88 |

## Usage
- Set per surface: `<LetbuyyThemeProvider surface="admin" density="compact">`. Default is `compact`.
- Consume in CSS via `var(--lb-density-card-padding)` etc., **not** raw px — that's how a surface responds to density.
- Expose to users with the `DensityToggle` component from `@letbuyy/ui` where product-appropriate.

Density is a deliberate axis: if a surface hardcodes px it opts out of density. Migrating raw px spacing/sizing to `--lb-density-*` is what makes the toggle meaningful.
