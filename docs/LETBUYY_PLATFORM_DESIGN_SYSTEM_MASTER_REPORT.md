# LetBuyy Platform Design System, UX Governance & Product Consistency — Master Report

**Date:** 2026-06-08
**Auditor lens:** Shopify Polaris architect · Shopify/Stripe/Atlassian design-systems engineering · staff frontend · principal UX & platform architect · SaaS design-governance lead
**Subject:** `@letbuyy/ui` v0.0.2 (`packages/typescript/ui`) as the design foundation for the entire LetBuyy ecosystem — 9 web apps, a Flutter mobile app, and reserved future surfaces.
**Method:** full source reads of every token, component, hook, util, ESLint rule, codemod, and validator; corrected `ripgrep` usage tracing across `apps/`; runtime token/contrast math; benchmarking against Polaris, Atlassian, Stripe (Sail), Cloudflare (Kumo), Linear, Notion, and the 2024–26 SaaS/W3C-DTCG consensus (cited in the Maturity Scorecard).
**Companion documents (full detail):** `LETBUYY_DESIGN_SYSTEM_DISCOVERY.md` · `DESIGN_TOKEN_AUDIT.md` · `DESIGN_SYSTEM_MATURITY_SCORECARD.md` · `TOP_200_ISSUES.md` · `LETBUYY_UI_FOUNDATION_IMPLEMENTATION_PLAN.md`. Supersedes the v0.0.1 set in `docs/ui-system-audit/` where counts differ.

---

## ▶ For leadership (read this section if nothing else)

### The question
> *Can LetBuyy maintain a consistent user experience across 10+ applications and 1,000+ screens without collapsing into design debt?*

### The answer
**Yes — but it does not, fully, today; and the gap is operational and at the edges, not architectural.**

LetBuyy has done the genuinely hard thing: it has **one real, modern design system** and **every web app actually mounts it.** `@letbuyy/ui` is a 9,800-line package with a correct three-tier token model, light/dark/auto theming, three density modes, five per-product "surfaces," a brand-override seam with **runtime WCAG contrast validation**, ~60 accessible components, ~450 icons, Polaris-shaped layout primitives, and a working enforcement toolchain (ESLint plugin, 6 codemods, 3 snapshot validators, 334 visual-regression baselines). Its **architecture is at or above Shopify Polaris / Stripe Sail.** It is consumed by ~290 files across 9 apps and is mounted via `DesignSystemRoot` in **all of them**.

What stops it from *being* a Shopify-grade foundation today is everything *around* and *below* the components:

1. **Three un-fenced divergence channels.** Consistency is enforced inside `.tsx` (hardcoded hex in JSX is now **0**, raw `<button>` is down to ~1), but it leaks through (a) **~613 raw Tailwind default color utilities** (`bg-white`, `text-gray-500`) that bypass tokens and silently break dark mode; (b) a **parallel, hand-"synced" `rgb()` token namespace in every app's `globals.css`** (382 raw colors in the merchant app alone); and (c) a **separate, already-drifted Dart token copy** powering the 136-screen mobile app.
2. **A v0.x operational base.** No `dist` build, no semver/`changesets` (pinned at `0.0.2` under 9+ consumers), ~1 unit test and 2 a11y tests for ~60 components, no portals for overlays, and no W3C-DTCG/Figma pipeline.
3. **A documentation & governance gap.** No docs site, no Figma kit, no written ownership/RFC/lifecycle model, no declared WCAG target — the program scaffolding that mature systems run on.

### The verdict in one line
> **A strong v1 architecture on a v0.x operational base, with three divergence channels that will become real design debt as the platform grows. Keep the architecture; close the edges; harden the operations. ~2–3 quarters, no rewrite.**

### Grades
| | Grade | Why |
|---|:--:|---|
| Architecture (tokens, components, theming) | **B+ / A−** | 3-tier tokens, density/surface/brand, accessible components — reference-class design |
| Operational maturity (dist, semver, tests, distribution) | **C / C−** | raw `src`, pinned 0.0.2, ~1 test, no changesets |
| Cross-surface/cross-platform consistency | **C+** | enforced in JSX; porous in CSS/Tailwind/mobile |
| Documentation & governance | **C−** | no docs site, Figma kit, or written contribution model |
| **Overall maturity** | **2.8 / 5** | late Stage-2 trending Stage-3 (Sparkbox model) |

