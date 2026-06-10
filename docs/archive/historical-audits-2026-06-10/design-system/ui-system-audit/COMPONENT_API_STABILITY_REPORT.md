# COMPONENT_API_STABILITY_REPORT.md

**Scope:** public API of `@letbuyy/ui` (`index.ts` + subpaths).
**Audit date:** 2026-06-06
**Rating scale:** 🟢 **Stable** (ship as-is) · 🟡 **Needs Refactor** (works, but API debt) · 🔴 **Dangerous** (correctness / a11y / will force a breaking change soon).

---

## Executive summary (for leadership)

The library is **mostly stable at the call-site level** — props are typed, mostly native-attribute-extending, and consumers can't easily misuse them. But three categories of risk mean **you cannot yet freeze this API and promise consumers stability**:

- **Two `Dangerous` items** (`Input` ID/aria correctness, `Modal` focus management) are correctness bugs in two of your highest-traffic components.
- **Duplication** (`DataTable`/`IndexTable`, `Page`/`PageShell`, `PageActions`, `TableFilterBar`, `Text`/`TextStyle`) guarantees a future consolidation that *will* be a breaking change. Better to do it now (203 import sites) than at 2× the size.
- **Inconsistent conventions** across the library (`onCheckedChange` vs `onValueChange` vs `onChange` vs `onPageChange`; `helperText` vs `description`; `variant` unions that differ per component) mean the system has no enforced API style guide.

**Headline:** this is a **0.0.1 private package** with no tests and `main` pointing at raw `src/index.ts`. It has the API maturity of an internal v0 — which is fine, *as long as you don't tell teams it's stable*. The single most valuable governance act is to **declare it pre-1.0, then run the consolidation in `UI_SYSTEM_GOVERNANCE.md` before 1.0.**

---

## Ratings at a glance

| Component | Rating | Primary reason |
|---|---|---|
| Button | 🟢 Stable | Clean, native-extending, no polymorphism debt (minor) |
| Card | 🟢 Stable | Minimal, composable |
| Section | 🟢 Stable | Clear |
| Badge | 🟡 Needs Refactor | `danger`+`critical` dual variant; re-exported from two modules |
| Banner | 🟢 Stable | Consistent with `StatusVariant` |
| Skeleton | 🟢 Stable | — |
| EmptyState | 🟢 Stable | Large but coherent |
| Box / BlockStack / InlineStack | 🟢 Stable | Good primitives |
| Text + TextStyle | 🟡 Needs Refactor | Two overlapping text APIs |
| Page + PageShell | 🟡 Needs Refactor | `PageShell` is a dead alias |
| PageHeader | 🟡 Needs Refactor | Redundant `show*` prop pairs; builds own buttons |
| Select | 🟢 Stable | Good a11y, `controlSize` naming (vs Button `size`) |
| Checkbox / Radio / ChoiceList | 🟢 Stable | Strong a11y; many class-name slots |
| Combobox | 🟢 Stable | Strong a11y |
| Tabs | 🟢 Stable | Strong a11y |
| Input / Textarea | 🔴 Dangerous | Label-derived IDs (collisions) + no `aria-describedby`/`aria-invalid` |
| Modal | 🔴 Dangerous | No focus trap / initial focus / restore / `inert` |
| ConfirmDialog | 🟡 Needs Refactor | Hardcoded body copy overrides intent |
| Tooltip | 🟡 Needs Refactor | Not linked to trigger via `aria-describedby` |
| CommandPalette | 🟡 Needs Refactor | No focus trap |
| DataTable | 🟡 Needs Refactor | Duplicate of IndexTable; weaker |
| IndexTable | 🟡 Needs Refactor | Generic `<T extends {id:string}>`; builds own controls; large prop surface |
| MetricCard / Avatar / Chart | 🟢 Stable | — |
| Pagination | 🟡 Needs Refactor | Too minimal to be the system's pagination |
| FilterBar / TableFilterBar | 🟡 Needs Refactor | Alias duplication |
| DesignSystemRoot | 🟡 Needs Refactor | `surface` inert; `auto` theme broken; per-instance `<style>` |
| MaterialIcon | 🟡 Needs Refactor | `name` accepts any string (no type safety) |
| cx (util) | 🟡 Needs Refactor | No `tailwind-merge`; override conflicts unresolved |

---

## 🔴 Dangerous (fix before declaring stability)

### D1 · Input / Textarea — ID generation + missing ARIA
**File:** `input.tsx` L24, L80.
```ts
const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
```
- **Bug 1 — ID collisions:** two inputs labeled "Name" both get `id="name"`. Duplicate IDs break `<label htmlFor>`, screen-reader association, and any `getElementById`. With **103 `<Input>` + 17 `<Textarea>` app instances**, collisions are statistically certain on any form with repeated labels.
- **Bug 2 — no error/helper association:** unlike `Select`/`Combobox`/`Checkbox` (which use `useId` + `aria-describedby` + `aria-invalid`), `Input` renders error/helper text **not linked to the field**. Screen readers don't announce the error.
- **Why dangerous:** it's the #2 form component, it's a real a11y defect, and the fix (`useId()` + describedby/invalid wiring) is technically a behavior change to generated IDs → coordinate as a deliberate change.

