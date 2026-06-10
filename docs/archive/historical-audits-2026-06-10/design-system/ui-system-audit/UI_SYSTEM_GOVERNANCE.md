# UI_SYSTEM_GOVERNANCE.md

**Scope:** how teams safely evolve `@letbuyy/ui` (Card, Button, Input, Modal, Table, Navigation, tokens) without breaking the Developer Portal, Themes Marketplace, Apps Marketplace, Merchant Admin, and the other 5 consumers.
**Audit date:** 2026-06-06

---

## Executive summary (for leadership)

`@letbuyy/ui` is consumed by **203 files across 9 apps** but is governed like a throwaway prototype: **version `0.0.1`, `private: true`, `main`/`types` → raw `src/index.ts`, zero tests, no changelog, no deprecation policy, no codemods.** The repo *does* have governance machinery (`AGENTS.md`, `scripts/validate-governance.mjs`, `docs/governance/`) — but it governs **runtime topology**, not the UI API. The design system has no contract.

This is the highest-leverage area in the whole audit. Until there is a **versioned, tested, documented release process**, every other recommendation (fix Input, focus-trap Modal, merge tables, collapse tokens) is unsafe to execute, because nothing catches the fallout.

The good news: the consumer set is **finite, in-repo, and concentrated** (merchant-control-plane = 35%). That makes governance tractable — you can codemod every consumer in one PR. This document defines the **versioning, deprecation, migration, and compatibility** strategies to get from v0 chaos to a foundation teams can build on.

---

## Current governance state (evidence)

| Control | State |
|---|---|
| Version | `0.0.1`, pinned, `private: true` |
| Distribution | `main`/`types` = `./src/index.ts` (raw TSX, no build) |
| Tests | **0** |
| Storybook | 4 stories + `storybook-screenshots/` (not CI-gated) |
| Changelog | none |
| Deprecation policy | none (dead aliases like `PageShell` just linger) |
| Codemods | none |
| API ownership / CODEOWNERS | not defined for the package |
| Lint rules enforcing DS usage | none (apps freely use raw `<button>`/hex) |
| Governance script | `validate-governance.mjs` — topology only, **not UI** |

---

## 1. Versioning strategy

### Adopt semver with an internal-monorepo twist
Because all consumers are in-repo, you don't need npm publishing, but you **do** need a version contract for change classification and changelog discipline.

- **Move off `0.0.1` → `0.x`** and treat the library as **explicitly pre-1.0** (breaking changes allowed on minor) **until** the consolidation in §3 is done. Communicate "pre-1.0, expect churn" so teams don't assume stability.
- **Ship a real build.** Point `main`/`types` at a compiled `dist/` (tsc/tsup). This:
  - gives a stable import contract (no deep `src/*` imports),
  - lets you detect breaking type changes via API-extractor/`tsc` diff,
  - decouples internal file moves from consumers.
- **Classify every change** (enforced in PR template):
  - **major** — remove/rename a prop, change a default that alters rendering, change a `render` signature, remove a token/CSS var, change DOM structure that consumers target.
  - **minor** — new component, new optional prop, new variant/union member, new token.
  - **patch** — bug fix with no API/visual contract change.
- **Token CSS variables are part of the public API.** Renaming `--lb-color-*` is a **major**. (Critical: apps and themes reference these.)

### Stability tiers (publish per component)
- 🟢 **Stable** — Button, Card, Section, Banner, Skeleton, EmptyState, Box/Stacks, Select, Checkbox, Radio, ChoiceList, Combobox, Tabs, MetricCard, Avatar, Chart. Frozen API; major-only changes.
- 🟡 **Evolving** — Input, Modal, IndexTable, DataTable, PageHeader, SaveBar, ConfirmDialog, DesignSystemRoot. Expect changes during consolidation.
- 🔵 **Experimental** — visual preview helpers, anything new. No stability promise.

---

## 2. Deprecation strategy

A standard, mechanical deprecation lifecycle (one minor of overlap, removal on next major):

1. **Mark** — `@deprecated` JSDoc on the export with the replacement named; add a one-time `console.warn` in dev (`process.env.NODE_ENV !== 'production'`).
2. **Document** — entry in `CHANGELOG.md` + a `DEPRECATIONS.md` table (symbol, since, remove-in, replacement, codemod).
3. **Codemod** — ship a jscodeshift transform that rewrites call sites.
4. **Migrate consumers** — run the codemod across `apps/`/`packages/` in one PR.
5. **Remove** — delete on the next major after ≥1 minor of overlap.

