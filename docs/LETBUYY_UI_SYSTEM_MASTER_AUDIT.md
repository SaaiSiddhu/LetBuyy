# LETBUYY_UI_SYSTEM_MASTER_AUDIT

**The definitive assessment of `@letbuyy/ui` as the single design foundation for the LetBuyy ecosystem.**

**Audit date:** 2026-06-06
**Scope:** `@letbuyy/ui` (`packages/typescript/ui`) and shared UI infrastructure — design tokens, component library, styling system, icon system, layout primitives, theming. Consuming apps were inspected only to trace usage.
**Package:** `@letbuyy/ui@0.0.1` (private) · 25 files · ~7,512 LOC · ~50 components · 88 value exports + 4 subpaths + ~150 icons.
**Reviewer lens:** Polaris architect / Stripe + Atlassian design-system engineering / staff frontend / accessibility lead / component-library maintainer.
**Method:** full source read of every component, hook, token, provider, and util; static usage tracing via ripgrep across `apps/ packages/ services/`; token contrast math; benchmark against Polaris / Stripe / Linear / Vercel. Claims are grounded in source and counts (see each phase doc). Not a substitute for runtime AT testing or axe-core CI.

---

## ▶ For leadership (read this section only, if nothing else)

### The question
> *Can `@letbuyy/ui` become the single design foundation for the entire LetBuyy ecosystem?*

### The answer
**Yes — but it is not one today, and the gap is discipline, not architecture.**

`@letbuyy/ui` is a **genuinely good prototype that the organization has already started treating as a foundation.** It is consumed by **203 files across 9 apps**, its token system is **at or above** Shopify/Stripe quality, and its component vocabulary is faithfully Polaris-shaped. The architecture is right and should be **kept, not rebuilt.**

What disqualifies it *today* from being called a stable foundation is everything *around* the code:

- **No tests. No build artifact (ships raw `src`). Frozen at `0.0.1`. No versioning, no changelog, no codemods.** There is no net under 203 import sites.
- **The product bypasses the system at scale** — apps contain **more raw `<button>` (282) than DS `<Button>` (218)** and **more raw `<input>` (138) than DS `<Input>` (103)**, plus **417 hardcoded hex colors**. The system renders **well under half** of the product's core controls — and **17 of its components (incl. the layout primitives and the accessible form controls) have zero app adoption at all.**
- **Correctness gaps in the highest-traffic surfaces** — the `Modal` has no focus trap; `Input` (103 uses) has ID collisions and unwired error ARIA; the default `theme="auto"` can't actually render dark mode; one app (`marketing-site`) renders components with no theme tokens at all.

### The verdict in one line
**A strong v0 masquerading as a v1. Promotable to a true, ecosystem-wide foundation in an estimated 2–3 quarters of disciplined work — with no rewrite of what already exists.**

### Overall grade: **C+ / B−**
Architecture **A−**. Operational maturity (tests, distribution, versioning, adoption safety) **D/F**. The spread between those two numbers *is* the finding.

### The 5 things that matter most
1. **Build the foundation under the foundation** — `dist` build, tests (RTL + axe), visual regression, semver, codemods. *Nothing else is safe until this exists.*
2. **Fix the high-traffic correctness gaps** — Modal focus trap, Input ID/ARIA, color contrast, `prefers-color-scheme`, and `marketing-site`'s missing token root.
3. **Stop the bypass** — an eslint fence that makes raw `<button>`/`<input>`/hex an error in apps, plus the missing primitives (`Drawer`, `Dropdown`, one unified `Table`) that teams are currently hand-rolling.
4. **Consolidate the duplicates and unify the API grammar** — one table, one text component, one change-handler convention; delete the dead aliases.
5. **Finish theming** — wire the (already-present) `surface` seam, add a `brand` input, fix `auto`. This is what makes "like Shopify" white-label possible.

### What it would cost to *not* do this
Adoption is concentrated in `merchant-control-plane` (35% of all usage) with no test net. Each new app and each new feature deepens the dependency on an unversioned, untested package. The longer the consolidation waits, the larger the eventual breaking-change blast radius (already 203 sites). This is a **pay-now-or-pay-double-later** situation.

---

## Key metrics at a glance