### D2 · Modal — no focus management
**File:** `overlays.tsx` L18–82.
- No focus trap, no initial focus, no focus restoration on close, background not `inert`/`aria-hidden`. Keyboard/SR users can tab out of the dialog into the page behind it.
- `ConfirmDialog` and any consumer modal inherit this. **27 `<ConfirmDialog>` + 1 `<Modal>`** app instances affected.
- **Why dangerous:** WCAG 2.4.3 / 2.1.2 failure on the primary dialog primitive.

---

## 🟡 Needs Refactor — duplicate components (future breaking changes)

| Duplicate | Keep | Drop / merge | Adoption today |
|---|---|---|---|
| `DataTable` vs `IndexTable` | `IndexTable` (responsive, selection, bulk) | Fold `DataTable` into IndexTable "simple" mode | DataTable 2, IndexTable 19 (apps) |
| `Page` vs `PageShell` | `Page` | Delete `PageShell` (pure alias) | PageShell 0 |
| `PageHeaderActions` vs `PageActions` | one name | Alias → deprecate | — |
| `FilterBar` vs `TableFilterBar` | `FilterBar` | Alias → deprecate | — |
| `Text` vs `TextStyle` | merge into one `Text` | — | both 0 in apps |
| `Breadcrumbs` (primitives) vs inline breadcrumbs in `PageHeader` | `Breadcrumbs` | PageHeader should consume it | — |

Each of these is a guaranteed breaking change later. Doing them **now**, behind codemods, is cheaper than at 1.0+.

---

## 🟡 Needs Refactor — inconsistent API conventions

The library has **no enforced prop-naming style**. Observed divergences:

**Change handlers (5 different conventions):**
- `Button` → native `onClick`
- `Checkbox`/`Radio` → `onCheckedChange(checked)`
- `Combobox` → `onValueChange(value)` + `onQueryChange`
- `Tabs` → `onValueChange(value)`
- `ChoiceList`/`Select`/`Input` → native `onChange`
- `Pagination` → `onPageChange(page)`; `DateRangePicker`/`DensityToggle` → `onChange(value)`

**Size props (3 names):**
- `Button` → `size: 'sm'|'md'|'lg'|'icon'`
- `Select` → `controlSize: 'sm'|'md'|'lg'`
- `Avatar`/`Spinner` → `size: 'sm'|'md'|'lg'`

**Helper/description text (2 names for similar things):**
- `Input`/`Select`/`Combobox` → `helperText`
- `Checkbox`/`Radio`/`ChoiceList` → both `description` **and** `helperText`

**Variant unions differ per component** (`Button`: primary/secondary/outline/ghost/destructive; `Badge`/`Banner`: default/info/success/warning/critical(+danger); `TextStyle`: body/subdued/strong/positive/negative/code). No shared `tone`/`intent` vocabulary.

**Recommendation:** publish a one-page **API style guide** (handler = `onXChange`; size = `size`; helper = `helperText`; intent = `tone`) and align in the pre-1.0 consolidation.

---

## 🟡 Needs Refactor — type-safety & override risks

- **`MaterialIconName = keyof materialIconMap | (string & {})`** — accepts any string, so `<MaterialIcon name=" shopping-bagg" />` (typo) compiles and silently renders the fallback. 114 instances rely on it.
- **`cx` has no `tailwind-merge`** — when a consumer passes `className` that conflicts with a base utility, the winner is CSS-source-order, not call-order. Overrides are unreliable. (Mitigated in practice because most styling is arbitrary `[var(--lb-*)]` values, which rarely collide — but the contract is still "overrides may or may not work.")
- **`IndexTable<T extends {id:string}>`** forces a string `id` on every row type; rows keyed by number/uuid object must be reshaped. Reasonable, but a hard constraint worth documenting.
- **`ButtonProps` has no `as`/`asChild`** — link-styled buttons are hand-rolled across the codebase (see `PageHeader.renderDefaultAction`, `SaveBar`), so the "button" visual exists in ≥3 implementations.

---

## 🟢 Stable — the dependable core

`Button`, `Card`, `Section`, `Banner`, `Skeleton`, `EmptyState`, `Box/BlockStack/InlineStack`, `Select`, `Checkbox`, `Radio`, `ChoiceList`, `Combobox`, `Tabs`, `MetricCard`, `Avatar`, `Chart`. These extend native attributes, are correctly typed, and have stable, predictable props. They can be promoted to a stable tier immediately.

---

## Future-compatibility risks (ranked)

1. **No build boundary** — `main`/`types` → `src/index.ts`. The package ships raw TSX; every consumer transpiles it. Any internal refactor that changes file structure can break deep imports, and there's no `dist` contract to version against. **Highest structural risk.**
2. **No tests** — 0 unit tests for a library imported by 203 files. Any refactor is unguarded.
3. **Duplication debt** — the 6 duplicate pairs above each pre-commit you to a breaking change.
4. **A11y debt in dialogs/inputs** — fixing focus/ID/ARIA correctly will alter DOM/IDs and is technically breaking.
5. **Token alias removal** (see token audit) — collapsing `--lb-color-text-primary`→`--lb-color-text` is breaking for any consumer that referenced the alias directly.

**Stability verdict:** **Pre-1.0.** Core is freezable; overlays/inputs/tables and the duplicate set are not. Sequence the fixes per `UI_SYSTEM_GOVERNANCE.md` and ship a real 1.0 with a `dist` build, tests, and a frozen prop contract.
