# CODEX UI Foundation Ledger

Branch: `stream/letbuyy-ui-foundation`
Worktree: `/private/tmp/letbuyy-ui-foundation`
Branch-point governance baseline: `node scripts/validate-governance.mjs` PASS, `129 validators`, `3043 tracked files scanned` on 2026-06-06.

## TRACEABILITY MATRIX

| # | issue | phase | status | evidence |
|---|---|---|---|---|
| 1 | Modal has no focus trap | U1.2 | TODO |  |
| 2 | Modal no initial focus on open | U1.2 | TODO |  |
| 3 | Modal no focus restoration on close | U1.2 | TODO |  |
| 4 | Modal background not inert/aria-hidden | U1.2 | TODO |  |
| 5 | Input ID derived from label text | U1.3 | TODO |  |
| 6 | Input no aria-describedby/aria-invalid | U1.3 | TODO |  |
| 7 | Textarea same label-ID collision | U1.3 | TODO |  |
| 8 | Textarea no error ARIA wiring | U1.3 | TODO |  |
| 9 | marketing-site has no DesignSystemRoot | U1.6 | TODO |  |
| 10 | theme auto never follows OS | U1.5 | TODO |  |
| 11 | textMuted contrast fails AA | U1.4 | TODO |  |
| 12 | brand purple text contrast fails AA | U1.4 | TODO |  |
| 13 | z-50 overlay collisions | U1.1 | TODO |  |
| 14 | CommandPalette no focus trap | U1.2 | TODO |  |
| 15 | CommandPalette no Arrow-key result nav | U1.2 | TODO |  |
| 16 | zero unit tests | U0 | DONE | `pnpm --filter @letbuyy/ui test` PASS: 10 RTL/jest-axe tests; `pnpm turbo test` PASS: 61 tasks. |
| 17 | raw src distribution/no dist | U0.5 | DONE | `pnpm --filter @letbuyy/ui build` PASS; `dist/` emitted; `main` and `types` remain `./src/index.ts`. |
| 18 | version 0.0.1/no semver/changelog | U8.3 | TODO |  |
| 19 | duplicate DataTable and IndexTable | U4.1 | TODO |  |
| 20 | DataTable desktop-only | U4.1 | TODO |  |
| 21 | no Drawer | U3.1 | TODO |  |
| 22 | no Dropdown/Menu | U3.1 | TODO |  |
| 23 | no Popover | U3.1 | TODO |  |
| 24 | surface prop inert | U6.1 | TODO |  |
| 25 | no brand override API | U6.2 | TODO |  |
| 26 | raw button bypass | U8.1 | TODO |  |
| 27 | raw input bypass | U8.1 | TODO |  |
| 28 | hardcoded hex bypass | U8.1 | TODO |  |
| 29 | no breakpoint tokens | U2.1 | TODO |  |
| 30 | no z-index scale | U1.1 | TODO |  |
| 31 | no Grid/Columns primitive | U3.2 | TODO |  |
| 32 | no Container primitive | U3.2 | TODO |  |
| 33 | PageHeader raw buttons/anchors | U5.1 | TODO |  |
| 34 | SaveBar raw buttons | U5.1 | TODO |  |
| 35 | IndexTable raw controls | U5.1 | TODO |  |
| 36 | Pagination/DensityToggle/mobile Open raw buttons | U5.1 | TODO |  |
| 37 | cx lacks tailwind-merge | U6.3 | TODO |  |
| 38 | Button lacks as/asChild | U3/U5 | TODO |  |
| 39 | token CSS injected per root | U6.4 | TODO |  |
| 40 | no deprecation policy | U8.3 | TODO |  |
| 41 | no codemods | U8.2 | TODO |  |
| 42 | no CODEOWNERS guidance | U8.4 | TODO |  |
| 43 | no eslint rule enforcing DS usage | U8.1 | TODO |  |
| 44 | no Switch/Toggle | U3.2 | TODO |  |
| 45 | no NumberField | U3.2 | TODO |  |
| 46 | no CI cross-app build gate on UI change | U0 | DONE | Local repo-wide gates PASS: `pnpm turbo typecheck`, `pnpm turbo build`, and `pnpm turbo test`. |
| 47 | Storybook screenshots not CI-gated | U0.3 | DONE | `pnpm --filter @letbuyy/ui test:visual:update` captured 276 baselines; `pnpm --filter @letbuyy/ui test:visual` PASS. |
| 48 | MaterialIconName accepts any string | U4.5 | TODO |  |
| 49 | no theme contract docs | U4/U8 | TODO |  |
| 50 | no contrast guardrail for custom brand | U4/U8 | TODO |  |
| 51 | storefront-runtime empty ui dir | U8.4 | TODO |  |
| 52 | exported TS token objects undocumented/internal | U0.4 | DONE | Public API snapshot protects current exports; `pnpm --filter @letbuyy/ui validate:api` PASS and self-test detects simulated export removal. |
| 53 | no bundle-size/API snapshot guard | U0.4 | DONE | API snapshot and token-variable snapshot guards added; `pnpm --filter @letbuyy/ui validate:ui` PASS. |
| 54 | ConfirmDialog hardcoded body copy | U7 | TODO |  |
| 55 | no app-shell Navigation/Sidebar/AppFrame | U3.3 | TODO |  |
| 56 | inconsistent change-handler conventions | U4/U7 | TODO |  |
| 57 | inconsistent size prop names | U4/U7 | TODO |  |
| 58 | helperText vs description duplication | U4/U7 | TODO |  |
| 59 | danger vs critical vocab | U4.4 | TODO |  |
| 60 | Text vs TextStyle overlap | U4.2 | TODO |  |
| 61 | PageShell dead alias | U4.3 | TODO |  |
| 62 | PageActions alias | U4.3 | TODO |  |
| 63 | TableFilterBar alias | U4.3 | TODO |  |
| 64 | color alias sprawl | U2.3 | TODO |  |
| 65 | dual spacing names | U2.4 | TODO |  |
| 66 | dual type scale | U2.4 | TODO |  |
| 67 | two shadow systems | U2.2 | TODO |  |
| 68 | PageHeader redundant props | U7 | TODO |  |
| 69 | PageHeader reimplements breadcrumbs | U5.1 | TODO |  |
| 70 | Pagination minimal | U7.2 | TODO |  |
| 71 | formatting exports subpath-only | U7 | TODO |  |
| 72 | three theme selectors | U6 | TODO |  |
| 73 | SpaceScale under-typed | U2/U7 | TODO |  |
| 74 | hover lift not reduced-motion gated | U7.1 | TODO |  |
| 75 | IndexTable lacks aria-selected | U7.1 | TODO |  |
| 76 | Combobox preventDefault blur hack | U7 | TODO |  |
| 77 | Toast duration fixed | U7.1 | TODO |  |
| 78 | Toast placement fixed | U7.1 | TODO |  |
| 79 | no DatePicker | U3.3 | TODO |  |
| 80 | no Accordion/Disclosure | U3.3 | TODO |  |
| 81 | statusSoft light values hardcoded | U2.2 | TODO |  |
| 82 | visual preview helpers shipped in main bundle | U8.4 | TODO |  |
| 83 | Tooltip not associated to trigger | U7.1 | TODO |  |
| 84 | Tooltip hover-only | U7.1 | TODO |  |
| 85 | Badge provenance confusing | U4.4 | TODO |  |
| 86 | PageIdentity parallels EmptyStateKind | U7/U8 | TODO |  |
| 87 | getPageIconName brittle regex | U7/U8 | TODO |  |
| 88 | no RTL/dir consideration | U7.1 | TODO |  |
| 89 | focusRing contrast weak | U7.1 | TODO |  |
| 90 | Select native limits option content | U7/U8 | TODO |  |
| 91 | ChoiceList min-width can overflow | U7 | TODO |  |
| 92 | no InlineError | U3.3 | TODO |  |
| 93 | DensityToggle not general SegmentedControl | U3.2 | TODO |  |
| 94 | Avatar alt always empty | U7.1 | TODO |  |
| 95 | no Storybook do/don't usage docs | U8.4 | TODO |  |
| 96 | Modal backdrop is full-screen button | U7.1 | TODO |  |
| 97 | Chart hand-rolled SVG | U7 | TODO |  |
| 98 | EmptyState motifs hardcoded | U7.2 | TODO |  |
| 99 | sharedCssVariables seeds compact density only | U7 | TODO |  |
| 100 | no inert support/polyfill note | U7.2 | TODO |  |