### What changed since the last audit (trajectory is excellent)
Versus the in-repo v0.0.1 audit (2026-06-06), the team has — in days — shipped the ESLint fence (raw `<button>` **282→~1**, hardcoded hex in JSX **417→0**), added 6 codemods, 334 visual baselines, and a CHANGELOG, **fixed** the Modal focus-trap and Input ARIA defects, wired `DesignSystemRoot` into **all 9 apps**, and added `prefers-color-scheme`. This is a team that executes. The remaining work is the operational base, the three channels, and the program.

### The five moves that matter (everything else sequences behind them)
1. **DTCG token pipeline** (Style Dictionary → CSS, Tailwind, **Dart**, **Figma** from one source) — kills the CSS/Tailwind/mobile divergence at the root.
2. **Fence every channel** — restrict Tailwind's palette to tokens, add Stylelint for `.css`, extend ESLint; codemod the ~613 offenders.
3. **Operational base** — `dist` + `changesets` + `1.0.0` + migrator CLI.
4. **Accessibility program** — declare WCAG 2.2 AA, axe-in-CI, **portal** overlays, scroll-lock/focus-return.
5. **Docs site + Figma kit** — give 10 teams one source of truth.

---

## Phase-by-phase findings

### Phase 1 — Design-system discovery
One package (`@letbuyy/ui` v0.0.2, ~9,800 LOC, 33 files): `tokens.ts` (1,374 LOC) implements primitive→semantic→component tiers; runtime is `DesignSystemRoot` (surface/theme/density/brand) → `TokenStyleBoundary` → injected `--lb-*` CSS. ~60 components, ~450 icons, Polaris-shaped layout primitives, app-shell (AppFrame/Navigation/Sidebar), overlays, feedback, productivity, controls. Governance: ESLint plugin, 6 codemods, 3 snapshot validators, 334 VRT baselines, CHANGELOG, `deprecations.ts`. *Full architecture/dependency/token/theme/component diagrams in the Discovery doc.*

