# LetBuyy Design Intelligence — Executive Summary
*Generated: 2026-06-19 | Agents: 10 | Scope: Full Platform*

---

## The Platform in One Paragraph

LetBuyy is an India-first multi-tenant commerce platform with five distinct product surfaces serving radically different users: a merchant control plane (day-to-day store operations), a storefront runtime (shopper-facing, theme-driven), an identity platform (merchant auth), a marketing site (public conversion), and two internal operator consoles. The design system reality is this: `@letbuyy/ui` is a mature, production-governed library with ~50+ exported components, a 4-tier token system emitting ~330 CSS custom properties, a 3-preset density system, full light/dark theming, a Flutter/Dart token mirror, and an active ratchet enforcer in CI. The gap is not foundation — the foundation is strong. The gap is adoption: merchant-control-plane files that predate the ratchet carry 127 arbitrary-radius violations, identity-platform maintains a parallel CSS custom property system that shadows the token layer, and the theme editor runs a fully independent design system. The platform's three most visible surfaces (marketing site, identity platform, merchant dashboard) share a coherent "ink lavender" visual identity. The storefront is deliberately identity-less by design. Frozen apps (app-marketplace, theme-marketplace, developer-portal) have their own divergent visual systems that are not in active production paths.

---

## The Ten Most Important Findings

### Finding 1: The Design System Foundation is Production-Grade
**What We Found:** `packages/typescript/ui/src/tokens.ts` defines a canonical 4-tier token hierarchy (Primitive → Semantic → Component → Density) emitting ~330 CSS custom properties. The system has a Tailwind v4 bridge, a DTCG JSON interchange file, a Flutter/Dart token mirror, 7 codemods, a ratchet validator with 7 metric categories, and 5 ESLint rules enforced at error level. Storybook stories exist for all major components.

**Why It Matters:** The foundation is not the problem. Teams building new features have a complete, governed system to build on. Infrastructure debt exists at the adoption layer, not the foundation layer.

**The Number:** ~330 unique CSS custom properties across all token categories; 50+ exported components in 12 functional groups.

**Recommended Action:** Document the current ratchet baseline values in `scripts/validators/design-ratchet-baseline.json` (Phase 0 of the migration roadmap) so every PR has a numeric target to beat.

---

### Finding 2: Three Apps Share a Coherent "Ink Lavender" Visual Core
**What We Found:** identity-platform, merchant-control-plane, and marketing-site all independently adopt the same "ink lavender" palette: light page `rgb(250 249 255)`, dark page `rgb(10 9 18)`, and purple-tinted borders. All three are commented in their CSS with phrases like "Premium Ink Lavender" or "Synced with accounts app theme." This is the platform's most coherent cross-app visual pattern.

**Why It Matters:** The platform has an implicit brand language that no one has formally codified. There is a real LetBuyy aesthetic already in use — it just lives in comments rather than in the design constitution.

**The Number:** 3 of 6 active web apps share this palette; the other 3 diverge (white for console/ops, indigo for storefront, slate-neutral for frozen marketplace apps).

**Recommended Action:** Promote the ink lavender palette to a named `--lb-color-bg-premium` token variant so it is formally part of the design system rather than duplicated raw values in three globals.css files.

---

### Finding 3: 127 Arbitrary Border-Radius Violations in Merchant Control Plane
**What We Found:** The ratchet forbids `rounded-[...]` arbitrary values, but 127 existing instances in merchant-control-plane predate the validator. These appear as `rounded-[8px]`, `rounded-[12px]`, `rounded-[var(--lb-radius-lg)]` — the bracket syntax is forbidden even when the value is a token variable. Six confirmed ratchet violations were found in components actively developed today (NotificationsPanel, SettingsSearch, BackendNeededPane, EmbeddedAppBridgeClient, ProviderModeBadge, AdminShell).

**Why It Matters:** Each arbitrary radius is a maintenance debt item and a governance signal that the ratchet was not yet enforced when these files were written. The count cannot increase; reducing it improves maintainability.

