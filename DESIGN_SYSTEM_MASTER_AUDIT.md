# LetBuyy — Design System Master Audit

**Auditor:** Principal Design Systems Architect / UI Governance Auditor
**Date:** 2026-06-09
**Mandate:** Deep, codebase-wide audit of the LetBuyy UI architecture — light/dark mode, design tokens, shared UI, component duplication, navigation, typography, spacing, color, theme persistence, and cross-app/cross-platform consistency. **Read-only.** No code modified, no redesigns, no fixes implemented. Findings are evidence-based with file:line citations.

**Surfaces audited:** 9 Next.js web apps (`app-marketplace`, `developer-portal`, `identity-platform`, `marketing-site`, `merchant-control-plane`, `platform-console`, `platform-operations-portal`, `storefront-runtime`, `theme-marketplace`), the Flutter merchant app (`apps/mobile/merchant-app`), and shared packages (`@letbuyy/ui` at `packages/typescript/ui`, `@letbuyy/theme-engine`, the `mobile-tokens` bridge, `config/tailwind`, `packages/dart/ui_kit`).

**Companion reports (read alongside this one):**
`DESIGN_TOKEN_AUDIT.md` · `THEME_ARCHITECTURE_AUDIT.md` · `LIGHT_DARK_MODE_AUDIT.md` · `COMPONENT_DUPLICATION_REPORT.md` · `NAVIGATION_GOVERNANCE_AUDIT.md` · `TYPOGRAPHY_SPACING_AUDIT.md` · `SHOPIFY_BENCHMARK_REPORT.md`

---

## 1. Executive summary

**LetBuyy has a genuinely strong design-system core wrapped in weak governance and inconsistent adoption.** The token engine in `@letbuyy/ui` (`tokens.ts`, 1,389 lines) is Polaris-grade in structure: a primitive → semantic → component tier model, light/dark/auto theming, three densities, five product surfaces, per-tenant brand injection, and runtime WCAG contrast validation. The library exports ~60 production components with codemods and a deprecation policy. On architecture alone, this is top-decile work for a company of this stage.

The gap is everything *around* the core. The same architecture is **bypassed in practice**:

- **Governance is half-wired.** ESLint blocks hex and raw elements in TSX (so TSX hex ≈ 0), but the well-designed `.stylelintrc.cjs` that would govern hand-authored CSS is **dormant** (no stylelint dependency or `lint:css` script exists anywhere), and the Tailwind-palette / raw-color rules are **warn-only**. CI lints changed files only and never fails on warnings.
- **The result is parallel CSS universes.** `merchant-control-plane/globals.css` is **10,335 lines**; `app-marketplace` **7,475**; `marketing-site` **5,143** — versus **38** and **37** for the two operations apps. Platform-wide: **~1,331 raw-px spacings**, **~720 raw-px font-sizes** (≈4:1 vs token sizes), **560 naked rgb() declarations**, **254 raw Tailwind palette classes**.
- **Adoption is universal but shallow and shell-blind.** All 9 apps import `@letbuyy/ui`, yet the app-shell module has **0 consumers** and the platform ships **10 hand-rolled navigations** (4 widths, 5 active-state strategies); two operations apps are near-byte-identical twins self-tagged `[CONSOLIDATE -> @letbuyy/ui]`.
- **Theming wiring partly defeats itself.** `DesignSystemRoot`'s default `theme="auto"` overrides the `.dark` class apps toggle on `<html>`, so canonical components can stay light in "dark mode" on a light-OS machine. There is no shared theme controller, so **5 app strategies** and **3 persistence keys** emerged; dark mode is user-reachable in only **4 of 9 apps**.
- **Mobile forks the system three times.** The Flutter app's in-sync token bridge is bypassed by a hand-maintained palette whose `success`/`error` colors diverge from web; it has the platform's best dark-mode UX on the wrong palette.

**Bottom line:** This is not a "build a design system" problem — that work is largely done and done well. It is a **"turn on the governance and force adoption"** problem. The highest-ROI fixes are configuration and consolidation, not new architecture.

---

## 2. Architecture map (what's real)

