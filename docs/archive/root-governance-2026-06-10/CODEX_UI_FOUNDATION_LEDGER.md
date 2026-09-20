# CODEX UI Foundation Ledger

Branch: `stream/letbuyy-ui-foundation`
Worktree: `/private/tmp/letbuyy-ui-foundation`
Branch-point governance baseline: `node scripts/validate-governance.mjs` PASS, `129 validators`, `3043 tracked files scanned` on 2026-06-06.

## TRACEABILITY MATRIX

| # | issue | phase | status | evidence |
|---|---|---|---|---|
| 1 | Modal has no focus trap | U1.2 | DONE | Shared `useFocusTrap` applied to Modal; `pnpm --filter @letbuyy/ui test` PASS: Modal trap test loops Tab inside dialog. |
| 2 | Modal no initial focus on open | U1.2 | DONE | Modal test proves the close button receives initial focus on open; `pnpm --filter @letbuyy/ui test` PASS. |
| 3 | Modal no focus restoration on close | U1.2 | DONE | Modal test proves focus returns to the opener after Escape close; `pnpm --filter @letbuyy/ui test` PASS. |
| 4 | Modal background not inert/aria-hidden | U1.2 | DONE | Modal test proves outside app content receives `inert` and `aria-hidden` while open; `pnpm --filter @letbuyy/ui test` PASS. |
| 5 | Input ID derived from label text | U1.3 | DONE | Input now uses React `useId()` when no explicit `id` is provided; duplicate-label test proves unique generated IDs; `pnpm --filter @letbuyy/ui test` PASS. |
| 6 | Input no aria-describedby/aria-invalid | U1.3 | DONE | Input helper/error IDs are wired into `aria-describedby` and errors set `aria-invalid`; `pnpm --filter @letbuyy/ui test` + axe PASS. |
| 7 | Textarea same label-ID collision | U1.3 | DONE | Textarea now uses React `useId()` when no explicit `id` is provided; duplicate-label test proves unique generated IDs; `pnpm --filter @letbuyy/ui test` PASS. |
| 8 | Textarea no error ARIA wiring | U1.3 | DONE | Textarea helper/error IDs are wired into `aria-describedby` and errors set `aria-invalid`; `pnpm --filter @letbuyy/ui test` + axe PASS. |
| 9 | marketing-site has no DesignSystemRoot | U1.6 | SKIP | [SKIP — NEEDS HUMAN/app stream] App-scope wrapper change recorded in status; this stream cannot edit `apps/marketing-site/**`. |
| 10 | theme auto never follows OS | U1.5 | DONE | Token CSS now emits `@media (prefers-color-scheme: dark)` for `auto`; `pnpm --filter @letbuyy/ui test` asserts the media block exists. |
| 11 | textMuted contrast fails AA | U1.4 | DONE | `--lb-color-text-muted` now resolves to `#6B7280` on light surface; contrast evidence recorded at 4.83:1; `pnpm --filter @letbuyy/ui test` PASS. |
| 12 | brand purple text contrast fails AA | U1.4 | DONE | Added additive `--lb-color-primary-text` and moved text usages to it; contrast evidence recorded at 7.10:1, status text pairs 4.57:1–6.37:1; `pnpm --filter @letbuyy/ui test` PASS. |
| 13 | z-50 overlay collisions | U1.1 | DONE | Added `--lb-z-{base,dropdown,sticky,overlay,modal,toast,tooltip}` and mapped UI overlays to distinct vars; `pnpm --filter @letbuyy/ui validate:ui` PASS. |
| 14 | CommandPalette no focus trap | U1.2 | DONE | Shared `useFocusTrap` applied to CommandPalette; `pnpm --filter @letbuyy/ui test` proves focus remains in the dialog. |
| 15 | CommandPalette no Arrow-key result nav | U1.2 | DONE | CommandPalette results use roving focus with ArrowUp/ArrowDown/Home/End; RTL keyboard test PASS. |
| 16 | zero unit tests | U0 | DONE | `pnpm --filter @letbuyy/ui test` PASS: 10 RTL/jest-axe tests; `pnpm turbo test` PASS: 61 tasks. |
| 17 | raw src distribution/no dist | U0.5 | DONE | `pnpm --filter @letbuyy/ui build` PASS; `dist/` emitted; `main` and `types` remain `./src/index.ts`. |
| 18 | version 0.0.1/no semver/changelog | U8.3 | DONE | `@letbuyy/ui` package version bumped to `0.0.2` and `packages/typescript/ui/CHANGELOG.md` added; `pnpm --filter @letbuyy/ui build` PASS. |
| 19 | duplicate DataTable and IndexTable | U4.1 | DONE | Added new unified `Table` with selection, saved views, chips, bulk actions, sorting, and responsive cards; V1 kept `DataTable`/`IndexTable` exported and deprecated; V2-A5 removed them after app migration. |
| 20 | Table desktop-only | U4.1 | DONE | New `Table` includes mobile card rendering plus desktop table rendering; Storybook visual baseline added; `pnpm --filter @letbuyy/ui test:visual` PASS: 306 baselines. |
| 21 | no Drawer | U3.1 | DONE | Added focus-trapped `Drawer` with side/size variants and dismiss behavior; RTL + axe coverage in `pnpm --filter @letbuyy/ui test` PASS: 20 tests. |
| 22 | no Dropdown/Menu | U3.1 | DONE | Added keyboard-roving `Dropdown` and `DropdownMenu` menu primitives; root `Menu` stays the existing icon export for back-compat; `pnpm turbo typecheck` PASS after collision check. |
| 23 | no Popover | U3.1 | DONE | Added anchored `Popover` with trigger render prop, Escape/outside dismiss, and axe-clean coverage; `pnpm --filter @letbuyy/ui test` PASS. |
| 24 | surface prop inert | U6.1 | DONE | `letbuyySurfaceTokens` and `[data-letbuyy-surface="..."]` selectors now emit identity-default hooks for every surface; RTL test asserts identity defaults and CSS selectors; `pnpm --filter @letbuyy/ui validate:ui` PASS. |
| 25 | no brand override API | U6.2 | DONE | `DesignSystemRoot brand` and `createLetbuyyBrandVariables()` now override primary/focus/CTA CSS variables with default behavior unchanged; RTL test asserts live root variables; brand identity decision recorded as human-gated. |
| 26 | raw button bypass | U8.1 | DONE | Added `packages/typescript/ui/eslint` rule `no-raw-elements` reporting raw `<button>` with `Button` suggestion; `pnpm --filter @letbuyy/ui test:eslint-rules` PASS. |
| 27 | raw input bypass | U8.1 | DONE | Added `no-raw-elements` coverage for raw `<input>` with `Input` suggestion; `pnpm --filter @letbuyy/ui test:eslint-rules` PASS. |
| 28 | hardcoded hex bypass | U8.1 | DONE | Added `no-hardcoded-hex` rule for literals/templates/JSX text; `pnpm --filter @letbuyy/ui test:eslint-rules` PASS. |
| 29 | no breakpoint tokens | U2.1 | DONE | Added `letbuyyBreakpointTokens`, `letbuyyTailwindScreens`, `letbuyyTailwindPreset`, and `--lb-bp-{sm,md,lg,xl}` with current 640/768/1024/1280 values; `pnpm --filter @letbuyy/ui validate:ui` PASS. |
| 30 | no z-index scale | U1.1 | DONE | `letbuyyZIndexTokens` and emitted `--lb-z-*` variables added; `pnpm --filter @letbuyy/ui validate:tokens` PASS with 338 vars. |
| 31 | no Grid/Columns primitive | U3.2 | DONE | Added responsive `Grid` and `Columns` layout primitives with stable gap/column props; `pnpm --filter @letbuyy/ui typecheck` and `test` PASS. |
| 32 | no Container primitive | U3.2 | DONE | Added `Container` with size and padding contracts; covered in U3 layout primitive test; `pnpm --filter @letbuyy/ui test` PASS. |
| 33 | PageHeader raw buttons/anchors | U5.1 | DONE | PageHeader default actions now compose `Button` and keep old classes; RTL test covers primary button and secondary link behavior; `pnpm --filter @letbuyy/ui test:visual` PASS with 306 baselines and zero U5 diffs. |
| 34 | SaveBar raw buttons | U5.1 | DONE | SaveBar save/discard controls now compose `Button` with unchanged classes and callbacks; RTL/axe test PASS; visual regression PASS with 306 baselines. |
| 35 | Table raw controls | U5.1 | DONE | Table saved-view, bulk, sort, select-all, row-select, and mobile Open controls now compose `Button`/`Checkbox`; RTL test covers selection, bulk action, and Open; visual regression PASS with 306 baselines. |
| 36 | Pagination/DensityToggle/mobile Open raw buttons | U5.1 | DONE | Pagination and Table mobile Open now compose `Button`; DensityToggle delegates through SegmentedControl whose options compose `Button`; RTL test covers pagination and visual regression PASS with 306 baselines. |
| 37 | cx lacks tailwind-merge | U6.3 | DONE | `cx()` now delegates conflict resolution to `tailwind-merge` with the same signature; RTL unit test proves `px-*` and `text-*` overrides resolve; `pnpm --filter @letbuyy/ui test` PASS. |
| 38 | Button lacks as/asChild | U3/U5 | DONE | Added additive `Button` `as` and `asChild` support while preserving default button rendering; RTL tests cover anchor and cloned-child paths; `pnpm --filter @letbuyy/ui test` PASS. |
| 39 | token CSS injected per root | U6.4 | DONE | `DesignSystemRoot` now routes token injection through a server-safe client boundary that dedupes nested roots; test asserts one token `<style>` for nested roots; repo `pnpm turbo build` PASS after fixing RSC context compatibility. |
| 40 | no deprecation policy | U8.3 | DONE | `packages/typescript/ui/DEPRECATIONS.md` finalized and deprecated wrappers emit one-time dev warnings; RTL test asserts warnings; `pnpm --filter @letbuyy/ui test` PASS: 35 tests. |
| 41 | no codemods | U8.2 | DONE | Added codemods for tables, text, badge danger, page aliases, and token aliases with fixture dry-run; `pnpm --filter @letbuyy/ui test:codemods` PASS: 6 fixtures. |
| 42 | no CODEOWNERS guidance | U8.4 | DONE | Updated package `AGENTS.md` with UI CODEOWNERS guidance and exact suggested entry; root CODEOWNERS enablement recorded as human-gated. |
| 43 | no eslint rule enforcing DS usage | U8.1 | DONE | Added UI eslint plugin with recommended config for raw elements and hardcoded hex; `pnpm --filter @letbuyy/ui test:eslint-rules` PASS. |
| 44 | no Switch/Toggle | U3.2 | DONE | Added accessible `Switch` with controlled/uncontrolled behavior, role switch, and disabled state; `pnpm --filter @letbuyy/ui test` PASS. |
| 45 | no NumberField | U3.2 | DONE | Added `NumberField` on top of the existing Input a11y contract; U3 form primitive test PASS. |
| 46 | no CI cross-app build gate on UI change | U0 | DONE | Local repo-wide gates PASS: `pnpm turbo typecheck`, `pnpm turbo build`, and `pnpm turbo test`. |
| 47 | Storybook screenshots not CI-gated | U0.3 | DONE | `pnpm --filter @letbuyy/ui test:visual:update` captured 276 baselines; `pnpm --filter @letbuyy/ui test:visual` PASS. |
| 48 | MaterialIconName accepts any string | U4.5 | DONE | Added `StrictMaterialIconName`, `materialIconNames`, `isMaterialIconName()`, and `materialIconName()` while keeping loose `MaterialIconName` compatibility; `pnpm --filter @letbuyy/ui test` PASS. |
| 49 | no theme contract docs | U4/U8 | DONE | Package `AGENTS.md` now documents `DesignSystemRoot` theme/density/surface/brand/dir contract and public `--lb-*` compatibility rules. |
| 50 | no contrast guardrail for custom brand | U4/U8 | DONE | Added `validateLetbuyyBrandContrast()` export and tests for failing/passing custom brand palettes; `pnpm --filter @letbuyy/ui test` PASS. |
| 51 | storefront-runtime empty ui dir | U8.4 | SKIP | [SKIP — NEEDS HUMAN/app stream] Removing `apps/storefront-runtime/src/components/ui` is app-scope and outside this stream's write contract. |
| 52 | exported TS token objects undocumented/internal | U0.4 | DONE | Public API snapshot protects current exports; `pnpm --filter @letbuyy/ui validate:api` PASS and self-test detects simulated export removal. |
| 53 | no bundle-size/API snapshot guard | U0.4 | DONE | API snapshot and token-variable snapshot guards added; `pnpm --filter @letbuyy/ui validate:ui` PASS. |
| 54 | ConfirmDialog hardcoded body copy | U7 | DONE | `ConfirmDialog` now accepts additive `children` for custom body copy while preserving the default warning copy; RTL/axe test PASS in `pnpm --filter @letbuyy/ui test` with 33 tests. |
| 55 | no app-shell Navigation/Sidebar/AppFrame | U3.3 | DONE | Added `Navigation`, `Sidebar`, and `AppFrame` primitives with current route state and shell layout support; `pnpm --filter @letbuyy/ui test` and visual baselines PASS. |
| 56 | inconsistent change-handler conventions | U4/U7 | SKIP | [SKIP — NEEDS HUMAN] Renaming existing handler props is breaking across consumers; record for U8 codemod/human migration. |
| 57 | inconsistent size prop names | U4/U7 | SKIP | [SKIP — NEEDS HUMAN] Canonical size prop migration is breaking; record for U8 codemod/human migration. |
| 58 | helperText vs description duplication | U4/U7 | SKIP | [SKIP — NEEDS HUMAN] Canonical helper/description prop migration is breaking; record for U8 codemod/human migration. |
| 59 | danger vs critical vocab | U4.4 | DONE | V1 normalized `Badge variant="danger"` to `critical`; V2-A5 removed the `danger` variant after app migration. |
| 60 | Text vs Text overlap | U4.2 | DONE | `Text` now covers Text variants; `Text` delegates to `Text`, keeps old output, and is deprecated; RTL test verifies wrapper class/element compatibility. |
| 61 | Page dead alias | U4.3 | DONE | `Page` remains exported and working with `@deprecated` tag pointing to `Page`; removal recorded as human-gated. |
| 62 | PageHeaderActions alias | U4.3 | DONE | `PageHeaderActions` remains exported and working with `@deprecated` tag pointing to `PageHeaderActions`; removal recorded as human-gated. |
| 63 | FilterBar alias | U4.3 | DONE | `FilterBar` remains exported and working with `@deprecated` tag pointing to `FilterBar`; removal recorded as human-gated. |
| 64 | color alias sprawl | U2.3 | DONE | Added `ui-no-new-token-alias-validator.mjs` and `token-aliases.json`; `validate:aliases` PASS with 108 protected duplicate-value groups; alias removal recorded as human-gated. |
| 65 | dual spacing names | U2.4 | DONE | Canonical numeric `--lb-space-*` scale documented in source while named spacing aliases keep emitting; token snapshot PASS with no removals. |
| 66 | dual type scale | U2.4 | DONE | Canonical role-based type variables documented in source while heading aliases keep emitting; token snapshot PASS with no removals. |
| 67 | two shadow systems | U2.2 | DONE | Added `letbuyyShadowTokens`; card shadows now source from that authority while `--lb-component-card-shadow` keeps previous resolved values; visual regression PASS across 276 baselines. |
| 68 | PageHeader redundant props | U7 | DONE | `PageHeaderProps.showBreadcrumb` and `showSectionLabel` are JSDoc-deprecated in favor of `showBreadcrumbs` and `showEyebrow`; behavior remains unchanged; `pnpm --filter @letbuyy/ui validate:ui` PASS. |
| 69 | PageHeader reimplements breadcrumbs | U5.1 | DONE | Breadcrumbs moved to a standalone module and PageHeader now composes it with slash/current-tone compatibility props; RTL test covers PageHeader breadcrumb links; visual regression PASS with 306 baselines. |
| 70 | Pagination minimal | U7.2 | DONE | `Pagination` now has additive page-number and page-size controls with old default rendering unchanged; RTL/axe test proves page and page-size callbacks; `pnpm --filter @letbuyy/ui test` PASS. |
| 71 | formatting exports subpath-only | U7 | DONE | Added dependency-free INR-first `formatCurrency`, `formatNumber`, and `formatDate` from root API plus `@letbuyy/ui/formatting`; API snapshot updated to 334 exports; repo build PASS. |
| 72 | three theme selectors | U6 | DONE | Token CSS now emits compatible selectors for `data-letbuyy-theme`, `data-theme`, and surface-scoped descendants while preserving explicit light/dark and auto behavior; `pnpm --filter @letbuyy/ui validate:ui` PASS. |
| 73 | SpaceScale under-typed | U2/U7 | DONE | Exported `SpaceScale` from layout and extended it to include `8`; `pnpm --filter @letbuyy/ui typecheck` PASS. |
| 74 | hover lift not reduced-motion gated | U7.1 | DONE | Token CSS now emits `@media (prefers-reduced-motion: reduce)` to zero motion duration/hover transform tokens and stop decorative empty-state animations; test asserts block exists. |
| 75 | Table lacks aria-selected | U7.1 | DONE | Desktop `Table` rows now expose `aria-selected` based on selected checkbox state; RTL test asserts selected row state; `pnpm --filter @letbuyy/ui test` PASS. |
| 76 | Combobox preventDefault blur hack | U7 | DONE | Removed option `onMouseDown(event.preventDefault())`; selection still passes keyboard/click tests through normal button activation; `pnpm --filter @letbuyy/ui test` PASS. |
| 77 | Toast duration fixed | U7.1 | DONE | `ToastProvider` and `notify()` now support additive `duration` with default 5000ms unchanged and `null` for persistent toasts; fake-timer RTL test PASS. |
| 78 | Toast placement fixed | U7.1 | DONE | `ToastProvider` and individual toast messages now support additive placements while default top-right remains unchanged; placement RTL test PASS. |
| 79 | no DatePicker | U3.3 | DONE | Added single-date `DatePicker` with label/helper/error a11y wiring; `pnpm --filter @letbuyy/ui test` PASS. |
| 80 | no Accordion/Disclosure | U3.3 | DONE | Added `Disclosure` and multi-item `Accordion` with button/region wiring; `pnpm --filter @letbuyy/ui test` PASS. |
| 81 | statusSoft light values hardcoded | U2.2 | DONE | Added exact primitive soft-status colors and pointed light `statusSoft` to them with unchanged emitted soft values; `pnpm --filter @letbuyy/ui validate:tokens` PASS with 349 vars. |
| 82 | visual preview helpers shipped in main bundle | U8.4 | DONE | Added canonical `@letbuyy/ui/preview` subpath and moved implementations to preview helpers; root preview exports now deprecated wrappers for back-compat; `pnpm --filter @letbuyy/ui validate:ui` PASS. |
| 83 | Tooltip not associated to trigger | U7.1 | DONE | `Tooltip` now assigns an ID and clones valid triggers with merged `aria-describedby`; RTL/axe test PASS. |
| 84 | Tooltip hover-only | U7.1 | DONE | `Tooltip` now toggles visibility for non-mouse pointer activation while retaining hover/focus behavior; RTL touch reveal test PASS. |
| 85 | Badge provenance confusing | U4.4 | DONE | Canonical `Badge` remains sourced from `feedback`; `data-table` re-export preserved for back-compat and canonical vocabulary documented; `pnpm --filter @letbuyy/ui validate:ui` PASS. |
| 86 | PageIdentity parallels EmptyStateKind | U7/U8 | DONE | Added exported `letbuyyPageIdentityIcons`, `letbuyyPageIdentityOptions`, and `PageIdentityOption`; API snapshot updated to 340 exports. |
| 87 | getPageIconName brittle regex | U7/U8 | DONE | Added exported `resolvePageIdentity()` so consumers can use stable identity resolution while `getPageIconName()` remains back-compatible; RTL unit test PASS. |
| 88 | no RTL/dir consideration | U7.1 | DONE | `DesignSystemRoot` now accepts additive `dir` and forwards it to the root; RTL test asserts `dir="rtl"` propagation. |
| 89 | focusRing contrast weak | U7.1 | DONE | Light `--lb-color-focus-ring` now uses `#5B21B6`; test asserts >=3:1 contrast on light surface; alias snapshot refreshed for the intentional focus-ring value change. |
| 90 | Select native limits option content | U7/U8 | SKIP | [SKIP — NEEDS HUMAN] Replacing native `Select` with rich custom listbox is a larger a11y/API decision; current guidance remains to use `Combobox` for rich option content. |
| 91 | ChoiceList min-width can overflow | U7 | DONE | ChoiceList option cards now use `min-w-0 max-w-full basis-[min(260px,100%)]` instead of a hard minimum; `pnpm --filter @letbuyy/ui typecheck` PASS. |
| 92 | no InlineError | U3.3 | DONE | Added `InlineError` with `role="alert"` and exported props; U3 form primitive test PASS. |
| 93 | DensityToggle not general SegmentedControl | U3.2 | DONE | Added `SegmentedControl`; existing `DensityToggle` now delegates to it without public prop changes; RTL test PASS. |
| 94 | Avatar alt always empty | U7.1 | DONE | `Avatar` now accepts optional `alt` for image avatars while preserving decorative image behavior by default; RTL/axe test PASS. |
| 95 | no Storybook do/don't usage docs | U8.4 | DONE | Added `governance.stories.tsx` with UI usage do/don't guidance; visual baseline updated and diff checked: 312 baselines PASS. |
| 96 | Modal backdrop is full-screen button | U7.1 | DONE | Modal backdrop is now a non-focusable `div` with `aria-hidden`, while the labelled close button remains; RTL test asserts no `Close modal` backdrop button; axe PASS. |
| 97 | Chart hand-rolled SVG | U7 | SKIP | [SKIP — NEEDS HUMAN] Replacing Chart with a proven charting library needs dependency/API/bundle decision; no new chart dependency added in this UI-only stream. |
| 98 | EmptyState motifs hardcoded | U7.2 | DONE | `EmptyState`/`EmptyStateIllustration` now accept additive per-kind custom motif overrides behind the current default motif set; RTL/axe test PASS. |
| 99 | sharedCssVariables seeds compact density only | U7 | SKIP | [SKIP — NEEDS HUMAN] Changing the root default density away from compact is a visual contract decision for all unwrapped consumers; existing explicit density selectors remain. |
| 100 | no inert support/polyfill note | U7.2 | DONE | `overlay-hooks.ts` now documents that UI overlay isolation uses platform `inert` and requires a polyfill for unsupported browsers; source note added next to implementation. |

