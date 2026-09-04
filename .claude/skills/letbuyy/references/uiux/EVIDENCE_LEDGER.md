# UI/UX Evidence Ledger — what was measured, when, at which commit

Append-only. Every row names the command and the commit. A number without a commit is not evidence.
DOC 06 (2026-06-10) rows are listed as **SUPERSEDED** where the tree has moved.

## 2026-09-04 · `823aa5ee` (GOV-3, UX-0)

| Fact | Command / source | Value |
|---|---|---|
| Token source size | `wc -l packages/typescript/ui/src/tokens.ts` | 1,749 lines (DOC 06: 1,388 — SUPERSEDED) |
| `--lb-*` variables | `grep -oE -- '--lb-[a-z0-9-]+' tokens.ts \| sort -u \| wc -l` | 307 |
| DTCG interchange | `wc -c packages/typescript/ui/tokens.json` | 8,867 B (DOC 06: 8,345 — SUPERSEDED) |
| Dart bridge | `grep -c 'static const' packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart`; classes | 183 consts; Primitive · Color · Typography · Spacing · Radius · Shadow · Density (DOC 06 "colours+spacing only" — SUPERSEDED) |
| Ratchet metrics | `node scripts/validators/validate-design-system.mjs` (dirty primary tree; provisional) | appCssRawHex 142 · appCssNakedRgbHsl 786 · tailwindPaletteClasses 524 · appLocalLbTokenRedefs 275 · rawPxFontSize 592 · rawPxSpacing 1,556 · tsxInlineStyles 673 · tsxRawHex 2 · tsxArbitraryRadius 386 · tsxArbitraryShadow 9 · localWorkspaceImplementations 0 |
| Ratchet baseline | `scripts/validators/design-system-baseline.json` (2026-08-14) | 156 · 821 · 535 · 339 · 612 · 1,581 · 673 · 5 · 388 · 9 · 0 — 8 metrics improved, 3 level |
| HARD violations | same run | **1**: `identity-platform: dark-mode reachability target file is missing` |
| Exiled from the ratchet | baseline `scope.exiledApps` | `apps/marketing-site` |
| `@letbuyy/ui` adoption (files importing / tsx files) | `grep -rl "from '@letbuyy/ui" apps/<app>/src`; `find … -name '*.tsx'` | customer_web 44/114 · merchant_web 122/141 · admin_web 21/33 · identity-platform 10/15 · marketing-site 33/69 |
| `AppNavigation` adoption (files) | `grep -rl AppNavigation apps/<app>/src` | merchant_web 2 · admin_web 1 · customer_web 0 · identity 0 · marketing 0 (DOC 06: 2/9 apps — comparable) |
| `ThemeToggleButton` (files) | `grep -rl ThemeToggleButton apps/<app>/src` | customer_web 1 · admin_web 1 · marketing 1 · merchant_web 0 · identity 0 |
| `DesignSystemRoot` (files) | `grep -rl DesignSystemRoot apps/<app>/src` | merchant_web 1 · others 0 (apps may mount the provider differently — verify before claiming absence) |
| `ProviderModeBadge` | `packages/typescript/ui/src/feedback.tsx:220`; `provider-mode-badge-validator` | present, canonical, validator PASS (DOC 06: absent — SUPERSEDED by Phase U1, 2026-08-23) |
| Feedback exports | `grep -nE '^export function' packages/typescript/ui/src/feedback.tsx` | Badge · StatusBadge · StatusPresentationBadge · ProviderModeBadge · Banner · ToastProvider · Skeleton · EmptyStateIllustration · EmptyState · SaveBar |
| stylelint | `ls node_modules/.bin/stylelint`; root `lint:css`; `grep -n lint:css .github/workflows/ci.yml` | installed; `pnpm run lint:css` runs in ci.yml's lint job (line 98) (DOC 06 UX-R30 "not installed, not in CI" — SUPERSEDED) |
| a11y tooling | `packages/typescript/ui/package.json` devDependencies | `jest-axe`, `@types/jest-axe`; Storybook `dev :9009`, `test:visual` |
| Flutter kit widgets | `ls packages/dart/ui_kit/lib/src/widgets` | 18 files; duplicates: `empty_state.dart`/`empty_state_widget.dart`, `error_view.dart`/`error_widget.dart` |
| Design docs | `ls docs/design-system docs/ui-standards` | 9 design-system docs + `tokens.reference.css`; 10 ui-standards docs |
| Flutter canary | Phase S (2026-09-04) | merchant_app 172/172; customer_app 13; admin_app 11; marketplace_core 165; marketplace_ui_kit 54 |
| Performance budgets | — | **not measured**; `PERFORMANCE_AND_MOTION_BUDGETS.md` values are PROVISIONAL |
| Font files bound to `--font-letbuyy-*` | — | **not measured** (`ICONOGRAPHY_AND_LICENSING.md` §2) |
| Flutter `ThemeData` consumes the bridge? | — | **not measured** (UX-R2; UX-4) |

## Rules for this ledger

- A ratchet reading on a dirty tree is provisional; re-measure on a clean worktree and say which.
- Never re-baseline to record a "reduction" that came from another session's uncommitted files.
- When a DOC 06 number is superseded, add the row here and leave DOC 06 untouched (it is law, dated).
