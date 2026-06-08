# Typography

Source: `letbuyyTokens.typography` in `tokens.ts`; DTCG in `tokens.json`.

## Rules
1. Use the role-based size tokens via `var(--lb-font-size-*)` / `var(--lb-line-height-*)`, or the `Text` primitive from `@letbuyy/ui`. **No raw `font-size: NNpx`.**
2. Font family is set once at the design-system root (`var(--lb-font-family-body)`). **Do not re-declare `font-family`** in app CSS/components.
3. Families are wired through `next/font` in every app layout (`--font-letbuyy-sans/display/mono`).

## Role scale (→ `--lb-font-size-*`, `--lb-line-height-*`)

| Role | Size | Line height |
|---|---|---|
| `display` | 32 | 40 |
| `h1` / `page-title` | 28 / 24 | 36 / 32 |
| `section-title` | 18 | 24 |
| `card-title` / `body-large` | 16 | 20 / 24 |
| `body` | 14 | 20 |
| `secondary` / `table` | 13 | 18 |
| `caption` / `badge` | 12 | 16 |

Weights: `regular 400`, `medium 500`, `semibold 600`, `bold 700` (`--lb-font-weight-*`).

Enforcement: raw `font-size:` in app CSS is captured by the `rawPxFontSize` ratchet in `validate:design-system` (counts may only decrease).