## SKIPPED — NEEDS HUMAN

- [SKIP — NEEDS HUMAN] Issue #17 follow-up: repoint `@letbuyy/ui` `main`/`types` from `./src/index.ts` to `./dist/index.js` and `./dist/index.d.ts` only after the parallel app/service hardening stream has landed and consumers have been rechecked. Exact local decision/command: update `packages/typescript/ui/package.json` entrypoints, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issue #9 app-scope fix: wrap `apps/marketing-site` in `DesignSystemRoot` so UI tokens are present. Exact handoff: app stream updates the marketing-site root layout with `<DesignSystemRoot surface="storefront" theme="auto">{children}</DesignSystemRoot>`, then runs `pnpm --filter @letbuyy/marketing-site typecheck`, `pnpm --filter @letbuyy/marketing-site build`, `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issues #64, #65, #66 follow-up: collapse existing duplicate token aliases only after cross-app codemods and visual verification are coordinated. Exact handoff: run the U8 token-alias codemod across app/service consumers, remove deprecated aliases in `packages/typescript/ui/src/tokens.ts`, update snapshots with `pnpm --filter @letbuyy/ui snapshot:tokens:update` and `pnpm --filter @letbuyy/ui snapshot:aliases:update`, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issue #22 optional root `Menu` component alias: `Menu` is already a public icon export and is consumed by apps through `@letbuyy/ui`. This stream shipped the menu primitive as `Dropdown`/`DropdownMenu`; exposing a root component named `Menu` requires coordinated icon rename/import migration first. Exact handoff: choose the public symbol strategy, run a codemod for existing `Menu` icon imports if needed, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issues #19, #20, #59, #60, #61, #62, #63, #85 follow-up: remove deprecated duplicate/alias surfaces only after U8 codemods are authored and app/service migrations are coordinated. Exact handoff: run the table, text, badge, and page-alias codemods across consumers, remove deprecated exports in `packages/typescript/ui`, refresh the API snapshot, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issue #48 follow-up: remove loose arbitrary `MaterialIconName` strings only after auditing unknown icon names. Exact handoff: replace user-provided strings with `isMaterialIconName()` guards or strict `materialIconName()` calls, remove `LooseMaterialIconName`, refresh the API snapshot, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issue #24 follow-up: choose non-identity per-surface palettes for admin, marketplace, storefront, identity, and operations. This stream added the surface hooks with identity defaults only. Exact handoff: update `letbuyySurfaceTokens` in `packages/typescript/ui/src/tokens.ts`, refresh token/visual snapshots, then run `pnpm --filter @letbuyy/ui validate:ui`, `pnpm --filter @letbuyy/ui test:visual`, `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issue #25 follow-up: decide the LetBuyy brand identity ramp and light CTA contrast policy before making non-default brand values canonical. This stream added runtime brand plumbing without changing default purple. Exact handoff: pass the approved `brand` override or change token defaults, verify brand contrast, refresh snapshots, then run `pnpm --filter @letbuyy/ui validate:ui`, `pnpm --filter @letbuyy/ui test:visual`, `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issues #56, #57, #58 follow-up: canonicalize legacy prop grammar (`onChange`/`onValueChange`, `size`/`controlSize`, `helperText`/`description`) only with a codemod and consumer migration plan. Exact handoff: author/run U8 codemods across consumers, add deprecation warnings where applicable, refresh API snapshots, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issue #90 follow-up: decide whether `Select` should remain native-only with `Combobox` for rich options, or gain a custom listbox implementation. Exact handoff: choose the primitive strategy, implement behind additive props or a new component, then run `pnpm --filter @letbuyy/ui test`, `pnpm --filter @letbuyy/ui test:visual`, `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issue #97 follow-up: choose a proven charting library and bundle policy before replacing the current SVG `Chart`. Exact handoff: add the approved dependency to `@letbuyy/ui`, preserve the current `Chart` API through a shim or codemod, refresh visual snapshots, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issue #99 follow-up: changing root/default density from compact would change visual output for unwrapped consumers. Exact handoff: choose the default-density policy, update `sharedCssVariables`/density selectors, refresh visual snapshots, then run `pnpm --filter @letbuyy/ui test:visual`, `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issues #26, #27, #28, #43 follow-up: enable the UI eslint plugin in app/service lint configs after the parallel app stream lands. Exact handoff: add `packages/typescript/ui/eslint` as the configured `@letbuyy/ui` plugin, enable `@letbuyy/ui/no-raw-elements` and `@letbuyy/ui/no-hardcoded-hex`, then run `pnpm lint`, `pnpm turbo typecheck`, `pnpm turbo build`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issue #41 follow-up: run codemods across `apps/**`, `services/**`, and non-UI packages only after coordination with the parallel stream. Exact handoff: run the needed transforms in `packages/typescript/ui/codemods`, inspect every diff, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issues #18, #40 follow-up: cut `@letbuyy/ui` 1.0 only after deprecated exports have a human-approved removal plan and consumers are migrated. Exact handoff: update package version/entrypoints, remove migrated shims, refresh snapshots, then run all final gates.
- [SKIP — NEEDS HUMAN] Issue #42 follow-up: add the package CODEOWNERS entry to the root `CODEOWNERS` file after parallel streams merge. Exact entry candidate: `packages/typescript/ui/** @letbuyy/design-system-maintainers`.
- [SKIP — NEEDS HUMAN] Issue #51 follow-up: remove `apps/storefront-runtime/src/components/ui` in the app stream if it remains empty. Exact handoff: delete that app-scope directory, then run storefront typecheck/build, repo typecheck/build/lint, and governance validation.
- [SKIP — NEEDS HUMAN] Repository intelligence follow-up: `scripts/generate-repository-intelligence.mjs` rewrites root docs, app AGENTS, service AGENTS, and non-UI package files, so this stream did not run it under the parallel isolation contract. Exact handoff after streams merge: run `node scripts/generate-repository-intelligence.mjs`, review generated root/docs/app/package changes, then run `node scripts/validate-governance.mjs`.

