# CODEX UI Foundation Status

Branch: `stream/letbuyy-ui-foundation`
Worktree: `/private/tmp/letbuyy-ui-foundation`
Scope: `packages/typescript/ui/**`, `CODEX_UI_FOUNDATION_LEDGER.md`, `CODEX_UI_FOUNDATION_STATUS.md`, and additive UI validators if required.

## Current State

- Started from `origin/develop` at `127a850ed3e7690e2570c245fd6313a4d7b58a4e`.
- Original checkout was dirty on `stream/letbuyy-foundation-v2`; this stream is isolated in a separate worktree to avoid cross-stream file collisions.
- Audit docs are present as untracked read-only files in `/Users/saai_sidd/Git/Letbuyy_Store/docs/**`, but not tracked on `develop`. They are being used as the canonical issue source without copying them into this branch.
- Branch-point governance baseline: `node scripts/validate-governance.mjs` PASS, `129 validators`, `3043 tracked files scanned`.

## Running Summary

- U0 safety net is implemented.
- U1 P0 correctness is implemented except the app-scope marketing-site wrapper, which is recorded as a human/app-stream skip.
- Required ledger and deprecation register have been created.
- `@letbuyy/ui` now has a Vitest + React Testing Library + jest-axe suite covering the load-bearing components: Card, Section, Button, Badge, Input, Banner, Skeleton, EmptyState, Select, Checkbox, Radio, Combobox, and Tabs.
- Storybook visual regression is wired through `packages/typescript/ui/tests/visual/storybook-visual-regression.mjs`; 276 baselines were captured across light/dark and compact/comfortable/spacious density modes.
- Public API and token-variable snapshot validators are in place and self-tested so public exports and `--lb-*` variables cannot silently disappear.
- `dist/` builds additively through the existing TypeScript build while package entrypoints remain on `./src/index.ts`.
- Modal and CommandPalette now share focus-trap and dismiss hooks with focus restoration, Escape handling, outside dismiss, and background inerting.
- Input and Textarea now use React `useId()` by default and expose error/helper copy through `aria-describedby` plus `aria-invalid`.
- Token CSS now includes an additive z-index scale and `theme="auto"` follows OS dark mode through `prefers-color-scheme`.
- Text contrast fixes landed additively where possible: muted text is darker, primary text has a dedicated AA-safe text token, and status text pairs meet AA on light soft backgrounds.

## Human-Gated Remainders

- [SKIP — NEEDS HUMAN] Repoint `@letbuyy/ui` package entrypoints from `./src/index.ts` to `dist` after the parallel app/service stream lands and consumers have been rechecked. Unblocks full package distribution hardening for issue #17. Exact follow-up: update `packages/typescript/ui/package.json` `main` and `types`, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Marketing-site token root fix is app-scope. Exact follow-up for the app stream: wrap the marketing-site root layout with `DesignSystemRoot`, for example `<DesignSystemRoot surface="storefront" theme="auto">{children}</DesignSystemRoot>`, then run `pnpm --filter @letbuyy/marketing-site typecheck`, `pnpm --filter @letbuyy/marketing-site build`, `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.

## Behavior Changes To Re-Check

- Input/Textarea generated IDs changed from label-derived IDs to React `useId()` when callers do not provide `id`. Consumers should query by label/ref instead of hardcoded label-derived IDs.
- `DesignSystemRoot theme="auto"` now emits `data-letbuyy-theme="auto"` and follows OS dark preference through `@media (prefers-color-scheme: dark)`. Explicit light/dark themes remain explicit.
- Modal and CommandPalette now trap focus, inert background content while open, close on Escape/outside pointer, and restore focus to the opener.
- Light-mode text contrast changed intentionally: `--lb-color-text-muted` is darker; `--lb-color-primary-text` is new for primary text; soft status text tokens now use AA-safe text values.

## Verification Evidence

- `node scripts/validate-governance.mjs` PASS before edits; final line: `Governance validation passed (129 validators).`
- `pnpm --filter @letbuyy/ui test` PASS: 1 file, 10 tests.
- `pnpm --filter @letbuyy/ui test:visual:update` PASS: 276 baselines captured.
- `pnpm --filter @letbuyy/ui test:visual` PASS: 276 baselines checked.
- `pnpm --filter @letbuyy/ui snapshot:api:update` PASS: 265 public exports captured.
- `pnpm --filter @letbuyy/ui snapshot:tokens:update` PASS: 320 `--lb-*` variables captured.
- `node packages/typescript/ui/tests/validators/ui-public-api-snapshot-validator.mjs --self-test` PASS: simulated removal detected.
- `node packages/typescript/ui/tests/validators/ui-token-variable-snapshot-validator.mjs --self-test` PASS: simulated removal detected.
- `pnpm --filter @letbuyy/ui build` PASS: `dist/` emitted; `main`/`types` unchanged.
- `pnpm --filter @letbuyy/ui validate:ui` PASS.
- `pnpm turbo test` PASS: 61 successful tasks.
- `pnpm turbo typecheck` PASS: 60 successful tasks.
- `pnpm turbo build` PASS: 60 successful tasks.
- `pnpm lint` PASS: repo lint completed with existing warnings outside UI scope and 0 errors.
- `node scripts/validate-governance.mjs` PASS after U0 cleanup; final line: `Governance validation passed (129 validators).`
- Generated build artifacts from repo-wide build/install (`.next`, `.turbo`, nested `node_modules`, generated `dist`) were removed before the governance handoff check.
- `pnpm --filter @letbuyy/ui test` PASS after U1: 1 file, 15 tests.
- `pnpm --filter @letbuyy/ui typecheck` PASS after U1 source changes.
- `pnpm --filter @letbuyy/ui snapshot:api:update` PASS after U1: 266 public exports captured.
- `pnpm --filter @letbuyy/ui snapshot:tokens:update` PASS after U1: 338 `--lb-*` variables captured.
- `pnpm --filter @letbuyy/ui build` PASS after U1; `dist/` emitted; `main`/`types` unchanged.
- `pnpm --filter @letbuyy/ui test:visual` PASS after U1: 276 baselines checked with no unintended visual diffs.
- `pnpm --filter @letbuyy/ui validate:ui` PASS after U1.
- U1 contrast evidence on light surfaces: textMuted 4.83:1, primaryText 7.10:1, info 5.84:1, success 4.57:1, warning 6.37:1, danger 5.30:1.
- `pnpm turbo test` PASS after U1: 61 successful tasks.
- `pnpm turbo typecheck` PASS after U1: 60 successful tasks.
- `pnpm turbo build` PASS after U1: 60 successful tasks.
- `pnpm lint` PASS after U1: repo lint completed with existing warnings outside UI scope and 0 errors.
- `node scripts/validate-governance.mjs` PASS after U1 cleanup; final line: `Governance validation passed (129 validators).`