**The Number:** 127 existing arbitrary-radius instances; 6 confirmed active violations in named component files.

**Recommended Action:** Run the `tailwind-default-color-to-token` codemod on merchant-control-plane and manually resolve the 6 confirmed component violations in Priority 1 order (NotificationsPanel badge → SettingsSearch → BackendNeededPane → EmbeddedAppBridgeClient tabs → ProviderModeBadge → AdminShell).

---

### Finding 4: identity-platform Runs a Parallel CSS Custom Property System
**What We Found:** `apps/identity-platform/src/app/globals.css` (~2,300 lines) defines its own `--bg`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--border`, `--input-bg` and other properties with raw `rgb()` values. These broadly match `--lb-color-*` token values but do not reference them. The file also contains three layers of override blocks ("COMPACT AUTH FLOW POLISH") that re-declare the same values at higher specificity. Identity-platform scored the lowest of the three audited apps: Token Adoption 4.5/10, Layout Consistency 4.0/10.

**Why It Matters:** Every time the canonical token system updates, the auth and onboarding pages do not benefit. The double maintenance surface means visual drift between the auth flow and the rest of the platform is a near-certainty over time.

**The Number:** 10+ parallel CSS custom properties in globals.css duplicating `--lb-*` equivalents; identity-platform overall score 6.3/10 vs merchant-control-plane 8.0/10.

**Recommended Action:** Wire identity-platform's local CSS variables to their `--lb-*` equivalents: `--bg: var(--lb-color-bg)`, `--text-primary: var(--lb-color-text)`, `--border: var(--lb-color-border)`. The unique "Premium Ink Lavender" tint may warrant a dedicated `--lb-color-bg-identity` token if the exact shade differs from the platform default.

---

### Finding 5: The Theme Editor is a Design System Island
**What We Found:** `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` imports 27 icons directly from `lucide-react` (bypassing `@letbuyy/ui`'s version-pinned re-exports), uses ~50+ `theme-os-*` private CSS class names with no `--lb-*` token references in JSX, and scores 2/10 on Token Adoption and Component Usage. It is architecturally isolated as a full-screen tool, but semantic values (z-index, motion timing, border-radius) should still use `--lb-*` tokens.

**Why It Matters:** This is classified CRITICAL in the consistency scorecard. A dual `lucide-react` dependency creates a version-drift risk. The `theme-os-*` CSS namespace means any designer or engineer who hasn't read that specific external CSS file cannot reason about the editor's visual behavior from the JSX alone.

**The Number:** 27 direct lucide-react imports; ~50+ private CSS classes; score 21/100 on the consistency scorecard.

**Recommended Action:** Replace all `import { ... } from 'lucide-react'` with `import { ... } from '@letbuyy/ui'` in the editor file. This is a 2-hour fix that eliminates the CRITICAL dependency governance issue. The CSS refactor to `--lb-*` tokens is a separate Phase 4 effort.

---

### Finding 6: Four Different Dark Backgrounds Across the Platform
**What We Found:** The platform has four distinct dark page backgrounds in active apps: `rgb(10 9 18)` (canonical ink-950, used by identity/merchant/marketing), `rgb(10 10 10)` (platform-console/operations), `rgb(10 15 26)` (app-marketplace), and `rgb(15 15 26)` (theme-marketplace). The differences are imperceptible in isolation but cumulative across a user session that crosses surfaces.

**Why It Matters:** Dark mode was explicitly designed around the violet-tinted ink palette (`#0a0912`). The platform-console divergence to pure near-black (`rgb(10 10 10)`) and the marketplace divergence to a bluer tone are accidental, not intentional.

**The Number:** 4 distinct dark backgrounds; canonical ink-950 is `rgb(10 9 18)` which is the only value backed by a token.

**Recommended Action:** Standardize platform-console and platform-operations-portal globals.css to use `var(--lb-color-bg)` for the dark background rather than the hardcoded `rgb(10 10 10)`. This is a 30-minute fix with zero visual risk for the forced-dark internal tools.

---

