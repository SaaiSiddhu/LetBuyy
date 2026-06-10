# BREAKING_CHANGE_IMPACT_REPORT.md

**Scope:** blast-radius analysis for changing core `@letbuyy/ui` components.
**Audit date:** 2026-06-06
**Inputs:** usage counts from `UI_USAGE_GRAPH.md`; API shapes from source.

---

## Executive summary (for leadership)

Because the library **ships raw `src/index.ts` with no build artifact, no tests, and no semver discipline**, there is currently **nothing that stops a breaking change from silently shipping** to 203 import sites. The protection model today is "hope and `merchant-control-plane` looking okay."

The three components the brief asks about have very different blast radii:

*(All counts are apps-only product consumption — the true blast radius — per `UI_USAGE_GRAPH.md`.)*

| If this changes… | Direct sites | Effective blast radius | Worst-case failure |
|---|---|---|---|
| **Card** | 284 | **Whole product** (every app, every page) | Layout/visual regression everywhere; silent (no test catches it) |
| **Table** (DataTable **and** IndexTable) | 21 combined (2 + 19) | Data-heavy admin & ops screens | Broken selection/sort/empty-state on list views; type errors on row shape |
| **Modal** | 1 direct **+ 27 via ConfirmDialog = 28** | Every confirm/destructive flow | Focus/escape regressions on data-affecting actions |

The reassuring part: most changes can be made **additive** (new optional props, new variants) with **zero** breakage. The dangerous part: the changes you *most need* (fix `Input` IDs, add `Modal` focus trap, collapse token aliases, merge the duplicate tables) are **inherently breaking** at the DOM/ID/type level, and you have no test net to catch fallout.

**One sentence:** the foundation is safe to *extend* today and unsafe to *correct* today — fixing that asymmetry (tests + `dist` + semver) is the prerequisite for every other recommendation in this audit.

---

## Scenario 1 — "If `Card` changes, what breaks?"

**Direct usage:** 284 app instantiations. Consumers: every token-rooted app; merchant-control-plane alone has 219.
**Current API:** `layout?: 'default'|'stack'|'split'` + native `<div>` attrs. Styling via `--lb-component-card-*`.

| Change type | Breaking? | Blast radius | Notes |
|---|---|---|---|
| Add a new optional prop (`padding?`, `header?`) | 🟢 No | 0 | Safe, additive |
| Add a new `layout` value | 🟢 No | 0 | Union widening is non-breaking |
| Change default radius/shadow **token value** | 🟡 Visual | **All 284 + every nested surface** | No type break, but global visual shift; nothing tests it |
| Change root element `<section>`→`<div>` | 🔴 Yes | CSS/selectors targeting `section`, a11y landmarks | `overflow-hidden` already clips; landmark semantics change |
| Rename/remove `layout` or change to required | 🔴 Yes | 284 call sites + `data-lb-card-layout` consumers | Hard break |
| Remove `--lb-component-card-*` vars | 🔴 Yes | Card + MetricCard + Chart + IndexTable + DataTable (all read card vars) | Cascade beyond Card itself |

**Worst case:** a token-level visual change to card radius/shadow/border silently restyles the entire product with **no failing test and no type error**. This is the highest-probability, lowest-visibility risk in the system.

**Safe path:** additive props + new `layout` values only; gate any token change behind visual regression across all 8 rooted apps.

---

## Scenario 2 — "If `Table` changes, what breaks?"

**There are two tables.** This is itself the core finding: a change to "the table" is ambiguous.

- **`DataTable`** (`data-table.tsx`, 2 app uses, merchant-control-plane only): `columns: Column<T>[]`, `data: T[]`, `loading?`, `emptyMessage?`, `onRowClick?`, sort props. `Column.render(value, row, index)`.
- **`IndexTable`** (`productivity.tsx`, 19 app uses, merchant-control-plane / platform-console / platform-ops): `columns: IndexTableColumn<T>[]`, `rows: T[]` where **`T extends {id:string}`**, plus selection, bulk actions, saved views, filter chips, mobile cards. `Column.render(row, index)`.

| Change | Breaking? | Blast radius |
|---|---|---|
| Add optional column/feature prop to either | 🟢 No | 0 |
| **Unify the two render signatures** (`render(value,row,i)` vs `render(row,i)`) | 🔴 Yes | **All 21** table sites must be rewritten |
| Change `IndexTable` row constraint `{id:string}` | 🔴 Yes | 19 sites + their row types |
| Change `data`→`rows` naming to unify | 🔴 Yes | 2 DataTable sites |
| Token change to `--lb-component-table-*` | 🟡 Visual | Both tables + any card-styled surface |