| Metric | Value | Source |
|---|---|---|
| Consuming apps | 9 of 9 web apps | `UI_USAGE_GRAPH.md` |
| Import sites | **203 files** | usage trace |
| Dominant consumer | merchant-control-plane (**72 files, 35%**) | usage trace |
| Components | ~50 (88 value exports) | `UI_COMPONENT_CATALOG.md` |
| Most-used component | `Card` (284 app uses) | usage trace |
| Load-bearing five | Card 284 · Section 261 · Button 218 · Badge 114 · Input 103 | usage trace |
| Components with **zero app adoption** (Storybook-only) | **17** (incl. Box, BlockStack, InlineStack, Checkbox, Radio, ChoiceList, Combobox) | usage trace |
| Unit tests | **0** | source |
| Raw `<button>` in apps (DS bypass) | **282** (> the 218 DS `<Button>`) | usage trace |
| Raw `<input>` in apps | **138** (> the 103 DS `<Input>`) | usage trace |
| Hardcoded hex in apps | **417** (36 files) | usage trace |
| Missing requested primitives | `Drawer`, `Dropdown/Menu` (also Popover) | catalog |
| Duplicate component pairs | 6 (tables, Page/Shell, PageActions, FilterBar, Text/TextStyle, breadcrumbs) | API stability |
| Token tiers | primitive → semantic → component → density | `DESIGN_TOKEN_AUDIT.md` |
| Themes | light / dark (+ broken `auto`) | `THEMING_AUDIT.md` |

---

## Consolidated scorecard

| Dimension | Grade | Verdict |
|---|---|---|
| Token architecture | **A−** | Three-tier + density; keep verbatim |
| Token hygiene (aliases, breakpoints, z-index) | **C** | Alias sprawl; no breakpoint/z-index tokens |
| Component vocabulary / coverage | **B+** | Polaris-faithful; missing overlay primitives |
| API stability & consistency | **C** | 6 duplicates, 5 handler grammars, 2 Dangerous bugs |
| Accessibility — controls | **A−** | Tabs/Combobox/Select genuinely strong |
| Accessibility — dialogs/inputs/contrast | **D** | No focus trap; Input ARIA; AA contrast fails |
| Responsive foundation | **C−** | Works per-component; no breakpoint/grid/container system |
| Theming — mechanism | **A−** | CSS-variable substrate is correct |
| Theming — coverage (auto/brand/surface) | **C−** | `auto` broken, `surface` inert, no brand API |
| Governance / versioning / distribution | **F** | `0.0.1`, raw `src`, 0 tests, no semver |
| Adoption safety | **D** | ~50% coverage; heavy bypass; no lint fence |
| **Overall** | **C+ / B−** | Strong architecture, pre-1.0 operations |

---

## Top findings (the headline set)

**P0 — correctness / a11y (fix first):**
- `Modal`/`CommandPalette` have no focus trap, initial focus, restoration, or inert background (28 dialogs).
- `Input`/`Textarea` use label-derived IDs (collisions) and omit `aria-describedby`/`aria-invalid` (120 instances).
- `theme="auto"` (the default) never renders dark — no `prefers-color-scheme`.
- `marketing-site` renders DS components with **no `DesignSystemRoot`** → undefined token variables.
- `textMuted` (~2.6:1) and brand-purple text (~3.5:1) fail WCAG AA; overlay layers all share `z-50`.

**P1 — architecture / stability:**
- **0 tests**, raw-`src` distribution, frozen `0.0.1` — no contract under 203 sites.
- DS heavily bypassed (282 `<button>`, 138 `<input>`, 417 hex).
- Missing `Drawer`, `Dropdown/Menu`, `Popover`; two competing tables; `surface` axis inert; no brand-override API; no breakpoint/z-index/grid/container primitives; components hand-roll raw buttons instead of using `Button`.

Full ranked list: **`ui-system-audit/TOP_100_UI_FOUNDATION_ISSUES.md`**.

---

## The 13-phase audit (index)

All phase documents live in **[`docs/ui-system-audit/`](./ui-system-audit/)**. Each is layered: a leadership summary on top, full engineering depth below.

