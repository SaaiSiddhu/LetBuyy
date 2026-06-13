# LetBuyy Design System

The single source of UI truth is `@letbuyy/ui` (`packages/typescript/ui`). Build from its primitives; never hand-roll styled elements.

## Tokens (mandatory)
All colors, spacing, radius, typography come from `--lb-*` CSS variables. The design-system validator (`scripts/validators/validate-design-system.mjs`) **ratchets down** drift — these may not increase:
- `tsxArbitraryRadius` — no new `rounded-[...]`; use `rounded-md`/`rounded-lg`.
- `rawPxSpacing` / `rawPxFontSize` — no raw `px`; use `--lb-space-*` / `--lb-font-size-*`.
- `tsxInlineStyles`, `tsxRawHex`, `tailwindPaletteClasses`, `appCssNakedRgbHsl` — avoid.

## Core primitives
`Button` (variants: primary/secondary/outline/ghost/destructive; sizes icon/sm/md/lg), `Input`/`Textarea`/`Select`/`Checkbox`/`Switch`, `Table`, `Badge` (default/info/success/warning/critical), `Card`/`Section`/`Page`/`PageHeader`, `Banner`, `Modal`/`Drawer`/`ConfirmDialog`, `EmptyState`, `Skeleton`, `Avatar`, `SaveBar`, `useToast`. Icons re-exported from lucide (`Plus`, `Copy`, `Eye`, `Lock`, `Mail`, `ShieldCheck`, …).

## Rules
1. Compose, don't fork — extend via props, not copies.
2. Tokens only — see ratchet above.
3. Accessibility built in — `Checkbox` requires `label` (use `unstyled` + `aria-label` when the visible label is a sibling).
4. Formatting via `@letbuyy/ui/formatting` (`formatInrCurrency`).

## Verify
`node scripts/validators/validate-design-system.mjs` and `npx tsc --noEmit -p apps/<app>`.