## SKIPPED — NEEDS HUMAN

- [SKIP — NEEDS HUMAN] Issue #17 follow-up: repoint `@letbuyy/ui` `main`/`types` from `./src/index.ts` to `./dist/index.js` and `./dist/index.d.ts` only after the parallel app/service hardening stream has landed and consumers have been rechecked. Exact local decision/command: update `packages/typescript/ui/package.json` entrypoints, then run `pnpm turbo typecheck`, `pnpm turbo build`, `pnpm lint`, and `node scripts/validate-governance.mjs`.

## NEW PUBLIC API

- No new runtime component exports in U0.
- New package scripts: `test`, `test:visual`, `test:visual:update`, `test:watch`, `snapshot:api:update`, `snapshot:tokens:update`, `validate:api`, `validate:tokens`, `validate:ui`.

## DEPRECATIONS

None yet.

## VISUAL-REGRESSION BASELINES

- Baseline captured 2026-06-06 with `pnpm --filter @letbuyy/ui test:visual:update`.
- Scope: every Storybook story in `packages/typescript/ui/src/**/*.stories.tsx`, 2 themes (`light`, `dark`) x 3 densities (`compact`, `comfortable`, `spacious`), 276 PNG baselines under `packages/typescript/ui/storybook-screenshots/baseline/`.
- Verification: `pnpm --filter @letbuyy/ui test:visual` PASS with 276 baselines checked.

## VALIDATOR LEDGER

- `packages/typescript/ui/tests/validators/ui-public-api-snapshot-validator.mjs`: snapshots all public exports from `src/index.ts`; `validate:api` PASS; `--self-test` PASS by detecting simulated removal of `Activity`.
- `packages/typescript/ui/tests/validators/ui-token-variable-snapshot-validator.mjs`: snapshots all emitted `--lb-*` variables; `validate:tokens` PASS; `--self-test` PASS by detecting simulated removal of `--lb-card-bg`.

## BLOCKED

None yet.