### Phase 2 — Platform-wide UI usage
All 9 web apps mount the DS. DS component instances: MCP **574**, TM 175, SF 128, ID 101, DP 58, AM 44, OPS 30, PC 19, MKT 13. Raw interactive elements remaining: ~**13 total** (all `<select>/<textarea>`, which the lint doesn't yet cover). Hardcoded hex in JSX: **0**. **But** raw Tailwind colors **~613**, inline `style` files: SF **42**, ID 5, MCP 4, and `rgb()` in JSX: SF **691**, MCP 21. Every `globals.css` carries a parallel `rgb()` token set (MCP 382 / MKT 304 / AM 235 raw colors). *Net: high adoption in component code, three ungoverned channels around it.*

### Phase 3 — Design tokens
Correct 3-tier model + density + surface + brand + contrast validation — strong. Drags: **incomplete primitive ramps** (gray skips 300/600/700/800) force **raw hex into the semantic layer** (`#5B21B6`, `#4C1D95`, `#CBD5E1`, `#FCA5A5`, `#7DD3FC`); **alias sprawl** (numeric+named space, `h1–h4`+role type) frozen by a `no-new-alias` validator (containment, not elimination); **not DTCG/Style Dictionary**, so no Figma/Dart codegen and three parallel color sources. Spacing/radius/shadow/motion/z-index are clean; **breakpoint tokens are defined but used by 0 apps.** *Verdict: A− architecture, C on single-source-of-truth. Full table in the Token Audit.*

### Phase 4 — Component governance
Mechanically real: ESLint (`no-raw-elements`, `no-hardcoded-hex` at error), codemods, snapshot validators, VRT. **Missing:** a written contribution/RFC model, component lifecycle (EA/Beta/GA/Deprecated), and a Carbon-style **Definition of Done**. Teams *can* still introduce inconsistency via `<select>/<textarea>`, Tailwind palette, `.css`, and `unstyled` escape hatches. *Can teams safely build without drift? Inside JSX, largely yes; everywhere else, not yet.*

### Phase 5 — Layout system
A standardized page architecture exists: `Page` → `PageHeader` (with an opinionated identity-icon system) → `Section` → `Card`, plus `Box/BlockStack/InlineStack/Grid/Columns/Container/Text` and `AppFrame/Sidebar/Navigation`. `Grid` supports responsive `sm/md/lg/xl` column maps. This is genuinely Polaris-shaped and good. Gaps: **`AppFrame` is imported by 0 app files** (apps assemble their own shells), no documented page templates (list/detail/settings), no responsive mobile-nav pattern, and grid breakpoints are hard-coded class strings rather than token-derived. *Architecture is present; adoption of the shell and templates is uneven.*

### Phase 6 — Platform consistency
High **inside component code** (one package, mounted everywhere, near-zero raw elements/hex). Porous **across the edges**: ~613 Tailwind colors, parallel `globals.css` systems, storefront's inline/rgb surface, and mobile drift. marketing-site is the most off-system app (304 raw colors, lowest DS density). Reference systems achieve consistency *structurally* ("the same underlying code" — Cloudflare; programmatic themes — Linear), whereas LetBuyy currently achieves it *disciplinarily* in one layer. *Consistency 3.0/5 — fix by making divergence impossible in the other three layers.*

### Phase 7 — Responsiveness
Apps do use responsive design (corrected counts: 344 `md:`, 103 `lg:`, 78 `sm:`, 42 `xl:`, 3 `2xl:`). Components handle responsive states (Modal goes full-screen on mobile → centered `sm:`; Grid responsive columns). **But** apps use Tailwind **default** breakpoints, not the DS breakpoint tokens (`letbuyyTailwindPreset` adopted by 0 apps); `2xl:` references an undefined token; no container queries; no responsive `AppFrame`/mobile-nav; table responsive policy undefined. *Foundations exist; the breakpoint contract is unwired, so consistency across devices is by coincidence, not construction.*

### Phase 8 — Accessibility
Components are accessible-by-default: 186 `aria-*` in src, focus-visible rings everywhere, Modal/Drawer focus-trap with `inert` background isolation + full dialog ARIA, Input/Textarea wired `aria-describedby`/`aria-invalid`, Dropdown roving-tabindex keyboard nav, reduced-motion handling, and a contrast helper. Apps carry 1,000 `aria-*`. **But the *program* is missing:** ~no automated a11y tests (2 jest-axe files), no axe-in-CI, no declared WCAG target, no portals (focus-return/scroll-lock risk), `select/textarea` can be raw, charts lack keyboard/data-table fallback, and there's no VPAT. *Components ≈ AA-capable; the enforcement and attestation program is absent. 3.0/5.*

### Phase 9 — Maturity vs the field
Weighted **2.8/5** vs Polaris 5.0, ADS 4.9, Cloudflare 4.4, Stripe 4.1, Linear ~3.8, Notion ~3.2. Tokens (3.5) and components (3.5) are near-reference; documentation (1.5) and governance (2.5) are the laggards. LetBuyy is the unusual case of **Stage-3 enforcement tooling on a Stage-2 documentation/governance base** — an inversion that's fast to correct. *Full scorecard with citations in the Maturity Scorecard.*

### Phase 10 — Product design governance
Recommended hybrid model: a small core team owns tokens/primitives/process and the lint/codemod/release machinery; product teams contribute components/patterns via RFC. Encode review rules in CI (extended lint, Stylelint, restricted Tailwind palette, changeset-required, DoD-required), run fortnightly design critique, and adopt component lifecycle + warn→wait→remove deprecation with codemods shipped alongside breaking changes. *Full framework in the Implementation Plan, Part 2.*

### Phase 11 — LetBuyy Design System V2
DTCG-native tokens (full OKLCH ramps, light/dark/high-contrast, density, surface, brand with CI-gated contrast) emitting CSS/Tailwind/Dart/iOS/Figma from one source; overlays rebuilt on a headless primitive + portals; a full form system, virtualized data grid, and accessible charts; documented page templates and state sets; token-derived responsive grid + container queries + responsive AppFrame; WCAG 2.2 AA with VPAT; per-surface + per-merchant white-label theming through the `brand` API; hybrid governance with docs+Figma parity and AGENTS.md for AI-on-system. *Full target state in the Implementation Plan, Part 3.*

### Phase 12 — Implementation roadmap
**P0** (now, ~1 qtr, prerequisite): DTCG pipeline · complete ramps + de-hex · fence all channels · dist+changesets+1.0.0 · WCAG 2.2 AA + axe-in-CI + portals · test/VRT floor. **P1**: docs site · Figma kit · missing primitives · breakpoints+page templates · governance v1 · mobile parity. **P2**: adoption telemetry · content guidelines · VPAT · charts · i18n. **P3**: container queries · perf · high-contrast · assets. **P4**: future-surface readiness · external distribution. *Each phase's business value/effort/apps/dependencies/risk/outcome in the Implementation Plan, Part 1.*

### Phase 13 — Top 200 issues
A prioritized register of **216** issues with severity/impact/affected-apps/fix/priority: ~22 S1, ~26 P0. The P0 cluster collapses to the five moves above. *Full register in `TOP_200_ISSUES.md`.*

---

## Phase 14 — Brutal review (if the Polaris team reviewed LetBuyy today)

**What they'd praise.**
- *"You built the right architecture."* Three-tier tokens, density modes, a per-surface theming seam, and a brand override with **runtime contrast validation** — that's the Stripe/Cloudflare instinct, in code, already. Most startups never get here.
- *"You actually adopted it."* One package, mounted in all 9 apps, ~290 import sites, hex-in-JSX driven to zero by a real ESLint fence. Adoption is the thing that usually fails, and you have it.
- *"You shipped the boring machinery."* 6 codemods, snapshot validators, 334 visual baselines, a CHANGELOG, and `inert`-based focus isolation. That's Stage-3 tooling.
- *"You move fast."* You closed most of your own prior audit's P0 list in days.

**What they'd reject.**
- *"It ships raw `src` at `0.0.2` with one test, under nine apps and a mobile app."* No `dist`, no semver, no `changesets`, ~1 unit test, 2 a11y tests for ~60 components. That is not a foundation nine teams can safely depend on; it's a prototype they're standing on.
- *"Your 'one source of truth' isn't one."* A hand-"synced" `rgb()` token system in every `globals.css`, ~613 raw Tailwind colors, and a drifting Dart copy mean a new screen can pull color from four places. The lint that makes JSX clean doesn't see any of them.
- *"No docs site, no Figma kit, no WCAG target."* Ten teams are building from tribal knowledge; design and code have no shared source; accessibility is asserted, not measured.

**What they'd immediately redesign.**
- The **token format → DTCG + Style Dictionary**, so Figma, web, and Dart render the same decisions and the mobile/CSS/Tailwind channels disappear.
- The **overlay layer → portals + a headless primitive** (Base UI/Floating UI). Hand-rolled focus management with no portal is a guaranteed source of "menu clipped / focus lost" bugs at scale.

**What they'd remove.**
- The **alias debt** (numeric+named space, `h1–h4`+role type, `bg`+`background`) — pick one, codemod, delete. A `no-new-alias` validator is a confession, not a cure.
- The **raw hex inside the semantic token layer** — complete the ramps so the system can obey its own `no-hardcoded-hex` rule.
- The **triplicate theme toggles** (`.dark` + `data-theme` + `data-letbuyy-theme`).

**What they'd rebuild from scratch.**
- **Almost nothing.** This is the headline: the architecture is right. Rebuild the **token *pipeline*** (format + codegen + Figma), not the tokens; rebuild the **overlay *mechanics*** (portals/primitive), not the components. Everything else is additive hardening.

**What breaks first as LetBuyy grows.**
1. **Mobile↔web consistency** — already broken; every new mobile screen widens the gap until codegen exists.
2. **Overlays at density** — the first complex page inside an `overflow:hidden` container clips a dropdown; with no portal, z-index tokens won't save it.
3. **Dark mode** — every `bg-white`/`text-gray-500` is a latent dark-mode bug that surfaces the moment dark mode is taken seriously.
4. **The next breaking change** — with no semver/dist, one token rename ripples unversioned through nine apps.
5. **`globals.css` drift** — "synced by hand" guarantees that, over time, the merchant app and the marketing site stop looking like the same company.

**What prevents LetBuyy from becoming a world-class platform.**
Not the design system's design — that's good. It's the **absence of the program around it**: a single cross-platform token *source* (DTCG), an operational *contract* (dist/semver/tests), an enforced *boundary* (lint over CSS/Tailwind/native), an accessibility *standard* (WCAG 2.2 AA in CI + VPAT), and a *documentation/Figma spine* so design, engineering, web, and native all render the same system. Build those five and LetBuyy clears the bar — on an architecture it already has.

---

## Bottom line

LetBuyy is closer to a Shopify-grade foundation than its `0.0.2` version number suggests, and further than its enthusiastic adoption implies. **Keep the architecture. Close the three channels. Harden the operations. Add the design↔code spine.** Do that — roughly the P0→P1 program, ~2–3 quarters, no rewrite — and the answer to the platform question turns from *"yes, conditionally"* to an unqualified *yes*.

---

*Prepared from direct source inspection of `@letbuyy/ui` v0.0.2 and all consuming apps, benchmarked against current (2026) reference design systems. Quantitative claims are reproducible via the `grep`/read methodology described in the Discovery document. Reference-system citations appear in the Maturity Scorecard.*
