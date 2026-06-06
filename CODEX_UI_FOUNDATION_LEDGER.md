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
| 18 | version 0.0.1/no semver/changelog | U8.3 | TODO |  |
| 19 | duplicate DataTable and IndexTable | U4.1 | DONE | Added new unified `Table` with selection, saved views, chips, bulk actions, sorting, and responsive cards; kept `DataTable`/`IndexTable` exported and deprecated; `pnpm --filter @letbuyy/ui test` PASS: 23 tests. |
| 20 | DataTable desktop-only | U4.1 | DONE | New `Table` includes mobile card rendering plus desktop table rendering; Storybook visual baseline added; `pnpm --filter @letbuyy/ui test:visual` PASS: 306 baselines. |
| 21 | no Drawer | U3.1 | DONE | Added focus-trapped `Drawer` with side/size variants and dismiss behavior; RTL + axe coverage in `pnpm --filter @letbuyy/ui test` PASS: 20 tests. |
| 22 | no Dropdown/Menu | U3.1 | DONE | Added keyboard-roving `Dropdown` and `DropdownMenu` menu primitives; root `Menu` stays the existing icon export for back-compat; `pnpm turbo typecheck` PASS after collision check. |
| 23 | no Popover | U3.1 | DONE | Added anchored `Popover` with trigger render prop, Escape/outside dismiss, and axe-clean coverage; `pnpm --filter @letbuyy/ui test` PASS. |
| 24 | surface prop inert | U6.1 | TODO |  |
| 25 | no brand override API | U6.2 | TODO |  |
| 26 | raw button bypass | U8.1 | TODO |  |
| 27 | raw input bypass | U8.1 | TODO |  |
| 28 | hardcoded hex bypass | U8.1 | TODO |  |
| 29 | no breakpoint tokens | U2.1 | DONE | Added `letbuyyBreakpointTokens`, `letbuyyTailwindScreens`, `letbuyyTailwindPreset`, and `--lb-bp-{sm,md,lg,xl}` with current 640/768/1024/1280 values; `pnpm --filter @letbuyy/ui validate:ui` PASS. |
| 30 | no z-index scale | U1.1 | DONE | `letbuyyZIndexTokens` and emitted `--lb-z-*` variables added; `pnpm --filter @letbuyy/ui validate:tokens` PASS with 338 vars. |
| 31 | no Grid/Columns primitive | U3.2 | DONE | Added responsive `Grid` and `Columns` layout primitives with stable gap/column props; `pnpm --filter @letbuyy/ui typecheck` and `test` PASS. |
| 32 | no Container primitive | U3.2 | DONE | Added `Container` with size and padding contracts; covered in U3 layout primitive test; `pnpm --filter @letbuyy/ui test` PASS. |
| 33 | PageHeader raw buttons/anchors | U5.1 | TODO |  |
| 34 | SaveBar raw buttons | U5.1 | TODO |  |
| 35 | IndexTable raw controls | U5.1 | TODO |  |
| 36 | Pagination/DensityToggle/mobile Open raw buttons | U5.1 | TODO |  |
| 37 | cx lacks tailwind-merge | U6.3 | TODO |  |
| 38 | Button lacks as/asChild | U3/U5 | DONE | Added additive `Button` `as` and `asChild` support while preserving default button rendering; RTL tests cover anchor and cloned-child paths; `pnpm --filter @letbuyy/ui test` PASS. |
| 39 | token CSS injected per root | U6.4 | TODO |  |
| 40 | no deprecation policy | U8.3 | TODO |  |
| 41 | no codemods | U8.2 | TODO |  |
| 42 | no CODEOWNERS guidance | U8.4 | TODO |  |
| 43 | no eslint rule enforcing DS usage | U8.1 | TODO |  |
| 44 | no Switch/Toggle | U3.2 | DONE | Added accessible `Switch` with controlled/uncontrolled behavior, role switch, and disabled state; `pnpm --filter @letbuyy/ui test` PASS. |
| 45 | no NumberField | U3.2 | DONE | Added `NumberField` on top of the existing Input a11y contract; U3 form primitive test PASS. |
| 46 | no CI cross-app build gate on UI change | U0 | DONE | Local repo-wide gates PASS: `pnpm turbo typecheck`, `pnpm turbo build`, and `pnpm turbo test`. |
| 47 | Storybook screenshots not CI-gated | U0.3 | DONE | `pnpm --filter @letbuyy/ui test:visual:update` captured 276 baselines; `pnpm --filter @letbuyy/ui test:visual` PASS. |
| 48 | MaterialIconName accepts any string | U4.5 | DONE | Added `StrictMaterialIconName`, `materialIconNames`, `isMaterialIconName()`, and `materialIconName()` while keeping loose `MaterialIconName` compatibility; `pnpm --filter @letbuyy/ui test` PASS. |
| 49 | no theme contract docs | U4/U8 | TODO |  |
| 50 | no contrast guardrail for custom brand | U4/U8 | TODO |  |
| 51 | storefront-runtime empty ui dir | U8.4 | TODO |  |
| 52 | exported TS token objects undocumented/internal | U0.4 | DONE | Public API snapshot protects current exports; `pnpm --filter @letbuyy/ui validate:api` PASS and self-test detects simulated export removal. |
| 53 | no bundle-size/API snapshot guard | U0.4 | DONE | API snapshot and token-variable snapshot guards added; `pnpm --filter @letbuyy/ui validate:ui` PASS. |
| 54 | ConfirmDialog hardcoded body copy | U7 | TODO |  |
| 55 | no app-shell Navigation/Sidebar/AppFrame | U3.3 | DONE | Added `Navigation`, `Sidebar`, and `AppFrame` primitives with current route state and shell layout support; `pnpm --filter @letbuyy/ui test` and visual baselines PASS. |
| 56 | inconsistent change-handler conventions | U4/U7 | TODO |  |
| 57 | inconsistent size prop names | U4/U7 | TODO |  |
| 58 | helperText vs description duplication | U4/U7 | TODO |  |
| 59 | danger vs critical vocab | U4.4 | DONE | `Badge variant="danger"` still normalizes to `critical`; canonical `critical` vocabulary documented in `BadgeProps` and `DEPRECATIONS.md`; RTL/axe test PASS. |
| 60 | Text vs TextStyle overlap | U4.2 | DONE | `Text` now covers TextStyle variants; `TextStyle` delegates to `Text`, keeps old output, and is deprecated; RTL test verifies wrapper class/element compatibility. |
| 61 | PageShell dead alias | U4.3 | DONE | `PageShell` remains exported and working with `@deprecated` tag pointing to `Page`; removal recorded as human-gated. |
| 62 | PageActions alias | U4.3 | DONE | `PageActions` remains exported and working with `@deprecated` tag pointing to `PageHeaderActions`; removal recorded as human-gated. |
| 63 | TableFilterBar alias | U4.3 | DONE | `TableFilterBar` remains exported and working with `@deprecated` tag pointing to `FilterBar`; removal recorded as human-gated. |
| 64 | color alias sprawl | U2.3 | DONE | Added `ui-no-new-token-alias-validator.mjs` and `token-aliases.json`; `validate:aliases` PASS with 108 protected duplicate-value groups; alias removal recorded as human-gated. |
| 65 | dual spacing names | U2.4 | DONE | Canonical numeric `--lb-space-*` scale documented in source while named spacing aliases keep emitting; token snapshot PASS with no removals. |
| 66 | dual type scale | U2.4 | DONE | Canonical role-based type variables documented in source while heading aliases keep emitting; token snapshot PASS with no removals. |
| 67 | two shadow systems | U2.2 | DONE | Added `letbuyyShadowTokens`; card shadows now source from that authority while `--lb-component-card-shadow` keeps previous resolved values; visual regression PASS across 276 baselines. |
| 68 | PageHeader redundant props | U7 | TODO |  |
| 69 | PageHeader reimplements breadcrumbs | U5.1 | TODO |  |
| 70 | Pagination minimal | U7.2 | TODO |  |
| 71 | formatting exports subpath-only | U7 | TODO |  |
| 72 | three theme selectors | U6 | TODO |  |
| 73 | SpaceScale under-typed | U2/U7 | DONE | Exported `SpaceScale` from layout and extended it to include `8`; `pnpm --filter @letbuyy/ui typecheck` PASS. |
| 74 | hover lift not reduced-motion gated | U7.1 | TODO |  |
| 75 | IndexTable lacks aria-selected | U7.1 | TODO |  |
| 76 | Combobox preventDefault blur hack | U7 | TODO |  |
| 77 | Toast duration fixed | U7.1 | TODO |  |
| 78 | Toast placement fixed | U7.1 | TODO |  |
| 79 | no DatePicker | U3.3 | DONE | Added single-date `DatePicker` with label/helper/error a11y wiring; `pnpm --filter @letbuyy/ui test` PASS. |
| 80 | no Accordion/Disclosure | U3.3 | DONE | Added `Disclosure` and multi-item `Accordion` with button/region wiring; `pnpm --filter @letbuyy/ui test` PASS. |
| 81 | statusSoft light values hardcoded | U2.2 | DONE | Added exact primitive soft-status colors and pointed light `statusSoft` to them with unchanged emitted soft values; `pnpm --filter @letbuyy/ui validate:tokens` PASS with 349 vars. |
| 82 | visual preview helpers shipped in main bundle | U8.4 | TODO |  |
| 83 | Tooltip not associated to trigger | U7.1 | TODO |  |
| 84 | Tooltip hover-only | U7.1 | TODO |  |
| 85 | Badge provenance confusing | U4.4 | DONE | Canonical `Badge` remains sourced from `feedback`; `data-table` re-export preserved for back-compat and canonical vocabulary documented; `pnpm --filter @letbuyy/ui validate:ui` PASS. |
| 86 | PageIdentity parallels EmptyStateKind | U7/U8 | TODO |  |
| 87 | getPageIconName brittle regex | U7/U8 | TODO |  |
| 88 | no RTL/dir consideration | U7.1 | TODO |  |
| 89 | focusRing contrast weak | U7.1 | TODO |  |
| 90 | Select native limits option content | U7/U8 | TODO |  |
| 91 | ChoiceList min-width can overflow | U7 | TODO |  |
| 92 | no InlineError | U3.3 | DONE | Added `InlineError` with `role="alert"` and exported props; U3 form primitive test PASS. |
| 93 | DensityToggle not general SegmentedControl | U3.2 | DONE | Added `SegmentedControl`; existing `DensityToggle` now delegates to it without public prop changes; RTL test PASS. |
| 94 | Avatar alt always empty | U7.1 | TODO |  |
| 95 | no Storybook do/don't usage docs | U8.4 | TODO |  |
| 96 | Modal backdrop is full-screen button | U7.1 | TODO |  |
| 97 | Chart hand-rolled SVG | U7 | TODO |  |
| 98 | EmptyState motifs hardcoded | U7.2 | TODO |  |
| 99 | sharedCssVariables seeds compact density only | U7 | TODO |  |
| 100 | no inert support/polyfill note | U7.2 | TODO |  |