**Worst case:** the *correct* long-term move — merging `DataTable` into `IndexTable` — is unavoidably breaking for all 21 sites because the two have **incompatible `render` signatures and prop names**. The longer you wait, the more sites accrue. Today, 21 is small; a codemod can rewrite both call shapes.

**Safe path:** introduce a unified `Table` as a **new** export, migrate the 28 sites via codemod, deprecate both old names for one major, then remove.

---

## Scenario 3 — "If `Modal` changes, what breaks?"

**Effective usage:** 1 direct `<Modal>` + 27 `<ConfirmDialog>` (which composes `Modal`) = **28 dialog surfaces**, concentrated in merchant-control-plane's destructive/confirm flows.
**Current API:** `open`, `title`, `description?`, `onClose`, `footer?`, `children`.

| Change | Breaking? | Blast radius |
|---|---|---|
| **Add focus trap / initial focus / restore / `inert`** (the needed fix) | 🟢 API-compatible, 🟡 behavior change | All 28 — *improves* a11y but alters focus behavior; could surprise tests that assert focus | 
| Add `size?`/`onConfirm` etc. (optional) | 🟢 No | 0 |
| Make `Modal` portal to `document.body` | 🟡 Maybe | Stacking/`z-50` collisions with Toast/CommandPalette (all `z-50`) |
| Change `ConfirmDialog` hardcoded body copy | 🟡 Copy change | 27 sites currently get the boilerplate sentence; removing it changes rendered text |
| Require focus-trap dep / change DOM structure | 🔴 Possibly | Snapshot/E2E that assert modal DOM |

**Worst case:** adding the focus trap (which you *must* do) interacts with the **shared `z-50`** across Modal/Toast/CommandPalette — if two are open, stacking is DOM-order-defined and a focus trap can lock focus to the lower layer. Fix the z-index scale (token audit Z-1) **before** the focus trap.

**Safe path:** ship focus management as a `Modal` internal (no prop changes) + introduce `--lb-z-*` scale in the same release.

---

## Scenario 4 — "If `Button` or `Badge` changes?" (added — higher usage than Modal)

- **`Button` (218):** adding variants/sizes is safe. Removing/renaming a variant (`destructive`, `ghost`) is catastrophic. Changing the **light-mode primary token from slate-900 to brand purple** (a likely brand decision) is a non-breaking *type* change but a **product-wide visual change** to 218 primary CTAs — exactly the kind of change that needs visual regression.
- **`Badge` (114):** it accepts both `'danger'` and `'critical'`. **Removing `'danger'`** to unify vocabulary breaks every site using it. A codemod (`danger`→`critical`) is required; until then, keep the normalizer.

---

## What actually protects you today: (almost) nothing

| Guardrail | Status |
|---|---|
| Unit tests on `@letbuyy/ui` | ❌ **0 tests** |
| Visual regression (Storybook screenshots) | ⚠️ 4 stories + a `storybook-screenshots/` dir, not wired to CI gating |
| Type-level contract (`dist`) | ❌ ships raw `src` |
| Semver / changelog | ❌ pinned `0.0.1`, `private` |
| Codemods for migrations | ❌ none |
| Governance validation | ⚠️ `scripts/validate-governance.mjs` exists for topology, **not** UI API |

**Consequence:** breaking changes are caught only if a human notices in `merchant-control-plane`. For a foundation with **203 import sites**, that is the single biggest organizational risk in this audit.

---

## Recommended pre-conditions before ANY core change

1. **Stand up tests** — React Testing Library on the 🔴/🟠 components (Card, Button, Badge, Input, Banner, PageHeader, Modal, IndexTable). Even 30 tests change the risk profile dramatically.
2. **Wire Storybook visual regression into CI** (the screenshots dir already exists).
3. **Ship a `dist` build** so `main`/`types` reference compiled output, giving a versionable contract.
4. **Adopt semver + CHANGELOG**, move off `0.0.1`.
5. **Write codemods** for the known-breaking consolidations (table merge, `danger`→`critical`, token-alias removal, `PageShell`/`PageActions` removal).

Then sequence the corrections per `UI_SYSTEM_GOVERNANCE.md`.
