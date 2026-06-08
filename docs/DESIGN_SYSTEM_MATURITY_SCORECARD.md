# LetBuyy Design System — Maturity Scorecard (Phase 9)

**Date:** 2026-06-08
**Benchmarks:** Shopify Polaris, Atlassian Design System (ADS), Stripe (Sail), Cloudflare (Kumo / Cloudflare Design System), Linear, Notion, and the 2024–2026 SaaS design-system consensus (W3C DTCG, EightShapes, Carbon, Sparkbox). Reference facts are cited at the end; LetBuyy facts are from source reads (see Discovery + Token Audit).

---

## Scoring model

0–5 per dimension. **0** none · **1** ad hoc · **2** emerging · **3** established · **4** managed/measured · **5** optimized & exemplary. Anchors: a mature, governed enterprise system (Polaris/ADS) ≈ **4–5**; a strong internal-only system (Sail/Kumo) ≈ **4**; a craft-led product without a public/formal system (Linear/Notion) scores high on *consistency/DX* but low on *documentation/governance formality*.

| Dimension | LetBuyy | Polaris | Atlassian | Stripe (Sail) | Cloudflare (Kumo) | Linear | Notion | Target (12 mo) |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 1. Documentation | **1.5** | 5 | 5 | 3 | 4 | 2 | 2 | 4 |
| 2. Governance | **2.5** | 5 | 5 | 4 | 4 | 3* | 3* | 4 |
| 3. Tokens | **3.5** | 5 | 5 | 5 | 5 | 4 | 3 | 4.5 |
| 4. Components | **3.5** | 5 | 5 | 4 | 4 | 4* | 3* | 4 |
| 5. Patterns | **2.5** | 5 | 5 | 4 | 3 | 4 | 4 | 3.5 |
| 6. Consistency | **3.0** | 5 | 5 | 4 | 5 | 5 | 4 | 4.5 |
| 7. Accessibility | **3.0** | 5 | 5 | 4 | 5 | 3 | 3 | 4.5 |
| 8. Adoption | **3.0** | 5 | 4 | 4 | 4 | 5* | 4* | 4 |
| 9. Developer experience | **3.0** | 5 | 5 | 4 | 5 | 4 | 3 | 4.5 |
| **Weighted overall** | **2.8 / 5** | 5.0 | 4.9 | 4.1 | 4.4 | ~3.8 | ~3.2 | **4.2** |

*\*Linear/Notion publish no formal design system; their governance/component/adoption scores reflect internal craft + small-team consistency, not documented programs.*

**One-line read:** LetBuyy is a **mid-Stage-2 ("emerging/established") system trending toward Stage 3** on Sparkbox's 4-stage model — already past most startups, with **tokens and components near reference quality**, held back by **documentation, formal governance, and operational maturity**. The gap to Polaris/ADS is **process and surface-coverage, not core architecture.**

---

## Dimension-by-dimension

### 1. Documentation — **1.5/5** (biggest single gap)

- **LetBuyy:** 7 catalog-style Storybook stories + 334 visual baselines; in-repo audit docs in `docs/ui-system-audit/`. **No** docs site, **no** per-component usage/do-don't/a11y pages, **no** Figma kit, **no** content/UX-writing guidelines, **no** contribution guide surfaced to consumers.
- **Bar:** Polaris and ADS publish a full site — Foundations / Components / Patterns / **Content** / Tokens, each component with usage + do/don't + code + **per-component accessibility**, kept in **1:1 Figma parity**. Carbon additionally requires published docs as part of a component's "definition of done."
- **Implication:** 9 app teams + a mobile team are building against tribal knowledge. This is the cheapest dimension to move and the highest leverage for consistency.

### 2. Governance — **2.5/5**

- **LetBuyy:** real *mechanical* governance — ESLint plugin (`no-raw-elements`, `no-hardcoded-hex` at `error`), 3 snapshot validators (public-API, token-variable, no-new-alias), 6 codemods, 334 visual baselines. **Missing:** a written ownership/contribution model, RFC process, design review, component lifecycle/status labels, and a "definition of done."
- **Bar:** ADS runs an explicit **RFC + contribution model** (internal makers; fixes/small enhancements accepted, new components gated), fortnightly critique, and **release phases** (Early Access / Beta / GA / Caution / Deprecated). Polaris has a proposal pipeline and quality gates. The 2024–26 consensus is a **hybrid model**: a small core team owns tokens/primitives/process, product teams contribute the rest.
- **Implication:** LetBuyy enforces *rules* but hasn't defined *who decides* — which is what prevents drift once contribution scales past the core team.

