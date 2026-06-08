# Color

Source: `letbuyyPrimitiveTokens` + `letbuyySemanticTokens` in `tokens.ts`; DTCG in `tokens.json`.

## Rules
1. **Never** use a hex, `rgb()`, `hsl()`, or Tailwind palette class (`bg-gray-500`, `bg-white`) in product code. These bypass theming and fail the governance gate.
2. Reference semantic roles via `var(--lb-color-*)` or the token utility classes (`bg-surface`, `text-default`, `border-line` — see `config/tailwind/letbuyy-tokens.css`).
3. Compose new UI from **semantic** roles, not primitives.

## Brand
Primary is purple `#8B5CF6` (`--lb-color-primary`); CTA `#7C3AED` (`--lb-color-primary-cta`). Per-tenant brand overrides are injected by `createLetbuyyBrandVariables` with runtime WCAG contrast validation (`validateLetbuyyBrandContrast`).

## Semantic roles (→ `--lb-color-*`)

| Role | Light | Dark |
|---|---|---|
| `bg` | gray-125 | gray-900 |
| `surface` | white | gray-900 |
| `card` | white | slate-850 |
| `text` | gray-900 | white |
| `text-subdued` | gray-500 | slate-300 |
| `border` | gray-200 | slate-700 |
| `primary` | purple-500 | purple-500 |
| `critical` / `success` / `warning` / `info` | red/green/amber/blue-500 | same |

Both schemes are emitted under `[data-theme]` / `.dark` / `prefers-color-scheme` by `letbuyyTokenCss`. The merchant **storefront** theme engine (`packages/theme-engine`) is a separate system and is not governed by these tokens.
