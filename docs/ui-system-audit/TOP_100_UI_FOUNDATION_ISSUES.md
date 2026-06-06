# TOP_100_UI_FOUNDATION_ISSUES.md

**Scope:** `@letbuyy/ui`. 100 issues, ranked by severity then blast radius.
**Audit date:** 2026-06-06
**Severity:** **P0** correctness / a11y / blocking · **P1** architecture / stability / major debt · **P2** consistency / hygiene · **P3** polish / nits.
**Consumers affected** = static blast radius. All component counts are **apps-only product instantiations** per `UI_USAGE_GRAPH.md` (Card 284 · Section 261 · Button 218 · Badge 114 · Input 103 · …); "all 9" = every consuming app.

---

## P0 — Critical (15)

| # | Issue | Impact | Consumers | Recommended fix |
|---|---|---|---|---|
| 1 | `Modal` has no focus trap | Keyboard/SR users tab behind dialog (WCAG 2.4.3) | 28 dialogs (1 Modal + 27 ConfirmDialog) | Shared `useFocusTrap` |
| 2 | `Modal` no initial focus on open | Focus stays on trigger/body | 28 dialogs | Autofocus first focusable / dialog |
| 3 | `Modal` no focus restoration on close | Focus lost after close | 28 dialogs | Restore to opener |
| 4 | `Modal` background not `inert`/`aria-hidden` | SR reads page behind modal | 28 dialogs | `inert` background while open |
| 5 | `Input` ID derived from label text → collisions | Duplicate DOM IDs break `htmlFor`/AT | 103 Inputs | `useId()` |
| 6 | `Input` no `aria-describedby`/`aria-invalid` | Errors unannounced to SR (WCAG 3.3.1) | 103 Inputs | Wire ARIA like `Select` |
| 7 | `Textarea` same label-ID collision | Same as #5 | 17 Textareas | `useId()` |
| 8 | `Textarea` no error ARIA wiring | Same as #6 | 17 Textareas | Wire ARIA |
| 9 | `marketing-site` renders DS components with **no `DesignSystemRoot`** → no token CSS | Components render with undefined `var(--lb-*)` (broken styling) | marketing-site (9 files) | Wrap app in `DesignSystemRoot`; add lint guard |
| 10 | `theme="auto"` (default) never follows OS (no `prefers-color-scheme`) | Dark mode unreachable by default | all 9 | Emit `@media (prefers-color-scheme: dark)` for auto |
| 11 | `textMuted` #94A3B8 ~2.6:1 on white | Fails AA for text | all 9 | Darken muted token |
| 12 | Brand purple #8B5CF6 ~3.5:1 as text (active tabs, accent) | Fails AA normal text | all 9 | Use `purple[700]` for text |
| 13 | `z-50` collisions (Modal/Toast/CommandPalette) | Undefined stacking when ≥2 open | all 9 | `--lb-z-*` scale |
| 14 | `CommandPalette` no focus trap | Focus escapes palette | 1 | `useFocusTrap` |
| 15 | `CommandPalette` no Arrow-key result nav | ⌘K unusable by keyboard | 1 | Add roving selection |

---

## P1 — High: architecture & stability (30)

