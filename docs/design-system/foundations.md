# LetBuyy Design System — Foundations

> The authoring source of truth for tokens is **`packages/typescript/ui/src/tokens.ts`**.
> The DTCG interchange projection is **`packages/typescript/ui/tokens.json`** (kept in parity by `scripts/generators/generate-design-tokens.mjs --check`).
> Everything ships from **`@letbuyy/ui`**. Apps do not re-declare tokens, providers, or shells.

This guide is the human-authored companion to the auto-generated `README.md` (a repository scan). It documents how to consume the system correctly.

## Token tiers

| Tier | Symbol (`tokens.ts`) | Use |
|---|---|---|
| Primitive | `letbuyyPrimitiveTokens` | Raw palette. **Private** — never reference in product code. |
| Semantic | `letbuyySemanticTokens` (light/dark) | Public alias roles: `bg`, `surface`, `text`, `border`, `primary`, status… |
| Component | `letbuyyComponentTokens` (light/dark) | Per-component values (button, card, sidebar, input, table…). |
| Density | `letbuyyDensityTokens` | `compact` / `comfortable` / `spacious`. |
| Scales | `letbuyyTokens.{space,radius,typography,shadow,zIndex,motion,size}` | Spacing, radius, type, etc. |

All tiers are emitted to `--lb-*` CSS variables by `letbuyyTokenCss` and injected by `DesignSystemRoot`. **Reference `var(--lb-*)`; never hardcode hex / rgb / px.**

## Theming model (single provider)

Every app wraps its body in exactly one provider:

```tsx
// app/layout.tsx
import { LetbuyyThemeProvider, ThemeScript } from "@letbuyy/ui";

<html suppressHydrationWarning>
  <head><ThemeScript /></head>
  <body>
    <LetbuyyThemeProvider surface="admin">{children}</LetbuyyThemeProvider>
  </body>
</html>
```

`LetbuyyThemeProvider` owns theme state, persistence, and renders `DesignSystemRoot` **with the resolved theme** internally — apps never touch `DesignSystemRoot` or pass `theme="auto"`. See [dark-mode.md](./dark-mode.md).

- **Persistence:** one key `localStorage["letbuyy-theme"]`, one vocabulary `light | dark | system`.
- **Read/control:** `const { theme, resolvedTheme, setTheme, themes } = useTheme()` from `@letbuyy/ui`.
- **Flash prevention:** the single `<ThemeScript>` in `<head>` (no per-app scripts).
- **Surfaces:** `admin | marketplace | storefront | identity | operations` scope component variables.

## Governance (enforced)

| Gate | What it blocks | Where |
|---|---|---|
| `@letbuyy/ui` ESLint plugin | hex + raw `<button>/<input>/<table>` (error); Tailwind-palette + raw rgb (warn, ratcheting) | per-app `eslint.config.mjs` |
| `validate:design-system` | `<DesignSystemRoot>` in layouts, `theme="auto"`, legacy keys, bespoke providers (hard); CSS drift (ratchet) | CI + pre-commit |
| `validate:design-tokens` | `tokens.json` drift from `tokens.ts` | CI + pre-commit |
| `validate:mobile-tokens` | Flutter token drift | CI + pre-commit |
| `.stylelintrc.cjs` | raw color in `.css` (once `stylelint` is installed) | `pnpm lint:css` |

Enable local hooks once: `pnpm run hooks:install`.

## Topic guides
[colors](./colors.md) · [typography](./typography.md) · [spacing](./spacing.md) · [density](./density.md) · [dark-mode](./dark-mode.md) · [components](./components.md) · [navigation](./navigation.md)
