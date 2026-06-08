# LetBuyy — Component Duplication Report

**Auditor:** Principal Design Systems Architect / UI Governance
**Date:** 2026-06-09
**Scope:** Duplication and reuse of UI components across 9 web apps, the Flutter app, and `@letbuyy/ui`.
**Method:** `rg`/`grep` counts of import sites, local component declarations, and parallel implementations; reconciled against the repo's own `FORENSIC_REPORT/09-duplication.md`. No code modified.

> **One-line verdict:** Duplication is **low at the named-primitive level** (the repo's own forensic report is right that there is no second `Button`/`Input`/`Card`) but **high at the composition/shell level**. `@letbuyy/ui` exports ~60 production components and all 9 apps import it — yet adoption is shallow in several apps, the app-shell module has **0 consumers**, and the platform ships **10 hand-rolled navigations**, **near-identical `_local-ui` workspace twins**, **StatusBadge re-implemented 5×**, and **three parallel color palettes on mobile**.

---

## 1. The library is comprehensive

`@letbuyy/ui` (`packages/typescript/ui/src/index.ts`) exports ~60 components: `Button`; `Input`/`Textarea`/`NumberField`; `Table`; layout `Box`/`BlockStack`/`InlineStack`/`Grid`/`Columns`/`Container`/`Card`/`Page`/`PageHeader`/`Section`/`Text`; feedback `Badge`/`Banner`/`EmptyState`/`SaveBar`/`Skeleton`/`Toast`; overlays `Modal`/`Drawer`/`Dropdown`/`Popover`/`Tooltip`/`ConfirmDialog`; controls `Checkbox`/`Radio`/`Select`/`Switch`/`Tabs`/`Combobox`/`ChoiceList`; shell `AppFrame`/`Sidebar`/`Navigation`; productivity `Avatar`/`CommandPalette`/`FilterBar`/`MetricCard`/`Pagination`; primitives `Breadcrumbs`/`Chart`/`Accordion`/`DatePicker`/`DateRangePicker`/`DensityToggle`/`DescriptionList`/`Disclosure`/`Divider`/`FilterChips`/`ProgressBar`/`SegmentedControl`/`Spinner`. It also ships codemods and a `DEPRECATIONS.md` for safe migration. **The problem is not coverage; it is adoption depth and shell-level reinvention.**

---

## 2. Adoption is universal but shallow

`@letbuyy/ui` is imported by **287 files** platform-wide. But depth varies wildly:

| App | Files importing `@letbuyy/ui` | Distinct components used | Note |
|---|---:|---:|---|
| merchant-control-plane | 74 | ~21 | Deep, healthy adopter |
| platform-operations-portal | 16 | ~17 | Deep |
| platform-console | 17 | ~15 | Deep |
| app-marketplace | 59 | ~11 | Medium |
| theme-marketplace | 45 | ~12 | Medium |
| developer-portal | 13 | ~7 | Medium |
| identity-platform | 11 | ~6 | Medium |
| **storefront-runtime** | **42** | **4** (Button, Input, EmptyState, Skeleton) | **Shallow — largest app, 4 primitives** |
| **marketing-site** | **10** | **4** (Button, Input, Table, Checkbox) | **Shallow** |

**Finding DUP-1 — Shallow adopters re-build instead of reusing.** storefront-runtime imports the library in 42 files but uses only 4 primitives, hand-building the rest (it also carries the platform's most rgb literals — 794). marketing-site likewise. **Severity: Medium.** **Root cause:** marketing/storefront surfaces have bespoke visual languages and were built fast; no governance required composing from the library. **Recommended direction:** define a "marketing kit" + "storefront kit" layer inside `@letbuyy/ui` (hero, section, pricing primitives) so these surfaces have canonical parts to compose.

---

## 3. Shell-level and `_local-ui` duplication (the real debt)

### DUP-2 — The `@letbuyy/ui` app-shell has 0 consumers; 10 navigations are hand-rolled
**Severity: High** · **Affected: all 8 apps with navigation (identity has none)**

`AppFrame`/`Sidebar`/`Navigation` (`app-shell.tsx`) are token-driven with built-in active state — and **no app imports them** (`rg "AppFrame|Navigation|Sidebar" 'from @letbuyy/ui'` across apps → 0). Instead there are **10 distinct nav implementations** with 4 different sidebar widths and 5 active-state strategies. Full treatment in `NAVIGATION_GOVERNANCE_AUDIT.md`.

### DUP-3 — `console-workspace.tsx` and `ops-workspace.tsx` are 63-line-diff twins, self-flagged for consolidation
**Severity: High** · **Affected: platform-console, platform-operations-portal**

`apps/platform-console/src/components/_local-ui/console-workspace.tsx` (199 lines) and `apps/platform-operations-portal/src/components/_local-ui/ops-workspace.tsx` (186 lines) implement the same dashboard grammar (`Workspace`, `MetricGrid`, `Metric`, `Panel`, `ModuleGrid`, `ModuleCard`, `StatusPill`, `EmptyDataState`) and differ by only ~63 lines. **Both files carry a `// [CONSOLIDATE -> @letbuyy/ui]` comment** — the codebase already admits the debt. **Root cause:** the two operations apps were forked from a shared template without extracting the shared shell. **Recommended direction:** promote the shared workspace grammar into `@letbuyy/ui` (it overlaps `MetricCard`, `Card`, `Badge`, `EmptyState` already exported) and delete both `_local-ui` files.

### DUP-4 — Status badge / pill re-implemented 5×, ModuleCard 2×
**Severity: Medium** · **Affected: platform-console, platform-operations-portal, developer-portal**

`StatusBadge`/`StatusPill` and their tone→color mappers appear in at least 5 places (`console-workspace.tsx`, `ops-workspace.tsx`, `platform-console/src/components/ConsoleDataTable.tsx:89`, `developer-portal/.../_local-ui/developer-docs.tsx:68`, `developer-portal/.../PortalChrome.tsx`) — all re-deriving logic the exported `Badge` + `StatusVariant` already provide (`feedback` exports, `index.ts:54,71`). `ModuleCard` is duplicated 2× (`console-workspace.tsx:107`, `ops-workspace.tsx:102`) despite `Card`/`MetricCard` existing. **Recommended direction:** delete local status components; standardize on `Badge variant=…`.

### DUP-5 — `developer-docs.tsx` hand-rolls 15+ bespoke table renderers
**Severity: Medium** · **Affected: developer-portal**

A single 554-line file (`developer-portal/src/components/_local-ui/developer-docs.tsx`) declares ~30 components including 15+ `*Matrix`/`*Table` renderers instead of reusing the one configurable `Table` it already imports. **Recommended direction:** collapse to `Table` with column config; the file should shrink by an order of magnitude.

### DUP-6 — Marketing Header/Footer duplicated across two marketing apps
**Severity: Low (acknowledged)** · **Affected: app-marketplace, marketing-site**

`apps/app-marketplace/src/components/{Header,Footer}.tsx` vs `apps/marketing-site/src/components/{Header,Footer}.tsx` — different nav sets but the same brand chrome, and both leak hardcoded colors (`marketing-site` carries all 25 of the platform's hex literals; `app-marketplace` uses `rgba(5,7,12,0.98)`). Already noted as D-4 in `FORENSIC_REPORT/09-duplication.md`. **Recommended direction:** a shared `MarketingHeader`/`MarketingFooter` in the proposed marketing kit.

---

## 4. Mobile (Flutter) — three parallel palettes, two share a class name

### DUP-7 — The design system is forked three times in Dart
**Severity: High** · **Affected: apps/mobile/merchant-app, packages/dart/ui_kit**

| # | File | Class | Consumed by | Brand primary |
|---|---|---|---|---|
| 1 | `packages/dart/ui_kit/.../tokens/letbuyy_tokens.dart:45` | `LetbuyyColorTokens` (package) | `store_theme.dart` ColorScheme | `#8B5CF6` |
| 2 | `packages/dart/ui_kit/.../themes/app_colors.dart:4` | `AppColors` | live theme + 343 screen refs | `#8B5CF6` |
| 3 | `apps/mobile/merchant-app/lib/theme/letbuyy_color_tokens.dart` (generated from `mobile-tokens.ts`) | `LetbuyyColorTokens` (mobile) | ~40 screens as `mobile_tokens` | `brandPrimary #8B5CF6` |

Two classes share the name `LetbuyyColorTokens`; `store_theme.dart:17` silently binds to the ui_kit one, so the in-sync generated palette is bypassed. Brand purple matches across all three, but the *live* semantic colors are the off-spec `AppColors` (`success #A4E500`, `error #B02525`). **Recommended direction:** one Dart source (the generated file), delete the duplicate class, reconcile `AppColors`, wire `generate-mobile-tokens --check` into CI. (Cross-ref `DESIGN_TOKEN_AUDIT.md` TOK-4.)

### DUP-8 — Screens ignore the tokens they have
**Severity: Medium** · **Affected: apps/mobile/merchant-app**

`grep` counts in `lib`: **324** raw `Color(0x…)`, **1,155** `Colors.*`, **712** raw `fontSize:` literals — even where a correct token exists. Worst raw-hex concentration is the website-editor widgets and `screens/auth/login_screen.dart`. **Recommended direction:** lint Dart for raw `Color(`/`fontSize:` outside the theme layer (custom `analysis_options.yaml` rule or `dart_code_metrics`).

---

## 5. Reconciliation with the repo's own forensic report

`FORENSIC_REPORT/09-duplication.md` concludes duplication is "low … one UI package, no duplicate Button/Input/Card/Modal." **That is accurate at the primitive level and this report agrees** — there is no second `Button`. The nuance this audit adds: duplication migrated *up a layer* to shells, dashboards, status components, and mobile palettes, where it is substantial and partly self-acknowledged (`[CONSOLIDATE -> @letbuyy/ui]`). The forensic report also lists D-1 (section schemas 3×) and D-6 (theme editor web+mobile) which are storefront-engine concerns, not design-system duplication.

---

## 6. Component-reuse scorecard (component of the master scorecard)

| Dimension | Rating | Basis |
|---|---|---|
| Library coverage | **4.5 / 5** | ~60 components, codemods, deprecations. |
| Adoption breadth | **4.0 / 5** | 287 files, all 9 apps import it. |
| Adoption depth | **2.5 / 5** | storefront/marketing use 4 primitives; shells reinvented. |
| Shell / composite reuse | **1.5 / 5** | 0/9 app-shell adoption; twin workspaces; StatusBadge 5×. |
| Mobile reuse | **2.0 / 5** | 3 palettes; tokens bypassed; 324 raw colors. |
| **Component reuse (overall)** | **2.5 / 5** | Strong parts, weak composition discipline. |

See `NAVIGATION_GOVERNANCE_AUDIT.md` for the shell duplication detail and `DESIGN_SYSTEM_MASTER_AUDIT.md` for the consolidated scorecard.