## NEW PUBLIC API

- No new runtime component exports in U0.
- New package scripts: `test`, `test:visual`, `test:visual:update`, `test:watch`, `snapshot:api:update`, `snapshot:tokens:update`, `validate:api`, `validate:tokens`, `validate:ui`.
- New export: `letbuyyZIndexTokens`.
- New public CSS variables: `--lb-z-base`, `--lb-z-dropdown`, `--lb-z-sticky`, `--lb-z-overlay`, `--lb-z-modal`, `--lb-z-toast`, `--lb-z-tooltip`, `--lb-color-primary-text`.
- New exports: `letbuyyBreakpointTokens`, `letbuyyTailwindScreens`, `letbuyyTailwindPreset`, `letbuyyShadowTokens`.
- New public CSS variables: `--lb-bp-sm`, `--lb-bp-md`, `--lb-bp-lg`, `--lb-bp-xl`, `--lb-shadow-card`, `--lb-shadow-card-light`, `--lb-shadow-card-dark`, `--lb-primitive-color-green-100`, `--lb-primitive-color-amber-100`, `--lb-primitive-color-red-100`, `--lb-primitive-color-blue-100`.
- New package scripts: `snapshot:aliases:update`, `validate:aliases`.
- New exports: `Drawer`, `Dropdown`, `DropdownMenu`, `Popover`, `Grid`, `Columns`, `Container`, `InlineError`, `NumberField`, `Switch`, `AppFrame`, `Navigation`, `Sidebar`, `Accordion`, `DatePicker`, `Disclosure`, `SegmentedControl`.
- New exported types: `DrawerProps`, `DropdownItem`, `DropdownProps`, `OverlayTrigger`, `OverlayTriggerProps`, `PopoverProps`, `GridProps`, `ColumnsProps`, `ContainerProps`, `SpaceScale`, `InlineErrorProps`, `NumberFieldProps`, `SwitchProps`, `AppFrameProps`, `NavigationItem`, `NavigationProps`, `SidebarProps`, `AccordionItem`, `AccordionProps`, `DatePickerProps`, `DisclosureProps`, `SegmentedControlOption`, `SegmentedControlProps`.
- New additive `Button` props: `as`, `asChild`, `href`, `target`, `rel`.
- New exports: `Table`, `materialIconName`, `isMaterialIconName`, `materialIconNames`.
- New exported types: `TableBulkAction`, `TableColumn`, `TableFilterChip`, `TableProps`, `TableSavedView`, `StrictMaterialIconName`, `LooseMaterialIconName`.
- New additive `Text` variants: `subdued`, `strong`, `positive`, `negative`, `code`; new additive `Text` tones: `positive`, `negative`; new additive `Text` prop: `reset`.
- New additive `Button` prop: `unstyled` for look-preserving internal composition.
- New additive `Checkbox` prop: `unstyled` for look-preserving internal checkbox composition.
- New additive `Breadcrumbs` props: `separator`, `currentTone`.
- New exports: `letbuyySurfaceTokens`, `createLetbuyyBrandVariables`.
- New exported types: `LetbuyySurface`, `LetbuyyBrandInput`, `LetbuyyBrandOverrides`.
- New additive `DesignSystemRoot` props: `brand`, `style`; `surface` is now typed through `LetbuyySurface` while retaining the same accepted values.
- New additive `DesignSystemRoot` prop: `dir`.
- New exports: `formatCurrency`, `formatDate`, `formatNumber`.
- New exported types: `FormatCurrencyOptions`, `FormatDateOptions`, `FormatNumberOptions`.
- New subpath export: `@letbuyy/ui/formatting`.
- New exported types: `ToastPlacement`, `EmptyStateIllustrationProps`.
- New additive `ToastProvider` props: `duration`, `placement`; new additive `ToastMessage` fields: `duration`, `placement`.
- New additive `Pagination` props: `showPageNumbers`, `maxPageButtons`, `pageSize`, `pageSizeOptions`, `onPageSizeChange`, `pageSizeLabel`.
- New additive `Avatar` prop: `alt`; new additive `ConfirmDialog` prop: `children`; new additive `Tooltip` prop: `id`; new additive `EmptyState` prop: `illustrationMotifs`.
- New exports: `letbuyyPageIdentityIcons`, `letbuyyPageIdentityOptions`, `resolvePageIdentity`, `validateLetbuyyBrandContrast`.
- New exported types: `PageIdentityOption`, `LetbuyyBrandContrastCheck`.
- New subpath export: `@letbuyy/ui/preview`.
- New package scripts: `test:eslint-rules`, `test:codemods`.
- New UI governance artifacts: `packages/typescript/ui/eslint`, `packages/typescript/ui/codemods`, `packages/typescript/ui/CHANGELOG.md`, `packages/typescript/ui/src/governance.stories.tsx`.