| # | Document | What it answers |
|---|---|---|
| 1 | [UI_COMPONENT_CATALOG.md](./ui-system-audit/UI_COMPONENT_CATALOG.md) | Every component/hook/token/util: purpose, props, deps, usage count |
| 2 | [DESIGN_TOKEN_AUDIT.md](./ui-system-audit/DESIGN_TOKEN_AUDIT.md) | Colors, type, spacing, radius, shadow, breakpoints, z-index, motion — source of truth vs duplication |
| 3 | [COMPONENT_API_STABILITY_REPORT.md](./ui-system-audit/COMPONENT_API_STABILITY_REPORT.md) | Stable / Needs-Refactor / Dangerous per component; breaking & inconsistent APIs |
| 4 | [UI_USAGE_GRAPH.md](./ui-system-audit/UI_USAGE_GRAPH.md) | Per-component consumers, blast radius, DS-bypass graph |
| 5 | [BREAKING_CHANGE_IMPACT_REPORT.md](./ui-system-audit/BREAKING_CHANGE_IMPACT_REPORT.md) | If Card / Table / Modal change — what breaks |
| 6 | [DESIGN_SYSTEM_CONSISTENCY_REPORT.md](./ui-system-audit/DESIGN_SYSTEM_CONSISTENCY_REPORT.md) | Benchmarked vs Polaris / Stripe / Linear / Vercel |
| 7 | [RESPONSIVE_FOUNDATION_REPORT.md](./ui-system-audit/RESPONSIVE_FOUNDATION_REPORT.md) | Breakpoint / container / grid / layout systems; device support |
| 8 | [ACCESSIBILITY_AUDIT.md](./ui-system-audit/ACCESSIBILITY_AUDIT.md) | WCAG 2.1 AA: keyboard, focus, ARIA, contrast, SR |
| 9 | [THEMING_AUDIT.md](./ui-system-audit/THEMING_AUDIT.md) | Light/dark/auto, theme variables, brand, white-label |
| 10 | [UI_SYSTEM_GOVERNANCE.md](./ui-system-audit/UI_SYSTEM_GOVERNANCE.md) | Versioning, deprecation, migration, compatibility |
| 11 | [LETBUYY_UI_SYSTEM_V2.md](./ui-system-audit/LETBUYY_UI_SYSTEM_V2.md) | The ideal target system & phased roadmap |
| 12 | [TOP_100_UI_FOUNDATION_ISSUES.md](./ui-system-audit/TOP_100_UI_FOUNDATION_ISSUES.md) | 100 ranked issues: severity, impact, consumers, fix |
| 13 | [BRUTAL_REVIEW.md](./ui-system-audit/BRUTAL_REVIEW.md) | Unvarnished Polaris-team review: praise / reject / redesign / rebuild |

---

## ▶ For engineers — the execution path

The phase docs contain file/line-level detail. The recommended sequencing (full version in `UI_SYSTEM_GOVERNANCE.md §3` and `LETBUYY_UI_SYSTEM_V2.md §7`):

**Quarter 1 — Foundation safety (no API changes):**
`dist` build (repoint `main`/`types`) → RTL + jest-axe tests on the 🟢/🟡 tier → wire Storybook visual regression + cross-app build into CI → eslint rule banning raw `<button>`/`<input>`/hex in `apps/*` → token-variable snapshot test.

**Quarter 2 — Correctness + theming (breaking, codemodded):**
`useFocusTrap` for Modal/CommandPalette → Input/Textarea `useId` + ARIA → `--lb-z-*` and `--lb-bp-*` token scales → fix `theme="auto"` (`prefers-color-scheme`) → wire `data-letbuyy-surface` overrides + add `brand` input → fix `marketing-site` root → contrast token fixes.

**Quarter 3 — Consolidation (breaking, codemodded):**
Merge `DataTable`+`IndexTable` → one `Table` → merge `Text`+`TextStyle` → remove `PageShell`/`PageActions`/`TableFilterBar` aliases → collapse token aliases → unify API grammar (`onChange`, `size`, `helperText`, `tone`).

**Quarter 4 — Expansion + 1.0:**
Add `Drawer`, `Popover`, `Dropdown/Menu`, `Switch`, `Grid`, `Container`, `Navigation/AppFrame` → freeze the stable tier → publish API style guide + theme playground → cut **`@letbuyy/ui` 1.0**.

**Definition of done — "the single design foundation":**
raw `<button>`/`<input>`/hex are lint errors; all 9 apps build green on every UI change in CI; every requested pattern (incl. Drawer, Dropdown) exists; light/dark/auto + per-surface + per-brand all work; a new app is themed by setting `brand`+`surface` on one `DesignSystemRoot`.

---

## Bottom line

`@letbuyy/ui` has the **right architecture, the right vocabulary, and real craft in its best components** — the token system and density model are competitive with the systems it emulates. It is held back not by what it *is* but by what it *lacks around itself*: tests, a build, versioning, adoption enforcement, a handful of correctness fixes, three missing overlay primitives, and one theming follow-through.

**Recommendation: invest. Do not rebuild.** Fund the 2–3 quarter hardening in `UI_SYSTEM_GOVERNANCE.md` / `LETBUYY_UI_SYSTEM_V2.md`, starting with the test/build/versioning net in Q1 because every other fix depends on it. Executed in order, `@letbuyy/ui` becomes exactly what the brief asks: **the stable, single design foundation for the entire LetBuyy ecosystem.**