| # | Issue | Impact | Consumers | Recommended fix |
|---|---|---|---|---|
| 16 | **0 unit tests** for the package | No regression net for 203 sites | all 9 | RTL + jest-axe on Tier 0–3 |
| 17 | Ships raw `src/index.ts` (`main`/`types`), no `dist` | File moves break consumers; no versionable contract | all 9 | Build `dist` (tsup/tsc) |
| 18 | Version `0.0.1`, `private`, no semver/changelog | No change classification | all 9 | Semver + `CHANGELOG.md` |
| 19 | `DataTable` **and** `IndexTable` (duplicate tables) | "Which table?" ambiguity; split maintenance | 28 sites | Merge into one `Table` |
| 20 | `DataTable` desktop-only (no mobile view) | Broken on small screens | 2 | Retire for IndexTable pattern |
| 21 | **No `Drawer`** component | Apps hand-roll drawers (raw markup) | all 9 | Add `Drawer` |
| 22 | **No `Dropdown`/`Menu`** | Apps hand-roll menus / raw `<select>` | all 9 | Add `Dropdown`/`Menu` |
| 23 | No `Popover` primitive | No anchored transient UI | all 9 | Add `Popover` |
| 24 | `surface` prop inert (no CSS keys off it) | Multi-surface theming impossible | all 9 | Wire `[data-letbuyy-surface]` overrides |
| 25 | No brand-override API | Can't white-label per merchant/marketplace | all 9 | `createTheme({brand})` / `brand` prop |
| 26 | **282 raw `<button>`** in apps | DS bypassed; inconsistent buttons | apps | eslint ban + migrate to `Button` |
| 27 | **138 raw `<input>`** in apps | DS bypassed; a11y/style drift | apps | eslint ban + migrate to `Input` |
| 28 | **417 hardcoded hex** across 36 app files | Token bypass; theme drift | 36 files | eslint ban + tokenize |
| 29 | No breakpoint tokens | Responsive contract invisible/inherited | all 9 | `--lb-bp-*` + owned `screens` |
| 30 | No z-index scale | Stacking ad-hoc | all 9 | `--lb-z-*` |
| 31 | No `Grid`/`Columns` primitive | 5 ad-hoc grid impls | all 9 | Add `Grid` |
| 32 | No `Container` primitive | No standard width constraint | all 9 | Add `Container` |
| 33 | `PageHeader` builds raw `<button>`/`<a>` not `Button` | Divergent button rendering | 62 | Compose `Button` |
| 34 | `SaveBar` builds raw `<button>`s | Same | 20 | Compose `Button` |
| 35 | `IndexTable` builds raw checkboxes/sort/bulk buttons | Same; a11y drift | 19 | Compose `Checkbox`/`Button` |
| 36 | `Pagination`/`DensityToggle`/mobile-Open raw buttons | Same | 5 | Compose `Button` |
| 37 | `cx` has no `tailwind-merge` | `className` overrides unreliable | all 9 | Adopt `tailwind-merge` |
| 38 | `Button` lacks `as`/`asChild` | Link-buttons hand-rolled ×3 | all 9 | Add polymorphism |
| 39 | Token CSS injected per `DesignSystemRoot` instance | Duplicate multi-KB `<style>` | 8 rooted apps | Inject once / static CSS |
| 40 | No deprecation policy | Dead aliases linger | all 9 | `@deprecated` + `DEPRECATIONS.md` |
| 41 | No codemods | Manual migration across 203 sites | all 9 | jscodeshift per breaking change |
| 42 | No `CODEOWNERS` for `ui` | Unowned API changes | all 9 | Define DS guild |
| 43 | No eslint rule enforcing DS usage | Bypass keeps growing | apps | `@letbuyy/eslint-plugin-ui` |
| 44 | No `Switch`/`Toggle` | Apps fake with checkbox/buttons | all 9 | Add `Switch` |
| 45 | No `NumberField` | Numeric input unguarded | all 9 | Add `NumberField` |
| 46 | No CI cross-app build gate on UI change | Breakage caught manually | all 9 | Build 9 apps in CI |
| 47 | Storybook screenshots dir exists but not CI-gated | No visual regression net | all 9 | Wire visual regression |
| 48 | `MaterialIconName` accepts any string | Typos render fallback silently | 93 | Restrict to keyof map |
| 49 | No theme contract docs | Tenants can't safely override | all 9 | Publish overridable `--lb-*` set |
| 50 | No contrast guardrail for custom brand | Merchants can pick inaccessible colors | future | Validate/auto-adjust brand |
| 51 | `storefront-runtime/src/components/ui` is empty/dead | Dead dir / confusion | storefront | Remove |
| 52 | Exported TS token objects unused by apps | Large surface, only feeds CSS gen | all 9 | Mark internal / document |
| 53 | No bundle-size budget; barrel `index.ts` + ~150 icon re-exports | Tree-shaking risk | all 9 | Size budget + verify shaking |
| 54 | `ConfirmDialog` hardcodes body copy over `description` | Surprising rendered text | 27 | Remove hardcoded sentence |
| 55 | No app-shell `Navigation`/`Sidebar`/`AppFrame` | Nav hand-rolled per app | all 9 | Add shell primitives |

---

## P2 — Medium: consistency & hygiene (30)

