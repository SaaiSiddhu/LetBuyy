# Spacing

Source: `letbuyyTokens.space` + `letbuyyDensityTokens` in `tokens.ts`; DTCG in `tokens.json`.

## Rules
1. Use the spacing scale via `var(--lb-space-*)` (numeric `--lb-space-1..11` or named `--lb-space-xs..xl`). **No raw `padding/margin/gap: NNpx`.**
2. For density-sensitive layout (paddings, gaps, control heights) use `var(--lb-density-*)` so the surface responds to `compact/comfortable/spacious`.
3. Prefer layout primitives — `BlockStack`, `InlineStack`, `Box gap=…`, `Grid` — over hand-written CSS gaps.

## Scale (→ `--lb-space-*`)

| Token | px | | Token | px |
|---|---|---|---|---|
| `none` | 0 | | `2xl` | 24 |
| `xs` | 4 | | `3xl` | 32 |
| `sm` | 8 | | `4xl` | 40 |
| `md` | 12 | | `5xl` | 48 |
| `lg` | 16 | | `6xl` | 64 |
| `xl` | 20 | | `7xl` | 96 |

Radius: `sm 4 / md 8 / lg 12 / xl 16 / full 999` (`--lb-radius-*`).

Enforcement: raw `padding/margin/gap` px in app CSS is captured by the `rawPxSpacing` ratchet in `validate:design-system`.