### Finding 7: Coupons Page Has a Live Locale Bug
**What We Found:** The coupons page `formatDiscount()` function returns `` `Rs. ${coupon.value}` `` for absolute discount values. The correct symbol is `₹` per India-first locale standards. The canonical formatter `formatInrCurrency` is exported from `@letbuyy/ui` and is used correctly everywhere else in merchant-control-plane. This is an anomaly in an otherwise well-compliant app.

**Why It Matters:** `Rs.` is deprecated for ₹ in Indian commerce contexts. A merchant showing coupon discounts to customers sees an incorrect currency symbol, undermining trust in the platform's India-first claim.

**The Number:** 1 confirmed live locale violation; coupons page also scored 3/10 on Locale Standards and 31/100 overall (lowest non-editor merchant page score).

**Recommended Action:** Replace `` `Rs. ${coupon.value}` `` with `formatInrCurrency(coupon.value)` in `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx`. Estimated fix time: 1 hour. Priority: P0.

---

### Finding 8: marketing-site Uses Wrong ThemeProvider Surface
**What We Found:** `apps/marketing-site/src/app/layout.tsx` uses `surface="storefront"` — but the marketing site is the public marketing presence for LetBuyy, not a merchant's customer storefront. The `storefront` surface is semantically designated for the shopper-facing `storefront-runtime`. The marketing site and the consumer storefront share the same surface token set.

**Why It Matters:** Currently, all five surfaces resolve to identical token values — so there is no visual impact today. But the surface system is the architectural hook for future per-product design differentiation. If the platform ever gives the storefront surface its own distinct token values (for shopper-specific aesthetics), the marketing site will silently receive those changes.

**The Number:** 1 surface assignment bug; marketing-site should use `surface="marketing"` (once that surface is defined) or at minimum a dedicated `marketing` variant distinct from `storefront`.

**Recommended Action:** Define a `marketing` surface type in the token system and update marketing-site's ThemeProvider. This is a 2-hour change with no visual impact today but prevents a latent future regression.

---

### Finding 9: No Deployed Storybook or Design Handoff
**What We Found:** Seven Storybook story files exist in `packages/typescript/ui/src/` (`component-catalog.stories.tsx`, `design-tokens.stories.tsx`, `foundation-primitives.stories.tsx`, `governance.stories.tsx`, `merchant-experience.stories.tsx`, `primitives.stories.tsx`, `table.stories.tsx`). However, no `storybook` script was confirmed in the package.json, no deployed Storybook URL appears in any documentation, and no Figma token plugin configuration or design handoff integration was found.

**Why It Matters:** Without a deployed Storybook or Figma integration, designers cannot inspect the actual token values or component states, engineers cannot quickly reference usage patterns, and new team members have no visual catalog entry point. The governance stories (`governance.stories.tsx`) contain do/don't guidance that is invisible unless someone knows to run Storybook locally.

**The Number:** 7 story files with no confirmed deployment; 0 Figma file links or Figma token plugin configurations found across all documentation.

**Recommended Action:** Add a `storybook:dev` and `storybook:build` script to `packages/typescript/ui/package.json`. Deploy the built Storybook to a static URL (e.g., design.letbuyy.com or via Vercel). This unblocks design-to-engineering handoff without any codebase changes.

---

### Finding 10: Flutter Dark Mode Uses a Different Palette Than Web
**What We Found:** The generated `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart` file uses gray/slate-based darks for its `backgroundDark` (`gray900 = #111827`) while the TypeScript source uses the violet-tinted ink palette (`ink.950 = #0a0912`). Similarly, `surfaceDark`/`cardDark` and the dark border token (`slate700 = #334155` in Dart vs. `rgba(139,92,246,0.18)` in TypeScript) diverge meaningfully.

**Why It Matters:** A merchant using the iOS or Android merchant app in dark mode sees different background colors than they see in the web dashboard. This breaks the multi-platform brand consistency that the token synchronization pipeline is meant to guarantee.