## DEPRECATIONS

| Symbol | Since | Replacement | Codemod | Removal |
|---|---|---|---|---|
| `DataTable` | `0.0.2` | `Table` | `packages/typescript/ui/codemods/data-table-to-table.cjs` | Removed in V2-A5 for the 1.0 line after app migration |
| `IndexTable` | `0.0.2` | `Table` | `packages/typescript/ui/codemods/index-table-to-table.cjs` | Removed in V2-A5 for the 1.0 line after app migration |
| `TextStyle` | `0.0.2` | `Text` | `packages/typescript/ui/codemods/text-style-to-text.cjs` | Removed in V2-A5 for the 1.0 line after app migration |
| `PageShell` | `0.0.2` | `Page` | `packages/typescript/ui/codemods/page-aliases-to-canonical.cjs` | Removed in V2-A5 for the 1.0 line after app migration |
| `PageActions` | `0.0.2` | `PageHeaderActions` | `packages/typescript/ui/codemods/page-aliases-to-canonical.cjs` | Removed in V2-A5 for the 1.0 line after app migration |
| `TableFilterBar` | `0.0.2` | `FilterBar` | `packages/typescript/ui/codemods/page-aliases-to-canonical.cjs` | Removed in V2-A5 for the 1.0 line after app migration |
| `Badge variant="danger"` | `0.0.2` | `Badge variant="critical"` | `packages/typescript/ui/codemods/badge-danger-to-critical.cjs` | Removed in V2-A5 for the 1.0 line after app migration |
| `LooseMaterialIconName` / arbitrary icon-name strings | `0.0.2` | `StrictMaterialIconName`, `materialIconName()`, `isMaterialIconName()` | Not planned; human review needed for unknown icon names | SKIP - breaking, needs icon-name audit |
| Root preview helpers (`ColorSwatch`, `ColorPreviewBlock`, `ColorPreviewSurface`, `ColorPreviewButton`, `RadiusPreview`) | `0.0.2` | `@letbuyy/ui/preview` | Not needed; import-source migration only | SKIP - breaking, needs cross-app migration |