```
PRIMITIVE  letbuyyPrimitiveTokens         tokens.ts:47-121     (purple/gray/slate/status palettes)
   │
SEMANTIC   letbuyySemanticTokens          tokens.ts:186-315    (light/dark roles)
   │
COMPONENT  letbuyyComponentTokens         tokens.ts:317-488    (button/card/sidebar/input/table…)
   │
EMITTER    letbuyyTokenCss                tokens.ts:1274-1388  → --lb-* under [data-theme]/.dark/auto, [data-density], [data-letbuyy-surface]
   │
PROVIDER   DesignSystemRoot               design-system-root.tsx  (injects <style>, sets data-attrs; default theme="auto")
   │                                       + config/tailwind/letbuyy-tokens.css (Tailwind v4 @theme → --lb-color-*)
   ├── 9 web apps  → all wrap DesignSystemRoot; 5 different theme controllers; 3 persistence keys
   └── mobile      → mobile-tokens.ts → generate-mobile-tokens.mjs → letbuyy_color_tokens.dart (generated, in-sync, BYPASSED)
                                                                     live theme uses ui_kit AppColors (forked)
ENFORCEMENT
   ESLint @letbuyy/ui  eslint/index.cjs   hex+raw-elements = error; color/palette = WARN; CSS not seen
   Stylelint           .stylelintrc.cjs   well-designed but DORMANT (no dep, no script)
   CI ci.yml           turbo lint --filter "...[HEAD^1]"  (changed-only, warnings don't fail)
```

"Theme" is overloaded: this audit covers **design-system theming** (admin/platform appearance). The **storefront theme engine** (`packages/theme-engine`, merchant Liquid/sections) is a separate system — see `FORENSIC_REPORT/04-theme-system.md`.

---

## 3. Consolidated findings (by severity)

### Critical
| ID | Finding | Affected | Where |
|---|---|---|---|
| **TOK-1** | CSS token governance written but **dormant** (`.stylelintrc.cjs` never activated) → multi-thousand-line raw-value `globals.css` | merchant, app-marketplace, marketing, identity, storefront, theme-mktpl | `DESIGN_TOKEN_AUDIT.md` |

### High
| ID | Finding | Affected | Where |
|---|---|---|---|
| **TOK-2** | Color/palette ESLint rules are warn-only and CSS-blind → 254 raw palette classes, 560 naked rgb() | all 9 apps | `DESIGN_TOKEN_AUDIT.md` |
| **TOK-3** | CI lints changed files only, never fails on warnings; no design-token validator | platform | `DESIGN_TOKEN_AUDIT.md` |
| **TOK-4 / DUP-7** | Mobile token bridge in-sync but **bypassed**; 3 Dart palettes; `success`/`error` diverge | mobile | `DESIGN_TOKEN_AUDIT.md`, `COMPONENT_DUPLICATION_REPORT.md` |
| **TOK-5** | Apps re-declare `--lb-*` tokens locally, defeating single source | app-marketplace, identity, merchant | `DESIGN_TOKEN_AUDIT.md` |
| **THEME-1** | `DesignSystemRoot theme="auto"` overrides html-level `.dark` → DS components can stay light in dark mode | identity, merchant, app-marketplace, theme-mktpl | `THEME_ARCHITECTURE_AUDIT.md` |
| **THEME-2** | No shared theme controller/persistence → 5 strategies, 3 keys, 2 vocabularies | all 9 apps | `THEME_ARCHITECTURE_AUDIT.md` |
| **LDM-1** | Dark mode user-reachable in only 4/9 apps (1 hardcoded dark, 1 dead-ended) | 5 apps | `LIGHT_DARK_MODE_AUDIT.md` |
| **LDM-2** | 3 persistence keys, 2 vocabularies — preference doesn't travel across apps | 5 apps | `LIGHT_DARK_MODE_AUDIT.md` |
| **LDM-4** | Where dark works it works unevenly (app token re-authoring; merchant most fragile) | merchant, app-marketplace, identity | `LIGHT_DARK_MODE_AUDIT.md` |
| **NAV-1** | 0/9 adoption of canonical app-shell | all nav apps | `NAVIGATION_GOVERNANCE_AUDIT.md` |
| **NAV-2** | console & ops sidebars are near-identical twins, no active state | console, ops | `NAVIGATION_GOVERNANCE_AUDIT.md` |
| **DUP-2/3** | 10 hand-rolled navs; `_local-ui` workspace twins self-tagged for consolidation | platform | `COMPONENT_DUPLICATION_REPORT.md` |
| **TYP-1** | ~4:1 raw-px-to-token font-size ratio in CSS | app-marketplace, merchant, identity, marketing | `TYPOGRAPHY_SPACING_AUDIT.md` |
| **SPC-1** | ~1,331 raw-px spacing declarations in ungoverned CSS | app-marketplace, merchant, marketing | `TYPOGRAPHY_SPACING_AUDIT.md` |

### Medium / Low
THEME-3 (operations apps disagree on default theme), THEME-4 (uneven SSR flash handling), THEME-5 (density axis under-used), LDM-3 (class-vs-attribute signal), LDM-5 (mobile dark on forked palette), DUP-1/4/5/6/8 (shallow adoption, StatusBadge 5×, table renderers, marketing Header/Footer, mobile raw colors), NAV-3/4/5 (4 widths, 5 active-state strategies, hardcoded nav colors), TYP-2/3 (inline font-family, mobile type), SPC-2 (density unused), TOK-6 (no machine-readable token manifest). See companion reports.