**The Number:** 3+ meaningful parity gaps between web and Flutter dark palette; the generation script (`generate-mobile-tokens.mjs`) passes CI validation but the source mapping is incorrect for the ink-palette values.

**Recommended Action:** Update `scripts/generators/generate-mobile-tokens.mjs` to map the ink palette values correctly to Flutter `Color` objects, then run `validate:mobile-tokens` to confirm parity. Estimated effort: 2 hours plus visual review on device.

---

## Platform Design Health Dashboard

| Dimension | Score | Status | Priority |
|-----------|-------|--------|----------|
| Token Adoption | 7/10 | Yellow | High |
| Component Consistency | 7/10 | Yellow | High |
| Layout Consistency | 7/10 | Yellow | Medium |
| Typography System | 8/10 | Yellow | Medium |
| Color Governance | 6/10 | Yellow | High |
| Interaction Patterns | 8/10 | Green | Low |
| Theme Architecture | 8/10 | Green | Low |
| Dark Mode | 6/10 | Yellow | Medium |
| Mobile Design | 7/10 | Yellow | Medium |
| Governance Maturity | 8/10 | Green | Low |
| **Overall** | **7.2/10** | **Yellow** | — |

**Scoring methodology:** Derived from the CONSISTENCY_SCORECARD.md weighted averages across 24 files, cross-referenced with VISUAL_IDENTITY_REPORT.md consistency scores per app, COMPONENT_DUPLICATION_REPORT.md violation counts, and DESIGN_DEBT_REPORT.md priority assessments.

**Status key:**
- Green (8–10): Healthy; maintain current trajectory
- Yellow (6–8): Attention needed; systematic improvement plan in place
- Red (<6): Requires immediate remediation

---

## Application Identity Summary

| App | Visual Identity | Consistency | Token Adoption | Status |
|-----|-----------------|-------------|----------------|--------|
| merchant-control-plane | Intentional — "ink lavender" sidebar, dark header wayfinding | 9/10 | 7.5/10 | Active — most compliant app; 127 legacy radius violations |
| identity-platform | Intentional — "Premium Ink Lavender," mobile-first auth flow | 8/10 | 4.5/10 | Active — CSS layer has parallel property system; component layer is correct |
| marketing-site | Intentional — bold/aspirational, gradient system, Framer Motion | 9/10 | 7.3/10 | Active — wrong `surface="storefront"` assignment; own color system for marketing visual identity |
| storefront-runtime | Intentional (intentionally identity-less) | 5/10 | Minimal | Active — theme-driven; blank-slate by design; storefront font aliases don't load different fonts |
| platform-console | Accidental — defers entirely to component defaults | 6/10 | Minimal | Active — forced dark; byte-for-byte identical CSS to operations portal; no differentiation |
| platform-operations-portal | Accidental — copy of platform-console | 6/10 | Minimal | Active — forced dark; visually indistinguishable from platform-console |
| app-marketplace | Partially intentional — slate-neutral aesthetic, no purple tinting | 7/10 | Comprehensive inline token redeclaration | Frozen — redundant token declarations; wrong dark background `rgb(10 15 26)` |
| developer-portal | Intentional — teal accent system, docs aesthetic | 7/10 | Thin (defers + own accents) | Frozen — `surface="marketplace"` is wrong for this context |
| theme-marketplace | Strongly intentional — own indigo primary, 3-accent system, rose dark text | 8/10 | None — own complete token system | Frozen — fully disconnected from `--lb-*` token system |
| mobile/merchant-app | Flutter native — mirrors web through token generation | N/A | Token mirror (with dark mode gaps) | Active — dark palette parity gap vs. web |

---

## The Design System Reality

### What `@letbuyy/ui` Actually Provides

