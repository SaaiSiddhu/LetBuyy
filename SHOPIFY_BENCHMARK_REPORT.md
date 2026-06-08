# LetBuyy — Shopify (Polaris) Benchmark Report

**Auditor:** Principal Design Systems Architect / UI Governance
**Date:** 2026-06-09
**Scope:** Benchmark LetBuyy's design system against Shopify Polaris (the explicit reference, given LetBuyy positions as "like Shopify") across token architecture, components, theming/dark mode, governance, and cross-platform parity.
**Method:** LetBuyy findings from the companion audits; Polaris facts from Shopify's public Polaris documentation and design-system writeups (sources at end). No code modified.

> **One-line verdict:** Structurally, LetBuyy is **closer to Polaris than almost any startup design system** — a real tiered-token model, ~60 components, density, surfaces, brand theming, and contrast validation. The gap is not architecture; it is **governance, adoption, documentation, and cross-platform parity**. Polaris's edge is that its single source of truth is *enforced and consumed*; LetBuyy's is *defined but bypassed*. **Shopify-level readiness ≈ 2.0/5 (≈40/100):** Polaris-grade bones, pre-Polaris discipline.

---

## 1. Side-by-side

| Dimension | Shopify Polaris | LetBuyy | Gap |
|---|---|---|---|
| **Token tiers** | Palette tokens (private) → alias/semantic tokens (public, e.g. `--p-color-text`); HSLuv palette, 12 hues × 10–16 shades | Primitive → semantic → component (`tokens.ts:47-488`); purple/gray/slate palettes | **Small.** Same 2–3 tier model. LetBuyy lacks HSLuv perceptual calibration and a machine-readable token package. |
| **Token interchange** | `@shopify/polaris-tokens` — standalone, versioned, machine-readable, consumed by code + Figma | TS objects only; auto-generated "design-system" doc is a repo scan, not a token manifest | **Medium.** No `tokens.json`/DTCG export; no Figma sync artifact. |
| **Component library** | 60+ production components, single source of truth | ~60 components in `@letbuyy/ui` (`index.ts`) | **Small on coverage.** Comparable breadth. |
| **Component adoption** | The library *is* the admin; consistent consumption | 287 import sites but shallow in some apps; 0/9 app-shell adoption; 10 hand-rolled navs | **Large.** Coverage ≠ consumption. |
| **Dark mode** | AppProvider + ThemeProvider; quarterly-improved dark support | Engine supports light/dark/auto/density/surfaces; **reachable in 4/9 apps**, `auto`-vs-`.dark` cascade bug, 3 persistence keys | **Large.** Capability ≫ delivery. |
| **Governance / CI** | CI enforces token usage, a11y, **visual regression**; contribution workflow; versioned releases | ESLint hex/raw-element = error; color rules **warn-only**; **stylelint dormant**; no design/token validator; changed-only lint | **Large.** The defining gap. |
| **Accessibility** | WCAG AA baked into components + docs | Runtime contrast validator (`validateLetbuyyBrandContrast`, `tokens.ts:1154`); a11y in `Navigation`/controls | **Medium.** Primitives present; no automated a11y/visual-regression gate in CI. |
| **Cross-platform** | Polaris is web; React Native via Restyle as a separate lineage | Web tokens + a Flutter bridge (`mobile-tokens.ts`) that is **in-sync but bypassed**; 3 Dart palettes | **Large.** Bridge exists, isn't the source of truth. |
| **Documentation** | polaris.shopify.com: foundations, usage, content, a11y per component | `docs/design-system/README.md` is auto-generated scan; `DEPRECATIONS.md` + Storybook stories exist | **Medium-Large.** No human-authored usage/foundation docs. |
| **Density** | Polaris is largely one density | 3 densities, density-aware tokens, `DensityToggle` | **LetBuyy ahead** (a genuine differentiator, if exercised). |
| **Multi-tenant brand** | Polaris is Shopify-branded | Per-tenant brand injection + contrast check (`createLetbuyyBrandVariables`, `tokens.ts:1187`) | **LetBuyy ahead** (necessary for a storefront platform). |

---

## 2. Where LetBuyy meets or beats Polaris

1. **Tiered tokens with component tier.** LetBuyy's explicit `letbuyyComponentTokens` (`tokens.ts:317-488`) is a clean third tier, conceptually equal to Polaris's alias layer.
2. **Three-density system.** Polaris doesn't ship this; LetBuyy's `compact/comfortable/spacious` with density-aware component variables (`tokens.ts:500-585`) is more ambitious.
3. **Per-tenant brand theming + runtime WCAG contrast.** Essential for a Shopify-style multi-merchant platform and genuinely well-built (`tokens.ts:1154-1234`).
4. **Surfaces.** Five product surfaces (`admin/marketplace/storefront/identity/operations`) is a thoughtful scoping mechanism Polaris approximates only via theming.