## VISUAL-REGRESSION BASELINES

- Baseline captured 2026-06-06 with `pnpm --filter @letbuyy/ui test:visual:update`.
- U0/U1/U2 scope: every Storybook story in `packages/typescript/ui/src/**/*.stories.tsx`, 2 themes (`light`, `dark`) x 3 densities (`compact`, `comfortable`, `spacious`), 276 PNG baselines under `packages/typescript/ui/storybook-screenshots/baseline/`.
- U3 baseline expansion: `foundation-primitives.stories.tsx` added 24 primitive screenshots; `pnpm --filter @letbuyy/ui test:visual:update` captured 300 baselines total.
- U4 baseline expansion: `table.stories.tsx` added 6 table screenshots; `pnpm --filter @letbuyy/ui test:visual:update` captured 306 baselines total.
- Verification: `pnpm --filter @letbuyy/ui test:visual` PASS with 306 baselines checked.
- U5 verification: `pnpm --filter @letbuyy/ui test:visual` PASS with 306 baselines checked and no baseline updates, proving the internal composition refactor is visually unchanged.
- U6 verification: `pnpm --filter @letbuyy/ui test:visual` PASS with 306 baselines checked and no baseline updates, proving surface/brand/style-dedupe changes preserve default visuals.
- U7 verification: `pnpm --filter @letbuyy/ui test:visual` PASS with 306 baselines checked and no baseline updates, proving default visual states remain stable after additive polish fixes.
- U8 baseline expansion: `governance.stories.tsx` added 6 governance-doc screenshots; `pnpm --filter @letbuyy/ui test:visual:update` captured 312 baselines total.
- U8 verification: `pnpm --filter @letbuyy/ui test:visual` PASS with 312 baselines checked.

