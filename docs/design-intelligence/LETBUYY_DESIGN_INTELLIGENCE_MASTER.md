---
title: LetBuyy Design Intelligence Master
version: 1.0
generated: 2026-06-19
agents: 10 specialized + 1 synthesis
source_documents: 22
lines_analyzed: 9371
status: CANONICAL
supersedes: all individual design intelligence documents
---

# LetBuyy Design Intelligence Master
*The definitive design operating handbook for the LetBuyy ecosystem*

---

# PART 1: EXECUTIVE OVERVIEW

## Opening: The Complete Story

LetBuyy is a production-grade, India-first multi-tenant commerce platform with a design system foundation that would pass scrutiny at most Series B product organisations — and a set of adoption gaps that, if left unaddressed, will compound into maintenance debt that blocks the platform's next growth phase. The foundation is this: `packages/typescript/ui` exports 50+ React components across 12 functional groups, governs ~330 CSS custom properties through a 4-tier token hierarchy (Primitive → Semantic → Component → Density), ships a Tailwind v4 bridge, a DTCG JSON interchange file, a Flutter/Dart token mirror, 7 mechanical codemods, and a ratchet validator tracking 7 violation categories in CI. The system has a ratified Design Constitution, 5 ESLint rules enforced at error level, and 7 Storybook story files covering every major component group. By any objective measure, this is not a platform that lacks design system infrastructure.

The gaps live at the adoption and governance layer. Of the six active web applications, three carry design debt that the ratchet was not yet enforcing when those files were first written: merchant-control-plane has 127 arbitrary-radius violations in files that predate the validator, 6 of which are in actively developed components; identity-platform maintains a ~2,300-line parallel CSS custom property system (10+ `--bg`, `--text-primary`, `--border` properties) that mirrors `--lb-*` token values without referencing them; and the theme editor inside merchant-control-plane operates as a fully isolated design system island with 27 direct `lucide-react` imports and ~50 private `theme-os-*` CSS class names, scoring 21/100 on the consistency scorecard. The two forced-dark internal tools (platform-console, platform-operations-portal) share byte-for-byte identical CSS and accidentally diverge from the canonical dark background by using `rgb(10 10 10)` instead of the violet-tinted ink-950 (`rgb(10 9 18)`). The three frozen marketplace apps carry their own divergent visual systems — one fully disconnected from `--lb-*` tokens, one using incorrect surface assignments — that will require dedicated remediation work when those apps are unfrozen.

Why this matters operationally: LetBuyy's most visible brand moment is the journey from the marketing site (`letbuyy.com`) through the auth flow (`accounts.letbuyy.com`) into the merchant dashboard (`admin.letbuyy.com`). Those three apps share a coherent "ink lavender" visual core — light page `rgb(250 249 255)`, dark page `rgb(10 9 18)`, purple-tinted borders — but that coherence exists in three separate `globals.css` comments rather than in a formally codified token. A single `--lb-color-bg-premium` token promotion would make this implicit brand language explicit, governable, and protected from drift. The critical short-term actions are not architecture changes: they are a 1-hour locale fix (Rs. → ₹ in the coupons page), a 2-hour dependency governance fix (lucide-react → @letbuyy/ui in the theme editor), a 30-minute dark background standardisation for the internal tools, and a Storybook deployment that requires no production code changes at all.

---

## The Ten Critical Findings

**Finding 1: The Design System Foundation is Production-Grade**
Severity: P2 (informational) | Effort: Phase 0 baseline only | Owner: Design System team

`packages/typescript/ui/src/tokens.ts` defines a canonical 4-tier token hierarchy — Primitive → Semantic → Component → Density — that emits ~330 CSS custom properties at runtime via `letbuyy-tokens.css`. The system's governance infrastructure is complete: a Tailwind v4 bridge maps semantic tokens to utility classes (`bg-surface`, `text-default`, `border-line`); a DTCG JSON interchange file enables cross-tool interoperability; a Flutter/Dart token mirror in `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart` propagates the web token set to native mobile; 7 codemods handle mechanical migration (including `tailwind-default-color-to-token` and `rounded-arbitrary-to-token`); an ESLint plugin enforces 5 rules at error level (no raw colors, no arbitrary radius, no deprecated tokens); and a ratchet validator in CI tracks 7 violation categories and prevents the violation count from increasing. Storybook stories exist for all major component groups across 7 story files including `governance.stories.tsx` (do/don't usage patterns) and `design-tokens.stories.tsx`.

The significance: the platform's design problems are adoption and governance gaps, not foundation gaps. The immediate action is to document the current ratchet baseline values in `scripts/validators/design-ratchet-baseline.json` as the Phase 0 anchor.

**Finding 2: Three Apps Share a Coherent "Ink Lavender" Visual Core**
Severity: P2 | Effort: 2–4 hours (token promotion) | Owner: Design System team

identity-platform, merchant-control-plane, and marketing-site independently adopt the same premium palette: light page background `rgb(250 249 255)`, dark page background `rgb(10 9 18)`, and purple-tinted border values. All three files comment this palette with phrases like "Premium Ink Lavender" or "Synced with accounts app theme" — the coherence is real, consistent, and intentional in practice, but it exists as duplicated raw `rgb()` values in three separate `globals.css` files rather than as a named token. The recommended action: promote to `--lb-color-bg-premium` in the semantic tier.

**Finding 3: 127 Arbitrary Border-Radius Violations in Merchant Control Plane**
Severity: P1 | Effort: 2 days (systematic) + half-day (6 active) | Owner: Merchant UX team

The design-system ratchet explicitly forbids `rounded-[...]` arbitrary values — the bracket syntax is disallowed even when the bracketed value is a token variable (e.g., `rounded-[var(--lb-radius-lg)]` is forbidden; the correct form is `rounded-lg`). 127 such instances exist in merchant-control-plane and predate the ratchet validator. Six are in actively developed, named component files, representing current governance misses: `NotificationsPanel.tsx`, `SettingsSearch.tsx`, `BackendNeededPane.tsx`, `EmbeddedAppBridgeClient.tsx`, `ProviderModeBadge.tsx`, and `AdminShell.tsx`.

**Finding 4: identity-platform Runs a Parallel CSS Custom Property System**
Severity: P1 | Effort: 4 hours (bridging) + 1 hour (visual verification) | Owner: Identity team

`apps/identity-platform/src/app/globals.css` is a ~2,300-line file that defines its own `--bg`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--border`, `--input-bg` properties with raw `rgb()` values. These shadow the canonical `--lb-color-*` token system without referencing it. The file also contains three layers of specificity override blocks ("COMPACT AUTH FLOW POLISH"). Identity-platform received the lowest design scores: Token Adoption 4.5/10, Layout Consistency 4.0/10, overall score 6.3/10.

The fix is mechanical: wire identity-platform's local custom properties to their `--lb-*` equivalents (`--bg: var(--lb-color-bg)`, `--text-primary: var(--lb-color-text)`, `--border: var(--lb-color-border)`, etc.).

**Finding 5: The Theme Editor is a Design System Island**
Severity: P0 (dependency governance) + P2 (CSS refactor) | Effort: 2 hours (dependency) + Phase 4 (CSS) | Owner: Theme team / Merchant UX team

`apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` imports 27 icons directly from `lucide-react`, bypassing `@letbuyy/ui`'s version-pinned re-exports. This creates a dual dependency. The file also uses approximately 50+ `theme-os-*` CSS class names with no `--lb-*` token references in JSX, scoring 2/10 on Token Adoption — 21/100 on the consistency scorecard. The 2-hour fix: replace all `import { ... } from 'lucide-react'` with `import { ... } from '@letbuyy/ui'`. The CSS refactor is Phase 4.

**Finding 6: Four Different Dark Backgrounds Across the Platform**
Severity: P1 | Effort: 30 minutes (internal tools) + Phase 4 (frozen apps) | Owner: Design System team

Four distinct dark page backgrounds: `rgb(10 9 18)` (canonical ink-950, token-backed), `rgb(10 10 10)` (platform-console and platform-operations-portal — accidental), `rgb(10 15 26)` (app-marketplace — frozen), and `rgb(15 15 26)` (theme-marketplace — frozen). The 30-minute fix: replace `rgb(10 10 10)` with `var(--lb-color-bg)` in both internal tool `globals.css` files.

**Finding 7: Coupons Page Has a Live Locale Bug**
Severity: P0 | Effort: 1 hour | Owner: Merchant UX team

The `formatDiscount()` function in `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx` returns `` `Rs. ${coupon.value}` `` for absolute discount values. `Rs.` is the deprecated romanised abbreviation; the correct symbol is `₹`. The canonical formatter `formatInrCurrency` is exported from `@letbuyy/ui` and is used correctly everywhere else in merchant-control-plane. Fix: replace `` `Rs. ${coupon.value}` `` with `formatInrCurrency(coupon.value)`.

**Finding 8: marketing-site Uses Wrong ThemeProvider Surface**
Severity: P2 (latent) | Effort: 2 hours | Owner: Marketing / Design System team

`apps/marketing-site/src/app/layout.tsx` instantiates `LetbuyyThemeProvider` with `surface="storefront"`. The `storefront` surface is semantically designated for `storefront-runtime`. Currently all five surface types resolve to identical token values — zero visual impact today — but if the platform ever defines distinct token values for the `storefront` surface, the marketing site silently inherits those changes. Fix: define a `marketing` surface type and update the ThemeProvider.

**Finding 9: No Deployed Storybook or Design Handoff**
Severity: P1 (governance gap) | Effort: Half-day | Owner: Design System team

Seven Storybook story files exist in `packages/typescript/ui/src/`: `component-catalog.stories.tsx`, `design-tokens.stories.tsx`, `foundation-primitives.stories.tsx`, `governance.stories.tsx`, `merchant-experience.stories.tsx`, `primitives.stories.tsx`, and `table.stories.tsx`. No `storybook` script was confirmed in `packages/typescript/ui/package.json`. No deployed Storybook URL appears in any documentation. No Figma token plugin configuration was found across the entire codebase. Without a published Storybook, the governance stories are invisible to engineers, who find the nearest existing code — including code with ratchet violations — and copy it.

**Finding 10: Flutter Dark Mode Uses a Different Palette Than Web**
Severity: P1 | Effort: 2 hours + device visual review | Owner: Mobile team / Design System team

The generated `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart` uses gray/slate-based dark values: `backgroundDark` maps to `gray900 = #111827`. The TypeScript source uses the violet-tinted ink palette: `ink.950 = #0a0912`. The generation script is `scripts/generators/generate-mobile-tokens.mjs`; it passes CI validation but the source mapping for ink-palette values is incorrect. Fix: update `generate-mobile-tokens.mjs` to correctly map `ink.950 → Color(0xFF0A0912)` and run `validate:mobile-tokens` to confirm parity.

---

## Platform Design Health Dashboard

| Dimension | Score | Status | Root Cause | Priority Action |
|-----------|-------|--------|------------|-----------------|
| Token Adoption | 7/10 | Yellow | identity-platform parallel CSS system; theme editor island; 127 legacy radius violations | Bridge identity-platform to `--lb-*`; run radius codemod on merchant-control-plane; Phase 4 theme editor CSS |
| Component Consistency | 7/10 | Yellow | 6 active ratchet violations in named components; theme editor bypasses @letbuyy/ui icons; CommandPalette local duplicate | Fix 6 named component violations; replace lucide-react direct imports in theme editor |
| Layout Consistency | 7/10 | Yellow | identity-platform layout scored 4.0/10; no canonical `BottomSheet` component; two apps with identical CSS | Promote `BottomSheet` pattern to @letbuyy/ui; differentiate console vs. ops-portal CSS |
| Typography System | 8/10 | Yellow | No fluid font scaling for body/secondary text (only display/h1/h2 have `clamp()` variants); 14 distinct icon sizes in use | Add `clamp()` variants for body/secondary; establish canonical icon size vocabulary |
| Color Governance | 6/10 | Yellow | 4 distinct dark backgrounds; implicit ink-lavender in 3 apps not formally tokenised; Flutter dark palette mismatch | Promote `--lb-color-bg-premium` token; fix internal tool backgrounds; fix Flutter generation script |
| Interaction Patterns | 8/10 | Green | Strong: keyboard shortcuts, command palette, form patterns, feedback patterns all consistent | Maintain current trajectory; add async entity search to DS CommandPalette to retire merchant duplicate |
| Theme Architecture | 8/10 | Green | Strong: 4-tier token system, 5 surface types, 3 density presets, ThemeScript FOUC prevention; one wrong surface assignment | Add `marketing` surface type; fix marketing-site surface="storefront" assignment |
| Dark Mode | 6/10 | Yellow | 4 distinct dark backgrounds; Flutter dark uses gray/slate not ink-violet; no deployed visual reference | Fix internal tool backgrounds; fix Flutter generation; deploy Storybook with dark mode stories |
| Mobile Design | 7/10 | Yellow | Flutter dark palette gap; 14 icon sizes with no canonical vocabulary; no `BottomSheet` in DS | Fix Flutter token generation; establish icon size tokens; promote BottomSheet |
| Governance Maturity | 8/10 | Green | Strong: ratchet, ESLint rules, codemods, Design Constitution; gap: no deployed Storybook, no Figma integration | Deploy Storybook; establish Figma token plugin; document ratchet baseline in JSON |
| **Overall** | **7.2/10** | **Yellow** | Adoption and tooling gaps, not foundation gaps — foundation is production-grade | Phase 0: baseline. Phase 1: quick wins. Phase 2–4: systematic adoption |

---

## Application Health at a Glance

| App | Score | Active | Biggest Issue | Next Action |
|-----|-------|--------|---------------|-------------|
| merchant-control-plane | 8.0/10 | Yes | 127 legacy arbitrary-radius violations; 6 active ratchet violations in named components; theme editor design system island (21/100) | Fix 6 named component violations (half-day); run radius codemod; replace lucide-react in theme editor (2 hrs) |
| identity-platform | 6.3/10 | Yes | ~2,300-line parallel CSS custom property system (Token Adoption 4.5/10, Layout Consistency 4.0/10) | Bridge 10+ local CSS vars to `--lb-*` equivalents (4 hrs); fix coupons Rs.→₹ (1 hr) |
| marketing-site | 7.3/10 | Yes | Wrong `surface="storefront"` assignment; implicit ink-lavender palette not tokenised | Define `marketing` surface type; update ThemeProvider (2 hrs); promote ink-lavender palette to token |
| storefront-runtime | 5.0/10 | Yes | Intentionally identity-less (correct design choice); storefront font aliases don't load different fonts; no DS component adoption (theme-driven) | Verify storefront font alias loading; document blank-slate design intent formally |
| platform-console | 6.0/10 | Yes | Accidental visual identity; dark background `rgb(10 10 10)` diverges from canonical ink-950; byte-for-byte identical CSS to ops-portal | Replace hardcoded dark bg with `var(--lb-color-bg)` (30 min); differentiate visual identity from ops-portal |
| platform-operations-portal | 6.0/10 | Yes | Copy of platform-console CSS with no differentiation; same dark background divergence | Standardise dark bg (30 min); establish visual differentiation from console |
| app-marketplace (frozen) | 7.0/10 | No | Redundant inline token redeclarations; wrong dark background `rgb(10 15 26)` | Address as part of freeze-exit consolidation planning |
| developer-portal (frozen) | 7.0/10 | No | `surface="marketplace"` is semantically wrong for developer documentation context | Update to `surface="developer"` on unfreeze |
| theme-marketplace (frozen) | 8.0/10 | No | Fully disconnected from `--lb-*` token system; owns complete parallel token set | Assess consolidation vs. token bridge on unfreeze |
| mobile/merchant-app | N/A | Yes | Flutter dark palette uses gray/slate (`#111827`) instead of ink-violet (`#0a0912`) | Fix `generate-mobile-tokens.mjs` mapping (2 hrs + device review) |

---

# PART 2: LETBUYY DESIGN PHILOSOPHY

## 2.1 What LetBuyy Is as a Design Problem

LetBuyy is not a single product. It is five distinct product surfaces, each serving a different user population with fundamentally different cognitive modes, trust relationships, and design language requirements.

**Prospective merchants at letbuyy.com** are in an evaluation mode. They are scanning for credibility signals, pricing clarity, and differentiation from Shopify, WooCommerce, and domestic Indian platforms. The marketing site serves them with bold typography, generous whitespace, scroll-driven animation (GSAP 3.14, Framer Motion 12, Lenis smooth scroll), gradient-heavy visual storytelling, and aspirational brand language. Information density is low by intent — friction is the enemy.

**New merchants during onboarding** are in a high-anxiety transition mode. They are committing to a platform, entering personal and business information, creating credentials, and making decisions (store type, subdomain) that will define their identity on the platform. The identity platform serves them with a single-focus card UI at 380–420px, minimal distractions, clear progress signalling, and an "ink lavender" premium palette that communicates trust without corporate coldness. The primary user is a merchant signing up on their phone in Tier 2 India with a 4G connection, not a desktop user in a WeWork. Information density is intentionally minimal — one task per screen.

**Operating merchants in the dashboard** are in a work mode. They are processing orders, resolving inventory discrepancies, configuring GST tax rules, reviewing customer feedback. The merchant control plane serves them with a data-dense, keyboard-navigable, sidebar-anchored workspace. The design language prioritises legibility, hierarchy, and efficiency over aesthetics. Information density is high by requirement.

**End customers at merchant storefronts** are in a shopping mode. They have no relationship with LetBuyy as a brand — they have a relationship with the merchant's store. The storefront runtime serves them with a deliberately identity-less rendering engine. Any LetBuyy branding on a merchant storefront is a UX failure.

**LetBuyy operators and team members** are in an oversight and intervention mode. Founders and engineers at console.letbuyy.com need cross-merchant visibility: KPIs, risk signals, compliance escalations. Operations staff at ops.letbuyy.com need workflow-oriented interfaces: support ticket queues, CRM pipelines, merchant health scorecards. Both populations need dark, dense, tool-like UIs. The design language is forced-dark, information-maximising, and deliberately unconsumer.

---

## 2.2 The Platform Ecosystem Principle

The guiding principle of LetBuyy's design architecture is: **consistency within products, governance across**. These are not the same thing.

Within merchant-control-plane, every page should feel like it was built by the same team on the same system. Across products, the goal is not visual sameness — it is governed identity. identity-platform and merchant-control-plane should feel related but distinct. The auth card is single-column, mobile-first, minimal. The dashboard is full-width, data-dense, navigated. They share the ink-lavender palette and the Geist Sans typeface. They do not share the layout, the information density, or the navigation model. That transition is a design success.