---

## 3. Where Polaris is decisively ahead (the readiness gap)

1. **Enforcement is the product.** Polaris's single source of truth holds because CI blocks token violations, runs visual regression, and gates a11y. LetBuyy *defines* the source of truth, then leaves the two biggest drift channels (hand-authored CSS; Tailwind palette classes) ungoverned — `.stylelintrc.cjs` is written but dormant, color lint is warn-only (`DESIGN_TOKEN_AUDIT.md` TOK-1/2/3). Outcome: 10,335-line `globals.css`, 1,331 raw-px spacings, 254 raw palette classes.
2. **Adoption is mandatory, not optional.** Polaris components *are* the Shopify admin. LetBuyy's app-shell has 0 consumers and 10 navs coexist (`NAVIGATION_GOVERNANCE_AUDIT.md`).
3. **One theme controller.** Polaris centralizes theme/color-scheme in providers. LetBuyy ships no controller, so 5 app strategies + 3 keys emerged (`THEME_ARCHITECTURE_AUDIT.md` THEME-2).
4. **Machine-readable, versioned tokens + Figma sync.** `@shopify/polaris-tokens` is consumed by design and code; LetBuyy has no equivalent artifact, so design↔code drift is uncontrolled.
5. **Authored documentation.** Polaris documents usage/do's/don'ts/a11y per component; LetBuyy's design-system doc is a generated file inventory.

---

## 4. Closing-the-gap roadmap (to reach "Shopify-level")

**Phase 1 — Turn on the gates (weeks, highest ROI).**
- Activate stylelint as an error gate (TOK-1); promote color/raw-element lint to error (TOK-2); run lint repo-wide in CI, fail on warnings (TOK-3); wire `generate-mobile-tokens --check` (TOK-4).

**Phase 2 — Make adoption mandatory.**
- Ship `LetbuyyThemeProvider` (one key, one vocabulary, pre-paint script) and route `DesignSystemRoot theme` from it (THEME-1/2). Adopt `AppFrame`/`Sidebar`/`Navigation` in console/ops/merchant first (NAV-1/2). Delete `_local-ui` twins and duplicate status components (DUP-3/4).

**Phase 3 — Interchange + parity + docs.**
- Emit versioned `tokens.json` (W3C DTCG) as the single source feeding TS/CSS/Dart/Figma (TOK-6). Reconcile mobile `AppColors` to generated tokens (TOK-4). Author per-component usage + a11y docs; add visual-regression (the Storybook baselines already exist under `packages/typescript/ui/storybook-screenshots/`).

**Phase 4 — Burn down drift.**
- Migrate the large `globals.css` files to tokens against a ratcheting "drift budget"; expose density + dark toggles consistently.

---

## 5. Shopify-readiness scorecard (component of the master scorecard)

| Dimension | LetBuyy vs Polaris | Rating |
|---|---|---|
| Token architecture | At parity (minus HSLuv/interchange) | **4.0 / 5** |
| Component coverage | At parity | **4.0 / 5** |
| Adoption / single-source-in-practice | Far behind | **1.5 / 5** |
| Governance / CI enforcement | Far behind | **1.5 / 5** |
| Dark mode delivery | Behind | **2.0 / 5** |
| Cross-platform parity | Behind | **2.0 / 5** |
| Documentation | Behind | **2.0 / 5** |
| **Shopify-level readiness (overall)** | Polaris bones, pre-Polaris discipline | **2.0 / 5 (≈40/100)** |

---

## Sources
- [Tokens — Shopify Polaris (Color)](https://polaris-react.shopify.com/design/colors/color-tokens)
- [Palettes and roles — Shopify Polaris](https://polaris-react.shopify.com/design/colors/palettes-and-roles)
- [Shopify/polaris-tokens (GitHub)](https://github.com/Shopify/polaris-tokens)
- [Polaris — unified and for the web (2025), Shopify](https://www.shopify.com/partners/blog/polaris-unified-and-for-the-web)
- [Deep Analysis of Polaris — Structure, Governance, Implementation (UpUply)](https://www.upuply.com/blog/shopify-design-system)
- [Shopify Polaris React (component library)](https://polaris-react.shopify.com/)

See `DESIGN_SYSTEM_MASTER_AUDIT.md` for the consolidated platform scorecard.