## VALIDATOR LEDGER

- `packages/typescript/ui/tests/validators/ui-public-api-snapshot-validator.mjs`: snapshots all public exports from `src/index.ts`; `validate:api` PASS; `--self-test` PASS by detecting simulated removal of `Activity`.
- `packages/typescript/ui/tests/validators/ui-token-variable-snapshot-validator.mjs`: snapshots all emitted `--lb-*` variables; `validate:tokens` PASS; `--self-test` PASS by detecting simulated removal of `--lb-card-bg`.
- `packages/typescript/ui/tests/validators/ui-no-new-token-alias-validator.mjs`: snapshots current duplicate-value `--lb-*` alias groups and fails on new alias growth; `validate:aliases` PASS; `--self-test` PASS by detecting simulated `--lb-self-test-new-alias`.
- U7 focus-ring correctness intentionally refreshed `token-aliases.json`; `validate:aliases` PASS with 109 protected duplicate-value groups and no removed public variables.
- `packages/typescript/ui/eslint/index.cjs`: UI eslint plugin with `no-raw-elements` and `no-hardcoded-hex`; `pnpm --filter @letbuyy/ui test:eslint-rules` PASS.
- `packages/typescript/ui/codemods/*.cjs`: migration codemods for table consolidation, text merge, badge vocabulary, page aliases, and token aliases; `pnpm --filter @letbuyy/ui test:codemods` PASS with 6 fixtures.