**Strengths:**
- 50+ production-ready React components across 12 functional groups: Actions, Layout, Data, Controls, Feedback, Overlays, Navigation/Shell, Internal Workspace, Theme, Tokens, Formatting, Icons
- A 4-tier token system (Primitive → Semantic → Component → Density) emitting ~330 CSS custom properties
- Three density presets (compact/comfortable/spacious) with 25 density-responsive variables
- Full light/dark/system theming with flash prevention via `ThemeScript`
- Five surface types (`admin`, `marketplace`, `storefront`, `identity`, `operations`) for per-product scoping
- A Tailwind v4 bridge with semantic utility classes (`bg-surface`, `text-default`, `border-line`, etc.)
- A tenant brand override API (`createLetbuyyBrandVariables`) with WCAG contrast validation
- A Flutter/Dart token mirror for cross-platform consistency
- 7 codemods for mechanical migration
- ESLint plugin with 5 rules enforced at error level
- Ratchet validator tracking 7 violation categories in CI

**What Is Missing:**
1. No deployed Storybook URL — stories exist but are not published
2. No Figma token integration or design handoff workflow
3. Flutter dark palette uses gray/slate darks instead of the violet-tinted ink palette
4. `--lb-color-border-subtle` Tailwind alias references a deprecated token that no longer emits CSS
5. No canonical icon size vocabulary (14 distinct sizes found in use across 24 files: 10, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 28, 32, 34px)
6. No fluid font scaling for body/secondary text (only display/h1/h2 have `clamp()` variants)
7. No `BottomSheet` component (pattern exists in two apps, not consolidated)
8. No `AccountSwitcher`/`ContextSwitcher` component (implemented in merchant HeaderBar, would be reusable)
9. `CommandPalette` in DS lacks async entity search — causing the merchant app to maintain a local duplicate
10. No `marketing` surface type defined in the token system (marketing-site uses `storefront` incorrectly)

---

## Top 5 Quick Wins

These actions improve platform quality significantly with minimal risk, no architecture changes, and can each ship in under a day.

### Quick Win 1: Fix `Rs.` → `₹` in Coupons (1 hour, P0)
**File:** `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx`
Replace `` `Rs. ${coupon.value}` `` with `formatInrCurrency(coupon.value)`. This is a live locale bug visible to merchants and their customers today.

### Quick Win 2: Fix `lucide-react` Direct Import in Theme Editor (2 hours, P0)
**File:** `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`
Replace all 27 `import { ... } from 'lucide-react'` with `import { ... } from '@letbuyy/ui'`. This eliminates the CRITICAL dual-dependency governance violation with zero visual impact.

### Quick Win 3: Standardize Internal App Dark Backgrounds (30 minutes, P1)
**Files:** `apps/platform-console/src/app/globals.css`, `apps/platform-operations-portal/src/app/globals.css`
Replace hardcoded `rgb(10 10 10)` with `var(--lb-color-bg)`. The canonical ink-950 (`#0a0912`) resolves correctly in dark mode, which is the forced default for both apps.

### Quick Win 4: Fix Identity-Platform CSS Variable Bridging (4 hours, P2)
**File:** `apps/identity-platform/src/app/globals.css`
Wire the 10+ parallel CSS custom properties to their `--lb-*` equivalents: `--bg: var(--lb-color-bg)`, `--text-primary: var(--lb-color-text)`, `--border: var(--lb-color-border)`, etc. Run the auth flow in both light and dark mode at 360px and 1280px to verify no visual regression.

### Quick Win 5: Fix 6 Active Ratchet Violations in Named Components (half day, P1)
Replace the 6 confirmed `rounded-[...]` and raw-px violations:
- `NotificationsPanel.tsx`: replace inline badge `<span>` with `<Badge>`
- `SettingsSearch.tsx`: replace raw `<input>` with `<Input>`
- `BackendNeededPane.tsx`: replace raw wrapper with `<Card>` or `<Box radius="lg">`
- `EmbeddedAppBridgeClient.tsx`: replace raw tab buttons with `<Tabs variant="pills">`
- `ProviderModeBadge.tsx`: remove `py-[2px]` (use token-scaled padding)
- `AdminShell.tsx`: change `rounded-tl-[var(--sidebar-panel-radius)]` to `rounded-tl-[var(--lb-radius-lg)]`

---

## The Governance Gap