| # | Issue | Impact | Consumers | Recommended fix |
|---|---|---|---|---|
| 56 | 5 change-handler conventions (`onClick`/`onCheckedChange`/`onValueChange`/`onChange`/`onPageChange`) | Unpredictable API | all 9 | Standardize `onChange` |
| 57 | 3 size prop names (`size`/`controlSize`) | Inconsistent | all 9 | One `size` |
| 58 | `helperText` vs `description` duplication | Two help props | all 9 | One `helperText` |
| 59 | `danger` vs `critical` dual status vocab | Two error words | 114 Badge | `critical` only |
| 60 | `Text` vs `TextStyle` overlap | Two text APIs | 24+ | Merge |
| 61 | `PageShell` dead alias of `Page` | API bloat | ~0 | Deprecate/remove |
| 62 | `PageActions` alias of `PageHeaderActions` | API bloat | — | Deprecate |
| 63 | `TableFilterBar` alias of `FilterBar` | API bloat | — | Deprecate |
| 64 | Color alias sprawl (`text`=`textPrimary`…) ~30 vars | Drift risk | all 9 | Collapse aliases |
| 65 | Spacing emitted as `space-1..8` **and** `space-xs..xl` | Two scales | all 9 | One naming |
| 66 | Dual type scale (`h1..h4`/`heading` + semantic) | 21 size vars for ~7 steps | all 9 | One scale |
| 67 | Two shadow systems (`shadow.*` + `card.shadow` literal) | Inconsistent elevation | all 9 | `card.shadow`→`--lb-shadow-*` |
| 68 | `PageHeader` has `showBreadcrumb`+`showBreadcrumbs`, `showEyebrow`+`showSectionLabel` | Redundant props | 93 | One name each |
| 69 | `PageHeader` re-implements breadcrumbs (vs `Breadcrumbs`) | Duplicate logic | 93 | Compose `Breadcrumbs` |
| 70 | `Pagination` minimal (no page numbers / page size) | Inadequate for large lists | 2 | Expand |
| 71 | `formatDisplayDate` etc. subpath-only, not in `index` | Inconsistent export surface | — | Export consistently |
| 72 | Three theme selectors (`data-theme`/`data-letbuyy-theme`/`.dark`) | Ambiguous canonical | all 9 | Pick one (+ `.dark` for Tailwind) |
| 73 | `SpaceScale` type only `0..7` (ignores `4xl`/`space-8`) | Token under-typed | layout users | Align type to scale |
| 74 | Hover-lift transforms not reduced-motion-gated | Motion for sensitive users | all 9 | `motion-safe`/reduced check |
| 75 | `IndexTable` selection not exposed via `aria-selected` | AT selection state weak | 21 | Add grid semantics |
| 76 | `Combobox` `onMouseDown preventDefault` blur hack | Fragile focus handling | 2 | Robust dismiss logic |
| 77 | `Toast` fixed 5s auto-dismiss, not configurable | No control over timing | toast users | `duration` option |
| 78 | `Toast` fixed top-right position | No placement options | toast users | `placement` prop |
| 79 | No `DatePicker` (only `DateRangePicker`) | Single-date hand-rolled | all 9 | Add `DatePicker` |
| 80 | No `Accordion`/`Disclosure` | Hand-rolled collapses | all 9 | Add `Accordion` |
| 81 | `statusSoft` light values hardcoded hex (not primitives) | Off-scale colors | all 9 | Reference primitives |
| 82 | Visual preview helpers shipped in main bundle | Prod ships Storybook helpers | all 9 | Move to `/preview` subpath |
| 83 | `Tooltip` not associated to trigger (`aria-describedby`) | AT users miss tooltip | 3 | Wire association |
| 84 | `Tooltip` hover-only (no touch/tap) | Mobile users can't see it | 3 | Add focus/tap |
| 85 | `Badge` re-exported via `data-table` **and** defined in `feedback` | Confusing provenance | 114 | Export from one module |
| 86 | `PageIdentity` enum parallels `EmptyStateKind` enum | Two near-identical domain enums | layout/feedback | Unify domain enum |
| 87 | `getPageIconName` brittle regex/locale-bound title matching | Wrong icons for some titles | 93 PageHeaders | Prefer explicit `identity`/`iconName` |
| 88 | No RTL/`dir` consideration | i18n RTL unsupported | future intl | Logical props / RTL pass |
| 89 | `focusRing` = brand purple | Ring contrast weak on some bg | all 9 | Verify ring contrast |
| 90 | `Select` native `<select>` limits option content/styling | No rich options | 29 | Document / offer `Combobox` |
| 91 | `ChoiceList` option `min-w-[min(260px,100%)]` can overflow tight containers | Layout overflow | choice users | Make min-width configurable |
| 92 | No `InlineError` primitive (error UI re-implemented) | Inconsistent error display | all 9 | Add `InlineError` |
| 93 | `DensityToggle` is a one-off, not a general `SegmentedControl` | Reinvented for other toggles | 3 | Generalize |
| 94 | Avatar `<img alt="">` always (even meaningful images) | Decorative even when informative | 14 | Optional `alt` |
| 95 | No do/don't usage docs per component | Misuse / bypass | all 9 | Storybook docs |

---

## P3 — Low: polish & nits (5 shown; remainder folded above)

| # | Issue | Impact | Consumers | Recommended fix |
|---|---|---|---|---|
| 96 | `Modal` backdrop is a full-screen `<button>` | SR announces large "Close modal" button | 28 | Use overlay `div` + close affordance |
| 97 | `Chart` hand-rolled SVG (no lib) | Maintenance burden for complex charts | 9 | Keep for simple; plan lib for complex |
| 98 | `EmptyState` 14 hardcoded SVG motifs | Maintenance / can't extend easily | 66 | Externalize illustration set |
| 99 | Base `sharedCssVariables` seeds only `compact` density | Relies on `data-density` always present | all 9 | Document default density requirement |
| 100 | No `inert` polyfill/support note for older browsers | Focus-trap fallback unclear | all 9 | Document support / polyfill |

---

## Severity rollup

| Severity | Count | Theme |
|---|---|---|
| **P0** | 15 | Dialog focus, Input ARIA, contrast, broken theming defaults |
| **P1** | 40 | No tests/build/semver, duplication, missing primitives, DS bypass, theming seams |
| **P2** | 40 | API-grammar inconsistency, alias/duplication hygiene, missing minor components |
| **P3** | 5 | Polish |

**The 80/20:** fixing items **1–10, 16–22, 24–28** (focus traps, Input ARIA, contrast, auto theme, tests, `dist`, the table/Drawer/Dropdown gaps, and the DS-bypass lint rules) addresses the majority of real-world impact and unlocks everything else. Full sequencing in `UI_SYSTEM_GOVERNANCE.md`.