### 3. Tokens — **3.5/5** (near-reference architecture)

- **LetBuyy:** correct 3-tier (primitive→semantic→component) + density + 5 surfaces + brand override with **runtime contrast validation** + reduced-motion. Density/surface scoping *exceeds* what Polaris/Stripe expose publicly.
- **Drag:** incomplete primitive ramp → raw hex in the semantic layer; alias sprawl; **not DTCG/Style Dictionary** (so no Figma/Dart codegen); parallel CSS/Tailwind/Dart channels.
- **Bar:** Polaris/ADS = full ramps, theming, Style-Dictionary-class pipelines; Stripe Sail generates ramps in **OKHsl with WCAG contrast built into the scale**; Cloudflare = 10×10 ramp, dark mode via `reverse()`, semantic tokens enforced by lint on Tailwind v4. DTCG v1 (2025.10) is now the interop standard.
- **Implication:** finish the ramps + adopt DTCG and this dimension is a 4.5.

### 4. Components — **3.5/5**

- **LetBuyy:** ~60 components, Polaris-shaped vocabulary, high-quality accessible implementations (Button `asChild`/focus-visible; Modal/Drawer focus-trap+inert+ARIA; Input wired ARIA; Dropdown roving-tabindex keyboard). Comparable *count* to ADS (~60+13) and Polaris (~47).
- **Drag:** **no portals** (overlays clip at scale); **hand-rolled** focus/dismiss instead of a headless primitive lib (cf. Kumo on Base UI); thin tests (1 unit, 2 axe) vs ~60 components; only `button/input/table` fenced (not `select/textarea/a/dialog`).
- **Bar:** Carbon's "stable" component requires unit ≥80%, visual regression, automated + manual a11y, typed API, codemods, docs, Figma kit — *per component*.

### 5. Patterns — **2.5/5**

- **LetBuyy:** strong *primitive* patterns baked into components (Page/PageHeader identity system, EmptyState, SaveBar, FilterBar, CommandPalette, MetricCard) — an admin-product point of view. **Missing:** documented page-level patterns (index/list pages, detail, settings, onboarding, empty/loading/error states) and content guidelines.
- **Bar:** Polaris/ADS document composed patterns + UX writing; Linear/Notion encode patterns culturally (constrain-the-surface vs rigor-at-the-block).

### 6. Consistency — **3.0/5**

- **LetBuyy:** genuinely high *inside component code* — one package mounted in all 9 apps; hex-in-JSX = 0; raw elements ≈ 13 total. **But** ~613 raw Tailwind colors, parallel `globals.css` token systems (382/304/235 raw colors), 691 `rgb()` in storefront, and mobile drift mean cross-surface consistency is **enforced in one layer, porous in three**.
- **Bar:** Cloudflare's "every button/table/chart is literally the same code"; Linear's programmatic theme generation. Consistency at reference systems is *structural* (impossible to diverge), not *disciplinary* (discouraged).

### 7. Accessibility — **3.0/5**

- **LetBuyy:** accessible-by-default components (186 `aria-*` in src, focus-visible rings, `inert` background isolation, reduced-motion, contrast helper, 1000 `aria-*` across apps). **But** automated a11y testing is thin (2 jest-axe files, no per-component axe-in-CI), no stated WCAG target, no VPAT, no portal (focus-return/scroll-lock risks), and `select/textarea` can be hand-rolled raw.
- **Bar:** Polaris targets **WCAG 2.1 AA** (Pa11y + manual); ADS commits to **2.2 AA** with eslint/stylelint a11y plugins + quarterly audits + per-product VPAT; Cloudflare's Project A11Y took the dashboard to **2.1 AA + Section 508 with a published VPAT**. **WCAG 2.2 AA is now table stakes** (e.g. 24×24px targets).
- **Implication:** the *components* are close; the *program* (target, CI gate, audit, VPAT) is missing.

### 8. Adoption — **3.0/5**

- **LetBuyy:** high de-facto adoption (e.g. merchant app: 574 DS instances, 74/91 files import the DS) and an ESLint fence that *forces* it. **But** adoption is **not measured** — no coverage telemetry, no "% of UI from the system" dashboard, and 0% on mobile.
- **Bar:** Polaris's `stylelint-polaris` *measures* design-system coverage in the Shopify admin; mature orgs track coverage via code-import/visual-coverage/render-count plus DX surveys (Productboard, Mews, Preply).

### 9. Developer experience — **3.0/5**