**The single biggest governance gap is the absence of a deployed Storybook / design documentation portal.**

The design system has exceptional infrastructure: a validated ratchet, ESLint rules at error level, codemods, a DTCG token file, a Flutter mirror, governance stories, and a design constitution. What it does not have is a published, accessible home for all of this.

**The consequence of not addressing it:**
- New engineers have no reference for which `@letbuyy/ui` component to use for a given pattern — they find existing code (including the code with ratchet violations) and copy it.
- Designers cannot inspect actual token values in context — they write specs with raw hex values that engineers then translate inconsistently.
- The `governance.stories.tsx` do/don't usage guardrails are invisible unless someone knows to run `pnpm storybook` locally.
- The migration roadmap's "establish migration patterns" goal cannot be completed without a shared reference that shows engineers what compliant code looks like.

**The fix is not a code problem.** Adding a `storybook:build` script and deploying the build to a static URL (Vercel preview deployment, or a dedicated `design.letbuyy.com` subdomain) requires no changes to any production app. It makes the entire governance investment accessible.

---

## Design Intelligence Index

| Document | Location | Agent | Purpose |
|----------|----------|-------|---------|
| This file | `executive-summary/EXECUTIVE_SUMMARY.md` | Synthesis | Platform-wide executive summary and top findings |
| Design System Inventory | `ecosystem-analysis/DESIGN_SYSTEM_INVENTORY.md` | Ecosystem Analysis | Full inventory of `@letbuyy/ui`: components, tokens, governance rules, mobile mirror, gaps |
| Token Inventory | `ecosystem-analysis/TOKEN_INVENTORY.md` | Ecosystem Analysis | Complete enumeration of all ~330 `--lb-*` CSS custom properties with light/dark values |
| Application Topology | `application-intelligence/APPLICATION_TOPOLOGY.md` | Application Intelligence | Per-app analysis: routes, layout type, component dependencies, workflows, CSS notes |
| Ecosystem Map | `application-intelligence/ECOSYSTEM_MAP.md` | Application Intelligence | Platform tier diagram, active/frozen/reserved classification, inter-app dependency graph, user journeys |
| Visual Identity Report | `visual-identity/VISUAL_IDENTITY_REPORT.md` | Visual Identity | Per-app visual analysis: color, typography, radius, shadows, mood, intent classification |
| App Brand Guides | `visual-identity/APP_BRAND_GUIDES.md` | Visual Identity | Comparative matrix of all 9 apps across visual attributes; coherence assessment; recommendations |
| Layout Topology | `layout-architecture/LAYOUT_TOPOLOGY.md` | Layout Architecture | Global layout primitives (AppFrame, Sidebar, Page, PageHeader, etc.) and per-app layout trees |
| Page Architecture | `layout-architecture/PAGE_ARCHITECTURE.md` | Layout Architecture | Page pattern library: list+detail, settings, dashboard, auth flow, creation wizard, empty state patterns |
| Component Catalog | `component-intelligence/COMPONENT_CATALOG.md` | Component Intelligence | Full catalog of all `@letbuyy/ui` components with props, token compliance, and usage notes |
| Component Duplication Report | `component-intelligence/COMPONENT_DUPLICATION_REPORT.md` | Component Intelligence | 7 confirmed duplications, 6 underutilization cases, 6 ratchet violations, 4 promotion candidates |
| Design Debt Report | `design-debt/DESIGN_DEBT_REPORT.md` | Design Debt | File-level violation audit across merchant-control-plane, identity-platform, marketing-site with priority matrix |
| Consistency Scorecard | `design-debt/CONSISTENCY_SCORECARD.md` | Design Debt | Quantified scores (0–10) across 5 dimensions for 24 files in 3 apps; top 10 debt items |
| Interaction Architecture | `interaction-design/INTERACTION_ARCHITECTURE.md` | Interaction Design | Navigation patterns, action placement, form patterns, feedback patterns, keyboard interactions |
| UX Pattern Library | `interaction-design/UX_PATTERN_LIBRARY.md` | Interaction Design | Canonical UX patterns across the platform with usage status and recommendations |
| Theme Architecture | `theme-architecture/THEME_ARCHITECTURE.md` | Theme Architecture | Token architecture, ThemeProvider system, surface model, density system, merchant theme engine |
| Theme Governance | `theme-architecture/THEME_GOVERNANCE.md` | Theme Architecture | Theme governance rules, canary flags, Liquid/React rendering model, theme registry governance |
| LetBuyy Design Constitution | `governance/LETBUYY_DESIGN_CONSTITUTION.md` | Governance | Ratified design governance law: 4-layer architecture, per-surface boundaries, change control process |
| Design Governance Model | `governance/DESIGN_GOVERNANCE_MODEL.md` | Governance | Operational governance model: what exists, what works, what is missing, role definitions |
| Design Migration Strategy | `migration-strategy/DESIGN_MIGRATION_STRATEGY.md` | Migration Strategy | Migration philosophy, current state baseline (adoption rates per app), quick wins, risk management |
| Implementation Roadmap | `migration-strategy/IMPLEMENTATION_ROADMAP.md` | Migration Strategy | 6-month phased roadmap: Phase 0 (audit), Phase 1 (quick wins), Phase 2–4 (systematic migration) |