## SKIPPED — NEEDS HUMAN

- [SKIP — NEEDS HUMAN] Issue #17 follow-up: repoint `@letbuyy/ui` `main`/`types` from `./src/index.ts` to `./dist/index.js` and `./dist/index.d.ts` only after the parallel app/service hardening stream has landed and consumers have been rechecked. Exact local decision/command: update `packages/typescript/ui/package.json` entrypoints, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issue #9 app-scope fix: wrap `apps/marketing-site` in `DesignSystemRoot` so UI tokens are present. Exact handoff: app stream updates the marketing-site root layout with `<DesignSystemRoot surface="storefront" theme="auto">{children}</DesignSystemRoot>`, then runs `pnpm --filter @letbuyy/marketing-site typecheck`, `pnpm --filter @letbuyy/marketing-site build`, `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issues #64, #65, #66 follow-up: collapse existing duplicate token aliases only after cross-app codemods and visual verification are coordinated. Exact handoff: run the U8 token-alias codemod across app/service consumers, remove deprecated aliases in `packages/typescript/ui/src/tokens.ts`, update snapshots with `pnpm --filter @letbuyy/ui snapshot:tokens:update` and `pnpm --filter @letbuyy/ui snapshot:aliases:update`, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issue #22 optional root `Menu` component alias: `Menu` is already a public icon export and is consumed by apps through `@letbuyy/ui`. This stream shipped the menu primitive as `Dropdown`/`DropdownMenu`; exposing a root component named `Menu` requires coordinated icon rename/import migration first. Exact handoff: choose the public symbol strategy, run a codemod for existing `Menu` icon imports if needed, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issues #19, #20, #59, #60, #61, #62, #63, #85 follow-up: remove deprecated duplicate/alias surfaces only after U8 codemods are authored and app/service migrations are coordinated. Exact handoff: run the table, text, badge, and page-alias codemods across consumers, remove deprecated exports in `packages/typescript/ui`, refresh the API snapshot, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.
- [SKIP — NEEDS HUMAN] Issue #48 follow-up: remove loose arbitrary `MaterialIconName` strings only after auditing unknown icon names. Exact handoff: replace user-provided strings with `isMaterialIconName()` guards or strict `materialIconName()` calls, remove `LooseMaterialIconName`, refresh the API snapshot, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.

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