### Immediate deprecation backlog (dead/duplicate API)
| Deprecate | Replacement | Why | Codemod difficulty |
|---|---|---|---|
| `PageShell` | `Page` | exact alias | trivial (rename) |
| `PageActions` | `PageHeaderActions` | alias | trivial |
| `TableFilterBar` | `FilterBar` | alias | trivial |
| `DataTable` | `IndexTable` (simple mode) | duplicate, desktop-only | medium (signature differs) |
| `Text` *or* `TextStyle` | one merged `Text` | overlapping | medium |
| `Badge variant="danger"` | `variant="critical"` | dual vocab | trivial (string) |
| visual preview helpers in main bundle | move to `@letbuyy/ui/preview` subpath | ship cost | low |

---

## 3. Migration strategy

### Principle: codemod-first, never "find and replace by hand"
With 203 import sites, manual migration is error-prone. Every breaking change ships **with** its codemod, and CI verifies no un-migrated usage remains.

### Sequenced migration plan (pre-1.0 → 1.0)
**Phase A — make change safe (no API changes):**
1. Add `dist` build; repoint `main`/`types`.
2. Stand up tests (RTL) for 🟢/🟡 components; wire Storybook visual regression into CI.
3. Add `eslint` rule: forbid raw `<button>`/`<input>`/hardcoded hex in `apps/*` (warn → error over time) to stop the bypass bleeding (282 `<button>`, 138 `<input>`, 417 hex today).

**Phase B — correctness fixes (breaking, codemodable):**
4. `Input`/`Textarea`: `useId` + ARIA wiring (IDs change → audit any `getElementById`/test selectors).
5. `Modal`/`CommandPalette`: focus trap + `--lb-z-*` scale.
6. `Badge danger→critical` codemod.

**Phase C — consolidation (breaking, codemodable):**
7. Merge `DataTable`→`Table`/`IndexTable`; codemod both call shapes.
8. Remove `PageShell`/`PageActions`/`TableFilterBar` aliases.
9. Merge `Text`/`TextStyle`.
10. Collapse token aliases (`--lb-color-text-primary`→`--lb-color-text`, dual space names); codemod CSS-var references.

**Phase D — 1.0:**
11. Freeze 🟢 tier; publish API style guide; cut `1.0.0` with full changelog.

### Migration support artifacts (per breaking change)
- codemod script + dry-run report,
- `DEPRECATIONS.md` row,
- visual-regression baseline update,
- a "migration note" in the PR description with before/after.

---

## 4. Compatibility strategy

### Public contract definition (what consumers may depend on)
1. **Exported component props** (as typed in `index.ts`).
2. **Token CSS variable names** (`--lb-*`) — these are public; many apps/themes reference them.
3. **`data-*` attributes** the system sets (`data-theme`, `data-density`, `data-letbuyy-*`, `data-lb-*`) — themes/CSS may target them.
4. **Subpath exports** (`./tokens`, `./formatting`, `./logging`, `./marketplace`).

Everything else (internal file structure, class strings, DOM nesting depth) is **explicitly not contract** — but only once a `dist` build hides `src` (today, raw-`src` shipping makes file structure a de-facto contract).

### Compatibility guardrails to add
- **Type-API snapshot** (API Extractor / `tsc --emitDeclarationOnly` diff) in CI → any public type change must be acknowledged with a version bump.
- **Token-variable snapshot** — a test that fails if a `--lb-*` variable disappears/renames without a major.
- **Visual regression** on the 🟢 set across light/dark/3 densities.
- **Cross-app smoke** — build all 9 apps in CI on `@letbuyy/ui` change (the breaking-change net).
- **`marketing-site` guard** — lint/test that any app rendering DS components has a `DesignSystemRoot` ancestor (catches the current token-less bug).

### Ownership
- Define `CODEOWNERS` for `packages/typescript/ui/**` (a small DS guild).
- All `major`-classified PRs require a DS-owner review + codemod + changelog.
- Extend `validate-governance.mjs` (or a sibling `validate-ui.mjs`) to assert: no new duplicate aliases, no raw-`src` deep imports, token-var snapshot intact.

---

## Governance maturity: today → target

| Capability | Today | 1.0 Target |
|---|---|---|
| Versioning | `0.0.1` frozen | semver, pre-1.0 churn → frozen 1.0 |
| Build/dist | raw `src` | compiled `dist`, hidden internals |
| Tests | 0 | RTL on 🟢/🟡 + axe + visual regression in CI |
| Changelog/deprecations | none | `CHANGELOG.md` + `DEPRECATIONS.md` |
| Migrations | manual | codemod-per-breaking-change |
| Adoption enforcement | none | eslint bans raw `<button>`/`<input>`/hex |
| API contract | implicit | typed + token-var snapshots, CODEOWNERS |
| Cross-app safety | "check merchant admin" | CI builds all 9 apps |

**Bottom line:** the engineering org already knows how to govern (the topology governance is mature). Apply the same rigor to `@letbuyy/ui`: **build → test → version → codemod → enforce.** Do this *before* the correctness and consolidation work, because it is the net that makes that work safe.