---

## 4. FINAL SCORECARD

Scale: 0–5 (5 = Shopify-Polaris-level, production-grade, enforced).

| Category | Score | Trajectory | Rationale |
|---|:---:|:---:|---|
| **Design System Maturity** | **3.0 / 5** | ↗ | Polaris-grade token + component core (would be ~4.5 in isolation), dragged down by dormant CSS governance, no authored docs, and shallow adoption. |
| **Theme Architecture Maturity** | **3.0 / 5** | → | Excellent multi-axis engine; undermined by the `auto`-vs-`.dark` cascade defect and the absence of a shared controller/persistence. |
| **UX Consistency (cross-app)** | **2.0 / 5** | ↘ | 5 theme strategies, 10 navigations, parallel CSS universes, mobile color divergence — the same brand renders measurably differently per app. |
| **Navigation Consistency** | **1.5 / 5** | → | Strong canonical shell with 0/9 adoption; 4 widths, 5 active-state strategies, twin sidebars. |
| **Component Reuse** | **2.5 / 5** | ↗ | Universal import of a ~60-component library, but shallow depth and shell/composite reinvention. |
| **Dark Mode Readiness** | **2.0 / 5** | → | Full engine capability; reachable in only 4/9 apps; cascade bug; 3 keys. Mobile dark is the bright spot (3.5). |
| **Shopify-Level Readiness** | **2.0 / 5 (≈40/100)** | ↗ | Polaris-grade bones, pre-Polaris governance/adoption/parity. |
| **Overall design-system posture** | **2.3 / 5** | ↗ | Strong foundation, weak governance. The fixes are mostly configuration + consolidation, so the trajectory is favorable if prioritized. |

**Supporting sub-scores** (from companion reports): Token architecture 4.5 · Token enforcement 1.5 · Type/space scale definition 4.5 · Type/space adoption 2.0–2.5 · Cross-platform token parity 2.0.

---

## 5. Prioritized remediation roadmap

**P0 — Turn on the gates (configuration; days-to-weeks; highest ROI).**
1. Activate stylelint as an **error** gate and add `lint:css` (TOK-1).
2. Promote `no-tailwind-default-color` / `no-raw-color-functions` / `no-raw-form-controls` to **error** after a burn-down (TOK-2).
3. Run lint repo-wide in CI and **fail on warnings**; add a `validate:design-tokens` step (TOK-3).
4. Wire `generate-mobile-tokens.mjs --check` into CI (TOK-4).

**P1 — One theme authority (small library addition; removes 5 forks).**
5. Ship `LetbuyyThemeProvider` + `useLetbuyyTheme()` (one key `letbuyy-theme`, vocabulary `light|dark|system`, pre-paint script) and route `DesignSystemRoot theme` from the resolved value (THEME-1/2, LDM-1/2/3). Delete the 5 bespoke controllers.

**P2 — Force shell + component adoption (consolidation).**
6. Adopt `AppFrame`/`Sidebar`/`Navigation` in console/ops/merchant; collapse the twin sidebars and `_local-ui` workspaces; delete duplicate StatusBadge/ModuleCard (NAV-1/2, DUP-2/3/4).

**P3 — Burn down drift + parity + docs.**
7. Migrate the large `globals.css` files to `var(--lb-*)` against a ratcheting drift budget (TOK-5, TYP-1, SPC-1).
8. Repoint mobile at generated tokens; reconcile `AppColors` (TOK-4, DUP-7/8).
9. Emit versioned `tokens.json` (W3C DTCG) for Figma + mobile; author per-component usage/a11y docs; add visual-regression using the existing Storybook baselines (TOK-6, `SHOPIFY_BENCHMARK_REPORT.md`).

---

## 6. Method & evidence integrity

Findings were derived by reading the token engine, provider, ESLint plugin, stylelint config, and CI workflows directly, and by quantifying per-app usage with `rg`/`grep` (counts shown in companion reports). Structural claims (e.g. the `auto`-vs-`.dark` cascade in THEME-1) are derived from the emitted CSS selectors at `tokens.ts:1275-1298` and verified against app wiring. Counts that mix legitimate `var(--token, fallback)` patterns with true hardcoding were separated where material (see `COMPONENT_DUPLICATION_REPORT.md` method note). This audit reconciles with — and adds composition-level nuance to — the repo's own `FORENSIC_REPORT/09-duplication.md` and `FORENSIC_REPORT/04-theme-system.md`. No files were modified.