The ink-lavender finding is the clearest evidence that this ecosystem principle is already working implicitly — and needs to be formalised explicitly. Three separate engineering teams independently chose the same premium palette: light `rgb(250 249 255)`, dark `rgb(10 9 18)`, purple-tinted borders. None of them were executing against a formal cross-app colour spec. They were executing against a shared aesthetic intuition. The fix is to codify what already exists: `--lb-color-bg-premium` in the token system, adopted by all three apps, protected by the ratchet.

The counter-case is the two internal operator tools. platform-console and platform-operations-portal have byte-for-byte identical CSS and visually indistinguishable interfaces. A super-admin at the console and an operations staff member in the ops portal are in different roles with different authorities. The design should reinforce that distinction with a header accent colour, a navigation label, a subtle difference in the shell background. This is the difference between accidental sameness (current state) and intentional differentiation (design goal).

---

## 2.3 The Four-Layer Design Architecture

**Layer 0: Global Foundation**
Primitive tokens (raw values), the Tailwind v4 bridge, the CSS custom property emission layer (`letbuyy-tokens.css`), the DTCG JSON interchange file, the Flutter/Dart mirror, the ESLint rules, and the ratchet validator. Owned by the Design System team and platform engineering leads. Every change to Layer 0 requires ARB review — a change to `ink.950`'s raw value propagates to every surface that uses `--lb-color-bg`. The 4-tier token hierarchy (Primitive → Semantic → Component → Density) lives at this layer.

**Layer 1: Shared Interaction Library**
`packages/typescript/ui` — `@letbuyy/ui`. Contains all 50+ exported React components, the ThemeProvider system, the 5 surface types, and the governance stories. Owned by the Design System team with contributions from product teams via governed PR process. Breaking changes require ARB approval. The 7 codemods live at this layer.

**Layer 2: Product Design Systems**
Each active product surface has its own design system at Layer 2: merchant-control-plane's admin surface, identity-platform's identity surface, marketing-site's marketing surface (currently incorrectly using `storefront`), storefront-runtime's storefront surface, and the shared `operations` surface for the two internal tools. Product teams can extend Layer 1 components with product-specific compositions and define product-scoped CSS, provided they reference `--lb-*` tokens for all values and do not introduce new raw primitives.

**Layer 3: Tenant Customisation**
The `createLetbuyyBrandVariables` API — the mechanism by which merchants apply their own brand palette to their storefronts without breaking platform guarantees. Layer 3 operates exclusively within storefront-runtime and is constrained by WCAG contrast validation. Layer 3 values are scoped to the tenant's storefront instance and do not propagate to merchant-control-plane, identity-platform, or any other surface.

---

## 2.4 Intentional vs Accidental Identity

**Intentional identity — the ink-lavender merchant-facing surface:** identity-platform, merchant-control-plane, and marketing-site share the ink-lavender palette, Geist Sans typeface, and quality aesthetic by design. Each is appropriate to its context. The recommended action is not to change it but to formalise it.

**Intentional identity — the storefront blank slate:** storefront-runtime has minimal LetBuyy design identity by explicit design intent. The 5/10 consistency score is not a quality failure — it is evidence that the blank-slate design intent is working.

**Accidental identity — the internal operator tools:** platform-console and platform-operations-portal serve different audiences (super-admin vs. operations staff) and look identical today not because someone decided they should, but because no one made an active decision about their visual differentiation. The recommended action: distinguish them with light but deliberate signals — a different header treatment, a different nav label.

**Diverged without governance — the frozen apps:** app-marketplace, theme-marketplace, and developer-portal each developed their own visual identities before being frozen. None of these are production regressions today. Each represents a known remediation scope required when those apps are unfrozen.

---

# PART 3: ECOSYSTEM MAP

## 1. merchant-control-plane

**Status:** Active — primary merchant workspace, production deploy target
**Runtime path:** `apps/merchant-control-plane` (port 9001, `admin.letbuyy.com`)
**Primary users:** Merchants — store owners and employees with scoped roles
**Design maturity score:** 8.0/10
**Information density:** High — 143 routes, data-dense tables, multi-panel editors, command palette

**Routes and Workflows:** The app exposes 143 routes (68 UI pages under `[store]/` + 75 internal API proxy routes). Core route tree: Dashboard, Products (`/products`, `/products/new`, `/products/[productId]`, `/products/collections`, `/products/inventory`, `/products/purchase-orders`, `/products/transfers`, `/products/gift-cards`), Orders, Customers, Marketing (`/coupons`, `/reviews`), Content (`/pages`, `/posts`, `/comments`, `/gallery`, `/categories`), Online Store (`/online-store`, `/online-store/themes`, `/online-store/themes/[themeId]/editor`, `/online-store/preferences`), Money (`/settings/billing`, `/payouts`), Apps, and Settings (15 sub-routes). The 5 primary workflows: products management, order fulfilment, online store and theme editing, settings configuration (shipping/taxes/Razorpay/domains/team), analytics and marketing.

**Layout Model:** Full-screen dashboard architecture. `AdminShell.tsx` is the master layout frame: sidebar left (persistent, site-type-adaptive, collapses to icon-only on mobile), `HeaderBar.tsx` top, content area right. `AppNavigation` from `@letbuyy/ui` drives the sidebar with 5 navigation configurations keyed to site type (store / portfolio / resume / landing / blog). Keyboard shortcuts (`g-h` for dashboard, `g-o` for orders, `g-p` for products) plus `CommandPalette.tsx` provide power-user navigation.

**Design System Integration:** Token adoption score: 7.5/10. `@letbuyy/ui` is the primary component source for all UI primitives. Known violations: 127 arbitrary-radius instances predating the ratchet, 6 active ratchet violations in named components. The theme editor (`/themes/[themeId]/editor/page.tsx`) is the single worst-scoring file at 21/100, with 27 direct `lucide-react` imports and ~50 `theme-os-*` CSS class names.

**Active Ratchet Violations (6):**
- R-01: `NotificationsPanel.tsx` — `rounded-[var(--lb-radius-full)]`, `py-[1px]` — fix: use `<Badge>` from `@letbuyy/ui`
- R-02: `SettingsSearch.tsx` — `rounded-[var(--lb-radius-lg)]` — fix: use `<Input>` from `@letbuyy/ui`
- R-03: `BackendNeededPane.tsx` — `rounded-[var(--lb-radius-lg)]` — fix: use `<Card>` or `<Box radius="lg">`
- R-04: `EmbeddedAppBridgeClient.tsx` — `rounded-[var(--lb-radius-lg)]` — fix: use `<Tabs variant="pills">`
- R-05: `ProviderModeBadge.tsx` — `py-[2px]` — fix: remove arbitrary padding; use token-scaled padding
- R-06: `AdminShell.tsx` — `rounded-tl-[var(--sidebar-panel-radius)]` — fix: use `rounded-tl-[var(--lb-radius-lg)]`

**Intelligence Notes:** The benchmark pages for design system compliance are `customers/page.tsx` and `purchase-orders/page.tsx` — both scored highest on the consistency scorecard and serve as reference implementations.

---

## 2. identity-platform

**Status:** Active — production deploy target; the auth entry point for all merchant users
**Runtime path:** `apps/identity-platform` (port 9002, `accounts.letbuyy.com`)
**Primary users:** Merchants — new (signup/onboarding) and returning (login/session); OAuth2 clients
**Visual personality:** "Premium Ink Lavender" — single-focus centered card, 380–420px, mobile-first, trust-communicating
**Design maturity score:** 6.3/10 (lowest of audited active apps; Token Adoption 4.5/10, Layout Consistency 4.0/10)

**Routes and Workflows:** 38 routes/files: 13 UI pages, 18 API routes, 5 OAuth2/OIDC server endpoints. UI pages: `/login`, `/signup`, `/lookup`, `/check-email`, `/forgot-password`, `/reset-password`, `/set-password`, `/onboarding` (store type selection, subdomain picker), `/select` (multi-store switcher). OAuth2 server: `/oauth2/authorize`, `/oauth2/token`, `/oauth2/callback`, `/oauth2/logout`, `/oauth2/userinfo`, `/oauth2/consent`. OIDC: `/.well-known/openid-configuration`, `/.well-known/jwks.json`.

**Layout Model:** No persistent navigation. The layout architecture is minimal card: centered `div`, 380–420px width, mobile-first. The `.auth-card` CSS class is the core layout primitive. Custom component classes: `.auth-otp-input` (6-cell OTP entry), `.onboard-bento-grid` (store-type selection), `.onboard-bento-card`, `.select-store-item`, `.onboard-india-defaults`.

**Design System Integration:** Token adoption score: 4.5/10. The component layer correctly imports `LetbuyyThemeProvider` and `ThemeScript`. The token layer is broken: the ~2,300-line `globals.css` defines 10+ parallel custom properties with raw `rgb()` values that duplicate `--lb-*` equivalents without referencing them. Three specificity override blocks ("COMPACT AUTH FLOW POLISH") re-declare values at elevated cascade weight.

---

## 3. marketing-site

**Status:** Active — primary public-facing marketing presence, production deploy target
**Runtime path:** `apps/marketing-site` (port 9006, `letbuyy.com`)
**Primary users:** Prospective merchants — evaluation mode, pre-signup
**Visual personality:** Bold, aspirational, editorial — gradient systems, scroll-driven animation (GSAP + Framer Motion + Lenis), generous whitespace
**Design maturity score:** 7.3/10 (Token Adoption 7.3/10, strong component usage, wrong surface assignment)

**Routes and Workflows:** 21 routes: 7 UI pages plus resource hub sub-pages. Core: `/` (homepage), `/pricing`, `/create`, `/signup`. Resource hub: `/resources`, `/resources/[category]`, `/resources/[category]/[slug]`, `/resources/authors/[slug]`, `/resources/changelog`, `/resources/releases`.

**Layout Model:** Marketing editorial layout — top-navigation header (`Header.tsx`) + full-width content sections + footer (`Footer.tsx`). Section components: `Hero.tsx`, `Features.tsx`, `Pricing.tsx`, `FAQ.tsx`. Platform narrative components (`CapabilityMap.tsx`, `CommerceNetwork.tsx`, `EcosystemMap.tsx`, `MerchantJourney.tsx`, `SiteTypes.tsx`, `TrustIndicators.tsx`) handle visual storytelling.

**Design System Integration:** Token adoption score: 7.3/10. The marketing site correctly maps `--lb-color-*` tokens to semantic marketing aliases in globals.css. The Tailwind `@source` directive includes `@letbuyy/ui` package source. Known violation: `surface="storefront"` is incorrectly assigned. Note: `apps/marketing-site` is excluded from the design-system ratchet scope by design — its 725 raw `rgb()` calls represent deliberate visual identity, not careless debt.

---

## 4. storefront-runtime

**Status:** Active — primary shopper-facing runtime, production deploy target
**Runtime path:** `apps/storefront-runtime` (port 9000, `{store}.letbuyy.com` and custom domains)
**Primary users:** Shoppers / end customers — purchasing from merchant stores
**Visual personality:** Intentionally identity-less — visual identity belongs entirely to the active merchant theme
**Design maturity score:** 5/10 (intentionally; blank-slate design intent)

**Routes and Workflows:** 66 routes: 46 UI pages/layouts + 23 API routes. Store routes: home, product detail, products listing, collection, cart, checkout. Customer account: hub, orders, addresses, settings, wishlist. The 5 primary workflows: browse → cart → checkout, customer account management, content consumption, theme preview, demo rendering (`/demo/urban-kicks`).

**Layout Model:** Highly themed, per-store layout — every layout element is under theme control. `src/proxy.ts` middleware routes subdomain requests to the correct tenant context — this is live Next.js middleware. The catch-all route (`[...path]`) handles Liquid/CMS page rendering via `@letbuyy/theme-engine`.