---

## How to Use This Repository

### For a new designer joining LetBuyy

Start with the **Design Constitution** (`governance/LETBUYY_DESIGN_CONSTITUTION.md`) to understand why the platform has five different visual languages rather than one. Then read the **Visual Identity Report** (`visual-identity/VISUAL_IDENTITY_REPORT.md`) to understand each surface's intended mood and personality. The **Token Inventory** (`ecosystem-analysis/TOKEN_INVENTORY.md`) is your reference for every available `--lb-*` value. When designing for a specific app, read that app's section in the **Application Topology** to understand its users, constraints, and layout rules. For component behavior, consult the **Component Catalog**; for spacing and layout conventions, consult the **Layout Topology**. When you need to know what components already exist before speccing something new, check the **Component Duplication Report** to avoid speccing a pattern that already exists in `@letbuyy/ui`.

### For an engineer building a new component

Start with the **Component Duplication Report** (`component-intelligence/COMPONENT_DUPLICATION_REPORT.md`) to verify there is no existing `@letbuyy/ui` component for your use case. Then read the **Design Constitution Article II** (Layer Architecture) to understand which layer your component belongs to. If building a new `@letbuyy/ui` primitive, consult the **Token Inventory** for available tokens — never introduce a new raw value without first checking whether a `--lb-*` token exists for that value. Use the **Consistency Scorecard** benchmark files (`customers/page.tsx` and `purchase-orders/page.tsx`) as reference implementations. Run `node scripts/validate-governance.mjs` after every meaningful change. Check the **Design Debt Report** to avoid repeating the patterns that are already listed as violations.

### For a PM planning a new feature

Read the **Ecosystem Map** (`application-intelligence/ECOSYSTEM_MAP.md`) to understand which app owns the domain your feature touches. For user journey context, that document's User Journeys section maps the full new-merchant and customer journeys. Review the **Platform Design Health Dashboard** above to understand where the platform has active design quality risk — features planned in lower-scoring areas (identity-platform at 6.3/10, storefront-runtime at 5/10) carry higher implementation complexity. Use the **Top 5 Quick Wins** section to identify adjacent improvements that can ship alongside your feature with minimal incremental cost.

### For a technical lead auditing quality

Run `node scripts/validate-governance.mjs` for the authoritative 107-validator gate. Then consult the **Consistency Scorecard** for file-level scores and the **Design Debt Report** for the prioritized violation list with fix estimates. The **Migration Roadmap** (`migration-strategy/IMPLEMENTATION_ROADMAP.md`) provides a sequenced plan with success criteria for each phase. For blast radius on any design system change, use `pnpm graph:intel blast "@letbuyy/ui"` before merging. For governance questions, the **Design Constitution** is the authoritative rule document; the **Design Governance Model** describes what is and is not currently enforced.
