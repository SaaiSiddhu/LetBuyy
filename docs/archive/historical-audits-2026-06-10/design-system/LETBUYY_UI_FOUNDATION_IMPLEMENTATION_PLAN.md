# LetBuyy UI Foundation — Implementation Plan, Governance Framework & V2 (Phases 10–12)

**Date:** 2026-06-08. Sequenced from the Top-200 register. Principle, stated up front and non-negotiable: **keep the architecture, do not rebuild.** `@letbuyy/ui` v0.0.2 is a sound foundation; this plan closes the operational base, fences the divergence channels, and adds the design↔code spine.

---

## Part 1 — Phased roadmap (P0–P4)

Effort key: **S** ≤1 wk · **M** 1–3 wk · **L** 3–6 wk · **XL** >6 wk (team).

### P0 — Foundation under the foundation (now; ~1 quarter)
*Goal: make divergence impossible and upgrades safe before adding scope.*

| Workstream | What | Effort | Apps | Depends on | Risk | Outcome |
|---|---|:--:|---|---|---|---|
| **P0.1 Token pipeline (DTCG)** | Move token source to W3C DTCG JSON; Style Dictionary emits `--lb-*` CSS, Tailwind theme, **Dart**, **Figma**. Keep `tokens.ts` public API as a generated shim. | XL | ALL+MOB | — | Token churn; mitigate w/ snapshot validators (already exist) | One source → CSS/Tailwind/Dart/Figma; root-cause fix for #4/#5/#6 |
| **P0.2 Complete ramps + de-hex semantic layer** | Generate full OKLCH ramps; remove all raw hex from semantic tokens; turn `no-hardcoded-hex` on inside the DS. | M | DS | P0.1 | Visual shifts; gate with VRT | Pure 3-tier; DS obeys its own rules |
| **P0.3 Fence every channel** | Restrict Tailwind palette to `--lb-*` in a shared `@letbuyy/tailwind-preset`; add Stylelint (ban raw color/units in `.css`); extend ESLint to `select/textarea/a/dialog` + `rgb()/hsl()`. Codemod the ~613 Tailwind colors + per-app `globals.css`. | L | ALL | P0.1 | Large mechanical change; codemod + CI | Divergence becomes a build error, not a guideline |
| **P0.4 Operational base** | `dist` build; adopt `changesets`; cut **1.0.0**; changeset-required CI; `@letbuyy/ui-migrator` CLI wrapping the 6 codemods. | M | ALL | — | Low | Safe, versioned upgrades for 9 apps |
| **P0.5 A11y baseline** | Declare **WCAG 2.2 AA**; axe-in-CI per story; **portal** overlays; add scroll-lock + focus-return; verify 24×24 targets in compact density. | L | ALL | — | Overlay refactor regressions; VRT+interaction tests | A11y becomes enforced, not aspirational |
| **P0.6 Test/VRT floor** | RTL tests for top 15 components; dark/density/mobile VRT variants; keyboard interaction tests for overlays/forms. | L | DS | P0.5 | Time | A real net under 1.0.0 |

**P0 business value:** stops design debt accrual at the source, unlocks safe multi-app upgrades, removes the mobile/web split, and makes the platform a11y-defensible (enterprise sales unblock). **This is the only phase that is strictly prerequisite — nothing below is safe without it.**

### P1 — Coverage & design↔code spine (next quarter)

| Workstream | What | Effort | Apps | Depends | Outcome |
|---|---|:--:|---|---|---|
| P1.1 Docs site | Storybook Docs/zeroheight: per-component usage, do/don't, a11y, code; token reference (generated); getting-started. | L | ALL | P0.1 | Teams stop guessing |
| P1.2 Figma kit (DTCG parity) | Figma library bound to DTCG tokens; 1:1 with code; design-lint pre-handoff. | L | ALL+MOB | P0.1 | Design and code render the same decisions |
| P1.3 Missing primitives | `Form/FormField/Fieldset`, responsive `AppFrame` (mobile nav), virtualized `Table`, `FileUpload`, `Stepper`, accessible `Chart` w/ data-table fallback. | XL | MCP,ID,AM,SF | P0 | Teams stop hand-rolling |
| P1.4 Wire breakpoints + page templates | All apps consume the preset; publish list/detail/settings/empty/loading/error templates. | M | ALL | P0.3 | Structural page consistency |
| P1.5 Governance v1 | CODEOWNERS, RFC process, component lifecycle (EA/Beta/GA/Deprecated), Definition of Done, deprecation policy. | M | DS | — | Decision rights defined |
| P1.6 Mobile parity | Dart tokens generated; web↔mobile component parity matrix; CI drift test. | L | MOB | P0.1 | Merchant web↔mobile converge |

### P2 — Measure & deepen
Adoption telemetry (coverage % per app, à la stylelint-polaris) + DX survey; content/UX-writing guidelines + terminology lint; VPAT after audit; dark-mode/contrast full audit; chart system + data-viz tokens; RTL + i18n strategy (generalize India/INR helpers); cross-browser VRT; recipes gallery; AGENTS.md for AI-on-system.
*Effort: L–XL across quarter. Outcome: the system proves and defends its consistency with data.*

### P3 — Scale & polish
Container queries; high-contrast/forced-colors theme; ultra-wide strategy; print styles; performance budgets (Lighthouse CI, token-CSS build-time option, treeshake verification); illustration/asset system; theming playground for white-label brand testing.