**Design System Integration:** Minimal at the app level — intentional. The storefront imports `letbuyy-tokens.css` and uses `LetbuyyThemeProvider surface="storefront"`. Beyond that, visual values are provided by the theme engine at runtime via `createLetbuyyBrandVariables`. Liquid canary is OFF by default (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`).

**Critical Risk:** Storefront font aliases (`--storefront-font-heading`, `--storefront-font-body`) may not load different fonts from the web dashboard's Geist Sans, creating font consistency failures. This is a live bug where `--font-lora`, `--font-playfair` etc. all resolve to Geist (merchant deception).

---

## 5. platform-console

**Status:** Active — internal super-admin operator tool, production deploy target
**Runtime path:** `apps/platform-console` (port 9007, `console.letbuyy.com`)
**Primary users:** LetBuyy founders, engineering leads — MFA-required, highest-authority system access
**Visual personality:** Accidental — defers to `@letbuyy/ui` defaults; forced-dark; unintentionally identical to platform-operations-portal
**Design maturity score:** 6.0/10

**Routes and Workflows:** 34 routes: 22 UI pages + 6 API routes. Key routes: `/dashboard`, `/stores`, `/merchants/[id]`, `/revenue`, `/money-reconciliation`, `/marketplace-governance`, `/risk`, `/trust-safety`, `/audit-logs`.

**Design System Integration:** Heavy use of `@letbuyy/ui`. `globals.css` adds `rgb(10 10 10)` as the dark background — diverging from canonical ink-950 (`rgb(10 9 18)`). The 30-minute fix: replace with `var(--lb-color-bg)`.

---

## 6. platform-operations-portal

**Status:** Active — internal team operations tool, production deploy target
**Runtime path:** `apps/platform-operations-portal` (port 9008, `ops.letbuyy.com`)
**Primary users:** LetBuyy operations staff, customer success team, support agents
**Visual personality:** Accidental copy of platform-console — visually indistinguishable
**Design maturity score:** 6.0/10

**Routes and Workflows:** 27 routes: 20 UI pages. Key routes: `/crm`, `/tickets`, `/support`, `/merchant-health`, `/retention`, `/campaigns`, `/onboarding`, `/operations`.

**Design System Integration:** Same profile as platform-console — `@letbuyy/ui` usage, wrong dark background `rgb(10 10 10)`. CSS is byte-for-byte identical to platform-console's globals.css beyond import statements.

---

## 7. app-marketplace (Frozen)

**Status:** Frozen — not a production deploy target; pending consolidation
**Design maturity score:** 7.0/10
**Routes:** 40 routes: 27 UI pages + 10 API routes.
**Known violations:** Dark background `rgb(10 15 26)` — blue-shifted, not canonical ink-950. Comprehensive inline token redeclaration (correct direction, wrong implementation). Background flash prevention via `dangerouslySetInnerHTML` style (bespoke solution, not using `ThemeScript`).

---

## 8. developer-portal (Frozen)

**Status:** Frozen — not a production deploy target
**Design maturity score:** 7.0/10
**Routes:** 10 routes.
**Known violations:** `surface="marketplace"` is semantically wrong for a developer documentation context. Minimal dependency footprint — thin layer over the platform.

---

## 9. theme-marketplace (Frozen)

**Status:** Frozen — not a production deploy target
**Design maturity score:** 8.0/10 (by own standards)
**Known violations:** Fully disconnected from `--lb-*` token system; owns a complete independent token system with indigo primary, 3-accent visual system, rose dark text. Dark background `rgb(15 15 26)` — not ink-950. Highest remediation effort of the frozen trio.

---

## 10. mobile/merchant-app

**Status:** Active — Flutter native app
**Known violations:** Flutter dark palette uses `gray900 = #111827` as `backgroundDark` instead of the violet-tinted `ink.950 = #0a0912`. Similarly, dark border tokens map to `slate700 = #334155` in Dart vs. `rgba(139,92,246,0.18)` in TypeScript. The generation script passes CI validation but the source mapping is incorrect.

---

# PART 4: VISUAL IDENTITY INTELLIGENCE

## 4.1 The Ink Lavender Identity — The Platform's Implicit Brand

### How It Was Discovered

The ink lavender identity was not declared in a design brief. It was found in code comments.

During the visual identity audit, three independent `globals.css` files — belonging to `identity-platform`, `merchant-control-plane`, and `marketing-site` — contained near-identical CSS variable declarations with explicit inline documentation:

```css
/* Light Theme — Premium Ink Lavender */
--bg: rgb(250 249 255);
```

```css
/* — Sidebar — Ink Lavender — */
--sidebar-bg: rgb(244 242 254);
```

```css
/* PREMIUM DESIGN TOKENS - LIGHT MODE (Matching light_theme_colors.dart) */
--bg-deep: rgb(250 249 255);
```

The phrase "ink lavender" appears independently in at least two of these three files. The `marketing-site` comment `Matching light_theme_colors.dart` reveals these color values were originally defined in a Flutter mobile application and ported to the web platform. Origin: `packages/dart/ui_kit/lib/src/tokens/light_theme_colors.dart`.

### What the Ink Lavender Palette Is

**Light pole — "Premium Ink Lavender"**

| Role | Value | Where Used |
|---|---|---|
| Page background | `rgb(250 249 255)` | identity, merchant, marketing |
| Secondary surface / sidebar | `rgb(244 242 254)` | identity (bg-secondary), merchant (sidebar-bg) |
| Text primary | `rgb(10 8 22)` | identity, marketing |
| Border | `rgb(224 216 248)` | identity, merchant |

**Dark pole — "Ink 950"**

| Role | Value | Where Used |
|---|---|---|
| Dark page background | `rgb(10 9 18)` = `#0a0912` | identity, merchant, marketing |
| Dark card | `rgb(13 11 22)` = `#0d0b16` | identity |
| Dark sidebar | `rgb(13 11 21)` = `#0d0b15` | merchant |
| Dark border | `rgba(139, 92, 246, 0.18)` | identity, merchant |

The dark value `rgb(10 9 18)` is the `ink.950` step in the ink palette. It is not black — the slight upward pressure on the blue and green channels gives the dark mode a violet warmth that distinguishes LetBuyy from apps using pure black or flat dark gray.

### Formalisation Actions Required

1. **Name the canonical values in `tokens.ts`.** The light pole (`rgb(250 249 255)`) should be named `lavender.50` and documented as the platform's canonical page background for internal surfaces.
2. **Map to `--lb-color-bg` and `--lb-color-surface`.** Replace local CSS variables (`--bg`, `--sidebar-bg`) with direct references to `--lb-color-*` tokens.
3. **Correct the three apps that have diverged accidentally.** `platform-console` and `platform-operations-portal` use `rgb(10 10 10)` — should be `var(--lb-color-bg)`.
4. **Document the ink lavender palette as a brand standard** in the design system documentation.

---

## 4.2 Per-Application Visual Intelligence

### identity-platform
**Visual Mood:** Premium, focused, intimate. The lavender background communicates trust; the constrained palette keeps attention on the form.
**Identity Type:** Intentional — code is explicitly self-annotating with comments including `AUTH DESIGN SYSTEM — Mobile-First`, `Premium Ink Lavender`, and `ONBOARDING DESIGN SYSTEM — Purple theme`.
**Color System:** Light: page `rgb(250 249 255)`, card bg `rgb(255 255 255)`, sidebar bg `rgb(244 242 254)`, border `rgb(224 216 248)`. Dark: page `rgb(10 9 18)`, card bg `rgb(13 11 22)`, border `rgba(139, 92, 246, 0.18)`.
**Typography:** Geist Sans (inherited from platform), 14px body, `text-primary` references local `--text-primary` (not `--lb-color-text`). Fixed sizes (no responsive fluid scaling).
**Radius:** Moderate — ~12px for the auth card container. OTP inputs use smaller radius.

### merchant-control-plane
**Visual Mood:** Professional, information-dense, tool-like. The ink lavender base grounds a workspace that prioritises hierarchy and legibility.
**Identity Type:** Intentional — the sidebar dark, header wayfinding, and data-table-first layout are deliberate choices for a daily-use merchant tool.
**Color System:** Light: page bg `rgb(250 249 255)` (via `--lb-color-bg`), sidebar `rgb(241 242 244)`, border `rgb(229 231 235)`. Dark: page `rgb(10 9 18)`, sidebar `rgb(13 11 21)`, purple-tinted borders.
**Typography:** Geist Sans, 13–14px body (compact density), 24px page titles.
**Radius:** Under ratchet pressure (127 violations). Target: only canonical `rounded-sm/md/lg/xl/full`.

### marketing-site
**Visual Mood:** Bold, aspirational, editorial. Gradient systems, animated hero, generous whitespace.
**Identity Type:** Intentional — gradient-heavy visual storytelling appropriate for a conversion-optimised marketing surface.
**Color System:** Custom gradient system layered over `--lb-color-*` token references. Maps tokens to semantic marketing aliases: `--primary`, `--accent`, `--bg-deep`, `--bg-card`. Note: the marketing site's own color extensions are product-appropriate and do not violate the token system.
**Typography:** Fluid display scale (`clamp()` for h1/h2/display), Geist Sans, marketing-specific line heights.

### storefront-runtime
**Visual Mood:** Theme-determined — blank slate by design.
**Identity Type:** Intentionally identity-less. The 5/10 consistency score is correct.
**Color System:** `--lb-color-*` tokens for structural elements; all visual values provided by theme engine at runtime. Tenant brand overrides via `createLetbuyyBrandVariables`.

### platform-console + platform-operations-portal
**Visual Mood:** Dark, dense, tool-like — but without deliberate differentiation between the two.
**Identity Type:** Accidental — the apps are visually identical despite serving fundamentally different user roles.
**Dark background:** `rgb(10 10 10)` — should be `var(--lb-color-bg)` = `rgb(10 9 18)`.

---

## 4.3 Cross-App Visual Coherence

| Dimension | merchant-control-plane | identity-platform | marketing-site | Coherence |
|---|---|---|---|---|
| Page background (light) | `rgb(250 249 255)` | `rgb(250 249 255)` | `rgb(250 249 255)` | Perfect |
| Page background (dark) | `rgb(10 9 18)` | `rgb(10 9 18)` | `rgb(10 9 18)` | Perfect |
| Primary color | purple-500 `#8B5CF6` | purple-500 `#8B5CF6` | purple-500 `#8B5CF6` | Perfect |
| Border (light) | `rgb(229 231 235)` | `rgb(224 216 248)` | token-mapped | Near-match |
| Border (dark) | `rgba(139,92,246,0.18)` | `rgba(139,92,246,0.18)` | token-mapped | Perfect |
| Typeface | Geist Sans | Geist Sans | Geist Sans | Perfect |
| Radius system | Under ratchet | 12px card radius | custom scale | Partial |

---

## 4.4 Dark Mode Intelligence

Four divergent dark backgrounds across the platform:

| App | Dark Background | Status |
|---|---|---|
| identity-platform | `rgb(10 9 18)` = `#0a0912` = ink-950 | Canonical |
| merchant-control-plane | `rgb(10 9 18)` = `#0a0912` = ink-950 | Canonical |
| marketing-site | `rgb(10 9 18)` = `#0a0912` = ink-950 | Canonical |
| platform-console | `rgb(10 10 10)` | Wrong — should be `var(--lb-color-bg)` |
| platform-operations-portal | `rgb(10 10 10)` | Wrong — should be `var(--lb-color-bg)` |
| app-marketplace | `rgb(10 15 26)` | Wrong (frozen — not a production risk today) |
| theme-marketplace | `rgb(15 15 26)` | Wrong (frozen — not a production risk today) |

**Dual-signal dark mode architecture:** `ThemeScript` (blocking inline script in `<head>`) prevents FOUC by reading `LETBUYY_THEME_STORAGE_KEY` from localStorage and applying `data-letbuyy-theme="dark"` before first paint. `OverlayPortal` mirrors this attribute onto body-level portal containers, preventing the dark-mode cascade mismatch that causes modals to render light when the app is dark.

---

## 4.5 Visual Identity Decisions (Binding)

**Decision 1 (binding):** The canonical dark background for all active LetBuyy web surfaces is `rgb(10 9 18)` (`#0a0912`, ink-950). Any surface using a different value is incorrect.

**Decision 2 (binding):** The canonical light page background for all merchant-facing surfaces is `rgb(250 249 255)` (lavender.50). This value should be consumed via `var(--lb-color-bg)`.

**Decision 3 (binding):** The primary brand color is `#8B5CF6` (purple-500). CTA buttons use `#6D28D9` (purple-700). These values are not to be changed in product code — they are Layer 0 token values.

**Decision 4 (binding):** The ink lavender palette (light pole `rgb(250 249 255)`, dark pole `rgb(10 9 18)`, purple-tinted borders) is the platform's implicit brand standard for merchant-facing surfaces. It must be promoted to a formal `--lb-color-bg-premium` token before any new merchant-facing surface is built.

**Decision 5 (binding):** Font aliases in storefront-runtime must load the fonts they name. A storefront using `--font-lora` must load the Lora typeface, not resolve to Geist. The current state where all font aliases resolve to Geist is a critical bug that constitutes merchant deception.

**Decision 6 (binding):** `OverlayPortal` is the required pattern for all overlay rendering. No app may build its own overlay mechanism.

**Decision 7 (binding):** The `marketing` surface type must be defined in `tokens.ts` and `marketing-site`'s `LetbuyyThemeProvider` must be updated to `surface="marketing"`.

---

# PART 5: LAYOUT TOPOLOGY

## 5.1 The Five Layout Archetypes

### Archetype 1: Full-Screen Dashboard (merchant-control-plane)

```
<html>
  <body data-letbuyy-theme data-letbuyy-surface="admin" data-letbuyy-density="compact">
    <AdminShell>
      <Sidebar>                  ← AppNavigation, site-type-adaptive, collapse-to-icon
        <NavSection>             ← 5 configurations: store/portfolio/resume/landing/blog
        </NavSection>
      </Sidebar>
      <div class="main-area">
        <HeaderBar>              ← NotificationsPanel, UserMenu, StoreSwitcher
        </HeaderBar>
        <PageContent>
          <PageHeader>           ← @letbuyy/ui PageHeader: title + actions
          </PageHeader>
          <Content>              ← varies by page type
          </Content>
        </PageContent>
      </div>
      <CommandPalette />         ← global overlay, keyboard-activated
    </AdminShell>
  </body>
</html>
```

**Key measurements:** Sidebar: 240px expanded, 56px collapsed. HeaderBar: `var(--lb-density-header-height)` = 64px (compact). Page content max-width: `var(--lb-size-page-max)` = 1440px.

### Archetype 2: Single-Focus Auth Card (identity-platform)

```
<html>
  <body data-letbuyy-theme data-letbuyy-surface="identity">
    <LetbuyyThemeProvider surface="identity">
      <div class="auth-layout">            ← centered flex container
        <div class="auth-card">            ← 380–420px, vertical stack
          <BrandLogo />
          <form>                           ← primary task area
            <Input />
            <Button />
          </form>
          <AuthIcon />                     ← optional contextual icon
        </div>
        <TurnstileWidget />                ← Cloudflare bot prevention
      </div>
    </LetbuyyThemeProvider>
  </body>
</html>
```

**Key measurements:** Card width: 380–420px. Card padding: `--lb-density-card-padding`. No sidebar, no header, no navigation.

### Archetype 3: Marketing Editorial (marketing-site)

```
<html>
  <body data-letbuyy-theme data-letbuyy-surface="storefront" [→ should be "marketing"]>
    <Header>                               ← sticky, logo + primary CTA
    </Header>
    <main>
      <Hero>                              ← GSAP/Framer Motion animated
      </Hero>
      <Features>                          ← feature grid/cards
      </Features>
      <Pricing>                           ← pricing cards
      </Pricing>
      <FAQ>                               ← accordion
      </FAQ>
      <FinalCTA>                          ← conversion section
      </FinalCTA>
    </main>
    <Footer>
    </Footer>
  </body>
</html>
```

### Archetype 4: Theme-Driven Storefront (storefront-runtime)

```
<html>
  <body data-letbuyy-theme data-letbuyy-surface="storefront">
    <!-- Theme controls layout from here -->
    <ThemeHeader>                         ← theme-provided header
    </ThemeHeader>
    <main>
      <!-- Page sections from theme sections/ directory -->
    </main>
    <ThemeFooter>
    </ThemeFooter>
  </body>
</html>
```

### Archetype 5: Operator Dashboard (platform-console, platform-operations-portal)

```
<html>
  <body data-letbuyy-theme="dark" data-letbuyy-surface="operations">
    <AppNavigation>                       ← flat sidebar, 12–17 items
    </AppNavigation>
    <div class="console-content">
      <ConsoleDataTable>                  ← primary UI primitive
      </ConsoleDataTable>
    </div>
  </body>
</html>
```

---

## 5.2 Per-App Layout Analysis

### merchant-control-plane

| Page Type | Layout | Components | Note |
|---|---|---|---|
| List pages (products, orders, customers) | Dashboard archetype | `DataTable`, `PageHeader`, `Badge`, `EmptyState` | Benchmark files: `customers/page.tsx`, `purchase-orders/page.tsx` |
| Settings pages | Dashboard archetype, multi-section scroll | `Card`, `Input`, `Select`, `Button`, `SaveBar` | Settings pages have highest arbitrary-radius concentration |
| Detail/drawer pages | Dashboard archetype + `Drawer` | `Drawer`, `DataTable`, `Badge`, `StatusBadge` | |
| Creation wizards | Dashboard archetype, step form | `Input`, `Select`, `Button`, `SaveBar` | new product page is reference form |
| Theme editor | Full-screen, isolated (no sidebar, no header) | 27 direct `lucide-react` imports, `theme-os-*` CSS | Design system island — 21/100 score |
| Dashboard | Dashboard archetype + chart area | `MetricCard`, `Sparkline`, `DataTable` | DashboardClient.tsx is token adoption benchmark |

### identity-platform

| Page Type | Layout | Components |
|---|---|---|
| Login / Signup | Auth card | `Input`, `Button`, `AuthIcon`, `BrandLogo` |
| OTP verification | Auth card | `.auth-otp-input` (6-cell), `Button` |
| Onboarding step 1 | Auth card + bento grid | `.onboard-bento-grid`, `.onboard-bento-card` |
| Onboarding step 2 | Auth card | `Input` (subdomain), `Button` |
| Multi-store select | Auth card + list | `.select-store-item` |
| OAuth consent | Auth card | `Button` (approve/deny) |

---

## 5.3 Page Pattern Library

**Pattern 1: List + Detail (Reference: `products/page.tsx`, `customers/page.tsx`)**
- Components: `PageHeader` (title + primary action), `DataTable` (searchable, sortable, bulk-action), `Badge`/`StatusBadge` (per-row status), `EmptyState` (with primary action)
- Loading state: `Skeleton` mirroring the table layout
- Empty state: `EmptyState` with primary action teaching the next step

**Pattern 2: Settings Page (Reference: `settings/shipping/page.tsx`)**
- Components: `PageHeader`, `Card` (per-section grouping), `Input`/`Select`/`Textarea`, `Button`, `SaveBar` (sticky bottom, appears on unsaved changes)
- Each section is a `Card` with a title, description, and form content

**Pattern 3: Dashboard (Reference: `DashboardClient.tsx`)**
- Components: `MetricCard` (KPI with sparkline), `DataTable` (recent orders), `Badge`
- Skeleton mirrors the metric card + table layout during loading

**Pattern 4: Auth Flow (Reference: `onboarding/page.tsx`)**
- Single-column, centered, one task per screen. No sidebar. No top navigation.
- Progress indicator is implicit (page sequence), not a visual progress bar

**Pattern 5: Creation Wizard (Reference: `products/new/page.tsx`)**
- Form within the dashboard archetype. `SaveBar` replaces the page-level primary action for sticky save/discard.

**Pattern 6: Full-Screen Tool (Reference: `themes/[themeId]/editor/page.tsx`)**
- No sidebar, no header — full-viewport takeover. Self-contained UI system (currently a design system island; should adopt `--lb-*` tokens for semantic values).

---

## 5.4 Layout Debt Items

**LD-01 (P1):** identity-platform has no defined layout grid. Its `.auth-card` is centered at a fixed 380–420px with no documented breakpoint behaviour for screen sizes below 380px. Mobile-first requires a documented minimum viewport design.

**LD-02 (P1):** The theme editor (`/themes/[themeId]/editor/page.tsx`) is a full-screen takeover without any `--lb-*` layout primitives. It uses custom `theme-os-*` CSS for all layout decisions, making it invisible to the governance ratchet.

**LD-03 (P2):** platform-console and platform-operations-portal share byte-for-byte identical CSS layout definitions. The two apps should share a `@letbuyy/ui` operator-dashboard layout primitive rather than duplicating CSS.

**LD-04 (P2):** No canonical `BottomSheet` component exists in `@letbuyy/ui`. A BottomSheet pattern appears in at least two apps (storefront-runtime customer account, mobile app) without a shared definition.

**LD-05 (P2):** The `SaveBar` component is the correct pattern for form-with-unsaved-changes surfaces, but several settings pages in merchant-control-plane still use page-level button placement instead of `SaveBar`.

**LD-06 (P3):** The marketing site has no formal breakpoint documentation. Its responsive behaviour is implied by the animation libraries (GSAP, Framer Motion) but not codified against `--lb-bp-*` tokens.

**LD-07 (P3):** storefront-runtime's customer account section uses its own sub-navigation pattern (sidebar list on desktop, tab-bar on mobile) that is not part of `@letbuyy/ui`'s navigation primitives.

---

# PART 6: COMPONENT INTELLIGENCE

## 6.1 Component Catalog Overview

`@letbuyy/ui` exports 60+ components across 12 functional groups:

| Group | Components | Notes |
|---|---|---|
| Actions | `Button`, `IconButton`, `ButtonGroup`, `SaveBar` | `Button` is the most-used component across all apps |
| Layout | `Card`, `Box`, `Stack`, `Grid`, `Divider`, `Section`, `PageHeader` | `Card` is the canonical content container |
| Data Display | `DataTable`, `Badge`, `StatusBadge`, `MetricCard`, `Sparkline`, `Timeline`, `Tag` | `DataTable` is the primary merchant-control-plane primitive |
| Controls | `Input`, `Select`, `Textarea`, `Checkbox`, `Radio`, `Switch`, `Combobox`, `DatePicker`, `OTPInput` | `Input` is the second most-used component |
| Feedback | `Toast`, `Banner`, `Skeleton`, `EmptyState`, `ProgressBar` | `EmptyState` is systematically underutilised |
| Overlays | `Modal`, `Drawer`, `Popover`, `Dropdown`, `Tooltip`, `ConfirmDialog`, `CommandPalette` | All must use `OverlayPortal` |
| Navigation / Shell | `AppNavigation`, `Tabs`, `Breadcrumbs`, `DensityToggle`, `ThemeToggleButton` | `AppNavigation` is the canonical sidebar primitive |
| Internal Workspace | `InternalWorkspace`, `InternalPanel`, `InternalMetric` | Scoped to platform-console only |
| Theme | `LetbuyyThemeProvider`, `ThemeScript`, `OverlayPortal`, `DesignSystemRoot`, `TokenStyleBoundary` | Critical for correct dark mode and overlay behaviour |
| Tokens | Token CSS export (`letbuyy-tokens.css`), Tailwind config (`letbuyy-tokens.css` @theme block) | The token layer |
| Formatting | `formatInrCurrency`, `formatDisplayDate`, `formatIndiaDate` | Binding — the only sanctioned INR formatter |
| Icons | Lucide re-exports with density-aware sizing | Must import from `@letbuyy/ui`, never directly from `lucide-react` |

---

## 6.2 Component Duplication Analysis

**D-01: CommandPalette**
DS `CommandPalette` lacks async entity search capability. merchant-control-plane maintains a local duplicate (`_local-ui/CommandPalette.tsx`) that correctly uses `Input(unstyled)`, `Button(unstyled)`, and `MaterialIcon` from `@letbuyy/ui` for its primitives but adds async entity searching. The correct fix is to promote the async entity search capability to the DS `CommandPalette` and retire the local duplicate. Priority: P2.

**D-02: BottomSheet**
No `BottomSheet` component in `@letbuyy/ui`. The pattern exists in storefront-runtime's customer account section and in the mobile merchant app. Promotion candidate. Priority: P2.

**D-03: AccountSwitcher / ContextSwitcher**
The merchant HeaderBar implements a store-switcher pattern (`/select` redirect via multi-store detection) that has no equivalent DS component. Promotion candidate — any future surface needing context switching would need to duplicate this. Priority: P3.

**D-04: StatusBadge**
`StatusBadge` exists in `@letbuyy/ui` as the canonical status-to-badge mapper. It is systematically underutilised — multiple pages in merchant-control-plane map order status strings to badge variants locally instead of using `StatusBadge`. This is not a duplication but an underutilisation that multiplies status-vocabulary maintenance surface.

**D-05: INR Currency Formatter**
`formatInrCurrency` is the only correct INR formatter. The coupons page `formatDiscount()` function maintains a local implementation that uses the deprecated `Rs.` symbol. One confirmed live violation. Zero tolerance — every monetary display must use `formatInrCurrency`.

**D-06: Loading States**
Multiple pages in merchant-control-plane render custom loading spinners instead of `Skeleton` from `@letbuyy/ui`. The `Skeleton` component mirrors the expected layout, reducing perceived load time. Custom spinners provide no layout context.

**D-07: Empty States**
Multiple list pages render blank empty lists instead of `EmptyState` from `@letbuyy/ui`. An `EmptyState` with a primary action is the correct pattern for every list view — it teaches the merchant the next step.

---

## 6.3 Promotion Candidates

**P-01: `BottomSheet`** — consolidate from storefront-runtime and mobile app pattern into `@letbuyy/ui`. Estimated effort: Medium.

**P-02: `AccountSwitcher`** — extract from merchant HeaderBar, generalise for any multi-context switching surface. Estimated effort: Medium.

**P-03: Async `CommandPalette`** — add entity search capability to DS CommandPalette, retire merchant-control-plane local duplicate. Estimated effort: Medium-High.

**P-04: `marketing` surface type** — define `surface="marketing"` in `tokens.ts` `surfaceTokens` map, update marketing-site's `LetbuyyThemeProvider`. Estimated effort: Low (2 hours).

---

## 6.4 Governance Rules

**Rule 1 (binding):** Before proposing any new component, query LCIS: `curl "http://localhost:3333/api/search-v2?q=<component-description>"`. Then check `packages/typescript/ui/src/component-catalog.stories.tsx`. If a component already exists that meets the need (even partially), use it.

**Rule 2 (binding):** Every color reference in TSX or CSS must use a `--lb-color-*` CSS variable or a Tailwind utility class that resolves to one (`bg-surface`, `text-default`, `border-line`). Never hardcode `#hex`, `rgb()`, `hsl()`, or raw pixel values for color, spacing, radius, or shadow.

**Rule 3 (binding):** Never import from `lucide-react` directly — always from `@letbuyy/ui`.

```typescript
// WRONG
import { ArrowRight } from 'lucide-react'

// CORRECT
import { ArrowRight } from '@letbuyy/ui'
```

The `@letbuyy/ui` icon re-exports apply density-aware sizing and the `letbuyy-icon` class. Importing directly bypasses density control.

**Rule 4 (binding):** Never use arbitrary Tailwind values. `p-[14px]` → `p-3`, `rounded-[8px]` → `rounded-md`, `text-[13px]` → `text-secondary`.

**Rule 5 (binding):** Never use raw Tailwind color utilities. `bg-gray-100` → `bg-surface`, `text-gray-900` → `text-default`, `border-gray-200` → `border-line`, `bg-white` → `bg-surface`.

**Component graduation path:** App-local component → design review → graduation checklist → `@letbuyy/ui` PR → codemod for existing usages → deprecation of local copies.

**Component deprecation path:** `warnDeprecated()` console warning → codemod published → deprecation period (minimum 2 sprints) → removal from `index.ts`.

---

## 6.5 Design Pattern Reference (Gold Standard Files)

| Pattern | Gold Standard File |
|---|---|
| Product list page (Table, PageHeader, Badge, EmptyState) | `apps/merchant-control-plane/src/app/[store]/products/page.tsx` |
| Dashboard with MetricCards and charts | `apps/merchant-control-plane/src/app/[store]/dashboard/DashboardClient.tsx` |
| Form page with Input, Select, SaveBar | `apps/merchant-control-plane/src/app/[store]/products/new/page.tsx` |
| INR currency formatting | Any file importing `formatInrCurrency` from `@letbuyy/ui` in merchant-control-plane |
| Auth/onboarding flow with Button and Input | `apps/identity-platform/src/app/onboarding/page.tsx` |
| Token-backed Tailwind usage | `apps/merchant-control-plane/src/app/[store]/dashboard/DashboardClient.tsx` |
| Component deprecation with codemod | `packages/typescript/ui/codemods/badge-danger-to-critical.cjs` |
| Surface type with LetbuyyThemeProvider | `apps/merchant-control-plane/src/app/layout.tsx` |

---

# PART 7: INTERACTION INTELLIGENCE

## 7.1 Navigation Architecture

### merchant-control-plane: Canonical Sidebar

The merchant control plane uses a data-driven sidebar shell via the `AppNavigation` component from `@letbuyy/ui`. The `AdminShell.tsx` composes this shell by passing a `sections` array built from `getMerchantNavigation(siteType)`.

**Sidebar anatomy:** Fixed left panel (220/260/320px variants). Header slot: brand logo and store switcher. Body: scrollable, sections separated by `mt-[var(--lb-space-4)]`. Footer slot: user profile and settings links.

**Active state mechanism:** `isNavItemActive(pathname, href)` — exact match for the root `/`; `pathname.startsWith(href + '/')` for all other routes. Managed automatically inside `AppNavigation` via `usePathname()`. Apps do not manage active state manually.

**Three layout modes in AdminShell:**
1. `full-screen` — no sidebar (theme editor: `/{store}/online-store/themes/{themeId}/editor`)
2. `settings` — `SettingsShell` with floating sidebar navigation
3. `standard` — full `AppNavigation` shell

**Breadcrumbs:** Rendered inside `PageHeader` via the `breadcrumbs` prop. Always two levels. Required on all merchant pages with depth > 1. The root crumb must link to `/{store}/dashboard`. `chevron` separator + `currentTone="emphasis"` is the established standard.

### identity-platform: Minimal Auth Top Bar

No `AppNavigation`. Minimal top bar with CSS class `auth-top-bar` containing language toggle, theme toggle, and a user dropdown (custom popover). Deliberate separate system — auth flows do not carry the full application shell.

### platform-console: AppNavigation via ConsoleWorkspace

Uses `InternalWorkspace` family from `@letbuyy/ui`, zero-logic passthroughs. Navigation via `AppNavigation` with platform-console-specific sections (17-item flat list).

---

## 7.2 Action Architecture

### Primary Action Placement

Standard: **top-right of `PageHeader`** for all primary page-level actions.

```
PageHeader
  ├── eyebrow (domain/category label)
  ├── title
  ├── breadcrumbs (left-aligned)
  ├── primaryAction → Button(primary, top-right)
  └── secondaryActions → Button[](secondary, beside primary)
```

### Destructive Action Protocol (Binding)

All irreversible mutations must go through `ConfirmDialog`. The required pattern:

1. Trigger (trash icon, row action) → sets item-to-delete state
2. `ConfirmDialog` opens
3. Title phrased as a question: "Delete coupon?"
4. Description names the specific item: "Delete SUMMER20? This removes the discount from checkout promotions."
5. `confirmLabel` is action-specific: "Delete coupon" (not "Delete" or "Yes")
6. `cancelLabel` phrased as a positive action: "Keep coupon" (not "Cancel")
7. `destructive={true}` renders confirm button red
8. `onClose` blocked while mutation is in progress

**The cancel label rule is binding**: the cancel label must always affirm keeping the data, never generic "Cancel". This reduces accidental destructive clicks.

### Action Feedback

| State | Mechanism |
|---|---|
| During mutation | `Button loading={true}` — inline spinner, interaction disabled |
| Per-row mutation | `updatingStatusId` state targets a single row |
| On success | `notify({ title: '...', description: '...', variant: 'success' })` — auto-dismisses after 5000ms |
| On transient error | `notify({ variant: 'critical' })` |
| On persistent error | `Banner variant="critical"` with Retry action in `action` slot |

---

## 7.3 Form Architecture

### Standard Form Layout

**Single-column layout** is the default. Forms render inside `Card > Section` with one field per row. Two-column layout (`md:grid-cols-2`) is permitted when the form has clearly paired fields and the primary context is wider screens. Never more than two columns — the platform is mobile-first (~360px).

### Validation Patterns

**Pattern 1: Real-time async validation (debounced)** — for unique-value inputs requiring a server check (subdomain in onboarding). `debounce` at 400ms. Three visual states: `checking` → spinner, `valid` → check icon + success message, `invalid` → cancel icon + error reason. CTA gated on `validation?.valid`.

**Pattern 2: Submit-time validation** — for forms where real-time feedback would be premature (coupon code, coupon value). Check required fields before calling the API. Set `formError` state → render `Banner variant="critical"` above the form.

**Pattern 3: No explicit validation** — for search inputs and filter fields where invalid input produces no results.

### Form Action Placement

**Inline forms:** Primary + Cancel button below form fields. Primary first, Cancel second. Plus `SaveBar` (sticky bottom) as secondary mechanism.

**Modal/Dialog forms:** Footer slot with Cancel (secondary, left) + Save (primary, right). On mobile: buttons stack to full width.

**Auto-save:** Not implemented in the reviewed codebase. All forms use explicit save. If auto-save is introduced in the future, it must replace `SaveBar`, not coexist with it.

---

## 7.4 Data Table Architecture

### Standard List Page Pattern

```
PageHeader (title, eyebrow, breadcrumbs, primaryAction, secondaryActions)
└── Card
    └── Section
        ├── Search Input (leftIcon Search, label "Search {entities}")
        ├── Saved View Tabs (pill buttons: All / Active / Draft / Archived / ...)
        ├── Filter Chips Row (active filters as dismissible Badge chips)
        ├── Table
        │   ├── [loading]: Skeleton variant="table" lines={6}
        │   ├── [empty]: EmptyState with primaryAction and secondaryAction
        │   └── [data]: thead + tbody (desktop) / article cards (mobile)
```

Reference implementations: `products/page.tsx` and `customers/page.tsx`.

### Sort Direction Default

Date and amount columns default to `desc` (newest/largest first). Text columns default to `asc`. Coded in the sort handler.

### Pagination

No pagination used in reviewed list pages — all pages fetch with `limit: 100`. The `Pagination` component exists in `@letbuyy/ui` and must be used if server-side pagination is added.

---

## 7.5 Overlay Architecture

Five overlay types. Type is determined by interaction contract, not visual preference.

| Type | Component | Use When | Do Not Use For |
|---|---|---|---|
| Dialog | `Modal` or `ConfirmDialog` | User must respond before anything else; irreversible actions | Supplementary info, filters, abandonment-safe forms |
| Sheet/Drawer | `Drawer` | Secondary task without replacing current view | Confirmations, simple menus |
| Popover | `Popover` | Contextual content too rich for Tooltip; interactive | Navigation menus, confirmations |
| Menu | `Dropdown` / `DropdownMenu` | Action list from a trigger | Rich content, forms, multi-step interactions |
| Tooltip | `Tooltip` | Short label or hint (under ~8 words) | Interactive content, links |

**All overlay types use `OverlayPortal` with automatic theme mirroring.** No overlay renders dark in a light app when the OS is dark. This is enforced by `OverlayPortal` mirroring `data-letbuyy-theme` onto its body-level container.

---

## 7.6 State Architecture

### Loading States

- **Skeleton** — for initial page load of content-shaped data. `variant="table"` for list pages, `variant="card"` for single-card content, `variant="text"` for paragraph content. Skeleton must match the shape of the content that will appear.
- **Spinner** — for in-action loading where the trigger was a user gesture. `Button loading={true}` is the canonical pattern.
- **Do not use Spinner to replace Skeleton on initial page load.** A page that shows a centered spinner while loading a list is a worse experience than a Skeleton table.

### Empty States (Binding)

`EmptyState` from `@letbuyy/ui` is required for all empty list pages.

| Context | Title | primaryAction | secondaryAction |
|---|---|---|---|
| First-time empty | "Add your first {entity}" | Create action | Alternative entry point |
| Search/filter empty | "No matching {entities}" | Create action | "Clear search" |
| Error empty | "Unable to load {entities}" | "Retry" button | (omit) |

Do not omit the primary action — an empty state with no CTA is a dead end.

### Error States

- **Page-level errors:** `Banner variant="critical"` at the top of the main content area. Always include a Retry action.
- **Field-level errors:** `Input error` prop renders an error message directly below the input.
- **Form-level errors:** `Banner variant="critical"` placed above the form fields.
- **Transient errors:** `Toast variant="critical"` via `useToast().notify()`.

---

## 7.7 Interaction Anti-Patterns (Prohibited)

**AP-01:** Raw `<button>` elements with custom Tailwind color + padding — use `Button` from `@letbuyy/ui`.
**AP-02:** `window.confirm()` or `window.alert()` for confirmations — use `ConfirmDialog`.
**AP-03:** Custom loading spinners as page-load replacements for `Skeleton`.
**AP-04:** Empty list states with no CTA — always use `EmptyState` with a `primaryAction`.
**AP-05:** Toast notifications for persistent errors — use `Banner` with a Retry action.
**AP-06:** Inline delete without confirmation (`ConfirmDialog`) for any irreversible action.
**AP-07:** Multiple primary `Button` elements on one screen — one primary action per page.
**AP-08:** Direct `lucide-react` imports — always import icons from `@letbuyy/ui`.
**AP-09:** Local INR formatters — always use `formatInrCurrency` from `@letbuyy/ui`.
**AP-10:** Cancel labels that say "Cancel" — always affirm keeping data ("Keep coupon", "Discard changes").

---

# PART 8: THEME ARCHITECTURE

## 8.1 The Four-Tier Token System

LetBuyy's design token system has four tiers. Each tier has a defined purpose, owner, and consumption rule.

```
Tier 1: Primitive Tokens     (raw values — private, never consumed by product code)
         ↓
Tier 2: Semantic Tokens      (purpose-mapped aliases — the primary consumption tier)
         ↓
Tier 3: Component Tokens     (component-scoped values — consumed inside @letbuyy/ui components)
         ↓
Tier 4: Density Tokens       (layout-responsive values — change with density preset)
```

### Tier 1: Primitive Tokens

Raw CSS custom properties with specific values. The primitive palette:
- **Ink palette:** `ink.950 = #0a0912`, `ink.900 = #0d0b15`, `ink.850 = #0d0b16`, `ink.800 = #15131f`, `ink.700 = #1b1827`
- **Purple palette:** `purple.500 = #8B5CF6`, `purple.700 = #6D28D9`, `purple.900 = #4C1D95`
- **Gray palette:** gray-50 through gray-900
- **Slate palette:** slate-50 through slate-950

Emitted as `--lb-primitive-color-*` CSS custom properties. **Private — never use in product code.** Product code uses Tier 2 semantic tokens only.

### Tier 2: Semantic Tokens

The primary consumption tier. Maps semantic role to primitive value.

Key semantic tokens:
- `--lb-color-bg`: light `#F6F7F9`, dark `#0a0912` (ink-950)
- `--lb-color-surface`: light `#FFFFFF`, dark `#0d0b16`
- `--lb-color-surface-raised`: light `#FFFFFF`, dark `#1b1827`
- `--lb-color-text`: light `#111827`, dark `#FFFFFF`
- `--lb-color-text-subdued`: light `#6B7280`, dark `#CBD5E1`
- `--lb-color-border`: light `#E5E7EB`, dark `rgba(139,92,246,0.18)`
- `--lb-color-primary`: `#8B5CF6` (both modes)
- `--lb-color-primary-cta`: `#6D28D9` (both modes)
- `--lb-color-critical`: `#EF4444` (both modes)
- `--lb-color-success`: `#22C55E` (both modes)
- `--lb-color-warning`: `#F59E0B` (both modes)

**Critical bug:** `--lb-color-border-subtle` is in `deprecatedTokenAliasVariables` — it is absent from CSS output and resolves to transparent. Any usage produces invisible borders. Affected file: `apps/merchant-control-plane/src/app/[store]/products/collections/page.tsx`. Migrate to `--lb-color-border` or `--lb-color-border-strong`.

### Tier 3: Component Tokens

Component-scoped tokens owned by `@letbuyy/ui` component authors. Consumed inside component implementations only.

Examples:
- `--lb-component-button-primary-bg`: `#6D28D9` (both modes)
- `--lb-component-card-radius`: `16px` (both modes)
- `--lb-component-input-focus-border`: `#8B5CF6` (both modes)
- `--lb-component-banner-danger-bg`: light `#FEE2E2`, dark `#451A1A`

### Tier 4: Density Tokens

26 variables × 3 presets (compact/comfortable/spacious). Default is compact.

Key density tokens:

| Token | compact | comfortable | spacious |
|---|---|---|---|
| `--lb-density-button-height` | `36px` | `40px` | `44px` |
| `--lb-density-input-height` | `36px` | `40px` | `44px` |
| `--lb-density-sidebar-row-height` | `40px` | `44px` | `48px` |
| `--lb-density-header-height` | `64px` | `72px` | `88px` |
| `--lb-density-table-row-height` | `44px` | `48px` | `52px` |
| `--lb-density-card-padding` | `16px` | `20px` | `24px` |
| `--lb-density-modal-padding` | `16px` | `20px` | `24px` |

---

## 8.2 ThemeProvider System

### LetbuyyThemeProvider

The canonical theme controller. One instance per app, in the root layout.

```tsx
<LetbuyyThemeProvider
  defaultTheme="system"          // "light" | "dark" | "system"
  surface="admin"                // "admin" | "marketplace" | "storefront" | "identity" | "operations"
  density="compact"              // "compact" | "comfortable" | "spacious"
  brand={brandVars}              // optional tenant brand override
>
  {children}
</LetbuyyThemeProvider>
```

**Five-step state machine:**
1. Read `LETBUYY_THEME_STORAGE_KEY` from localStorage
2. Apply `data-letbuyy-theme` attribute to `<html>`
3. Apply `data-letbuyy-surface` attribute to `<html>`
4. Apply `data-letbuyy-density` attribute to `<html>`
5. Emit token CSS variables via `letbuyyTokenCss()`

**Surface-specific defaults:**
- `platform-console`: `defaultTheme="dark"` — forced dark
- All other web apps: `defaultTheme="system"` — follows OS preference

### ThemeScript

A blocking inline script that executes before the first paint to prevent FOUC (Flash of Unstyled Content). Must be placed in `<head>`, before any CSS.

```tsx
// In app layout.tsx <head>
<ThemeScript />
```

**Do not hand-roll a flash-prevention script.** `ThemeScript` is the only sanctioned mechanism.

### OverlayPortal

All overlays (`Modal`, `Drawer`, `Popover`, `Dropdown`, `Tooltip`) use `OverlayPortal` to portal to `<body>`. `OverlayPortal` automatically mirrors `data-letbuyy-theme`, `data-letbuyy-surface`, and `data-letbuyy-density` onto its body-level container.

**Why this matters:** Without `OverlayPortal`, a modal rendered at `<body>` level inherits the OS dark mode via `prefers-color-scheme` instead of the app's token-controlled theme. This causes modals to render dark in a light app when the OS is dark. `OverlayPortal` solves this by propagating the app's explicit theme attributes to the portal container.

### DesignSystemRoot

Internal component rendered by `LetbuyyThemeProvider`. Handles CSS injection, attribute propagation, and the theme state machine. Not intended for direct use by product teams.

### TokenStyleBoundary

Prevents duplicate token injection in nested contexts. Used in embedded contexts (e.g., a storefront widget embedded in a non-LetBuyy page). Not needed in standard app layouts.

---

## 8.3 The Five Surface Types

| Surface | `data-letbuyy-surface` | Used By | Default Theme | Default Density |
|---|---|---|---|---|
| `admin` | `"admin"` | merchant-control-plane | `system` | `compact` |
| `marketplace` | `"marketplace"` | app-marketplace (frozen) | `system` | `comfortable` |
| `storefront` | `"storefront"` | storefront-runtime, marketing-site (WRONG) | `system` | `comfortable` |
| `identity` | `"identity"` | identity-platform | `system` | `comfortable` |
| `operations` | `"operations"` | platform-console, platform-operations-portal | `dark` (forced) | `compact` |

**Surface assignment corrections required:**
- marketing-site: `surface="storefront"` → `surface="marketing"` (once defined)
- developer-portal: `surface="marketplace"` → `surface="developer"` (once defined, on unfreeze)

---

## 8.4 Tailwind v4 Bridge

The `config/tailwind/letbuyy-tokens.css` `@theme {}` block maps `--lb-*` tokens to Tailwind utility classes.

Key aliases:

| Tailwind Utility | Resolves To |
|---|---|
| `bg-surface` | `var(--lb-color-surface)` |
| `bg-surface-raised` | `var(--lb-color-surface-raised)` |
| `bg-surface-subdued` | `var(--lb-color-surface-subdued)` |
| `bg-card` | `var(--lb-color-card)` |
| `bg-page` | `var(--lb-color-bg)` |
| `bg-sidebar` | `var(--lb-color-sidebar)` |
| `text-default` | `var(--lb-color-text)` |
| `text-subdued` | `var(--lb-color-text-subdued)` |
| `text-muted` | `var(--lb-color-text-muted)` |
| `text-primary` | `var(--lb-color-primary)` |
| `text-critical` | `var(--lb-color-critical)` |
| `text-success` | `var(--lb-color-success)` |
| `text-warning` | `var(--lb-color-warning)` |
| `border-line` | `var(--lb-color-border)` |
| `border-focus` | `var(--lb-color-focus-ring)` |
| `bg-primary-cta` | `var(--lb-color-primary-cta)` |
| `bg-primary-soft` | `var(--lb-color-primary-soft)` |

**Breakpoint aliases:** `xs:` (360px), `mobile:` (480px), `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px).

**Migration guide from arbitrary to token-backed:**
- `bg-gray-100` → `bg-surface-subdued`
- `text-gray-900` → `text-default`
- `text-gray-500` → `text-subdued`
- `border-gray-200` → `border-line`
- `bg-white` → `bg-surface`
- `bg-gray-50` → `bg-page`

**Critical note:** The `@theme {}` variable names in `config/tailwind/letbuyy-tokens.css` are frozen — an API surface. Renaming any of these variables breaks the platform simultaneously across all apps. New utilities can be added; existing utilities cannot be renamed or removed without a platform-wide migration plan.

---

## 8.5 Dark Mode Architecture

### Dual-Signal System

Two signals control dark mode:
1. **`ThemeScript`** (blocking inline in `<head>`) — reads `LETBUYY_THEME_STORAGE_KEY` from localStorage and applies `data-letbuyy-theme="dark"` before first paint. Prevents FOUC.
2. **`LetbuyyThemeProvider`** — maintains React state for runtime theme toggle, persists to localStorage.

CSS resolves dark values via `[data-letbuyy-theme="dark"]` selectors, not `@media (prefers-color-scheme: dark)`. This allows user override of OS preference.

### Tenant Brand Customisation

The `createLetbuyyBrandVariables` API allows tenant-scoped primary color overrides in storefront-runtime:

```typescript
const brandVars = createLetbuyyBrandVariables({
  primary: merchant.brand_color  // e.g. "#E91E63"
})
// Apply to <LetbuyyThemeProvider brand={brandVars}>
```

Contrast validation is mandatory before applying:
```typescript
const result = validateLetbuyyBrandContrast(color)
if (!result.passes) throw new Error(`Contrast fails: ${result.ratio}:1`)
```

WCAG minimums: 4.5:1 for text, 3:1 for focus ring. This is non-negotiable — it protects shoppers with visual impairments.

**Scope restriction:** `createLetbuyyBrandVariables` is only for storefront-runtime. Must not be applied in merchant-control-plane or identity-platform.

---

## 8.6 Liquid/React Theme Engine

The storefront runtime supports two rendering modes:

- **React rendering (default):** Theme sections are React components. The design system token layer applies. Most stores use this mode.
- **Liquid rendering (canary):** Controlled by `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`. Off by default. Urban Kicks Liquid theme at `/demo/urban-kicks` is the reference implementation with 9 hydration islands.

The Liquid sanitizer is locked (`FORBID` lists, `outputEscape:'escape'`). ART-17 forbids new React-per-section after the Liquid freeze.

**10 experience presets** are defined in `theme-presets.ts` for the preset system. These provide pre-configured combinations of tokens and layout values for common merchant store types.

---

## 8.7 Mobile Token Sync Pipeline

**Generator:** `scripts/generators/generate-mobile-tokens.mjs` reads `tokens.json` (the DTCG interchange file) and generates `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart`.

**Bug:** The generator has an ink-palette dark mapping bug. Dark mode background tokens map to `gray900 = #111827` instead of `ink.950 = #0a0912`. Dark border tokens map to `slate700 = #334155` instead of `rgba(139,92,246,0.18)`.

**Fix:** Update `generate-mobile-tokens.mjs` to correctly resolve ink-tier values. Run `validate:mobile-tokens` to confirm parity.

**Rule:** `letbuyy_tokens.dart` contains a `// GENERATED FILE — DO NOT EDIT` header. It must never be hand-edited. Any PR that hand-edits the Dart file is rejected. Always regenerate via the script.

---

## 8.8 Missing Theme Capabilities (11)

1. No `marketing` surface type (marketing-site uses `storefront` incorrectly)
2. No `developer` surface type (developer-portal uses `marketplace` incorrectly)
3. `--lb-color-border-subtle` Tailwind alias references a deprecated token that no longer emits CSS
4. No canonical icon size vocabulary (14 distinct sizes found in use: 10–34px)
5. No fluid font scaling for body/secondary text (only display/h1/h2 have `clamp()` variants)
6. No `BottomSheet` component
7. No `AccountSwitcher`/`ContextSwitcher` component
8. `CommandPalette` in DS lacks async entity search
9. Flutter dark palette uses gray/slate instead of ink-violet (generator bug)
10. No automated token sync pipeline between web TypeScript source and Flutter Dart
11. No deployed Storybook / design handoff URL

---

# PART 9: DESIGN DEBT

## 9.1 P0 Debt Items (Immediate Action Required)

**P0-001: Rs. locale bug in coupons page**
File: `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx`
Violation: `formatDiscount()` returns `` `Rs. ${coupon.value}` `` — `Rs.` is the deprecated romanised abbreviation.
Fix: Replace with `formatInrCurrency(coupon.value)`.
Effort: 1 hour. This is a live, visible bug in a production feature.

**P0-002: 27 direct lucide-react imports in theme editor**
File: `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`
Violation: `import { Layers, Settings, Eye, Code2, ... } from 'lucide-react'` — bypasses `@letbuyy/ui`'s version-pinned re-exports.
Fix: Replace all `import { ... } from 'lucide-react'` with `import { ... } from '@letbuyy/ui'`.
Effort: 2 hours. Zero visual impact.

---

## 9.2 P1 Debt Items (Fix in Current or Next Sprint)

**P1-001: 6 active ratchet violations in named components**
See Part 6.4 (R-01 through R-06) for file-level details. Half-day to fix all six. These are in components used across every merchant-control-plane page and are the most likely to be copied by other engineers.

**P1-002: identity-platform parallel CSS custom property system**
File: `apps/identity-platform/src/app/globals.css`
Violation: ~2,300-line file defining 10+ `--bg`, `--text-primary`, `--border` properties that duplicate `--lb-*` without referencing them. Three specificity override blocks compound the maintenance surface.
Fix: Wire each local property to its `--lb-*` equivalent. Remove redundant `.dark {}` override block after wiring is verified.
Effort: 4 hours bridging + 1 hour visual verification.

**P1-003: Four divergent dark backgrounds**
Files: `apps/platform-console/src/app/globals.css`, `apps/platform-operations-portal/src/app/globals.css`
Violation: `rgb(10 10 10)` instead of canonical `rgb(10 9 18)`.
Fix: Replace with `var(--lb-color-bg)`.
Effort: 30 minutes.

**P1-004: 127 arbitrary-radius violations in merchant-control-plane**
Violation: `rounded-[Xpx]` and `rounded-[var(--lb-radius-*)]` bracket syntax throughout 100+ TSX files predating the ratchet.
Fix: Run `tailwind-default-color-to-token` codemod. Manual review for complex cases. Execute in 5 batches: settings → list pages → detail/drawer → form pages → checkout/theme-editor (last, highest risk).
Effort: 2 days systematic + half-day for the 6 active components.

**P1-005: No deployed Storybook**
Violation: 7 story files exist but no deployed URL, no `storybook:build` script confirmed, no Figma integration.
Fix: Add `storybook:dev` and `storybook:build` scripts. Deploy to static URL.
Effort: Half-day.

**P1-006: Flutter dark palette mismatch**
File: `scripts/generators/generate-mobile-tokens.mjs`
Violation: Generator maps ink-950 dark background to gray900 (`#111827`) instead of `#0a0912`.
Fix: Update generator source mapping. Run `validate:mobile-tokens`.
Effort: 2 hours + device visual review.

---

## 9.3 P2 Debt Items (Fix in Next Release Cycle)

**P2-001: marketing-site wrong surface assignment**
Fix: Define `marketing` surface type. Update `apps/marketing-site/src/app/layout.tsx`.
Effort: 2 hours.

**P2-002: Ink lavender palette not formally tokenised**
Fix: Promote to `--lb-color-bg-premium` in `tokens.ts`. Update three `globals.css` files to reference the token.
Effort: 2–4 hours.

**P2-003: CommandPalette local duplicate in merchant-control-plane**
Fix: Add async entity search to DS `CommandPalette`. Retire local duplicate.
Effort: Medium (P3 DS change, then migration).

**P2-004: Storefront font aliases resolve to wrong fonts**
File: `apps/storefront-runtime` font alias CSS
Violation: `--font-lora`, `--font-playfair`, etc. all resolve to Geist. Merchant deception.
Fix: Ensure font aliases load the fonts they name.
Effort: 1 day investigation + fix.

**P2-005: `--lb-color-border-subtle` deprecated but Tailwind alias still references it**
Fix: Remove `border-line-subtle` from `letbuyy-tokens.css` @theme block, or update the alias to reference `--lb-color-border`.
Effort: 30 minutes + audit of any `border-line-subtle` usages.

---

## 9.4 P3 Debt Items (Roadmap)

**P3-001: Marketing-site 725 raw `rgb()` calls** — deliberate visual identity, not careless debt. Requires design sign-off before migration (see Section 11.7).

**P3-002: Frozen app remediation** — app-marketplace, theme-marketplace, developer-portal remediation required on unfreeze. Highest effort: theme-marketplace (fully disconnected from `--lb-*` tokens).

**P3-003: Flutter/Dart token sync automation** — replace manual sync with `scripts/sync-tokens-dart.mjs`.

**P3-004: No `BottomSheet` component** — pattern exists in two apps, not consolidated.

**P3-005: No `AccountSwitcher` / `ContextSwitcher` component** — implemented in merchant HeaderBar, not promoted.

---

## 9.5 Consistency Scorecard

Quantified scores (0–10) across 5 dimensions, representing design debt concentration.

**Lowest-scoring files:**
1. `themes/[themeId]/editor/page.tsx` — 21/100 (P0-002 target)
2. `coupons/page.tsx` — 31/100 (P0-001 target)
3. `identity-platform/src/app/globals.css` — effectively 0% token adoption at the CSS layer

**Highest-scoring benchmark files:**
1. `customers/page.tsx` — highest merchant-control-plane page score
2. `purchase-orders/page.tsx` — second highest; reference implementation for list pages
3. `dashboard/DashboardClient.tsx` — reference for token-backed Tailwind usage

**Ratchet baseline (as of 2026-06-12):**

| Category | Baseline Count |
|---|---|
| appCssRawHex | 0 |
| appCssNakedRgbHsl | 572 |
| tailwindPaletteClasses | 588 |
| appLocalLbTokenRedefs | 112 |
| rawPxFontSize | 533 |
| rawPxSpacing | 1365 |
| tsxInlineStyles | 635 (cap) |
| tsxRawHex | 0 |
| tsxArbitraryRadius | 327 |
| tsxArbitraryShadow | 8 |
| localWorkspaceImplementations | 0 |

Baselines may only decrease. Increasing a baseline count is constitutionally prohibited.

---

## 9.6 Debt Trend Rules

**Rule 1:** The ratchet baseline may only decrease. No exceptions, no exceptions process.
**Rule 2:** Any PR that introduces a new ratchet violation — even a single instance — must fix that violation in the same PR before merging.
**Rule 3:** Running a codemod on an app reduces its violation count. This counts as migration progress toward the Phase targets.
**Rule 4:** P0 debt items block merging any feature PR that touches the same file. Fix before feature.
**Rule 5:** P1 debt items must have a tracked GitHub Issue. They are not blocked from merging alongside feature PRs but must have an assigned owner and a target sprint.

Debt trend cross-references (see Part 12 for decision status):
- P0-001 (Rs. locale bug) → Decision A-07 (formatInrCurrency binding), P-01 (hardcoded hex/locale violation)
- P0-002 (lucide-react) → Decision P-03 (direct lucide import prohibited), Rule 3 (never import from lucide-react directly)
- P1-003 (dark backgrounds) → Decision GS-01 (--lb-* prefix standard), Finding 6
- P1-004 (arbitrary radius) → Decision P-04 (arbitrary Tailwind values prohibited), M-01 (must migrate)

---

# PART 10: DESIGN GOVERNANCE

## 10.1 The LetBuyy Design Constitution (Condensed)

The full Design Constitution is at `docs/design-intelligence/governance/LETBUYY_DESIGN_CONSTITUTION.md`. The binding rules condensed:

**Article I: Foundation Law**
The `--lb-*` CSS custom property namespace is the sole authoritative source for all design values in all LetBuyy surfaces. No product, surface, or individual may introduce parallel token systems, shadow token names, or raw primitive values in product code without ARB approval.

**Article II: The Four-Layer Architecture**
- Layer 0 (Global Foundation): Change requires ARB review. Affects all surfaces simultaneously.
- Layer 1 (Shared Interaction Library): Breaking changes require ARB. New components require Design System team review.
- Layer 2 (Product Design Systems): Standard code review. Must reference `--lb-*` tokens.
- Layer 3 (Tenant Customisation): Constrained by WCAG contrast validation. Scoped to storefront-runtime only.

**Article III: The Ratchet**
The ratchet baseline is constitutional law. Baselines may only decrease. A PR that increases any ratchet count fails CI and cannot merge. There is no exception process for increasing ratchet counts.

**Article IV: Formatting**
`formatInrCurrency` from `@letbuyy/ui` is the sole INR formatter. All monetary display in all LetBuyy surfaces uses this function. All dates use `en-IN` locale.

---

## 10.2 Token Governance

### Token Ownership Matrix

| Token Prefix | Owner | Change Process |
|---|---|---|
| `--lb-primitive-color-*` | Design System team | ARB review required; affects all surfaces |
| `--lb-color-*` | Design System team | ARB review required; affects all surfaces |
| `--lb-component-*` | @letbuyy/ui component author | Component PR + design review |
| `--lb-density-*` | Design System team | ARB review required; affects all density presets |
| `--lb-font-*` | Design System team | ARB review; affects typography platform-wide |
| `--lb-space-*` | Design System team | ARB review; affects spacing platform-wide |
| `--lb-radius-*` | Design System team | ARB review; affects radius platform-wide |
| `--lb-shadow-*` | Design System team | ARB review |
| `--lb-z-*` | Design System team | ARB review |
| `--lb-motion-*` | Design System team | ARB review |
| `--lb-bp-*` | Design System team | ARB review |
| `--mcp-*` | Merchant UX team | Standard PR; product-scoped |
| `--ops-*` | Platform Operations team | Standard PR; product-scoped |

### Adding New Tokens (8 Steps)

1. Verify the value does not already exist as a `--lb-*` token (check `TOKEN_INVENTORY.md`)
2. Determine the correct tier (Primitive/Semantic/Component/Density)
3. Choose a name following the `--lb-{category}-{subcategory}-{role}-{modifier}` convention
4. Add to `packages/typescript/ui/src/tokens.ts` in the appropriate section
5. Add to `tokens.json` (DTCG interchange file) for parity
6. Run `node scripts/validate-governance.mjs` to confirm gate is green
7. If a density token: add values for all three presets
8. If a color token: add both light and dark values
9. Submit PR with ARB label if Layer 0; standard PR if Layer 2+

### Deprecating Tokens (7 Steps)

1. Add token name to `deprecatedTokenAliasVariables` list in `tokens.ts`
2. Create codemod in `packages/typescript/ui/codemods/` for mechanical migration
3. Run codemod across all apps and commit the result
4. Add `warnDeprecated()` call to any remaining usages not caught by the codemod
5. Remove from `letbuyyTokenCss()` output (token now absent from CSS)
6. Update `tokens.json` (DTCG file) to remove the deprecated entry
7. Remove from `deprecatedTokenAliasVariables` list in next major release

### The Forbidden Token Patterns

- `--bg`, `--text-primary`, `--border` — local shadow names without `--lb-` prefix
- `--mcp-*` or `--ops-*` tokens in `packages/typescript/ui/src/` — product prefixes in shared library
- Raw hex values in any `--lb-*` semantic tier definition — must reference a primitive token
- Duplicate token aliases — if `--lb-color-background` and `--lb-color-bg` exist, one must be deprecated
- Resurrecting deprecated token aliases — removing from `deprecatedTokenAliasVariables` requires ARB

---

## 10.3 Component Governance

### Ownership Registry

| Component | Owner | Layer |
|---|---|---|
| All `@letbuyy/ui` components | Design System team | Layer 1 |
| `AppNavigation` config/sections | Per-product team | Layer 2 |
| `CommandPalette.tsx` (merchant local) | Merchant UX team | Layer 2 (promotion candidate P-03) |
| `AdminShell.tsx` | Merchant UX team | Layer 2 |
| `ConsoleWorkspace` family | Platform Engineering | Layer 2 |
| All frozen marketplace components | Design System team (on unfreeze) | Layer 2 |

### Component Graduation Checklist

Before a Layer 2 component can be promoted to Layer 1 (`@letbuyy/ui`):
- [ ] Used in two or more runtimes OR fills a documented DS gap
- [ ] Uses only `--lb-*` CSS custom properties (zero raw Tailwind or inline px)
- [ ] Imports nothing from its current app (no app-specific hooks, types, or API calls)
- [ ] Props API is generalized and documented
- [ ] `governance.stories.tsx` entry with Do/Don't examples
- [ ] `validate:design-system` gate is green with the new component
- [ ] ARB sign-off (lightweight — comment in PR is sufficient)

### Deprecation Path

1. `/** @deprecated */` JSDoc tag → IDE strikethrough warnings
2. Codemod published and run across all runtimes
3. One release cycle deprecation period (minimum 2 sprints)
4. Remove from `index.ts`

---

## 10.4 Design Review Process

### When Review IS Required (ARB)

- Any change to `packages/typescript/ui/src/tokens.ts` (Layer 0 change)
- Any new exported component added to `packages/typescript/ui/src/index.ts`
- Any change to the ThemeProvider API (`LetbuyyThemeProvider` props)
- Any change to the Tailwind bridge variable names (`config/tailwind/letbuyy-tokens.css`)
- Any change to the DTCG `tokens.json` structure
- Any change that modifies the ratchet baseline `scripts/validators/design-system-baseline.json`
- Any new surface type addition

### When Review is NOT Required

- Reducing a ratchet count (migration work — auto-approved)
- Running any of the seven existing codemods
- Updating token documentation in `docs/design-system/`
- Storybook additions for existing components
- App-level Layer 2 CSS changes that reference `--lb-*` tokens (standard code review)

### Auto-Approval (no formal design review, standard code review only)

- All items in "When Review is NOT Required"
- Updating `docs/design-intelligence/`
- Adding new `@letbuyy/ui` icon re-exports to `icons.tsx`

---

## 10.5 AI Agent Governance (Binding Rules)

### The Eight Binding Rules for AI Agents

**Rule 1: Always check the component catalog before proposing a new component.**
Query LCIS: `curl "http://localhost:3333/api/search-v2?q=<component-description>"`. Then check `packages/typescript/ui/src/component-catalog.stories.tsx`. If a component already exists that meets the need (even partially), use it.

**Rule 2: Always use `--lb-*` tokens for color, spacing, radius, and shadow.**
Every color reference must use a `--lb-color-*` CSS variable or a Tailwind utility that resolves to one (`bg-surface`, `text-default`, `border-line`). Every border-radius must use `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, or `rounded-full` — never `rounded-[Xpx]`.

**Rule 3: Never import from `lucide-react` directly — always from `@letbuyy/ui`.**
```typescript
// WRONG
import { ArrowRight } from 'lucide-react'
// CORRECT
import { ArrowRight } from '@letbuyy/ui'
```

**Rule 4: Never use arbitrary Tailwind values.**
`p-[14px]` → `p-3`, `mt-[20px]` → `mt-5`, `rounded-[8px]` → `rounded-md`, `text-[13px]` → `text-secondary`.

**Rule 5: Never use raw Tailwind color utilities.**
`bg-gray-100` → `bg-surface`, `text-gray-900` → `text-default`, `border-gray-200` → `border-line`, `bg-white` → `bg-surface`.

**Rule 6: Always use `formatInrCurrency` for Indian Rupee formatting.**
```typescript
// WRONG
`₹${amount}`
amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
// CORRECT
import { formatInrCurrency } from '@letbuyy/ui'
formatInrCurrency(amount)
```

**Rule 7: Run `node scripts/validate-governance.mjs` after design system changes.**
After any change touching `packages/typescript/ui/src/tokens.ts`, `config/tailwind/letbuyy-tokens.css`, any app's `globals.css`, or any TSX file in an active app, run the governance validator.

**Rule 8: Consult LCIS before scanning the repository.**
```
curl "http://localhost:3333/api/search-v2?q=<your-question>"
curl "http://localhost:3333/api/blast?q=<symbol>"
curl "http://localhost:3333/api/domain?key=<domain>"
```
Repository scanning is the final fallback when LCIS cannot answer.

---

# PART 11: MIGRATION STRATEGY

## 11.1 Migration Philosophy

### Three Inviolable Rules

**Rule 1: Ship working code.** Every migration change must ship code that builds, passes the ESLint gate, and renders correctly in both light and dark mode at 360px and 1280px. A PR that fixes a token violation but breaks a page layout is not a step forward.

**Rule 2: Never break user flows.** Payment, checkout, and auth flows are the last to touch in every migration wave — not because they are unimportant, but because they are the most important. Prove the migration pattern on lower-risk surfaces first.

**Rule 3: Always have a rollback plan.** Every migration PR is independently revertable. No PR should be structured so that reverting it breaks a subsequent PR.

### Migration Is Ongoing, Not a Project

The migration has no end date. Phases 1 through 4 establish the foundation, CI enforcement, and product surface definitions. After that, maintaining compliance is a continuous engineering practice.

---

## 11.2 Quick Wins (Under 1 Week, Near-Zero Risk)

All 11 quick wins are independently executable as separate PRs, can run in parallel by different engineers.

**QW-001: `tailwind-default-color-to-token` codemod on merchant-control-plane**
```
node packages/typescript/ui/codemods/cli.mjs tailwind-default-color-to-token apps/merchant-control-plane/src --dry
# Review diff, then apply
```
Risk: Very Low. Target: `tailwindPaletteClasses` count reduced by 60%+. Time: 4 hours.

**QW-002: Replace arbitrary border-radius in settings pages**
Target files: `settings/checkout`, `settings/payments`, `settings/policies`, `settings/shipping`, `settings/taxes`, `settings/notifications`. Map: `rounded-[4px]` → `rounded-sm`, `rounded-[8px]` → `rounded-md`, `rounded-[12px]` → `rounded-lg`, `rounded-[16px]` → `rounded-xl`. Time: 2 hours.

**QW-003: Replace arbitrary border-radius in content pages**
Target files: `contact/page.tsx`, `comments/page.tsx`, `posts/page.tsx`, `gallery/page.tsx`, `testimonials/page.tsx`. Same radius substitution. Time: 1.5 hours.

**QW-004: Wire identity-platform CSS variables to `--lb-*` equivalents**
File: `apps/identity-platform/src/app/globals.css`. Map `--bg: var(--lb-color-bg)`, `--text-primary: var(--lb-color-text)`, `--border: var(--lb-color-border)`, etc. Time: 3 hours.

**QW-005: Remove redundant `.dark {}` override block in identity-platform**
Dependent on QW-004 being merged and verified first. The `.dark {}` block is redundant once `--lb-*` tokens resolve correctly. Time: 30 minutes.

**QW-006: Run `badge-danger-to-critical` codemod across all apps**
```
node packages/typescript/ui/codemods/cli.mjs badge-danger-to-critical apps/ --dry
```
Risk: Zero. Time: 1 hour.

**QW-007: Run `page-aliases-to-canonical` codemod across all apps**
Risk: Zero. Time: 1 hour.

**QW-008: Resolve inline `style={{}}` usages in merchant-control-plane**
Static values → Tailwind arbitrary with `var(--lb-*)`. Dynamic values → leave and comment. Time: 3 hours.

**QW-009: Promote `no-tailwind-default-color` to `error` in merchant-control-plane**
Change `"warn"` to `"error"` in `apps/merchant-control-plane/eslint.config.mjs`. Execute after QW-001. Time: 30 minutes.

**QW-010: Add `@letbuyy/ui` Skeleton/EmptyState to pages using raw loading/empty patterns**
Replace custom loading spinners with `Skeleton`, blank empty states with `EmptyState`. Time: 2–4 hours per page.

**QW-011: Wire marketing-site surface type**
Confirm `LetbuyyThemeProvider surface="marketplace"` or appropriate value is configured. Time: 30 minutes.

---

## 11.3 30-Day Plan: Foundation Repair

**Objective:** Reduce the three worst ratchet counts, eliminate the identity-platform parallel CSS system, establish zero new violations as the standard for incoming PRs.

**Week 1 targets:** Run QW-006, QW-007 (mechanical transforms, merge same day). Run QW-001 (tailwind-default-color-to-token). Establish ratchet baseline in `scripts/validators/design-ratchet-baseline.json`.

**Week 2 targets:** Execute QW-002 and QW-003 (radius repair). Execute QW-004 (identity-platform CSS bridge). `tsxArbitraryRadius` below 95 (from 327 baseline). Identity-platform globals.css zero raw `rgb()` values for semantically-named custom properties.

**Week 3 targets:** Execute QW-008 (inline style resolution). Execute QW-009 (promote ESLint rule to error). Execute QW-010 for three lowest-risk pages.

**Week 4 targets:** Verify all ratchet counts. Document per-surface extension namespaces. Open `design:exceptions-register` GitHub Issue.

**30-day success criteria:**
- [ ] `tsxArbitraryRadius` in merchant-control-plane: below 95 (from 327)
- [ ] `tailwindPaletteClasses` in merchant-control-plane: reduced by 60%+
- [ ] Identity-platform globals.css: zero raw `rgb()` values for semantically-named properties
- [ ] Zero console deprecation warnings from `@letbuyy/ui` in any app
- [ ] Ratchet baseline documented in `design-ratchet-baseline.json`

---

## 11.4 60-Day Plan: Token Adoption Acceleration

**Objective:** Drive merchant-control-plane token adoption from 39% to 50%+. Complete identity-platform CSS architecture consolidation. Target `tsxArbitraryRadius` below 50.

**Weeks 5–6:** merchant-control-plane complex pages and form control replacement. Products list page (`products/page.tsx`) and new product page (`products/new/page.tsx`) arbitrary radius elimination. Begin replacing raw `<select>` and `<textarea>` elements with `Select` and `Textarea` from `@letbuyy/ui` in settings pages.

**Weeks 7–8:** Identity-platform remaining local custom property consolidation. Map `--accent-cyan`, `--text-tertiary`, `--text-hint`, `--primary-light` to `--lb-*` primitives. Wire marketing-site typography to `--lb-font-family-*` tokens.

**60-day success criteria:**
- [ ] `tsxArbitraryRadius` in merchant-control-plane: below 50
- [ ] No-raw-form-controls warnings in settings files: 0
- [ ] Identity-platform globals.css: zero unexplained raw `rgb()` values
- [ ] Merchant-control-plane component adoption: from 39% to 50%+

---

## 11.5 90-Day Plan: Governance Infrastructure

**Objective:** Make governance automatic. Add design validator as required CI check. Formalize component graduation.

**Weeks 9–10:** Promote `no-raw-color-functions` to `error` in merchant-control-plane and identity-platform. Promote `no-tailwind-default-color` to `error` in identity-platform and storefront-runtime.

**Weeks 11–12:** Add design validator as non-blocking reporting check in CI. Add `COMPONENT_GRADUATION.md` to `packages/typescript/ui/`. After 2 weeks of clean reports, promote to blocking required check.

**90-day success criteria:**
- [ ] Design validator runs on every PR with a comment (non-blocking reporting)
- [ ] `no-raw-color-functions` at `error` in merchant-control-plane and identity-platform
- [ ] Component graduation checklist documented
- [ ] Zero new design violations merged in the last 2 weeks of the phase

---

## 11.6 6-Month Plan: Product Design System Maturity

**Month 4:** Complete merchant-control-plane arbitrary-radius elimination — all 127 instances across the full 100-file TSX tree, in 5 batches by section. Complete raw form control replacement in merchant-control-plane. Raise component adoption to 70%+.

**Month 5:** Formalize identity surface variant as `[data-letbuyy-surface="identity"]` override in `tokens.ts`. Define marketing site visual system scope via design sign-off session. Write `apps/marketing-site/DESIGN_SCOPE.md`.

**Month 6:** Complete platform-wide component adoption above 75%. Enforce CI blocking for all apps. Publish the LetBuyy Design Governance Handbook.

**6-Month success criteria:**
- [ ] merchant-control-plane `tsxArbitraryRadius` count: 0
- [ ] merchant-control-plane component adoption: 70%+
- [ ] Identity-platform surface variant: formalized in token layer
- [ ] Platform-wide UI file component adoption: 75%+
- [ ] Design Governance Handbook: published

---

## 11.7 What NEVER to Rewrite in a Big-Bang Approach

1. **`@letbuyy/ui` `index.ts` public API surface** — every active app imports from it; reorganisation is a breaking change for all consumers simultaneously.
2. **Checkout and payment flows in merchant-control-plane** — real merchant money; visual regression is a trust failure and potential revenue loss.
3. **marketing-site visual identity (725 raw `rgb()` calls)** — deliberate brand expression, not careless debt; requires design sign-off.
4. **`letbuyy-tokens.css` `@theme` block variable names** — frozen API surface; renaming breaks the entire platform simultaneously.
5. **`deprecatedTokenAliasVariables` list in `tokens.ts`** — must not resurrect deprecated aliases.
6. **`validate-design-system.mjs` ratchet baseline values** — resetting upward is constitutionally prohibited.
7. **Flutter/Dart token values via hand-editing** — `letbuyy_tokens.dart` must always be generated, never hand-edited.

---

## 11.8 Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Visual regression in payment/auth flow during migration sweep | Low | Critical | Payment and auth flows are always last in every migration wave; isolated PRs with dedicated review checklists |
| Ratchet count increases from parallel feature branch merging | Medium | High | Each cleanup PR must rebase on latest main before merging; feature PRs that introduce violations must fix them before merging |
| Codemod produces unexpected output on unusual file patterns | Low-Medium | Medium | Always run with `--dry` first; review diff in browser; never run on more than 20 files per PR without reviewing 10% sample |
| Marketing-site visual identity migration reduces conversion | Medium | High | Only structural tokens (not visual identity) until Month 5 design boundary document is produced and approved |
| Design validator flakiness blocks unrelated PRs | Low-Medium | Medium | Run in non-blocking reporting mode for 2 full weeks before promoting to required |

---

# PART 12: AUTHORITATIVE DECISIONS

## 12.1 ACCEPTED

Patterns that are correct and must be continued.

**A-01:** The `--lb-*` CSS variable naming prefix for all Layer 0 tokens. Unambiguous, collision-resistant, consistent across 330+ custom properties. Must continue for all new tokens.

**A-02:** The four-tier token hierarchy (Primitive → Semantic → Component → Density). Sound architecture. Must not be flattened.

**A-03:** The Tailwind v4 semantic utility alias layer in `config/tailwind/letbuyy-tokens.css`. The aliases make the token system ergonomic for TSX authoring without losing semantic correctness.

**A-04:** Single `LetbuyyThemeProvider` per app. One provider, one theme context, one flash-prevention script.

**A-05:** The `data-letbuyy-theme` / `data-letbuyy-surface` / `data-letbuyy-density` attribute system. Correct mechanism for cascading theme, surface, and density through the DOM.

**A-06:** The `OverlayPortal` pattern for all overlays. All overlays portal to `<body>` via `OverlayPortal`, which mirrors design system context attributes. No app should build its own overlay mechanism.

**A-07:** `formatInrCurrency` from `@letbuyy/ui` as the sole INR formatter. All monetary display in every LetBuyy surface uses this function.

**A-08:** `en-IN` locale for all date formatting. `toLocaleDateString('en-IN')` or `formatDisplayDate`/`formatIndiaDate` functions.

**A-09:** The density system (compact / comfortable / spacious) with `compact` as the platform default. Correct for an information-dense merchant tool.

**A-10:** The codemod infrastructure in `packages/typescript/ui/codemods/`. Every breaking change to a shared token or component must have a codemod before deprecation is announced.

**A-11:** `warnDeprecated()` for non-production console warnings. Consuming apps must not silence these warnings.

**A-12:** WCAG contrast validation for tenant brand overrides via `validateLetbuyyBrandContrast()`. Non-negotiable. Protects shoppers with visual impairments.

**A-13:** Mobile-first breakpoints starting at `xs: 360px`. Canonical smallest breakpoint for India-first Android device targeting.

**A-14:** The ratchet enforcement model. The "may only decrease" rule prevents the common failure mode of cleaning up violations in one place while introducing them in another.

**A-15:** DTCG `tokens.json` parity checking in CI. The interchange file and the Dart `letbuyy_tokens.dart` must always be in sync with the TypeScript source.

---

## 12.2 PROHIBITED

Patterns that are forbidden.

**P-01:** Hardcoded hex colors in TSX or app CSS.
Enforcement: ESLint `no-hardcoded-hex` (error, CI blocking) for TSX. `appCssNakedRgbHsl` ratchet for CSS. No exceptions without ARB-approved tracking issue.

**P-02:** Raw `<button>`, `<input>`, `<table>`, `<select>`, `<textarea>`, `<dialog>` in product JSX.
Enforcement: ESLint `no-raw-elements` (error, CI blocking) for buttons/inputs/tables.

**P-03:** Importing from `lucide-react` directly in product code.
Enforcement: `validate-governance.mjs` scans for `from 'lucide-react'`. All icon imports must be from `@letbuyy/ui`.

**P-04:** Arbitrary Tailwind values for spacing, radius, or font size.
Enforcement: `tsxArbitraryRadius`, `rawPxSpacing`, `rawPxFontSize` ratchet counters.

**P-05:** Tailwind default palette utility classes.
Enforcement: `tailwindPaletteClasses` ratchet counter. Use semantic utility aliases from `letbuyy-tokens.css`.

**P-06:** A second `ThemeProvider` or theme context in any app.
Enforcement: Code review. Exactly one `LetbuyyThemeProvider` per app.

**P-07:** Hand-rolled flash-prevention scripts.
Enforcement: Code review. Flash prevention is `<ThemeScript>` in `<head>` only.

**P-08:** Referencing deprecated token aliases.
Enforcement: Deprecated variables are absent from CSS output. Visual breakage is the hard enforcement.

**P-09:** Forking a Layer 1 component by copying and modifying its source.
Enforcement: Code review. Source forking doubles the maintenance burden and breaks the behavioral contract.

**P-10:** Using `theme="auto"` prop on `LetbuyyThemeProvider`.
Enforcement: `validate:design-system` gate. The prop does not exist in the current API.

**P-11:** Using legacy localStorage theme keys (`letbuyy_theme`, `theme`, `theme-marketplace-theme`).
Enforcement: `validate:design-system` gate. Correct key is `LETBUYY_THEME_STORAGE_KEY`.

**P-12:** Increasing any ratchet count.
Enforcement: The ratchet gate. Constitutional. No exceptions.

**P-13:** Product-scoped token prefixes (`--mcp-*`, `--ops-*`) in `packages/typescript/ui/src/`.
Enforcement: Planned `no-product-prefix-in-shared` ESLint rule. Currently enforced in code review.

**P-14:** Modifying `letbuyy_tokens.dart` directly (bypassing the generator).
Enforcement: `// GENERATED FILE — DO NOT EDIT` header. Code review. Run `node scripts/generators/generate-mobile-tokens.mjs`.

**P-15:** Resurrecting deprecated token aliases by re-adding them to CSS output.
Enforcement: `deprecatedTokenAliasVariables` list in `tokens.ts` requires ARB review to modify.

---

## 12.3 ENCOURAGED

Patterns that are correct and should spread platform-wide.

**E-01:** `DesignSystemRoot` inspection for theming in new layouts. Verify surface type, density default, and `defaultTheme` match the surface.

**E-02:** `StatusBadge` as the canonical status-to-badge mapper. Removes local status-to-variant mapping logic.

**E-03:** The `SaveBar` component for unsaved-changes surfaces. Canonical merchant UX pattern for the admin surface.

**E-04:** `EmptyState` with a primary action for every list view. A blank empty list is a merchant experience failure.

**E-05:** `Skeleton` mirroring the layout for loading states. Never a centered spinner for a full-page load.

**E-06:** `ConfirmDialog` for all destructive actions. Never make destructive actions one-click.

**E-07:** One primary action per screen in merchant-control-plane. Multiple primary buttons dilute merchant decision clarity.

**E-08:** Token-backed Tailwind utility aliases for all structural properties. `bg-surface`, `text-default`, `border-line` as the first-choice utilities.

**E-09:** `AppNavigation` for all admin-shell navigation. New navigation items added to the data-driven navigation config, not as new sidebar items in `_local-ui/`.

**E-10:** Product-scoped token prefixes for product-specific extensions. `--mcp-*` for merchant-control-plane, `--ops-*` for operations.

**E-11:** Querying LCIS before any repository grep. One API call costs less than a full repository scan.

**E-12:** Batch-by-section approach for large migration waves. Each batch is one PR covering 5–8 files in a single logical section.

---

## 12.4 MUST MIGRATE

Patterns present in the codebase requiring incremental correction.

**M-01: 127 arbitrary border-radius instances in merchant-control-plane. Priority: P1. Effort: High.**
5 batches: settings → list pages → detail/drawer → form pages → checkout/theme-editor. Target: `tsxArbitraryRadius` to 0 by end of Month 4.

**M-02: Identity-platform parallel CSS custom property system. Priority: P1. Effort: Medium.**
Wire local variables to `--lb-*` equivalents. Remove redundant `.dark {}` override block. Target: complete by end of Month 2.

**M-03: 38 files in merchant-control-plane using Tailwind default palette classes. Priority: P1. Effort: Low (codemod).**
Run `tailwind-default-color-to-token` codemod. Target: `tailwindPaletteClasses` to 0 by end of Month 2.

**M-04: 7 files in merchant-control-plane with inline `style={{}}` props. Priority: P2. Effort: Low.**
Static values → Tailwind utilities. Dynamic values → leave and document. Target: static `tsxInlineStyles` to 0 by end of Month 1.

**M-05: Raw `<select>` and `<textarea>` elements in merchant-control-plane form pages. Priority: P2. Effort: Medium.**
Replace with `Select` and `Textarea` from `@letbuyy/ui`. Start with settings pages. Save checkout flow for last. Target: `no-raw-form-controls` warnings to 0 by end of Month 4.

**M-06: Marketing-site structural properties not yet using token layer. Priority: P2. Effort: Low.**
Wire `--lb-font-family-*`, `--lb-space-*`, `--lb-bp-*`. Do not touch visual identity properties without design sign-off. Target: structural tokens wired by end of Month 2.

**M-07: Marketing-site visual identity (725 raw rgb() calls in globals.css). Priority: P3. Effort: High.**
Subject to design sign-off on scope (Month 5). Only properties approved in `apps/marketing-site/DESIGN_SCOPE.md` are in scope.

**M-08: Merchant-control-plane navigation from legacy sidebar patterns to `AppNavigation`. Priority: P2. Effort: Medium.**
Target: complete by end of Month 4.

**M-09: Deprecated token aliases (11 total). Priority: P1. Effort: Low (codemod).**
Run `token-alias-rename` codemod across all apps. Target: complete by end of Month 1.

**M-10: Dart/Flutter dark palette parity gap. Priority: P3. Effort: Low-Medium.**
Align Dart token generator to use ink palette values. Addressed in a future version of the mobile generator.

---

## 12.5 APP-SPECIFIC

Patterns that differ by app and that is correct. Do not standardize these.

**AS-01: Default theme per app.**
`platform-console`: `defaultTheme="dark"` — correct. All other web apps: `defaultTheme="system"` — correct. This difference is intentional.

**AS-02: Density default per surface.**
merchant-control-plane (`admin` surface): `compact` — correct. Marketing site: density system does not apply — correct. Operations surfaces: `compact` — correct.

**AS-03: Marketing site visual identity.**
Custom colors, gradients, Framer Motion, Lenis smooth scroll, and fluid display typography are intentional brand expression. These are not violations.

**AS-04: Storefront runtime's React/Liquid hybrid architecture.**
Liquid canary OFF by default (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`). React-rendered routes inherit `--lb-*` Layer 0 tokens; Liquid-rendered routes are governed by the theme engine. Intentional and correct.

**AS-05: The identity platform's lavender/violet ink palette.**
The auth and onboarding pages use a deliberately different visual identity from the merchant admin's neutral-purple palette. Not a violation. Will be formalized as a `[data-letbuyy-surface="identity"]` override in Month 5.

**AS-06: Internal workspace components for platform-console.**
`InternalWorkspace`, `InternalPanel`, `InternalMetric` are specific to platform-console's internal dashboards. Must not be generalized. Correctly scoped.

**AS-07: Marketing-site Lucide icon imports (icons only, no component imports).**
Marketing site imports only icon re-exports from `@letbuyy/ui` (e.g., `ArrowRight`, `Zap`) — correct. Must not import merchant-admin components (`Card`, `Table`, `PageHeader`) — they carry the admin visual language and density system.

**AS-08: Storefront runtime's `createLetbuyyBrandVariables` brand override pattern.**
Only for storefront-runtime. Must not be applied in merchant-control-plane or identity-platform.

---

## 12.6 GLOBALLY STANDARDIZED

Patterns that must be identical across every app, with no exceptions.

**GS-01:** The `--lb-*` token prefix for all Layer 0 CSS custom properties. Platform-wide, no surface-specific Layer 0 token prefixes.

**GS-02:** Semantic color token consumption (never primitive tokens in product code).

**GS-03:** `formatInrCurrency` for all monetary display. There is no surface-specific money formatter.

**GS-04:** `en-IN` locale for all date display. There is no surface-specific date locale.

**GS-05:** DTCG `tokens.json` parity with `tokens.ts`. `validate:design-tokens` enforces this on every PR.

**GS-06:** Dart `letbuyy_tokens.dart` generated from `tokens.json`, never hand-edited.

**GS-07:** The ratchet baseline may only decrease. Applies to every app, every surface, every team. Constitutional.

**GS-08:** The WCAG contrast minimum for tenant brand colors. `validateLetbuyyBrandContrast()` runs before applying any merchant brand color. WCAG minimums (4.5:1 for text, 3:1 for focus ring) are absolute.

**GS-09:** Accessibility minimum tap target size. 44px height minimum for interactive elements. Compact mode (36px button height) is permitted for trained daily users (merchant admin); comfortable and spacious modes meet the 44px target.

**GS-10:** The z-index stack using `--lb-z-*` tokens. Overlay stacking: dropdown 30, sticky 40, overlay 50, modal 60, toast 70, tooltip 80. No surface may introduce custom z-index values for shared UI concerns.

**GS-11:** Flash prevention via `ThemeScript`. Every app using `LetbuyyThemeProvider` includes `<ThemeScript />` in `<head>`.

**GS-12:** ESLint `@letbuyy/ui/recommended` configuration in all active apps. `no-raw-elements` (error) and `no-hardcoded-hex` (error) are active in all apps.

---

# PART 13: TOKEN REFERENCE APPENDIX

*Source: `packages/typescript/ui/src/tokens.ts`, `config/tailwind/letbuyy-tokens.css`. Generated: 2026-06-19. All values from the TypeScript source. CSS variable names match what `letbuyyTokenCss` emits at runtime. Density tokens listed for all three presets (compact / comfortable / spacious). `apps/marketing-site` is excluded from ratchet scope by design.*

---

## 13.1 Semantic Color Tokens (`--lb-color-*`)

| Token Name | Light Value | Dark Value | Category |
|---|---|---|---|
| `--lb-color-brand-purple` | `#8B5CF6` | `#8B5CF6` | color/brand |
| `--lb-color-bg` | `#F6F7F9` | `#0a0912` | color/background |
| `--lb-color-background` | `#F6F7F9` | `#0a0912` | color/background (alias) |
| `--lb-color-surface` | `#FFFFFF` | `#0d0b16` | color/surface |
| `--lb-color-surface-raised` | `#FFFFFF` | `#1b1827` | color/surface |
| `--lb-color-surface-subdued` | `#F9FAFB` | `#0a0912` | color/surface |
| `--lb-color-card` | `#FFFFFF` | `#15131f` | color/surface |
| `--lb-card-bg` | `#FFFFFF` | `#15131f` | color/surface (alias) |
| `--lb-content-bg` | `#F6F7F9` | `#0a0912` | color/background (alias) |
| `--lb-color-sidebar` | `#F1F2F4` | `#0d0b15` | color/surface |
| `--lb-sidebar-bg` | `#F1F2F4` | `#0d0b15` | color/surface (alias) |
| `--lb-color-header` | `#FFFFFF` | `#0d0b16` | color/surface |
| `--lb-color-text` | `#111827` | `#FFFFFF` | color/text |
| `--lb-color-text-subdued` | `#6B7280` | `#CBD5E1` | color/text |
| `--lb-color-text-muted` | `#6B7280` | `#6B7280` | color/text |
| `--lb-color-text-inverse` | `#FFFFFF` | `#111827` | color/text |
| `--lb-color-border` | `#E5E7EB` | `rgba(139,92,246,0.18)` | color/border |
| `--lb-color-border-strong` | `#334155` | `#E5E7EB` | color/border |
| `--lb-color-primary` | `#8B5CF6` | `#8B5CF6` | color/brand |
| `--lb-color-primary-text` | `#6D28D9` | `#C4B5FD` | color/brand |
| `--lb-color-primary-hover` | `#7C3AED` | `#7C3AED` | color/brand |
| `--lb-color-primary-active` | `#6D28D9` | `#6D28D9` | color/brand |
| `--lb-color-primary-subtle` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` | color/brand |
| `--lb-color-primary-soft` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` | color/brand (alias) |
| `--lb-color-primary-cta` | `#6D28D9` | `#6D28D9` | color/brand/cta |
| `--lb-color-primary-cta-hover` | `#5B21B6` | `#5B21B6` | color/brand/cta |
| `--lb-color-primary-cta-active` | `#4C1D95` | `#4C1D95` | color/brand/cta |
| `--lb-color-primary-cta-text` | `#FFFFFF` | `#FFFFFF` | color/brand/cta |
| `--lb-color-secondary-action` | `#8B5CF6` | `#8B5CF6` | color/action |
| `--lb-color-secondary-action-hover` | `#7C3AED` | `#7C3AED` | color/action |
| `--lb-color-secondary-action-subtle` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` | color/action |
| `--lb-color-critical` | `#EF4444` | `#EF4444` | color/status |
| `--lb-color-critical-hover` | `#DC2626` | `#DC2626` | color/status |
| `--lb-color-critical-soft` | `#FEE2E2` | `#451A1A` | color/status |
| `--lb-color-warning` | `#F59E0B` | `#F59E0B` | color/status |
| `--lb-color-warning-soft` | `#FEF3C7` | `#422006` | color/status |
| `--lb-color-success` | `#22C55E` | `#22C55E` | color/status |
| `--lb-color-success-soft` | `#DCFCE7` | `#052E16` | color/status |
| `--lb-color-info` | `#3B82F6` | `#3B82F6` | color/status |
| `--lb-color-info-soft` | `#E0F2FE` | `#082F49` | color/status |
| `--lb-color-focus-ring` | `#5B21B6` | `#8B5CF6` | color/focus |
| `--lb-color-overlay` | `rgb(15 23 42 / 56%)` | `rgb(0 0 0 / 64%)` | color/overlay |
| `--lb-shadow-card` | `0 1px 2px rgb(15 23 42 / 5%), 0 8px 24px rgb(15 23 42 / 4%)` | `0 1px 2px rgb(0 0 0 / 18%), 0 10px 26px rgb(0 0 0 / 16%)` | shadow/card |

**DEPRECATED (absent from CSS output — resolves to transparent):**
- `--lb-color-border-subtle` — migrate to `--lb-color-border` or `--lb-color-border-strong`

---

## 13.2 Static Color References

| Token Name | Value | Category |
|---|---|---|
| `--lb-color-background-light` | `#F6F7F9` | color/primitive-alias |
| `--lb-color-background-dark` | `#0a0912` | color/primitive-alias |
| `--lb-color-surface-light` | `#FFFFFF` | color/primitive-alias |
| `--lb-color-surface-dark` | `#0d0b16` | color/primitive-alias |
| `--lb-color-text-primary-light` | `#111827` | color/primitive-alias |
| `--lb-color-text-primary-dark` | `#FFFFFF` | color/primitive-alias |
| `--lb-color-text-secondary-light` | `#6B7280` | color/primitive-alias |
| `--lb-color-text-secondary-dark` | `#CBD5E1` | color/primitive-alias |
| `--lb-color-border-light` | `#E5E7EB` | color/primitive-alias |
| `--lb-color-border-dark` | `rgba(139,92,246,0.18)` | color/primitive-alias |

---

## 13.3 Component Color Tokens (`--lb-component-*`)

**Button**

| Token Name | Light Value | Dark Value |
|---|---|---|
| `--lb-component-button-primary-bg` | `#6D28D9` | `#6D28D9` |
| `--lb-component-button-primary-hover` | `#5B21B6` | `#5B21B6` |
| `--lb-component-button-primary-active` | `#4C1D95` | `#4C1D95` |
| `--lb-component-button-primary-text` | `#FFFFFF` | `#FFFFFF` |
| `--lb-component-button-primary-border` | `#6D28D9` | `#6D28D9` |
| `--lb-component-button-secondary-bg` | `transparent` | `#0d0b16` |
| `--lb-component-button-secondary-hover` | `#F9FAFB` | `#15131f` |
| `--lb-component-button-secondary-text` | `#111827` | `#FFFFFF` |
| `--lb-component-button-secondary-border` | `#E5E7EB` | `rgba(139,92,246,0.18)` |

**Card**

| Token Name | Light Value | Dark Value |
|---|---|---|
| `--lb-component-card-bg` | `#FFFFFF` | `#15131f` |
| `--lb-component-card-text` | `#111827` | `#FFFFFF` |
| `--lb-component-card-border` | `#E5E7EB` | `rgba(139,92,246,0.18)` |
| `--lb-component-card-radius` | `16px` | `16px` |
| `--lb-component-card-shadow` | `0 1px 2px rgb(15 23 42 / 5%), 0 8px 24px rgb(15 23 42 / 4%)` | `0 1px 2px rgb(0 0 0 / 18%), 0 10px 26px rgb(0 0 0 / 16%)` |

**Input**

| Token Name | Light Value | Dark Value |
|---|---|---|
| `--lb-component-input-bg` | `#FFFFFF` | `#0d0b16` |
| `--lb-component-input-text` | `#111827` | `#FFFFFF` |
| `--lb-component-input-border` | `#E5E7EB` | `rgba(139,92,246,0.18)` |
| `--lb-component-input-focus-border` | `#8B5CF6` | `#8B5CF6` |
| `--lb-component-input-focus-ring` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` |

**Badge**

| Token Name | Light Value | Dark Value |
|---|---|---|
| `--lb-component-badge-accent-bg` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` |
| `--lb-component-badge-accent-text` | `#6D28D9` | `#C4B5FD` |
| `--lb-component-badge-accent-border` | `#8B5CF6` | `#8B5CF6` |

**Banner**

| Token Name | Light Value | Dark Value |
|---|---|---|
| `--lb-component-banner-info-bg` | `#E0F2FE` | `#082F49` |
| `--lb-component-banner-info-text` | `#1D4ED8` | `#7DD3FC` |
| `--lb-component-banner-info-border` | `#3B82F6` | `#3B82F6` |
| `--lb-component-banner-success-bg` | `#DCFCE7` | `#052E16` |
| `--lb-component-banner-success-text` | `#15803D` | `#22C55E` |
| `--lb-component-banner-success-border` | `#22C55E` | `#22C55E` |
| `--lb-component-banner-warning-bg` | `#FEF3C7` | `#422006` |
| `--lb-component-banner-warning-text` | `#92400E` | `#F59E0B` |
| `--lb-component-banner-warning-border` | `#F59E0B` | `#F59E0B` |
| `--lb-component-banner-danger-bg` | `#FEE2E2` | `#451A1A` |
| `--lb-component-banner-danger-text` | `#B91C1C` | `#EF4444` |
| `--lb-component-banner-danger-border` | `#EF4444` | `#EF4444` |

**Empty State**

| Token Name | Light Value | Dark Value |
|---|---|---|
| `--lb-component-empty-state-bg` | `#FFFFFF` | `#15131f` |
| `--lb-component-empty-state-border` | `#E5E7EB` | `rgba(139,92,246,0.18)` |
| `--lb-component-empty-state-title` | `#111827` | `#FFFFFF` |
| `--lb-component-empty-state-body` | `#6B7280` | `#CBD5E1` |

**Page Header**

| Token Name | Value |
|---|---|
| `--lb-component-page-header-height` | `var(--lb-density-header-height)` |
| `--lb-component-page-header-title-size` | `24px` |
| `--lb-component-page-header-title-line-height` | `32px` |
| `--lb-component-page-header-icon-size` | `var(--lb-component-page-header-title-size)` |
| `--lb-component-page-header-icon-stroke-width` | `2.45` |

---

## 13.4 Typography Tokens

**Font Family (`--lb-font-family-*`)**

| Token Name | Value |
|---|---|
| `--lb-font-family-body` | `var(--font-letbuyy-sans), ui-sans-serif, system-ui, -apple-system, sans-serif` |
| `--lb-font-family-display` | `var(--font-letbuyy-display), var(--font-letbuyy-sans), ui-sans-serif, system-ui, sans-serif` |
| `--lb-font-family-mono` | `var(--font-letbuyy-mono), "SFMono-Regular", Consolas, monospace` |

**Font Size (`--lb-font-size-*`)**

| Token Name | Value | Category |
|---|---|---|
| `--lb-font-size-display` | `32px` | typography/size |
| `--lb-font-size-display-fluid` | `clamp(2.75rem, 2.1rem + 2vw, 3.5rem)` | typography/size/fluid |
| `--lb-font-size-h1` | `28px` | typography/size |
| `--lb-font-size-h1-fluid` | `clamp(1.75rem, 1.45rem + 0.9vw, 2rem)` | typography/size/fluid |
| `--lb-font-size-h2` | `24px` | typography/size |
| `--lb-font-size-h2-fluid` | `clamp(1.375rem, 1.18rem + 0.5vw, 1.5rem)` | typography/size/fluid |
| `--lb-font-size-h3` | `20px` | typography/size |
| `--lb-font-size-h4` | `18px` | typography/size |
| `--lb-font-size-page-title` | `24px` | typography/size |
| `--lb-font-size-section-title` | `18px` | typography/size |
| `--lb-font-size-card-title` | `16px` | typography/size |
| `--lb-font-size-body-large` | `16px` | typography/size |
| `--lb-font-size-heading` | `18px` | typography/size (canonical role) |
| `--lb-font-size-body` | `14px` | typography/size |
| `--lb-font-size-secondary` | `13px` | typography/size |
| `--lb-font-size-table` | `13px` | typography/size |
| `--lb-font-size-sidebar` | `14px` | typography/size |
| `--lb-font-size-empty-state` | `14px` | typography/size |
| `--lb-font-size-small` | `13px` | typography/size |
| `--lb-font-size-caption` | `12px` | typography/size |
| `--lb-font-size-badge` | `12px` | typography/size |

**Line Height (`--lb-line-height-*`)**

| Token Name | Value |
|---|---|
| `--lb-line-height-display` | `40px` |
| `--lb-line-height-h1` | `36px` |
| `--lb-line-height-h2` | `32px` |
| `--lb-line-height-h3` | `28px` |
| `--lb-line-height-page-title` | `32px` |
| `--lb-line-height-body` | `20px` |
| `--lb-line-height-secondary` | `18px` |
| `--lb-line-height-caption` | `16px` |
| `--lb-line-height-badge` | `16px` |

**Font Weight (`--lb-font-weight-*`)**

| Token Name | Value |
|---|---|
| `--lb-font-weight-regular` | `400` |
| `--lb-font-weight-medium` | `500` |
| `--lb-font-weight-semibold` | `600` |
| `--lb-font-weight-bold` | `700` |

---

## 13.5 Spacing Tokens (`--lb-space-*`)

| Token Name | Value | Named Alias |
|---|---|---|
| `--lb-space-0` | `0` | — |
| `--lb-space-1` | `4px` | `--lb-space-xs` |
| `--lb-space-2` | `8px` | `--lb-space-sm` |
| `--lb-space-3` | `12px` | `--lb-space-md` |
| `--lb-space-4` | `16px` | `--lb-space-lg` |
| `--lb-space-5` | `20px` | `--lb-space-xl` |
| `--lb-space-6` | `24px` | — |
| `--lb-space-7` | `32px` | — |
| `--lb-space-8` | `40px` | — |
| `--lb-space-9` | `48px` | — |
| `--lb-space-10` | `64px` | — |
| `--lb-space-11` | `96px` | — |

---

## 13.6 Border Radius Tokens (`--lb-radius-*`)

| Token Name | Value | Tailwind Class |
|---|---|---|
| `--lb-radius-sm` | `4px` | `rounded-sm` |
| `--lb-radius-md` | `8px` | `rounded-md` |
| `--lb-radius-lg` | `12px` | `rounded-lg` |
| `--lb-radius-xl` | `16px` | `rounded-xl` |
| `--lb-radius-full` | `999px` | `rounded-full` |

---

## 13.7 Shadow Tokens (`--lb-shadow-*`)

| Token Name | Value |
|---|---|
| `--lb-shadow-sm` | `0 1px 2px rgb(0 0 0 / 4%)` |
| `--lb-shadow-md` | `0 4px 12px rgb(15 23 42 / 6%)` |
| `--lb-shadow-lg` | `0 12px 32px rgb(15 23 42 / 8%)` |
| `--lb-shadow-card-light` | `0 1px 2px rgb(15 23 42 / 5%), 0 8px 24px rgb(15 23 42 / 4%)` |
| `--lb-shadow-card-dark` | `0 1px 2px rgb(0 0 0 / 18%), 0 10px 26px rgb(0 0 0 / 16%)` |

---

## 13.8 Z-Index Tokens (`--lb-z-*`)

| Token Name | Value | Used In |
|---|---|---|
| `--lb-z-base` | `0` | Default layer |
| `--lb-z-dropdown` | `30` | Popover, Dropdown panels |
| `--lb-z-sticky` | `40` | Sticky UI elements |
| `--lb-z-overlay` | `50` | Overlay backdrops |
| `--lb-z-modal` | `60` | Modal, Drawer containers |
| `--lb-z-toast` | `70` | Toast notifications |
| `--lb-z-tooltip` | `80` | Tooltip panels |

---

## 13.9 Motion Tokens

| Token Name | Value | Category |
|---|---|---|
| `--lb-motion-fast` | `150ms` | motion/duration |
| `--lb-motion-hover` | `150ms` | motion/duration |
| `--lb-motion-menu` | `150ms` | motion/duration |
| `--lb-motion-carousel` | `300ms` | motion/duration |
| `--lb-motion-normal` | `180ms` | motion/duration |
| `--lb-motion-slow` | `200ms` | motion/duration |
| `--lb-ease-standard` | `ease-out` | motion/easing |
| `--lb-ease-out` | `ease-out` | motion/easing |
| `--lb-ease-emphasized` | `cubic-bezier(0.16, 1, 0.3, 1)` | motion/easing |
| `--lb-motion-hover-lift` | `2px` | motion/transform |
| `--lb-motion-hover-scale` | `1.01` | motion/transform |

---

## 13.10 Breakpoint Tokens (`--lb-bp-*`)

| Token Name | Value | Tailwind Prefix |
|---|---|---|
| `--lb-bp-xs` | `360px` | `xs:` |
| `--lb-bp-mobile` | `480px` | `mobile:` |
| `--lb-bp-sm` | `640px` | `sm:` |
| `--lb-bp-md` | `768px` | `md:` |
| `--lb-bp-tablet` | `768px` | (alias for md) |
| `--lb-bp-lg` | `1024px` | `lg:` |
| `--lb-bp-desktop` | `1024px` | (alias for lg) |
| `--lb-bp-xl` | `1280px` | `xl:` |
| `--lb-bp-wide` | `1280px` | (alias for xl) |

---

## 13.11 Size Tokens (`--lb-size-*`)

| Token Name | Value | Category |
|---|---|---|
| `--lb-size-control-sm` | `var(--lb-density-icon-button-height)` | size/control |
| `--lb-size-control-md` | `var(--lb-density-button-height)` | size/control |
| `--lb-size-control-lg` | `var(--lb-density-button-height-large)` | size/control |
| `--lb-size-icon` | `var(--lb-density-icon-button-height)` | size/icon |
| `--lb-size-icon-inline` | `var(--lb-density-action-icon-size)` | size/icon |
| `--lb-size-page-header-height` | `var(--lb-density-header-height)` | size/layout |
| `--lb-size-page-max` | `1440px` | size/layout |
| `--lb-size-marketplace-container` | `1200px` | size/layout |
| `--lb-size-content-measure` | `720px` | size/layout |
| `--lb-size-empty-state-measure` | `440px` | size/layout |
| `--lb-size-save-bar-width` | `920px` | size/layout |
| `--lb-size-skeleton-card-height` | `120px` | size/layout |
| `--lb-size-empty-state-min-height` | `var(--lb-density-empty-state-min-height)` | size/layout |
| `--lb-size-combobox-menu-max-height` | `280px` | size/overlay |
| `--lb-size-tooltip-max-width` | `240px` | size/overlay |
| `--lb-size-metric-sparkline-width` | `96px` | size/chart |
| `--lb-size-metric-sparkline-height` | `40px` | size/chart |
| `--lb-size-chart-height-sm` | `160px` | size/chart |
| `--lb-size-chart-height-md` | `220px` | size/chart |
| `--lb-size-chart-height-lg` | `280px` | size/chart |
| `--lb-size-table-row-height` | `var(--lb-density-table-row-height)` | size/table |
| `--lb-size-table-header-height` | `var(--lb-density-table-header-height)` | size/table |
| `--lb-size-table-toolbar-height` | `var(--lb-density-action-bar-height)` | size/table |
| `--lb-size-command-palette-width` | `720px` | size/overlay |
| `--lb-size-command-palette-list-max-height` | `360px` | size/overlay |
| `--lb-size-command-palette-offset` | `12vh` | size/overlay |

---

## 13.12 Density Tokens (`--lb-density-*`)

All three density values listed. Default is compact.

| Token Name | compact | comfortable | spacious | Category |
|---|---|---|---|---|
| `--lb-density-sidebar-row-height` | `40px` | `44px` | `48px` | density/height |
| `--lb-density-input-height` | `36px` | `40px` | `44px` | density/height |
| `--lb-density-button-height` | `36px` | `40px` | `44px` | density/height |
| `--lb-density-button-height-large` | `40px` | `44px` | `48px` | density/height |
| `--lb-density-icon-button-height` | `32px` | `36px` | `40px` | density/height |
| `--lb-density-pill-height` | `28px` | `32px` | `36px` | density/height |
| `--lb-density-table-row-height` | `44px` | `48px` | `52px` | density/height |
| `--lb-density-table-header-height` | `44px` | `48px` | `52px` | density/height |
| `--lb-density-page-gap` | `12px` | `16px` | `20px` | density/spacing |
| `--lb-density-section-gap` | `12px` | `16px` | `20px` | density/spacing |
| `--lb-density-card-gap` | `16px` | `20px` | `24px` | density/spacing |
| `--lb-density-card-padding` | `16px` | `20px` | `24px` | density/spacing |
| `--lb-density-header-height` | `64px` | `72px` | `88px` | density/height |
| `--lb-density-action-bar-height` | `36px` | `40px` | `44px` | density/height |
| `--lb-density-modal-padding` | `16px` | `20px` | `24px` | density/spacing |
| `--lb-density-empty-state-scale` | `0.72` | `0.88` | `1` | density/scale |
| `--lb-density-empty-state-illustration-width` | `160px` | `184px` | `208px` | density/size |
| `--lb-density-empty-state-illustration-height` | `108px` | `122px` | `138px` | density/size |
| `--lb-density-empty-state-min-height` | `180px` | `220px` | `260px` | density/size |
| `--lb-density-page-icon-size` | `18px` | `20px` | `22px` | density/icon |
| `--lb-density-sidebar-icon-size` | `18px` | `18px` | `20px` | density/icon |
| `--lb-density-sidebar-nested-spacing` | `8px` | `8px` | `12px` | density/spacing |
| `--lb-density-sidebar-section-spacing` | `16px` | `16px` | `20px` | density/spacing |
| `--lb-density-button-icon-size` | `16px` | `16px` | `18px` | density/icon |
| `--lb-density-table-icon-size` | `14px` | `14px` | `16px` | density/icon |
| `--lb-density-action-icon-size` | `16px` | `16px` | `18px` | density/icon |

---

## 13.13 Tailwind v4 Theme Tokens

Declared in the `@theme` block of `config/tailwind/letbuyy-tokens.css`. Generate Tailwind utility classes.

| Tailwind Token | Resolves To | Generated Classes |
|---|---|---|
| `--breakpoint-xs` | `360px` | `xs:` responsive prefix |
| `--breakpoint-mobile` | `480px` | `mobile:` responsive prefix |
| `--color-surface` | `var(--lb-color-surface)` | `bg-surface`, `text-surface`, `border-surface` |
| `--color-surface-raised` | `var(--lb-color-surface-raised)` | `bg-surface-raised` |
| `--color-surface-subdued` | `var(--lb-color-surface-subdued)` | `bg-surface-subdued` |
| `--color-card` | `var(--lb-color-card)` | `bg-card` |
| `--color-page` | `var(--lb-color-bg)` | `bg-page` |
| `--color-sidebar` | `var(--lb-color-sidebar)` | `bg-sidebar` |
| `--color-default` | `var(--lb-color-text)` | `text-default` |
| `--color-subdued` | `var(--lb-color-text-subdued)` | `text-subdued` |
| `--color-muted` | `var(--lb-color-text-muted)` | `text-muted` |
| `--color-inverse` | `var(--lb-color-text-inverse)` | `text-inverse` |
| `--color-primary` | `var(--lb-color-primary)` | `bg-primary`, `text-primary` |
| `--color-primary-cta` | `var(--lb-color-primary-cta)` | `bg-primary-cta` |
| `--color-primary-soft` | `var(--lb-color-primary-soft)` | `bg-primary-soft` |
| `--color-critical` | `var(--lb-color-critical)` | `text-critical`, `bg-critical` |
| `--color-success` | `var(--lb-color-success)` | `text-success`, `bg-success` |
| `--color-warning` | `var(--lb-color-warning)` | `text-warning`, `bg-warning` |
| `--color-info` | `var(--lb-color-info)` | `text-info`, `bg-info` |
| `--color-line` | `var(--lb-color-border)` | `border-line` |
| `--color-line-subtle` | `var(--lb-color-border-subtle)` | `border-line-subtle` (NOTE: source variable deprecated — resolves to transparent) |
| `--color-focus` | `var(--lb-color-focus-ring)` | `ring-focus`, `border-focus` |

---

## 13.14 Primitive Color Tokens (`--lb-primitive-color-*`)

Private — never use in product code. Auto-generated from `letbuyyPrimitiveTokens`.

**Purple palette:**

| Token | Value |
|---|---|
| `--lb-primitive-color-purple-100` | `#EDE9FE` |
| `--lb-primitive-color-purple-200` | `#DDD6FE` |
| `--lb-primitive-color-purple-300` | `#C4B5FD` |
| `--lb-primitive-color-purple-400` | `#A78BFA` |
| `--lb-primitive-color-purple-500` | `#8B5CF6` |
| `--lb-primitive-color-purple-600` | `#7C3AED` |
| `--lb-primitive-color-purple-700` | `#6D28D9` |
| `--lb-primitive-color-purple-800` | `#5B21B6` |
| `--lb-primitive-color-purple-900` | `#4C1D95` |

**Ink palette (the canonical dark background family):**

| Token | Value | Role |
|---|---|---|
| `--lb-primitive-color-ink-950` | `#0a0912` | Canonical dark page background |
| `--lb-primitive-color-ink-900` | `#0d0b15` | Dark sidebar |
| `--lb-primitive-color-ink-850` | `#0d0b16` | Dark surface / header |
| `--lb-primitive-color-ink-800` | `#15131f` | Dark card |
| `--lb-primitive-color-ink-700` | `#1b1827` | Dark surface-raised |

**Gray palette:**

| Token | Value |
|---|---|
| `--lb-primitive-color-gray-50` | `#F9FAFB` |
| `--lb-primitive-color-gray-100` | `#F5F5F7` |
| `--lb-primitive-color-gray-125` | `#F6F7F9` |
| `--lb-primitive-color-gray-150` | `#EFEFF1` |
| `--lb-primitive-color-gray-175` | `#F1F2F4` |
| `--lb-primitive-color-gray-200` | `#E5E7EB` |
| `--lb-primitive-color-gray-300` | `#D1D5DB` |
| `--lb-primitive-color-gray-400` | `#94A3B8` |
| `--lb-primitive-color-gray-500` | `#6B7280` |
| `--lb-primitive-color-gray-600` | `#4B5563` |
| `--lb-primitive-color-gray-700` | `#374151` |
| `--lb-primitive-color-gray-800` | `#1F2937` |
| `--lb-primitive-color-gray-900` | `#111827` |

**Slate palette:** slate-50 through slate-950 (50 → `#F8FAFC` through 950 → `#0A0F1A`).

**Status palettes:**
- Green: `green-100 = #DCFCE7`, `green-500 = #22C55E`, `green-700 = #15803D`, `green-950 = #052E16`
- Amber: `amber-100 = #FEF3C7`, `amber-500 = #F59E0B`
- Red: `red-100 = #FEE2E2`, `red-500 = #EF4444`, `red-950 = #451A1A`
- Blue: `blue-100 = #E0F2FE`, `blue-500 = #3B82F6`, `blue-950 = #082F49`

---

*End of LetBuyy Design Intelligence Master — Version 1.0 — 2026-06-19*
