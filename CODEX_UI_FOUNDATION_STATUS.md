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
- U2 token system completion is implemented additively.
- U3 missing primitives are implemented additively.
- U4 consolidation shims are implemented additively.
- U5 internal composition refactor is implemented with zero visual diffs.
- U6 theming reach is implemented additively.
- U7 a11y and polish is implemented where non-breaking; larger prop grammar, native select replacement, chart-library replacement, and default-density policy are recorded as human-gated skips.
- Required ledger and deprecation register have been created.
- `@letbuyy/ui` now has a Vitest + React Testing Library + jest-axe suite covering the load-bearing components: Card, Section, Button, Badge, Input, Banner, Skeleton, EmptyState, Select, Checkbox, Radio, Combobox, and Tabs.
- Storybook visual regression is wired through `packages/typescript/ui/tests/visual/storybook-visual-regression.mjs`; 276 baselines were captured across light/dark and compact/comfortable/spacious density modes.
- Public API and token-variable snapshot validators are in place and self-tested so public exports and `--lb-*` variables cannot silently disappear.
- `dist/` builds additively through the existing TypeScript build while package entrypoints remain on `./src/index.ts`.
- Modal and CommandPalette now share focus-trap and dismiss hooks with focus restoration, Escape handling, outside dismiss, and background inerting.
- Input and Textarea now use React `useId()` by default and expose error/helper copy through `aria-describedby` plus `aria-invalid`.
- Token CSS now includes an additive z-index scale and `theme="auto"` follows OS dark mode through `prefers-color-scheme`.
- Text contrast fixes landed additively where possible: muted text is darker, primary text has a dedicated AA-safe text token, and status text pairs meet AA on light soft backgrounds.
- Breakpoint tokens now exist as `letbuyyBreakpointTokens`, `letbuyyTailwindScreens`, `letbuyyTailwindPreset`, and emitted `--lb-bp-*` variables using the current 640/768/1024/1280 values.
- Card shadow and light status-soft provenance now come from shared token authorities without changing the previous visual values.
- Existing token aliases remain emitted, while `validate:aliases` now prevents new duplicate-value token aliases from being added accidentally.
- Overlay primitives now include `Drawer`, `Popover`, `Dropdown`, and `DropdownMenu`, all sharing the same focus/dismiss foundation and z-index scale.
- Form/layout primitives now include `Grid`, `Columns`, `Container`, `Switch`, `NumberField`, `InlineError`, `DatePicker`, `Disclosure`, `Accordion`, `SegmentedControl`, and app-shell `Navigation`/`Sidebar`/`AppFrame`.
- `Button` now supports additive `as` and `asChild` rendering while default button rendering remains unchanged.
- `DensityToggle` now delegates to `SegmentedControl` without changing its public props.
- The bare root `Menu` symbol remains the existing icon export for consumer compatibility. The menu primitive is exported as `Dropdown`/`DropdownMenu`.
- A new unified `Table` export exists with saved views, filter chips, bulk selection/actions, sorting, mobile cards, and desktop table rendering. `DataTable` and `IndexTable` stay exported and are deprecated, not removed.
- `Text` now absorbs the `TextStyle` variants. `TextStyle` delegates to `Text` and preserves its old default element/class output.
- `PageShell`, `PageActions`, and `TableFilterBar` remain exported with deprecation tags and replacement pointers.
- `Badge variant="danger"` remains accepted and normalized, with `critical` documented as the canonical vocabulary.
- Strict material icon helpers now exist through `StrictMaterialIconName`, `materialIconNames`, `isMaterialIconName()`, and `materialIconName()` while the loose `MaterialIconName` path stays compiling.
- PageHeader, SaveBar, IndexTable, Pagination, and DensityToggle/SegmentedControl now compose `Button`, `Checkbox`, and `Breadcrumbs` internally while preserving public props and rendered visuals.
- `DesignSystemRoot` now emits surface-scoped variable hooks through `data-letbuyy-surface` with identity defaults, supports runtime `brand` CSS-variable overrides, and dedupes nested token `<style>` output through a server-safe client boundary.
- `cx()` now uses `tailwind-merge` while keeping the same call signature.
- Tooltip triggers now receive `aria-describedby`, tooltips can reveal on touch/pointer activation, Modal backdrops are non-button `div`s, and ConfirmDialog accepts custom body copy.
- Toasts now support additive duration and placement options; Pagination now supports additive page numbers and page-size controls.
- Avatar image alt text, DesignSystemRoot `dir`, IndexTable `aria-selected`, ChoiceList overflow safety, reduced-motion CSS, stronger focus-ring contrast, EmptyState motif overrides, and INR-first formatting helpers are in place.