### P4 — Future-surface readiness
Pre-define patterns for reserved surfaces (`search`, `media`, `notification`, `analytics` services; `shopper-app`, `operator-app`) so they launch on-system from day one; external distribution for theme/app developers; design-token request intake; ADR log.

### Sequencing at a glance
```
P0 ███ pipeline · ramps · fences · ops base · a11y · tests   ← prerequisite, ~1 qtr
P1   ███ docs · Figma · primitives · templates · governance · mobile parity
P2     ███ telemetry · content · VPAT · charts · i18n
P3       ██ container queries · perf · high-contrast · assets
P4         ██ future surfaces · external distribution
```

---

## Part 2 — Governance Framework

### Ownership model (hybrid — the 2024–26 consensus)
A **small core DS team owns** tokens, primitives, the contribution process, ESLint/Stylelint rules, codemods, and releases. **Product teams contribute** components/patterns via RFC. Encode in `CODEOWNERS` for `packages/typescript/ui/**` and the shared preset.

### Code-review rules (enforced in CI, not by reviewers' memory)
- `@letbuyy/ui/no-raw-elements` (extended to all interactive/semantic elements) and `no-hardcoded-hex` (+ `rgb()/hsl()`) at **error**.
- Stylelint bans raw color/units and non-`--lb-*` custom properties in `.css`.
- Tailwind preset exposes **only** token-backed color utilities (Tailwind defaults removed).
- A PR touching `packages/typescript/ui` **must** include a changeset; a PR adding a component **must** satisfy the Definition of Done.
- Token snapshot validators (public-API, token-variable, no-new-alias) stay required.

### Design-review rules
- New component/pattern needs an **RFC** (problem, prior art in Polaris/ADS, API, a11y, tokens, Figma) reviewed at a **fortnightly critique** (ADS model).
- Figma changes must round-trip through DTCG tokens (no off-token values; design-lint gate).

### Component "Definition of Done" (Carbon-style gate for **GA** status)
Spec (all states, focus order, **tokenized** color/space/type, 4.5:1 / 3:1 contrast) · Code (typed API, no magic numbers, responsive to 320px, RSC-safe, `cx`/tokens only) · Tests (unit ≥80%, **axe**, keyboard interaction, dark+density VRT) · Docs (usage/do-don't/code/a11y) · Figma (published, parity) · Codemod (if it changes any existing API).

### Versioning & deprecation (semver + warn→wait→remove)
- **SemVer** via changesets: patch=fix, minor=additive (incl. *introducing* a deprecation), major=removal.
- Component status: **Early Access → Beta → GA → Caution → Deprecated** (surfaced in docs + types).
- **Deprecation lifecycle:** ship `warnDeprecated()` + docs of the replacement in a **minor**; keep ≥1 minor; remove in the next **major** — with a **codemod** shipped *in the same release*.

### Migration & breaking-change policy
- No breaking change ships without: a codemod (or documented manual steps), a version guide entry, and a CI dry-run of the codemod against all 9 apps.
- Cross-app upgrades coordinated by the core team (Stripe's "instrument the migration, don't mandate it" — templates + automated paths, not edicts).

---

## Part 3 — LetBuyy Platform Design System V2 (target state)

**Tokens.** DTCG-native, full OKLCH ramps, 3 pure tiers, light/dark/**high-contrast**, 3 densities, 5 surfaces, brand override with **CI-gated contrast**. One source → CSS, Tailwind, Dart, iOS, Figma.

**Components.** ~60 → growth via RFC; overlays on a headless primitive (Base UI/Floating UI) + **portals**; full form system; virtualized data grid; accessible charts; every component GA-gated by the DoD.

**Patterns.** Documented page templates (index/detail/settings/onboarding) and the full state set (empty/loading/error/success); content & UX-writing guidelines; data-density and density-usage guidance.

**Layouts & navigation.** Token-derived responsive grid + container queries; responsive `AppFrame` with mobile nav; standardized IA and `PageHeader` identity across all surfaces; skip-link + landmark guarantees.

**Accessibility.** WCAG 2.2 AA as the contract; axe-in-CI + manual SR protocol; published VPAT; forced-colors support.

**Theming & branding.** Per-surface + per-merchant white-label through the `brand` API and DTCG themes (the "like Shopify" requirement), validated for contrast; one theme-state mechanism (retire the `.dark`/`data-theme`/`data-letbuyy-theme` triplication).

**Governance.** Hybrid ownership, RFCs, lifecycle, DoD, semver+codemods, adoption telemetry, docs+Figma parity, AGENTS.md for AI-assisted development that stays on-system.

**Definition of success (12 months):** maturity scorecard ≥ **4.2/5**; design-system coverage ≥ **95%** of UI per app (measured); **0** off-token colors platform-wide (lint-enforced); web↔mobile token drift **0** (CI-gated); WCAG 2.2 AA with published VPAT; every GA component passing the DoD; new surfaces launching on-system by default.

---

*Companions:* `LETBUYY_DESIGN_SYSTEM_DISCOVERY.md` · `DESIGN_TOKEN_AUDIT.md` · `DESIGN_SYSTEM_MATURITY_SCORECARD.md` · `TOP_200_ISSUES.md` · master synthesis in `LETBUYY_PLATFORM_DESIGN_SYSTEM_MASTER_REPORT.md`.