## BLOCKED

- V2 dirty-tree lint blocker: untracked `apps/storefront-runtime/src/app/api/store-access/password/route.ts` fails `letbuyy-boundaries/no-new-next-api-route` during `pnpm lint`. The API gateway already contains `/v1/internal/store-access/verify`, and storefront middleware contains gate-cookie helpers, but removing/moving this untracked route would take over separate domain/access work. Evidence: `pnpm lint` fails only on this error; `pnpm --filter @letbuyy/storefront-runtime exec eslint --ignore-pattern 'src/app/api/store-access/password/route.ts'` PASS with 0 errors / 24 existing warnings. Disposition: BLOCKED until the domain/access stream removes, relocates, or authorizes the app-route exception.

## V2

### Baseline

- Branch: `stream/letbuyy-ui-v2`.
- Merge preconditions: `stream/letbuyy-foundation-v2` and `stream/letbuyy-ui-foundation` are ancestors of `develop`; `git merge-base --is-ancestor` passed for both before V2 work began.
- Governance baseline: `node scripts/validate-governance.mjs` passed on 2026-06-06 with `Governance validation passed (157 validators)`.
- Merge reconciliation evidence: `develop` contains the broad merge (`ac3c7fda`), broad governance follow-up (`aed02212`), and UI foundation merge (`aef1d3ab`) with the formatter union preserved.

### V2 Traceability Matrix