## Human-Gated Remainders

- [SKIP — NEEDS HUMAN] Repoint `@letbuyy/ui` package entrypoints from `./src/index.ts` to `dist` after the parallel app/service stream lands and consumers have been rechecked. Unblocks full package distribution hardening for issue #17. Exact follow-up: update `packages/typescript/ui/package.json` `main` and `types`, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Marketing-site token root fix is app-scope. Exact follow-up for the app stream: wrap the marketing-site root layout with `DesignSystemRoot`, for example `<DesignSystemRoot surface="storefront" theme="auto">{children}</DesignSystemRoot>`, then run `pnpm --filter @letbuyy/marketing-site typecheck`, `pnpm --filter @letbuyy/marketing-site build`, `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Existing token alias collapse is breaking until coordinated with app/service codemods and visual verification. Exact follow-up after U8 codemods exist: run the token-alias codemod across consumers, remove deprecated aliases from `packages/typescript/ui/src/tokens.ts`, refresh UI snapshots, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Optional root `Menu` component alias requires a public symbol decision because `Menu` is already an icon export used by current consumers. This stream ships the primitive as `Dropdown`/`DropdownMenu`. Exact follow-up: decide whether to rename the icon export or keep the primitive name, run a consumer codemod if a rename is chosen, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Deprecated table/text/page-alias/badge surfaces cannot be removed in this stream. Exact follow-up after U8 codemods are available: run the table, text, badge, and alias codemods across app/service consumers, remove deprecated UI exports, refresh snapshots, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Arbitrary loose `MaterialIconName` strings cannot be removed until unknown icon names are audited. Exact follow-up: guard user-provided strings with `isMaterialIconName()` or replace known names with `materialIconName()`, remove `LooseMaterialIconName`, refresh the API snapshot, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Per-surface palettes need product/design approval. This stream added `data-letbuyy-surface` hooks with identity defaults only, so no default visuals changed. Exact follow-up: update `letbuyySurfaceTokens`, refresh snapshots, then run `pnpm --filter @letbuyy/ui validate:ui`, `pnpm --filter @letbuyy/ui test:visual`, `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Canonical brand identity and light CTA contrast policy need approval. This stream added the `brand` plumbing path while keeping default purple unchanged. Exact follow-up: apply the approved brand ramp through `DesignSystemRoot brand` or token defaults, verify contrast, refresh snapshots, then run `pnpm --filter @letbuyy/ui validate:ui`, `pnpm --filter @letbuyy/ui test:visual`, `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Prop grammar canonicalization for `onChange`/`onValueChange`, `size`/`controlSize`, and `helperText`/`description` is breaking without a consumer codemod. Exact follow-up: author/run U8 codemods across consumers, add deprecation warnings where applicable, refresh API snapshots, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Native `Select` rich-option replacement needs a primitive strategy decision. Exact follow-up: decide whether rich options belong in `Combobox`, a new select primitive, or additive custom `Select` props, then run `pnpm --filter @letbuyy/ui test`, `pnpm --filter @letbuyy/ui test:visual`, `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Chart replacement needs a proven charting-library and bundle policy decision. Exact follow-up: add the approved dependency to `@letbuyy/ui`, preserve the current `Chart` API through a shim or codemod, refresh visual snapshots, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Root/default density policy needs a visual design decision. Exact follow-up: choose whether `sharedCssVariables` should continue seeding compact or move to another default, refresh visual snapshots, then run `pnpm --filter @letbuyy/ui test:visual`, `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.