- **LetBuyy:** ESLint plugin with auto-fix suggestions, codemods, Storybook, visual regression, typed exports, a one-line `DesignSystemRoot`. Genuinely good. **Drag:** ships raw `src` (no `dist`), **no semver/changesets** (pinned 0.0.2 under 9 consumers), verbose Tailwind arbitrary-value ergonomics (`bg-[var(--lb-...)]` everywhere), no docs site, no Figma-to-code.
- **Bar:** ADS *invented* `changesets` and ships `codemod-cli` + eslint/stylelint plugins + Figma libraries; Kumo ships a **CLI**, **Figma plugin with token sync**, and an **AGENTS.md** for AI tooling.

---

## Where LetBuyy already meets or beats the bar

- **Density modes** (compact/comfortable/spacious) as first-class tokens — few public systems expose this.
- **Per-surface theming seam** (admin/marketplace/storefront/identity/operations) — structurally ready for white-label, which is the "like Shopify" requirement.
- **Brand override + runtime contrast validation** — the Stripe/Cloudflare philosophy (accessibility encoded into theming), already in code.
- **Mechanical enforcement shipped fast** — the ESLint fence + codemods + visual baselines took raw `<button>` 282→~1 and hex 417→0 between v0.0.1 and v0.0.2.

## Where LetBuyy is furthest behind

1. **Documentation & Figma parity (1.5)** — no docs site, no design source of truth.
2. **Operational base** — no `dist`, no semver/changesets, ~1 test.
3. **Cross-platform/cross-surface single source** — mobile Dart drift, `globals.css` + Tailwind channels.
4. **A11y *program*** (target/CI/VPAT) vs a11y *components*.

---

## Stage placement (Sparkbox 4-stage model)

```
Stage 1 build v1 ── Stage 2 grow adoption ── Stage 3 survive the teen years ── Stage 4 evolve as a product
                              ▲ LetBuyy is here (late Stage 2), with Stage-3 tooling (codemods/validators)
                                already in place ahead of the docs/governance that usually precede it.
```

LetBuyy is unusual: it has **Stage-3 enforcement tooling** bolted onto a **Stage-2 documentation/governance base**. That inversion is fixable and fast — and it is exactly what the Implementation Plan sequences.

---

## Sources (reference benchmarks)

- Shopify Polaris — tokens, components (web components, 2025-10), accessibility, stylelint-polaris, Figma kit, migrator: polaris-react.shopify.com/tokens/color · shopify.dev/docs/api/app-home/web-components · polaris-react.shopify.com/foundations/accessibility · npmjs.com/package/@shopify/stylelint-polaris · polaris-react.shopify.com/tools/polaris-migrator
- Atlassian Design System — tokens (Foundation→Property→Modifier), components+primitives, eslint plugin, codemod-cli, changesets, release phases, WCAG: atlassian.design/foundations/tokens/design-tokens · atlassian.design/components/tokens/all-tokens · atlassian.design/components/eslint-plugin-design-system · npmjs.com/package/@atlaskit/codemod-cli · github.com/changesets/changesets · atlassian.com/trust/compliance/resources/wcag
- Stripe (Sail) — OKHsl accessible color scale + token aliasing + dashboard migration: stripe.com/blog/accessible-color-systems · mattstromawn.com/writing/generating-color-palettes · docs.stripe.com/elements/appearance-api
- Cloudflare (Kumo / Design System) — color scales + dark mode `reverse()`, Base UI, CLI + Figma token sync, Project A11Y (WCAG 2.1 AA + 508 + VPAT): blog.cloudflare.com/dark-mode · blog.cloudflare.com/project-a11y · github.com/cloudflare/kumo · color.cloudflare.design
- Linear — LCH theme generation from 3 inputs, craft-as-strategy, local-first speed: linear.app/now/how-we-redesigned-the-linear-ui · linear.app/now/scaling-the-linear-sync-engine · figma.com/blog/karri-saarinens-10-rules-for-crafting-products-that-stand-out
- Notion — block/composability design philosophy: lennysnewsletter.com/p/inside-notion-ivan-zhao · design.kiwi.com/blog/data-model-behind-notion
- Consensus / standards — W3C DTCG stable v1 (2025.10): w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version · designtokens.org/tr/2025.10/format · EightShapes naming/versioning: medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676 · eightshapes.com/articles/versioning-design-systems · Carbon component checklist: carbondesignsystem.com/contributing/component-checklist · WCAG 2.2: w3.org/TR/WCAG22 · Chromatic VRT: chromatic.com/storybook · Sparkbox maturity model: sparkbox.com/foundry/design_system_maturity_model