| ID | issue / capability | stream | status | evidence |
|---|---|---|---|---|
| V2-A1 | Brand purple primary CTA, AA contrast, visual diff | A | DONE | `pnpm --filter @letbuyy/ui test` PASS (36 tests); `pnpm --filter @letbuyy/ui validate:ui` PASS (340 exports, 349 vars, 109 alias groups); `pnpm --filter @letbuyy/ui build` PASS; `pnpm --filter @letbuyy/ui test:visual:update` PASS (312 real baselines captured after HTTP harness fix); `pnpm --filter @letbuyy/ui test:visual` PASS (312 baselines checked); contact sheet: `packages/typescript/ui/storybook-screenshots/v2-a1-primary-button-before-after.png`; white text contrast after A1: normal `#6D28D9` = 7.10:1, hover `#5B21B6` = 8.98:1, active `#4C1D95` = 10.95:1. |
| V2-A2 | Run V1 codemods across all consumers | A | DONE | App migrations committed app-by-app: `fd5914e3 refactor(platform-console): adopt unified ui table`, `cf878e95 refactor(platform-operations-portal): adopt unified ui table`, `0d3e6e0d refactor(merchant-control-plane): adopt unified ui table`; supporting UI API fix: `5c10c4e6 fix(ui): relax table row typing`. Evidence: `pnpm --filter @letbuyy/platform-console typecheck` PASS, `pnpm --filter @letbuyy/platform-console lint` PASS, `pnpm --filter @letbuyy/platform-console build` PASS under escalated Turbopack permissions; `pnpm --filter @letbuyy/platform-operations-portal typecheck` PASS, `lint` PASS, `build` PASS under escalation; `pnpm --filter @letbuyy/merchant-control-plane typecheck` PASS, `lint` PASS with 0 errors / 6 pre-existing warnings, `build` PASS under escalation. Repo scan after migrations: no exact `DataTable`/`IndexTable`/`TextStyle`/`PageShell`/`PageActions`/`TableFilterBar`/`Badge variant="danger"` matches in `apps/**/*.ts(x)`; token-alias scan returned 0 matches. |
| V2-A3 | Enable UI eslint fence and migrate raw element / hardcoded hex bypass | A | DONE | UI eslint rules enabled at `error` in all nine web app lint configs; raw JSX element scan returned 0 matches; app TS/TSX/CSS/SCSS hex scan returned 0 matches; `pnpm --filter @letbuyy/ui validate:ui` PASS; `pnpm turbo typecheck` PASS (59 tasks). `pnpm lint` is blocked only by untracked dirty-tree `apps/storefront-runtime/src/app/api/store-access/password/route.ts` route-boundary error; excluding that untracked file, storefront eslint PASS with 0 errors / 24 existing warnings. |
| V2-A4 | Wrap marketing-site in `DesignSystemRoot` | A | DONE | `apps/marketing-site/src/app/layout.tsx` wraps the existing `ThemeProvider` in `<DesignSystemRoot surface="storefront" theme="auto">`; `pnpm --filter @letbuyy/marketing-site typecheck` PASS; `pnpm --filter @letbuyy/marketing-site lint` PASS with 0 errors / 1 existing warning; `env NEXT_PUBLIC_MARKETING_URL=https://letbuyy.com pnpm --filter @letbuyy/marketing-site build` PASS under escalated Turbopack permissions. |
| V2-A5 | Remove deprecated duplicate exports and collapse token aliases after migration | A | DONE | Removed root exports/source shims for `DataTable`, `IndexTable`, `TextStyle`, `PageShell`, `PageActions`, `TableFilterBar`, root preview helpers, and `Badge variant="danger"`; deleted unexported legacy `data-table.tsx` and `visual.tsx`; removed deprecated token aliases from emitted token variables; refreshed snapshots (`337` public exports, `338` token vars, `109` alias groups); `pnpm --filter @letbuyy/ui validate:ui` PASS; `pnpm --filter @letbuyy/ui build` PASS; `pnpm turbo typecheck` PASS (59 tasks); precise app/source/snapshot scans returned 0 removed-symbol and removed-alias matches; `apps/storefront-runtime/src/components/ui` is absent. |
| V2-A6 | Distribute from `dist`, fold UI validators into root governance, CODEOWNERS, CI gates, `@letbuyy/ui@1.0.0` | A | TODO | |
| V2-B1 | Multi-brand white-label surfaces and contrast guardrails | B | TODO | |
| V2-B2 | RTL/bidi and locale-aware i18n / multi-currency formatting | B | TODO | |
| V2-B3 | Form system | B | TODO | |
| V2-B4 | Charting library-backed `Chart` with legacy API shim | B | TODO | |
| V2-B5 | Table virtualization | B | TODO | |
| V2-B6 | Hosted / published docs site or static deploy-ready Storybook | B | TODO | |
| V2-B7 | Capacity primitives: Stepper/Wizard, FileUpload/Dropzone, Calendar/date-range, Tag input, Toast actions | B | TODO | |

### V2 Merge Runbook Evidence

- `stream/letbuyy-foundation-v2` was merged and pushed to `develop` before UI V1.
- `stream/letbuyy-ui-foundation` was merged and pushed to `develop` with `formatting.ts`, `index.ts`, and package subpath exports unioned.
- `pnpm --filter @letbuyy/ui validate:ui`, `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs` passed after the UI merge.

### V2 Visual Evidence

- V2-A1 fixed the Storybook visual harness to serve the static build over local HTTP instead of `file://`; the previous file URL silently CORS-blocked Storybook modules and produced blank baselines.
- V2-A1 added animation-disabling, font readiness, pixel-based comparison tolerance, and Storybook error-page detection to the visual harness.
- V2-A1 corrected `foundation-primitives.stories.tsx` so the app-shell story renders a supported `Badge` variant instead of Storybook's error page.
- V2-A1 contact sheet: `packages/typescript/ui/storybook-screenshots/v2-a1-primary-button-before-after.png`.