## Behavior Changes To Re-Check

- Input/Textarea generated IDs changed from label-derived IDs to React `useId()` when callers do not provide `id`. Consumers should query by label/ref instead of hardcoded label-derived IDs.
- `DesignSystemRoot theme="auto"` now emits `data-letbuyy-theme="auto"` and follows OS dark preference through `@media (prefers-color-scheme: dark)`. Explicit light/dark themes remain explicit.
- Modal and CommandPalette now trap focus, inert background content while open, close on Escape/outside pointer, and restore focus to the opener.
- Light-mode text contrast changed intentionally: `--lb-color-text-muted` is darker; `--lb-color-primary-text` is new for primary text; soft status text tokens now use AA-safe text values.
- U2 token additions are additive and should not change rendered output. Existing spacing/type/color aliases still emit; the new alias validator only blocks new duplicate-value aliases.
- U3 primitive additions are additive. Existing consumers keep the current `Menu` icon export; use `Dropdown` or `DropdownMenu` for the new menu primitive.
- U4 consolidation is additive. Existing `DataTable`, `IndexTable`, `TextStyle`, `PageShell`, `PageActions`, `TableFilterBar`, `Badge variant="danger"`, and loose `MaterialIconName` usages still compile and render.
- U5 composition is intended to be visually and behaviorally unchanged. Additive `Button.unstyled`, `Checkbox.unstyled`, and `Breadcrumbs` separator/current-tone props exist only to preserve legacy internal visuals while routing through design-system primitives.
- U6 theming changes are additive and default-identity. Existing `surface` values now have real variable hooks, `brand` overrides are opt-in, nested `DesignSystemRoot` token styles dedupe automatically, and `cx()` now resolves Tailwind class conflicts in favor of later classes.
- U7 changes are additive except intentional correctness fixes: `--lb-color-focus-ring` is stronger in light mode, Modal backdrop semantics changed from a hidden full-screen button to a non-focusable backdrop `div`, Combobox option clicks no longer suppress `mousedown`, and reduced-motion preference now disables decorative motion.

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
- `pnpm --filter @letbuyy/ui snapshot:api:update` PASS after U2: 270 public exports captured.
- `pnpm --filter @letbuyy/ui snapshot:tokens:update` PASS after U2: 349 `--lb-*` variables captured.
- `pnpm --filter @letbuyy/ui snapshot:aliases:update` PASS after U2: 108 duplicate-value alias groups captured.
- `node packages/typescript/ui/tests/validators/ui-no-new-token-alias-validator.mjs --self-test` PASS: simulated alias growth detected.
- `pnpm --filter @letbuyy/ui validate:ui` PASS after U2: 16 tests, API snapshot, token snapshot, alias snapshot.
- `pnpm --filter @letbuyy/ui typecheck` PASS after U2.
- `pnpm --filter @letbuyy/ui build` PASS after U2.
- `pnpm --filter @letbuyy/ui test:visual` PASS after U2: 276 baselines checked, no unintended diffs.
- `pnpm turbo test` PASS after U2: 61 successful tasks.
- `pnpm turbo typecheck` PASS after U2: 60 successful tasks.
- `pnpm turbo build` PASS after U2: 60 successful tasks.
- `pnpm lint` PASS after U2: repo lint completed with existing warnings outside UI scope and 0 errors.
- Generated build/install artifacts from U2 verification were removed before governance.
- `node scripts/validate-governance.mjs` PASS after U2 cleanup; final line: `Governance validation passed (129 validators).`
- `pnpm --filter @letbuyy/ui typecheck` PASS after U3 primitives.
- `pnpm --filter @letbuyy/ui test` PASS after U3: 1 file, 20 tests.
- `pnpm --filter @letbuyy/ui build` PASS after U3.
- `pnpm --filter @letbuyy/ui snapshot:api:update` PASS after U3: 310 public exports captured.
- `pnpm --filter @letbuyy/ui validate:ui` PASS after U3: 20 tests, API snapshot, token snapshot, alias snapshot.
- `pnpm --filter @letbuyy/ui test:visual:update` PASS after U3: 300 baselines captured.
- `pnpm --filter @letbuyy/ui test:visual` PASS after U3: 300 baselines checked.
- `pnpm turbo test` PASS after U3: 61 successful tasks.
- `pnpm turbo typecheck` PASS after U3: 60 successful tasks. This explicitly caught and then verified the `Menu` public-symbol collision fix.
- `pnpm turbo build` PASS after U3: 60 successful tasks.
- `pnpm lint` PASS after U3: repo lint completed with existing warnings outside UI scope and 0 errors.
- Generated build/install artifacts from U3 verification were removed before governance.
- `node scripts/validate-governance.mjs` PASS after U3 cleanup; final line: `Governance validation passed (129 validators).`
- `pnpm --filter @letbuyy/ui typecheck` PASS after U4 source changes.
- `pnpm --filter @letbuyy/ui test` PASS after U4: 1 file, 23 tests.
- `pnpm --filter @letbuyy/ui build` PASS after U4.
- `pnpm --filter @letbuyy/ui snapshot:api:update` PASS after U4: 321 public exports captured.
- `pnpm --filter @letbuyy/ui validate:ui` PASS after U4: 23 tests, API snapshot, token snapshot, alias snapshot.
- `pnpm --filter @letbuyy/ui test:visual:update` PASS after U4 under escalated browser permission: 306 baselines captured.
- `pnpm --filter @letbuyy/ui test:visual` PASS after U4 under escalated browser permission: 306 baselines checked.
- `pnpm turbo test` PASS after U4: 61 successful tasks.
- `pnpm turbo typecheck` PASS after U4: 60 successful tasks.
- `pnpm lint` PASS after U4: repo lint completed with existing warnings outside UI scope and 0 errors.
- `pnpm turbo build` PASS after U4 under escalated Turbopack permission: 60 successful tasks. The first sandboxed attempt failed because Turbopack could not create a helper process/bind a local port; rerun with escalation passed.
- Initial U4 governance caught an undeclared `@storybook/react` type import in the new table story; the story was changed to match existing UI story patterns with no external Storybook type import.
- `pnpm --filter @letbuyy/ui typecheck` PASS after that story import fix.
- `pnpm --filter @letbuyy/ui validate:ui` PASS after that story import fix.
- Generated build/install artifacts from U4 verification were removed with a depth that includes `packages/typescript/ui/dist`.
- `node scripts/validate-governance.mjs` PASS after U4 cleanup; final line: `Governance validation passed (129 validators).`
- `pnpm --filter @letbuyy/ui typecheck` PASS after U5 source changes.
- `pnpm --filter @letbuyy/ui test` PASS after U5: 1 file, 24 tests. Added RTL/axe coverage for composed PageHeader, SaveBar, IndexTable, and Pagination behavior.
- `pnpm --filter @letbuyy/ui build` PASS after U5.
- `pnpm --filter @letbuyy/ui validate:ui` PASS after U5: 24 tests, API snapshot, token snapshot, alias snapshot.
- `pnpm --filter @letbuyy/ui test:visual` PASS after U5 under escalated browser permission: 306 baselines checked with no baseline updates and no visual diffs.
- `pnpm turbo test` PASS after U5: 61 successful tasks.
- `pnpm turbo typecheck` PASS after U5: 60 successful tasks.
- `pnpm lint` PASS after U5: repo lint completed with existing warnings outside UI scope and 0 errors.
- `pnpm turbo build` PASS after U5 under escalated Turbopack permission: 60 successful tasks.
- Generated build/install artifacts from U5 verification were removed with a depth that includes `packages/typescript/ui/dist`.
- `node scripts/validate-governance.mjs` PASS after U5 cleanup; final line: `Governance validation passed (129 validators).`
- `CI=true pnpm install --frozen-lockfile` PASS before U6 verification after adding the `tailwind-merge` dependency to `@letbuyy/ui`.
- `pnpm --filter @letbuyy/ui typecheck` PASS after U6 source changes.
- `pnpm --filter @letbuyy/ui test` PASS after U6: 1 file, 27 tests. Added coverage for `cx` conflict merging, surface/brand variable plumbing, and nested token style dedupe.
- `pnpm --filter @letbuyy/ui snapshot:api:update` PASS after U6: 326 public exports captured.
- `pnpm --filter @letbuyy/ui build` PASS after U6.
- `pnpm --filter @letbuyy/ui validate:ui` PASS after U6: 27 tests, API snapshot, token snapshot, alias snapshot.
- `pnpm --filter @letbuyy/ui test:visual` PASS after U6 under escalated browser permission: 306 baselines checked with no baseline updates and no visual diffs.
- Initial `pnpm turbo build` after U6 caught a server-component incompatibility: `DesignSystemRoot` used React context directly and Next failed page-data collection with `createContext is not a function`. The style-dedupe context was moved into `token-style-boundary.tsx` with `'use client'`, keeping `DesignSystemRoot` server-importable.
- `pnpm --filter @letbuyy/ui typecheck` PASS after the server-safe style boundary fix.
- `pnpm --filter @letbuyy/ui test` PASS after the server-safe style boundary fix: 27 tests.
- `pnpm --filter @letbuyy/ui build` PASS after the server-safe style boundary fix.
- `pnpm --filter @letbuyy/ui validate:ui` PASS after the server-safe style boundary fix.
- `pnpm --filter @letbuyy/ui test:visual` PASS after the server-safe style boundary fix: 306 baselines checked.
- `pnpm turbo test` PASS after U6: 61 successful tasks.
- `pnpm turbo typecheck` PASS after U6: 60 successful tasks.
- `pnpm lint` PASS after U6: repo lint completed with existing warnings outside UI scope and 0 errors.
- `pnpm turbo build` PASS after the server-safe style boundary fix under escalated Turbopack permission: 60 successful tasks.
- Generated build/install artifacts from U6 verification were removed with a depth that includes `packages/typescript/ui/dist`.
- `node scripts/validate-governance.mjs` PASS after U6 cleanup; final line: `Governance validation passed (129 validators).`
- `pnpm --filter @letbuyy/ui typecheck` PASS after U7 source changes.
- `pnpm --filter @letbuyy/ui test` PASS after U7: 1 file, 33 tests. Added coverage for Tooltip trigger association/touch reveal, ConfirmDialog custom copy, Toast duration/placement, Pagination page numbers/page-size, Avatar alt, EmptyState custom motifs, formatting helpers, IndexTable `aria-selected`, `dir`, reduced motion, and focus-ring contrast.
- `pnpm --filter @letbuyy/ui snapshot:api:update` PASS after U7: 334 public exports captured.
- `pnpm --filter @letbuyy/ui snapshot:aliases:update` PASS after the intentional focus-ring value change: 109 duplicate-value groups captured.
- `pnpm --filter @letbuyy/ui build` PASS after U7.
- `pnpm --filter @letbuyy/ui validate:ui` PASS after U7: 33 tests, API snapshot, token snapshot, alias snapshot.
- `pnpm --filter @letbuyy/ui test:visual` PASS after U7 under escalated browser permission: 306 baselines checked with no baseline updates and no visual diffs.
- `pnpm turbo test` PASS after U7: 61 successful tasks.
- `pnpm turbo typecheck` PASS after U7: 60 successful tasks.
- `pnpm lint` PASS after U7: repo lint completed with existing warnings outside UI scope and 0 errors.
- `pnpm turbo build` PASS after U7 under escalated Turbopack permission: 60 successful tasks.
- `pnpm --filter @letbuyy/ui typecheck` PASS after the final PageHeader prop deprecation annotations.
- `pnpm --filter @letbuyy/ui validate:ui` PASS after the final PageHeader prop deprecation annotations.
- Generated build/install artifacts from U7 verification were removed with a depth that includes `packages/typescript/ui/dist`.
- `node scripts/validate-governance.mjs` PASS after U7 cleanup; final line: `Governance validation passed (129 validators).`