## DEPRECATIONS

| Symbol | Since | Replacement | Codemod | Removal |
|---|---|---|---|---|
| `DataTable` | `0.0.2` | `Table` | `packages/typescript/ui/codemods/data-table-to-table.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `IndexTable` | `0.0.2` | `Table` | `packages/typescript/ui/codemods/index-table-to-table.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `TextStyle` | `0.0.2` | `Text` | `packages/typescript/ui/codemods/text-style-to-text.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `PageShell` | `0.0.2` | `Page` | `packages/typescript/ui/codemods/page-aliases-to-canonical.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `PageActions` | `0.0.2` | `PageHeaderActions` | `packages/typescript/ui/codemods/page-aliases-to-canonical.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `TableFilterBar` | `0.0.2` | `FilterBar` | `packages/typescript/ui/codemods/page-aliases-to-canonical.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `Badge variant="danger"` | `0.0.2` | `Badge variant="critical"` | `packages/typescript/ui/codemods/badge-danger-to-critical.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `LooseMaterialIconName` / arbitrary icon-name strings | `0.0.2` | `StrictMaterialIconName`, `materialIconName()`, `isMaterialIconName()` | Not planned; human review needed for unknown icon names | SKIP - breaking, needs icon-name audit |

## VISUAL-REGRESSION BASELINES

- Baseline captured 2026-06-06 with `pnpm --filter @letbuyy/ui test:visual:update`.
- U0/U1/U2 scope: every Storybook story in `packages/typescript/ui/src/**/*.stories.tsx`, 2 themes (`light`, `dark`) x 3 densities (`compact`, `comfortable`, `spacious`), 276 PNG baselines under `packages/typescript/ui/storybook-screenshots/baseline/`.
- U3 baseline expansion: `foundation-primitives.stories.tsx` added 24 primitive screenshots; `pnpm --filter @letbuyy/ui test:visual:update` captured 300 baselines total.
- U4 baseline expansion: `table.stories.tsx` added 6 table screenshots; `pnpm --filter @letbuyy/ui test:visual:update` captured 306 baselines total.
- Verification: `pnpm --filter @letbuyy/ui test:visual` PASS with 306 baselines checked.

## VALIDATOR LEDGER

- `packages/typescript/ui/tests/validators/ui-public-api-snapshot-validator.mjs`: snapshots all public exports from `src/index.ts`; `validate:api` PASS; `--self-test` PASS by detecting simulated removal of `Activity`.
- `packages/typescript/ui/tests/validators/ui-token-variable-snapshot-validator.mjs`: snapshots all emitted `--lb-*` variables; `validate:tokens` PASS; `--self-test` PASS by detecting simulated removal of `--lb-card-bg`.
- `packages/typescript/ui/tests/validators/ui-no-new-token-alias-validator.mjs`: snapshots current duplicate-value `--lb-*` alias groups and fails on new alias growth; `validate:aliases` PASS; `--self-test` PASS by detecting simulated `--lb-self-test-new-alias`.

## BLOCKED

None yet.
