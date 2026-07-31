# LetBuyy Design Intelligence Master Document
## Parts 1, 2, and 3

*Generated: 2026-06-19 | Source: EXECUTIVE_SUMMARY.md, APPLICATION_TOPOLOGY.md, ECOSYSTEM_MAP.md*

---

# PART 1: EXECUTIVE OVERVIEW

## Opening: The Complete Story

LetBuyy is a production-grade, India-first multi-tenant commerce platform with a design system foundation that would pass scrutiny at most Series B product organisations — and a set of adoption gaps that, if left unaddressed, will compound into maintenance debt that blocks the platform's next growth phase. The foundation is this: `packages/typescript/ui` exports 50+ React components across 12 functional groups, governs ~330 CSS custom properties through a 4-tier token hierarchy (Primitive → Semantic → Component → Density), ships a Tailwind v4 bridge, a DTCG JSON interchange file, a Flutter/Dart token mirror, 7 mechanical codemods, and a ratchet validator tracking 7 violation categories in CI. The system has a ratified Design Constitution, 5 ESLint rules enforced at error level, and 7 Storybook story files covering every major component group. By any objective measure, this is not a platform that lacks design system infrastructure.

The gaps live at the adoption and governance layer. Of the six active web applications, three carry design debt that the ratchet was not yet enforcing when those files were first written: merchant-control-plane has 127 arbitrary-radius violations in files that predate the validator, 6 of which are in actively developed components; identity-platform maintains a ~2,300-line parallel CSS custom property system (10+ `--bg`, `--text-primary`, `--border` properties) that mirrors `--lb-*` token values without referencing them; and the theme editor inside merchant-control-plane operates as a fully isolated design system island with 27 direct `lucide-react` imports and ~50 private `theme-os-*` CSS class names, scoring 21/100 on the consistency scorecard. The two forced-dark internal tools (platform-console, platform-operations-portal) share byte-for-byte identical CSS and accidentally diverge from the canonical dark background by using `rgb(10 10 10)` instead of the violet-tinted ink-950 (`rgb(10 9 18)`). The three frozen marketplace apps carry their own divergent visual systems — one fully disconnected from `--lb-*` tokens, one using incorrect surface assignments — that will require dedicated remediation work when those apps are unfrozen and promoted to production.

Why this matters operationally: LetBuyy's most visible brand moment is the journey from the marketing site (`letbuyy.com`) through the auth flow (`accounts.letbuyy.com`) into the merchant dashboard (`admin.letbuyy.com`). Those three apps share a coherent "ink lavender" visual core — light page `rgb(250 249 255)`, dark page `rgb(10 9 18)`, purple-tinted borders — but that coherence exists in three separate `globals.css` comments rather than in a formally codified token. A single `--lb-color-bg-premium` token promotion would make this implicit brand language explicit, governable, and protected from drift. The storefront runtime — serving all end-customer traffic at `{store}.letbuyy.com` — is deliberately identity-less by design, a correct architectural decision given the multi-tenant theme engine. The critical short-term actions are not architecture changes: they are a 1-hour locale fix (Rs. → ₹ in the coupons page), a 2-hour dependency governance fix (lucide-react → @letbuyy/ui in the theme editor), a 30-minute dark background standardisation for the internal tools, and a Storybook deployment that requires no production code changes at all. The 6-month migration roadmap handles systematic adoption in sequenced phases. But the platform is operational, coherent where it matters most, and ready for governed incremental improvement rather than a foundational redesign.

---

## The Ten Critical Findings

**Finding 1: The Design System Foundation is Production-Grade**
Severity: P2 (informational) | Effort: Phase 0 baseline only | Owner: Design System team

`packages/typescript/ui/src/tokens.ts` defines a canonical 4-tier token hierarchy — Primitive → Semantic → Component → Density — that emits ~330 CSS custom properties at runtime via `letbuyy-tokens.css`. The system's governance infrastructure is complete: a Tailwind v4 bridge maps semantic tokens to utility classes (`bg-surface`, `text-default`, `border-line`); a DTCG JSON interchange file enables cross-tool interoperability; a Flutter/Dart token mirror in `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart` propagates the web token set to native mobile; 7 codemods handle mechanical migration (including `tailwind-default-color-to-token` and `rounded-arbitrary-to-token`); an ESLint plugin enforces 5 rules at error level (no raw colors, no arbitrary radius, no deprecated tokens); and a ratchet validator in CI tracks 7 violation categories and prevents the violation count from increasing. Storybook stories exist for all major component groups in `packages/typescript/ui/src/` across 7 story files including the critical `governance.stories.tsx` (do/don't usage patterns) and `design-tokens.stories.tsx`.

The significance of this finding is architectural: it establishes that the platform's design problems are adoption and governance gaps, not foundation gaps. Teams building new features today have a complete, enforced system to build on. The ratchet means every new PR either holds the line or improves it. The immediate action is to document the current ratchet baseline values in `scripts/validators/design-ratchet-baseline.json` as the Phase 0 anchor — so every subsequent PR has a numeric target to beat rather than a vague improvement goal. Without this baseline, the migration roadmap has no measurable starting point and no way to declare a migration phase complete.

**Finding 2: Three Apps Share a Coherent "Ink Lavender" Visual Core**
Severity: P2 | Effort: 2–4 hours (token promotion) | Owner: Design System team

identity-platform, merchant-control-plane, and marketing-site independently adopt the same premium palette: light page background `rgb(250 249 255)`, dark page background `rgb(10 9 18)`, and purple-tinted border values. All three files comment this palette with phrases like "Premium Ink Lavender" or "Synced with accounts app theme" — the coherence is real, consistent, and intentional in practice, but it exists as duplicated raw `rgb()` values in three separate `globals.css` files rather than as a named token in the design system.

This is the platform's most important unrealised design system opportunity. An implicit brand language already exists and is working; it just has no formal representation. If the `ink.950` value ever changes — for contrast compliance, for brand refresh, for any reason — all three apps must be updated manually, and the probability of drift is 100% over a sufficient time horizon. The recommended action is to promote this palette to a named token variant: `--lb-color-bg-premium` in the semantic tier, so all three globals.css files can replace their hardcoded `rgb()` values with `var(--lb-color-bg-premium)`. If the identity platform's exact shade differs from the merchant dashboard's, it warrants a `--lb-color-bg-identity` variant — but the key principle is that the value lives in one authoritative source. The 3-of-6 adoption rate across active web apps (identity, merchant, marketing) represents a strong enough foundation that this promotion carries almost no visual risk.

**Finding 3: 127 Arbitrary Border-Radius Violations in Merchant Control Plane**
Severity: P1 | Effort: 2 days (systematic) + half-day (6 active) | Owner: Merchant UX team

The design-system ratchet explicitly forbids `rounded-[...]` arbitrary values — the bracket syntax is disallowed even when the bracketed value itself is a token variable (e.g., `rounded-[var(--lb-radius-lg)]` is forbidden; the correct form is `rounded-lg` via the Tailwind token bridge). 127 such instances exist in merchant-control-plane and predate the ratchet validator. These are not new violations — the ratchet prevents the count from increasing — but they represent maintenance debt in the platform's most feature-rich application. Six of these violations are in actively developed, named component files, representing current governance misses rather than legacy debt: `NotificationsPanel.tsx` (inline `<span>` badge with arbitrary radius instead of `<Badge>`), `SettingsSearch.tsx` (raw `<input>` instead of `<Input>`), `BackendNeededPane.tsx` (raw wrapper div instead of `<Card>` or `<Box radius="lg">`), `EmbeddedAppBridgeClient.tsx` (raw tab buttons instead of `<Tabs variant="pills">`), `ProviderModeBadge.tsx` (`py-[2px]` instead of token-scaled padding), and `AdminShell.tsx` (`rounded-tl-[var(--sidebar-panel-radius)]` instead of `rounded-tl-[var(--lb-radius-lg)]`).

The immediate action is to address the 6 active component violations in priority order — these are the violations in components currently being developed and the signals most likely to be copied by other engineers. The `tailwind-default-color-to-token` codemod should be run against the full merchant-control-plane directory to mechanically address the 127 legacy instances where safe, with manual review for the remainder. Each resolved violation is a concrete ratchet improvement that can be tracked in `design-ratchet-baseline.json`.

**Finding 4: identity-platform Runs a Parallel CSS Custom Property System**
Severity: P1 | Effort: 4 hours (bridging) + 1 hour (visual verification) | Owner: Identity team

`apps/identity-platform/src/app/globals.css` is a ~2,300-line file that defines its own `--bg`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--border`, `--input-bg`, and related properties with raw `rgb()` values. These shadow the canonical `--lb-color-*` token system without referencing it. The file also contains three layers of specificity override blocks ("COMPACT AUTH FLOW POLISH") that re-declare the same values at higher cascade weight. Identity-platform received the lowest design scores of the three audited apps: Token Adoption 4.5/10, Layout Consistency 4.0/10, overall score 6.3/10 versus merchant-control-plane's 8.0/10.

The operational consequence is a double maintenance surface: every time the canonical `--lb-*` token values update — for brand refresh, contrast compliance, or dark mode calibration — the identity platform's parallel system receives no benefit from those updates. The auth flow is the merchant's first experience with LetBuyy; if its colours drift from the dashboard, that brand discontinuity is felt on every login. The fix is mechanical: wire identity-platform's local custom properties to their `--lb-*` equivalents (`--bg: var(--lb-color-bg)`, `--text-primary: var(--lb-color-text)`, `--border: var(--lb-color-border)`, etc.), verifying light/dark at 360px and 1280px after each change. If the "Premium Ink Lavender" tint is meaningfully different from the admin surface's ink value, it warrants a dedicated `--lb-color-bg-identity` token rather than a raw `rgb()` fallback.

**Finding 5: The Theme Editor is a Design System Island**
Severity: P0 (dependency governance) + P2 (CSS refactor) | Effort: 2 hours (dependency) + Phase 4 (CSS) | Owner: Theme team / Merchant UX team

`apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` imports 27 icons directly from `lucide-react` (`import { Layers, Settings, Eye, Code2, ... } from 'lucide-react'`), bypassing `@letbuyy/ui`'s version-pinned re-exports. This creates a dual dependency: if `@letbuyy/ui` pins Lucide at version X and the theme editor's direct import resolves to version Y, icon rendering diverges silently. The file also uses approximately 50+ `theme-os-*` CSS class names with no `--lb-*` token references in JSX, scoring 2/10 on Token Adoption and 2/10 on Component Usage — 21/100 on the consistency scorecard, the lowest score of any audited file except the identity globals. The editor is classified CRITICAL in the scorecard.

The 2-hour fix is to replace all `import { ... } from 'lucide-react'` statements with `import { ... } from '@letbuyy/ui'` in the editor file. Every icon that `@letbuyy/ui` re-exports from Lucide is available via this path, making this a zero-visual-impact, zero-risk change that eliminates the CRITICAL dependency governance issue entirely. The CSS refactor — migrating `theme-os-*` classes to `--lb-*` token references for semantic values (z-index, motion timing, border-radius) — is correctly deferred to Phase 4 of the migration roadmap, as the editor's architectural isolation makes it a lower-blast-radius project that can be planned independently.

**Finding 6: Four Different Dark Backgrounds Across the Platform**
Severity: P1 | Effort: 30 minutes (internal tools) + Phase 4 (frozen apps) | Owner: Design System team

The platform has four distinct dark page backgrounds across active and frozen apps: `rgb(10 9 18)` (canonical ink-950, token-backed, used by identity-platform, merchant-control-plane, marketing-site), `rgb(10 10 10)` (platform-console and platform-operations-portal — pure near-black with no violet tinting), `rgb(10 15 26)` (app-marketplace — a blue-shifted near-black), and `rgb(15 15 26)` (theme-marketplace — a slightly lighter blue-shifted dark). The differences are perceptually invisible in isolation but cumulative across sessions that cross surfaces. Dark mode was explicitly designed around the violet-tinted ink palette (`#0a0912 / rgb(10 9 18)`); the platform-console divergence to `rgb(10 10 10)` is not an intentional brand decision — it is the result of the internal tools CSS being written without reference to the canonical token.

The 30-minute fix is to replace `rgb(10 10 10)` with `var(--lb-color-bg)` in `apps/platform-console/src/app/globals.css` and `apps/platform-operations-portal/src/app/globals.css`. Both apps force dark mode via `ThemeScript defaultTheme="dark"`, so `--lb-color-bg` resolves to the canonical ink-950 dark value with no light-mode risk. The frozen marketplace apps' divergent backgrounds are addressed as part of the freeze-exit remediation when those apps are promoted to production.

**Finding 7: Coupons Page Has a Live Locale Bug**
Severity: P0 | Effort: 1 hour | Owner: Merchant UX team

The `formatDiscount()` function in `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx` returns `` `Rs. ${coupon.value}` `` for absolute discount values. `Rs.` is the deprecated romanised abbreviation for the Indian Rupee; the correct symbol is `₹`. The canonical formatter `formatInrCurrency` is exported from `@letbuyy/ui` and is used correctly everywhere else in merchant-control-plane. This is not a systemic platform deficit — it is a single file anomaly in an otherwise locale-compliant app. But the context makes it significant: a merchant viewing their coupon list sees `Rs. 100 off` instead of `₹100 off`, and any coupon description surfaced to customers carries this incorrect symbol. For a platform whose India-first positioning is a core brand claim, a deprecated currency symbol in a merchant-facing discount tool is a trust signal in the wrong direction.

The coupons page also scored 31/100 on the consistency scorecard — the lowest score of any non-editor merchant page — with 3/10 on Locale Standards. The fix is a single-line substitution: replace `` `Rs. ${coupon.value}` `` with `formatInrCurrency(coupon.value)`. Estimated fix time: 1 hour including verification across sample coupon values. Priority: P0 because it is a live, visible bug in a production feature.

**Finding 8: marketing-site Uses Wrong ThemeProvider Surface**
Severity: P2 (latent) | Effort: 2 hours | Owner: Marketing / Design System team

`apps/marketing-site/src/app/layout.tsx` instantiates `LetbuyyThemeProvider` with `surface="storefront"`. The `storefront` surface type is semantically designated for `storefront-runtime` — the shopper-facing commerce engine that serves merchant storefronts at `{store}.letbuyy.com`. The marketing site is the public-facing brand and acquisition surface for LetBuyy itself at `letbuyy.com`, categorically different in audience (prospective merchants vs. active shoppers), tone (aspirational/brand vs. commerce/transactional), and token semantics.

Currently, all five surface types resolve to identical token values — so there is zero visual impact in production today. But the surface system is the architectural hook for per-product design differentiation. If the platform ever defines distinct token values for the `storefront` surface (to serve shopper-specific aesthetic needs — high-contrast product imagery contexts, commerce-optimised button scales, tenant brand override boundaries), the marketing site silently inherits those changes. The fix is to define a `marketing` surface type in the token system and update marketing-site's ThemeProvider to `surface="marketing"`. This is a 2-hour change that costs nothing today and prevents a category of latent regression that would be genuinely difficult to debug when it occurs — because the symptom (marketing site visual change) would be upstream of the cause (storefront surface token update).

**Finding 9: No Deployed Storybook or Design Handoff**
Severity: P1 (governance gap) | Effort: Half-day | Owner: Design System team

Seven Storybook story files exist in `packages/typescript/ui/src/`: `component-catalog.stories.tsx`, `design-tokens.stories.tsx`, `foundation-primitives.stories.tsx`, `governance.stories.tsx`, `merchant-experience.stories.tsx`, `primitives.stories.tsx`, and `table.stories.tsx`. The `governance.stories.tsx` file in particular contains the do/don't usage guidance that prevents the exact violations found in the audit — showing engineers what `<Badge>` looks like versus an inline `<span>` with `rounded-[12px]`. No `storybook` script was confirmed in `packages/typescript/ui/package.json`. No deployed Storybook URL appears in any documentation. No Figma token plugin configuration or design handoff integration was found across the entire codebase.

The consequence is not abstract: engineers who encounter a pattern they haven't seen before find the nearest existing code and copy it. In merchant-control-plane, that code includes the 127 ratchet violations. Without a published Storybook, the governance stories are invisible to everyone who hasn't explicitly run `pnpm storybook` locally, which is a prerequisite that most engineers building features will skip. Additionally, the 10 items in the "What Is Missing" section of the design system inventory — including `BottomSheet`, `AccountSwitcher`, async `CommandPalette`, and the `marketing` surface type — cannot be formally specced or tracked without a shared reference. The fix requires no production code changes: add `storybook:dev` and `storybook:build` scripts to `packages/typescript/ui/package.json` and deploy the build to a static URL (design.letbuyy.com or a Vercel preview deployment). This makes the entire governance investment — 5 ESLint rules, 7 codemods, the ratchet, the Design Constitution — visible and accessible.

**Finding 10: Flutter Dark Mode Uses a Different Palette Than Web**
Severity: P1 | Effort: 2 hours + device visual review | Owner: Mobile team / Design System team

The generated `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart` file uses gray/slate-based dark values: `backgroundDark` maps to `gray900 = #111827`, and dark border tokens map to `slate700 = #334155`. The TypeScript source uses the violet-tinted ink palette: `ink.950 = #0a0912` for dark backgrounds, `rgba(139,92,246,0.18)` for dark borders. The generation script is `scripts/generators/generate-mobile-tokens.mjs`; it passes CI validation but the source mapping for ink-palette values is incorrect, producing a Dart output that does not match the web dark mode visual.

The operational impact: a merchant who uses the iOS or Android merchant app in dark mode sees a gray-black `#111827` background rather than the violet-black `#0a0912` that the web dashboard renders. The difference is perceptible on any calibrated display. For a platform with a designed ink-lavender visual identity that depends on the subtle purple tinting in its dark palette, this is a meaningful cross-platform brand inconsistency. The fix is to update `generate-mobile-tokens.mjs` to correctly map `ink.950 → Color(0xFF0A0912)` (and equivalent ink-tier values) rather than falling through to the gray/slate defaults, then run `validate:mobile-tokens` to confirm parity. The effort is 2 hours of script changes plus visual review on a physical device (not just a simulator, which may not render the tinting difference accurately).

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
| **Overall** | **7.2/10** | **Yellow** | Adoption and tooling gaps, not foundation gaps — foundation is production-grade | Phase 0: baseline. Phase 1: quick wins (Rs.→₹, lucide, dark bg). Phase 2–4: systematic adoption |

---

## Application Health at a Glance

| App | Score | Active | Biggest Issue | Next Action |
|-----|-------|--------|---------------|-------------|
| merchant-control-plane | 8.0/10 | Yes | 127 legacy arbitrary-radius violations; 6 active ratchet violations in named components; theme editor design system island (21/100) | Fix 6 named component violations (half-day); run radius codemod; replace lucide-react in theme editor (2 hrs) |
| identity-platform | 6.3/10 | Yes | ~2,300-line parallel CSS custom property system (Token Adoption 4.5/10, Layout Consistency 4.0/10); Rs. locale bug in adjacent merchant feature | Bridge 10+ local CSS vars to `--lb-*` equivalents (4 hrs); fix coupons Rs.→₹ (1 hr) |
| marketing-site | 7.3/10 | Yes | Wrong `surface="storefront"` assignment; implicit ink-lavender palette not tokenised | Define `marketing` surface type; update ThemeProvider (2 hrs); promote ink-lavender palette to token |
| storefront-runtime | 5.0/10 | Yes | Intentionally identity-less (correct design choice); storefront font aliases don't load different fonts; no DS component adoption (theme-driven) | Verify storefront font alias loading; document blank-slate design intent formally |
| platform-console | 6.0/10 | Yes | Accidental visual identity (defers to defaults); dark background `rgb(10 10 10)` diverges from canonical ink-950; byte-for-byte identical CSS to ops-portal | Replace hardcoded dark bg with `var(--lb-color-bg)` (30 min); differentiate visual identity from ops-portal |
| platform-operations-portal | 6.0/10 | Yes | Copy of platform-console CSS with no differentiation; same dark background divergence; no distinct visual identity for ops vs. super-admin | Standardise dark bg (30 min); establish visual differentiation from console (header accent, nav label) |
| app-marketplace (frozen) | 7.0/10 | No | Redundant inline token redeclarations; wrong dark background `rgb(10 15 26)` (not ink-950); frozen — not a production risk today | Address as part of freeze-exit consolidation planning |
| developer-portal (frozen) | 7.0/10 | No | `surface="marketplace"` is semantically wrong for developer documentation context; minimal dependency footprint | Update to `surface="developer"` (new surface type) on unfreeze |
| theme-marketplace (frozen) | 8.0/10 | No | Fully disconnected from `--lb-*` token system; owns complete parallel token set; own indigo/rose/3-accent visual system | Assess consolidation vs. token bridge on unfreeze; highest remediation effort of frozen trio |
| mobile/merchant-app | N/A* | Yes | Flutter dark palette uses gray/slate (`#111827`) instead of ink-violet (`#0a0912`); 3+ meaningful web/Flutter dark parity gaps | Fix `generate-mobile-tokens.mjs` mapping (2 hrs + device review) |

*Flutter app; native design maturity score not directly comparable to web 0–10 scale.

---

# PART 2: LETBUYY DESIGN PHILOSOPHY

## 2.1: What LetBuyy Is as a Design Problem

LetBuyy is not a single product. It is five distinct product surfaces, each serving a different user population with fundamentally different cognitive modes, trust relationships, and design language requirements. The error is to treat these as five "themes" of the same interface. They are structurally different design problems that share a token system.

**Prospective merchants at letbuyy.com** are in an evaluation mode. They are scanning for credibility signals, pricing clarity, and differentiation from Shopify, WooCommerce, and domestic Indian platforms. The marketing site (marketing-site) serves them with bold typography, generous whitespace, scroll-driven animation (GSAP 3.14, Framer Motion 12, Lenis smooth scroll), gradient-heavy visual storytelling, and aspirational brand language. They need to feel that LetBuyy is modern, premium, and worth a credit card. Every design decision is a conversion decision. Information density is low by intent — friction is the enemy.

**New merchants during onboarding** are in a high-anxiety transition mode. They are committing to a platform, entering personal and business information, creating credentials, and making decisions (store type, subdomain) that will define their identity on the platform. The identity platform (identity-platform) serves them with a single-focus card UI at 380–420px, minimal distractions, clear progress signalling, and an "ink lavender" premium palette that communicates trust without corporate coldness. The auth flow handles OTP inputs, OAuth consent screens, and store-creation confirmation. Every screen must be mobile-first: a merchant signing up on their phone in Tier 2 India with a 4G connection is the primary user, not a desktop user in a WeWork. Information density is intentionally minimal — one task per screen.

**Operating merchants in the dashboard** are in a work mode. They are processing orders at 7 AM, resolving inventory discrepancies, configuring GST tax rules, reviewing customer feedback, and making decisions about their business. The merchant control plane (merchant-control-plane) serves them with a data-dense, keyboard-navigable, sidebar-anchored workspace. The design language prioritises legibility, hierarchy, and efficiency over aesthetics. Notification panels, command palette, multi-panel editors, and site-type-adaptive navigation (5 navigation configurations for store/portfolio/resume/landing/blog site types) are all part of the working environment. Information density is high by requirement — a merchant's job is to handle complexity, not to be shielded from it.

**End customers at merchant storefronts** are in a shopping mode. They are browsing products, adding items to a cart, and completing a purchase. They have no relationship with LetBuyy as a brand — they have a relationship with the merchant's store. The storefront runtime (storefront-runtime) serves them with a deliberately identity-less rendering engine: the visual language belongs entirely to the merchant's chosen theme. The platform's design contribution is structural (page patterns, checkout flow UX, customer account layout) and invisible (Liquid/React hybrid rendering, performance, Razorpay/COD/PayPal payment integration). This is a correct design decision for a multi-tenant platform. Any LetBuyy branding on a merchant storefront is a UX failure.

**LetBuyy operators and team members** are in an oversight and intervention mode. Founders and engineers at console.letbuyy.com (platform-console) need cross-merchant visibility: KPIs, risk signals, compliance escalations, ledger reconciliation, audit logs. Operations staff at ops.letbuyy.com (platform-operations-portal) need workflow-oriented interfaces: support ticket queues, CRM pipelines, merchant health scorecards, onboarding queues, campaign tools. Both populations need dark, dense, tool-like UIs that communicate operational authority and data fidelity. The design language is forced-dark, information-maximising, and deliberately unconsumer — these are professional instruments, not consumer products.

These five populations require five different design treatments because their cognitive modes differ structurally. A merchant dashboard that looks like a marketing site wastes the merchant's time and dilutes their trust in the tool. A marketing site that looks like a merchant dashboard alienates prospective users who haven't yet decided to commit. The design system's role is to provide a shared vocabulary — tokens, components, layout primitives — while the surface model provides the boundary that keeps each surface appropriate for its context.

---

## 2.2: The Platform Ecosystem Principle

The guiding principle of LetBuyy's design architecture is: **consistency within products, governance across**. These are not the same thing, and conflating them is a design governance failure.

Within merchant-control-plane, every page should feel like it was built by the same team on the same system: sidebar layout, `AppNavigation` shell, `AdminShell` frame, `@letbuyy/ui` components for all primitives, `--lb-*` tokens for all values. A merchant switching from `/[store]/products` to `/[store]/settings/shipping` should experience seamless continuity. The design consistency goal within a single product is 10/10: no divergence, no surprises, no page that feels like it escaped from a different app.

Across products, the goal is not visual sameness — it is governed identity. identity-platform and merchant-control-plane should feel related but distinct. The auth card is single-column, mobile-first, minimal. The dashboard is full-width, data-dense, navigated. They share the ink-lavender palette and the Geist Sans typeface. They do not share the layout, the information density, or the navigation model. This distinction is correct by design. A user who moves from `accounts.letbuyy.com` to `admin.letbuyy.com` after store creation should feel a continuity of brand (same colours, same quality signal) but a meaningful change of mode (from guided flow to open workspace). That transition is a design success. A user who moves from `letbuyy.com` to `accounts.letbuyy.com` should experience a step-down in visual richness (marketing animations → focused auth card) that feels like entering a more serious context — not a jarring brand break.

The ink-lavender finding is the clearest evidence that this ecosystem principle is already working implicitly — and needs to be formalised explicitly. Three separate engineering teams independently chose the same premium palette: light `rgb(250 249 255)`, dark `rgb(10 9 18)`, purple-tinted borders. None of them were executing against a formal cross-app colour spec. They were executing against a shared aesthetic intuition that is consistent across the merchant-facing surface layer (marketing, auth, dashboard). This is remarkable. It is also fragile: any change to any one of those three globals.css files is a unilateral deviation from the de facto standard. The fix is to codify what already exists: `--lb-color-bg-premium` in the token system, adopted by all three apps, protected by the ratchet.

The counter-case is the two internal operator tools. platform-console and platform-operations-portal have byte-for-byte identical CSS and visually indistinguishable interfaces. This is not cross-app consistency — it is the absence of intentional identity. A super-admin at the console and an operations staff member in the ops portal are in different roles with different authorities and different workflows. The design should reinforce that distinction: a header accent colour, a navigation label, a subtle difference in the shell background. Not different tokens — different token values. This is the difference between accidental sameness (current state) and intentional differentiation (design goal). The platform ecosystem principle requires both: maintaining the ink-lavender coherence where it matters (merchant-facing) and establishing intentional differentiation where users need to understand which tool they're in (operator tier).

---

## 2.3: The Four-Layer Design Architecture

LetBuyy's design architecture is a four-layer stack. Each layer has a defined owner, a defined scope, and a defined change-control threshold. Understanding the layers is prerequisite to understanding why some changes require ARB approval and others do not.

**Layer 0: Global Foundation**
The global foundation consists of primitive tokens (raw values: specific `rgb()` colours, px values, ms values), the Tailwind v4 bridge (which maps these to utility classes), the CSS custom property emission layer (`letbuyy-tokens.css`), the DTCG JSON interchange file, the Flutter/Dart mirror, the ESLint rules, and the ratchet validator. Layer 0 is owned by the Design System team and the platform engineering leads. Every change to Layer 0 requires ARB review because a change to `ink.950`'s raw value propagates to every surface that uses `--lb-color-bg` — which is every active app. Layer 0 changes are also the only changes that affect the Flutter mobile app via the token generation pipeline. The 4-tier token hierarchy (Primitive → Semantic → Component → Density) lives at this layer. The Primitive tier is the most change-controlled: raw hex values that feed into Semantic tier aliases. The Semantic tier maps function to primitive (e.g., `--lb-color-bg → ink.950`). The Component tier scopes tokens to specific component contexts. The Density tier emits the 25 density-responsive variables across the 3 presets (compact/comfortable/spacious).

**Layer 1: Shared Interaction Library**
The shared interaction library is `packages/typescript/ui` — `@letbuyy/ui`. It contains all 50+ exported React components, the ThemeProvider system, the 5 surface types, and the governance stories. Layer 1 is owned by the Design System team with contributions from product teams via governed PR process. New component additions require design review and must not introduce raw values that bypass Layer 0 tokens. Changes to existing component APIs require a migration path (codemod or deprecation notice). Breaking changes require ARB approval. The 7 codemods live at this layer — they are the migration infrastructure that allows Layer 1 to evolve without stranding product teams on old APIs. `@letbuyy/ui` is the single source of truth for what a governed LetBuyy component looks like; any component that exists in product code and not in `@letbuyy/ui` is either a promotion candidate or a violation.

**Layer 2: Product Design Systems**
Each active product surface has its own design system at Layer 2: merchant-control-plane's admin surface, identity-platform's identity surface, marketing-site's marketing surface (currently using the incorrect `storefront` value), storefront-runtime's storefront surface, and the shared `operations` surface for the two internal tools. Layer 2 is owned by the respective product teams. Product teams can extend Layer 1 components with product-specific compositions and can define product-scoped CSS (e.g., identity-platform's `.auth-card`, `.onboard-bento-grid`, `.select-store-item` custom classes) without ARB approval, provided they reference `--lb-*` tokens for all values and do not introduce new raw primitives. Product-team changes to Layer 2 that would affect cross-product visual coherence (e.g., changing the ink-lavender palette) require Design System team review. Layer 2 is where the Surface model operates: `surface="admin"` in ThemeProvider tells the token system to apply admin-specific overrides within the `--lb-*` namespace.

**Layer 3: Tenant Customisation**
The tenant customisation layer is the `createLetbuyyBrandVariables` API — the mechanism by which merchants apply their own brand palette to their storefronts without breaking platform guarantees. Layer 3 operates exclusively within storefront-runtime and is constrained by WCAG contrast validation. A merchant cannot set `--lb-color-primary` to a value that fails AA contrast against the default button text colour. Layer 3 is owned by the merchant (within platform-enforced guardrails). No Layer 3 change can affect any other layer. Layer 3 values are scoped to the tenant's storefront instance and do not propagate to merchant-control-plane, identity-platform, or any other surface. The theme engine's Liquid/React hybrid rendering and the theme preset system operate at this layer. Changes to the Layer 3 API contract (new override-able variables, WCAG threshold changes) require ARB review.

---

## 2.4: Intentional vs Accidental Identity

The audit findings establish a clear taxonomy of visual identity across the platform. Drawing this line accurately is necessary for prioritising remediation work: intentional identity is to be protected and formalised; accidental identity is to be examined and either ratified or corrected.

**Intentional identity — the ink-lavender merchant-facing surface**: identity-platform, merchant-control-plane, and marketing-site share the ink-lavender palette, Geist Sans typeface, and quality aesthetic by design. Each is appropriate to its context and user population. identity-platform's single-focus auth card (380–420px, mobile-first, centered, minimal) is the right treatment for an anxious user committing credentials. merchant-control-plane's full-screen dashboard (sidebar-left, header-top, data-dense tables, command palette) is the right treatment for an operating user managing a business. marketing-site's scroll-driven editorial layout (full-width sections, GSAP animations, Framer Motion, generous whitespace) is the right treatment for a prospective user evaluating a platform. The visual identity unifying all three — ink lavender, Geist, quality — is an intentional platform-level decision that predates any formal token codification. The recommended action is not to change it but to formalise it.

**Intentional identity — the storefront blank slate**: storefront-runtime has minimal LetBuyy design identity by explicit design intent. The platform serves multi-tenant storefronts where each merchant's brand is the primary identity. Any LetBuyy token colour leaking into a merchant storefront is a framework failure. The 5/10 consistency score for storefront-runtime is not a quality failure — it is evidence that the blank-slate design intent is working. The caveat is that the structural patterns (checkout flow UX, customer account pages, order tracking) should still exhibit internal consistency and use `@letbuyy/ui` structural primitives (layouts, spacing, interaction patterns) even if the visual values are entirely theme-driven.

**Accidental identity — the internal operator tools**: platform-console and platform-operations-portal scored 6/10 on consistency, forced dark, and share byte-for-byte identical CSS. These apps serve different audiences (super-admin vs. operations staff), different workflow types (governance/compliance vs. support/CRM), and different authority levels (MFA-required founder access vs. invite-based team access). They look identical today not because someone decided they should look identical, but because no one made an active decision about their visual differentiation. This is the archetypal accidental identity: the absence of intentional design choices expressed as visual sameness. The recommended action is to distinguish them with light but deliberate signals: a different header treatment (purple-tinted for console vs. neutral for ops-portal), a different nav label or icon set emphasis, a different footer or session indicator. The tokens to achieve this already exist in `@letbuyy/ui`'s `operations` surface — they just need to be applied with intent.

**Diverged without governance — the frozen apps**: app-marketplace, theme-marketplace, and developer-portal each developed their own visual identities during an active development phase and then were frozen before those identities were brought into alignment with the platform token system. app-marketplace uses a slate-neutral aesthetic with a wrong dark background (`rgb(10 15 26)`). theme-marketplace built a complete independent token system with indigo primary, 3-accent visual system, and rose dark text — fully disconnected from `--lb-*`. developer-portal uses `surface="marketplace"` for a documentation context that deserves a `developer` surface with teal-accent code documentation aesthetics. None of these are production regressions today because the apps are frozen. But each represents a known remediation scope that will be required when those apps are unfrozen. The design intelligence work done in this audit provides the baseline assessment that will anchor that remediation: what each frozen app currently looks like, what it should look like when aligned to the platform token system, and what the migration effort involves.

---

# PART 3: ECOSYSTEM MAP

---

## 1. merchant-control-plane

**Status:** Active — primary merchant workspace, production deploy target
**Runtime path:** `apps/merchant-control-plane` (port 9001, `admin.letbuyy.com`)
**Primary users:** Merchants — store owners and employees with scoped roles; the daily operational user
**Business domain:** All commerce sub-domains: products, orders, customers, marketing, content, online-store, settings, billing, payouts
**Visual personality:** "Ink lavender" dashboard — dark sidebar (`AdminShell`), header wayfinding, purple-tinted UI chrome, high information density, data-table-first
**Design maturity score:** 8.0/10 (highest of audited apps; most compliant with `@letbuyy/ui` adoption)
**Information density:** High — 143 routes, data-dense tables, multi-panel editors, command palette for power-user navigation

**Routes and Workflows**
The app exposes 143 routes (68 UI pages under `[store]/` + 75 internal API proxy routes). The primary route tree covers: Dashboard (`/[store]/dashboard`), Products (`/products`, `/products/new`, `/products/[productId]`, `/products/collections`, `/products/inventory`, `/products/purchase-orders`, `/products/transfers`, `/products/gift-cards`), Orders (`/orders`), Customers (`/customers`), Marketing (`/coupons`, `/reviews`), Content (`/pages`, `/posts`, `/comments`, `/gallery`, `/categories`), Online Store (`/online-store`, `/online-store/themes`, `/online-store/themes/[themeId]/editor`, `/online-store/preferences`), Money (`/settings/billing`, `/payouts`), Apps (`/apps`, `/apps/[installationId]`), and Settings (15 sub-routes including `/settings/payments`, `/settings/shipping`, `/settings/taxes`, `/settings/domains`, `/settings/security`, `/settings/users`). The site-type-adaptive system adds domain-specific routes: portfolio types get `/projects`, `/skills`, `/education`, `/certifications`, `/experience`; resume types get similar; landing page types get `/leads`, `/contact`.

The 5 primary workflows are: (1) Products — create, edit, publish products; manage collections, categories, inventory, purchase orders across all site types; (2) Orders — view, fulfil, and refund orders; manage abandoned checkouts; (3) Online Store — install and manage themes, live theme editor, store page management, storefront preferences; (4) Settings — configure shipping, taxes, Razorpay payment credentials, custom domains, team user management, 2FA/step-up security, billing plan; (5) Analytics and Marketing — revenue dashboard, coupon management, customer reviews, email campaign tooling.

**Layout Model**
Full-screen dashboard architecture. `AdminShell.tsx` is the master layout frame: sidebar left (persistent, site-type-adaptive, collapses to icon-only on mobile), `HeaderBar.tsx` top (notifications bell → `NotificationsPanel.tsx` drawer, user menu, store switcher), content area right (full remaining viewport). `AppNavigation` from `@letbuyy/ui` drives the sidebar with 5 navigation configurations keyed to site type (store / portfolio / resume / landing / blog). Keyboard shortcuts (`g-h` for dashboard, `g-o` for orders, `g-p` for products, etc.) plus `CommandPalette.tsx` provide power-user navigation. Page types include: list+detail (products, orders, customers — `DataTable` based), settings forms (multi-section vertical scroll), creation wizards (new product, new collection), dashboard (KPI cards + summary tables), and the full-screen theme editor (architecturally isolated, single route, no sidebar).

**Design System Integration**
Token adoption score: 7.5/10. `@letbuyy/ui` is the primary component source for all UI primitives — AppNavigation, Button, Input, Card, DataTable, Badge, Dialog, Toast, and all display primitives. No bespoke design system in globals.css — relies entirely on `--lb-*` tokens for all colour, spacing, radius, and typography values. Known violations: 127 arbitrary-radius instances predating the ratchet (cannot increase, must decrease), 6 active ratchet violations in named components (`NotificationsPanel.tsx`, `SettingsSearch.tsx`, `BackendNeededPane.tsx`, `EmbeddedAppBridgeClient.tsx`, `ProviderModeBadge.tsx`, `AdminShell.tsx`). The theme editor (`/themes/[themeId]/editor/page.tsx`) is the single worst-scoring file at 21/100, with 27 direct `lucide-react` imports bypassing `@letbuyy/ui` and ~50 `theme-os-*` CSS class names.

**Risk Assessment**
Primary design risk: the 6 active ratchet violations in named components are the most likely to be copied by other engineers, since they exist in the components that appear in every page shell (`AdminShell`, `HeaderBar`/notifications area). Secondary risk: the theme editor's `lucide-react` dependency drift — if the version diverges from `@letbuyy/ui`'s pinned Lucide version, icon sizes, stroke weights, or specific icon availability diverge silently. Tertiary risk: the 127 legacy radius violations are maintenance debt but not visual regressions; their risk is in the copy-pattern signal they send to engineers who inspect them. The `formatDiscount()` Rs. locale bug in the coupons page is a live P0 visible to merchants.

**Intelligence Notes**
merchant-control-plane is the most complex app in the ecosystem by route count (143) and component diversity. The 5-configuration adaptive navigation (`merchantNavigation.ts`) is architecturally sophisticated and well-executed — it scales from a 5-item minimal nav (landing page site type) to a 20+ item full commerce nav (store site type) without separate codebases. The app's benchmark pages for design system compliance are `customers/page.tsx` and `purchase-orders/page.tsx` — both scored highest on the consistency scorecard and serve as reference implementations for other engineers. The AI screen (`/[store]/ai`) and the KYC flow (mobile-app-initiated, surfaced via `/[store]/kyc`) are surface-adjacent features with no design debt findings in the audit, suggesting they were built after the ratchet was enforced.

---

## 2. identity-platform

**Status:** Active — production deploy target; the auth entry point for all merchant users
**Runtime path:** `apps/identity-platform` (port 9002, `accounts.letbuyy.com`)
**Primary users:** Merchants — new (signup/onboarding) and returning (login/session); OAuth2 clients (developer apps, marketplace integrations)
**Business domain:** Auth / Identity / Tenant provisioning / OAuth2 server
**Visual personality:** "Premium Ink Lavender" — single-focus centered card, 380–420px, mobile-first, trust-communicating, premium but minimal
**Design maturity score:** 6.3/10 (lowest of audited active apps; Token Adoption 4.5/10, Layout Consistency 4.0/10)
**Information density:** Low — one task per screen, distraction-minimising, guided flow

**Routes and Workflows**
38 routes/files: 13 UI pages, 18 API routes, 5 OAuth2/OIDC server endpoints plus JWKS and email triggers. UI pages: `/` (root redirect), `/login`, `/signup`, `/lookup`, `/check-email`, `/forgot-password`, `/reset-password`, `/set-password`, `/onboarding` (store type selection, subdomain picker), `/select` (multi-store switcher). Auth API routes span lookup, login, signup, logout, accounts listing, store listing, session management, OTP verification, magic link, password reset, store creation, and subdomain validation. OAuth2 server routes: `/oauth2/authorize`, `/oauth2/token`, `/oauth2/callback`, `/oauth2/logout`, `/oauth2/userinfo`, `/oauth2/consent`. OIDC: `/.well-known/openid-configuration`, `/.well-known/jwks.json`. Email triggers: `/api/email/store-creation-success`, `/api/email/store-creation-failure`.

The 5 primary workflows are: (1) New merchant signup — email → OTP verification → set password → store type selection (store/portfolio/resume/landing/blog) → subdomain pick → store creation (via `create-store` RPC) → redirect to merchant-control-plane; (2) Returning merchant login — email lookup → password or magic link → optional multi-store switcher (`/select`); (3) OAuth 2.0 authorisation — third-party app requests access → consent screen → token issuance; (4) Password reset — forgot → email send → reset link → set-password; (5) Multi-store switching — `select` screen lists all stores for the authenticated user session.

**Layout Model**
No persistent navigation — each page is a standalone card flow. The layout architecture is minimal card: centered `div`, 380–420px width, mobile-first breakpoints. The `.auth-card` CSS class is the core layout primitive. Custom component classes handle specific flow states: `.auth-otp-input` for 6-cell OTP entry, `.onboard-bento-grid` for store-type selection cards, `.onboard-bento-card` for individual type options, `.select-store-item` for the multi-store list, `.onboard-india-defaults` for the India-first defaults confirmation strip. There is no sidebar, no top navigation, no shell — deliberately. The page-level components (`AuthIcon.tsx`, `BrandLogo.tsx`, `OAuthBrandIcon.tsx`, `TurnstileWidget.tsx`) are thin wrappers around Cloudflare Turnstile, SVG sprites, and theme-aware logo switching.

**Design System Integration**
Token adoption score: 4.5/10. The component layer correctly imports `LetbuyyThemeProvider` and `ThemeScript` from `@letbuyy/ui`. The token layer is broken: the ~2,300-line `globals.css` defines 10+ parallel custom properties (`--bg`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--border`, `--input-bg`) with raw `rgb()` values that duplicate `--lb-*` equivalents without referencing them. Three specificity override blocks ("COMPACT AUTH FLOW POLISH") re-declare values at elevated cascade weight. The identity-platform does NOT use Tailwind utilities directly in components — instead using custom semantic classes (`.auth-btn`, `.auth-btn-primary`, `.auth-btn-oauth`) layered on top of the parallel custom property system. This architecture works but creates double maintenance: every canonical token change requires a manual update to globals.css, and there is no automated way to detect or prevent the drift.

**Risk Assessment**
The primary risk is token drift: as `--lb-color-*` values evolve for contrast compliance, dark mode calibration, or brand refresh, identity-platform's parallel system will silently diverge. The auth/onboarding flow is the merchant's first impression of LetBuyy quality; any visual drift between the auth card and the dashboard creates a brand discontinuity at the most critical moment in the merchant journey. Secondary risk: the three specificity override blocks create a maintenance mine field — any future engineer attempting to update the auth flow styles must understand a cascade precedence that is not obvious from the JSX. The specificity overrides are a technical symptom of the parallel property system; eliminating the parallel system eliminates the overrides.

**Intelligence Notes**
Despite the CSS architecture debt, the auth flow's visual output is coherent and high-quality. The ink-lavender palette is correctly implemented — it just exists as raw values rather than token references. The Turnstile CAPTCHA integration (`TurnstileWidget.tsx`) is a sophisticated, production-grade bot prevention implementation. The OAuth2/OIDC server implementation (ES256 JWT, JWKS endpoint, PKCE, consent screens) at this app's API layer is architecturally significant — it is the identity broker for the entire platform ecosystem, serving not just direct merchant login but also third-party developer OAuth flows. The design decisions in the auth flow (OTP 6-cell input, bento-grid store type selection, India defaults confirmation strip) are considered UX patterns that should be documented in the design constitution as reference implementations, not treated as technical debt.

---

## 3. marketing-site

**Status:** Active — primary public-facing marketing presence, production deploy target
**Runtime path:** `apps/marketing-site` (port 9006, `letbuyy.com`)
**Primary users:** Prospective merchants — evaluation mode, pre-signup, arrived via SEO or referral
**Business domain:** Growth / Marketing / SEO / Content / Pricing
**Visual personality:** Bold, aspirational, editorial — gradient systems, scroll-driven animation (GSAP + Framer Motion + Lenis), generous whitespace, platform-narrative visual storytelling
**Design maturity score:** 7.3/10 (Token Adoption 7.3/10, strong component usage, wrong surface assignment)
**Information density:** Low — marketing rhythm, section-by-section disclosure, conversion-optimised pacing

**Routes and Workflows**
21 routes: 7 UI pages plus resource hub sub-pages and 1 API route. Core marketing pages: `/` (homepage — hero, features, pricing, FAQ), `/pricing` (dedicated pricing page), `/create` (signup funnel landing), `/signup` (redirect to identity-platform). Resource hub: `/resources` (index), `/resources/[category]` (category listing), `/resources/[category]/[slug]` (article detail), `/resources/authors/[slug]` (author profile), `/resources/changelog`, `/resources/releases`, `/resources/newsletter`, `/resources/search`, `/resources/tag/[tag]`. Technical routes: `/resources/rss.xml`, `/resources/sitemap.xml`, `/robots.ts`, `/sitemap.ts`. API: `/api/founding-pricing` (founding-merchant pricing data endpoint).

The 5 primary workflows are: (1) Prospective merchant reads homepage → understands value proposition → clicks "Get started free" → redirected to identity-platform signup; (2) Pricing comparison → selects appropriate plan → redirected to signup; (3) Resources/blog browsing → reads articles, changelog, release notes for platform credibility; (4) Newsletter subscription (building pre-launch or retention list); (5) SEO serving — Organization, WebSite, and SoftwareApplication JSON-LD structured data for Google indexing.

**Layout Model**
Marketing editorial layout — top-navigation header (`Header.tsx`) + full-width content sections + footer (`Footer.tsx`). Standard marketing site pattern: sticky header with logo and CTA, hero section, feature sections (alternating layout directions), pricing section, FAQ accordion, footer. Section components: `Hero.tsx` (animated with GSAP/Framer Motion), `Features.tsx` (feature grid/cards), `Pricing.tsx` (pricing cards), `FAQ.tsx` (accordion). Platform narrative components (`CapabilityMap.tsx`, `CommerceNetwork.tsx`, `EcosystemMap.tsx`, `MerchantJourney.tsx`, `SiteTypes.tsx`, `TrustIndicators.tsx`, `PlatformDirectory.tsx`, `FinalCTA.tsx`) handle the visual storytelling of the homepage. Resource hub has its own component subdirectory for article cards, category browsing, and newsletter.

**Design System Integration**
Token adoption score: 7.3/10. `@letbuyy/ui` provides `LetbuyyThemeProvider`, `ThemeScript`, and shared-types helpers. The marketing site correctly maps `--lb-color-*` tokens to semantic marketing aliases in globals.css (`--primary`, `--accent`, `--bg-deep`, `--bg-card`, gradient definitions) — this is the correct direction (referencing tokens, not duplicating values). The Tailwind `@source` directive includes `@letbuyy/ui` package source for scan coverage. Known violation: `surface="storefront"` is incorrectly assigned; the marketing site should use `surface="marketing"` (once that surface is defined). The marketing site's own colour extensions (gradient systems, marketing-specific type scale) are product-appropriate extensions that do not violate the token system — they augment it.

**Risk Assessment**
The wrong surface assignment is a latent risk with zero current visual impact. If the `storefront` surface ever receives distinct token values for shopper-context aesthetics, the marketing site silently adopts those values. The gradient system and animation libraries (GSAP, Framer Motion, Lenis) introduce performance risk if not carefully code-split and lazy-loaded — this is a performance concern rather than a design system concern, but marketing conversion depends on perceived performance, making it design-adjacent. The resource hub (`/resources/*`) is a content-heavy section that requires consistent editorial design treatment; if the blog/article components diverge from the homepage design language over time, the resource hub becomes a visual sub-brand rather than part of the marketing site identity.

**Intelligence Notes**
The marketing site is the only active app that uses three separate animation libraries (GSAP, Framer Motion, and Lenis) simultaneously — a choice that reflects the aspirational visual ambition of the homepage but introduces non-trivial bundle complexity. The `HowItWorks.tsx` component was deleted in the current git status (listed as `D` in working tree), indicating an in-progress homepage redesign that simplifies the feature storytelling section. The structured data implementation (JSON-LD for Organization, WebSite, SoftwareApplication) is sophisticated and indicates active SEO investment. The `/api/founding-pricing` endpoint suggests a differentiated founding-merchant pricing tier with a server-authoritative pricing model — a commercial feature with UX implications for the pricing page design.

---

## 4. storefront-runtime

**Status:** Active — primary shopper-facing runtime, production deploy target
**Runtime path:** `apps/storefront-runtime` (port 9000, `{store}.letbuyy.com` and custom domains)
**Primary users:** Shoppers / end customers — purchasing from merchant stores; no awareness of LetBuyy as the underlying platform
**Business domain:** Storefront / Checkout / Customer account / Themes / Liquid rendering
**Visual personality:** Intentionally identity-less — visual identity belongs entirely to the active merchant theme; LetBuyy provides structure, not aesthetics
**Design maturity score:** 5/10 (intentionally; blank-slate design intent; structural patterns are correct)
**Information density:** Medium — product browsing is scannable-density; checkout is step-by-step low density; customer account is moderate

**Routes and Workflows**
66 routes: 46 UI pages/layouts + 23 API routes. Store routes: `/store/[subdomain]/` (home), `/store/[subdomain]/product/[productId]`, `/store/[subdomain]/products`, `/store/[subdomain]/collections/[slug]`, `/store/[subdomain]/cart`, `/store/[subdomain]/checkout` (and `/checkout/success`, `/checkout/paypal-return`). Customer account: `/store/[subdomain]/account` (hub), `/account/orders`, `/account/orders/[id]`, `/account/addresses`, `/account/settings`, `/account/wishlist`. Static pages: blog (`/blog/[slug]`), shop, privacy, terms, shipping, returns. Catch-all for Liquid/CMS pages: `/store/[subdomain]/[...path]`. Preview: `/preview` and `/preview/coming-soon`. Demo: `/demo/urban-kicks` (Urban Kicks Liquid theme — the first-class Liquid theme reference implementation). API: `/api/customer/*` (login, register, logout, profile, orders, addresses, wishlist, session, set-password, auto-create), `/api/orders/*`, `/api/reviews`, `/api/shipping/rates`, `/api/coupons/validate`, `/api/store-lookup`, `/api/themes/*`, `/api/seed`.

The 5 primary workflows are: (1) Browse → Cart → Checkout — the primary commerce journey: product browsing by collection or search → product detail with variant selection → add to cart → checkout (address → shipping method → payment via Razorpay/COD/PayPal) → order confirmation; (2) Customer account — login or register → order history → order tracking → address management → wishlist management; (3) Content consumption — blog post browsing and reading within the tenant's store; (4) Theme preview — `/preview` route receives context from merchant-control-plane theme editor for live preview rendering; (5) Demo rendering — `/demo/urban-kicks` serves the Urban Kicks Liquid theme as a public reference implementation.

**Layout Model**
Highly themed, per-store layout — every layout element is under theme control. No persistent LetBuyy sidebar or navigation shell. Storefront header and footer are rendered by the active theme's section components. Account section has sub-navigation (orders, addresses, settings, wishlist). The `layout/` component directory handles storefront chrome (header, footer, nav) and the `account/` directory handles the account hub and sub-pages. The `sections/` directory houses theme section components. The catch-all route (`[...path]`) handles Liquid/CMS page rendering, delegating to `@letbuyy/theme-engine` for Liquid template resolution. `src/proxy.ts` middleware routes subdomain requests to the correct tenant context — this is live Next.js middleware, not a static config.

**Design System Integration**
Token adoption: minimal at the app level — intentional. The storefront imports `letbuyy-tokens.css` and uses `LetbuyyThemeProvider surface="storefront"`. Beyond that, visual values are provided by the theme engine at runtime. Structural patterns (checkout form layout, order confirmation page, account page shell) use `@letbuyy/ui` structural primitives. Theme engine tokens can override `--lb-*` values within the storefront surface scope via the tenant brand override API (`createLetbuyyBrandVariables`). The Urban Kicks demo at `/demo/urban-kicks` is the most concrete reference for what a fully implemented Liquid theme looks like in the runtime.

**Risk Assessment**
The 5/10 design maturity score is not a risk — it is the correct score for a blank-slate renderer. The actual risks are: (1) storefront font aliases (`--storefront-font-heading`, `--storefront-font-body`) may not load different fonts from the web dashboard's Geist Sans, creating a cross-surface font consistency issue rather than per-store font diversity; (2) the Liquid canary (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`) means most stores are still on React rendering — any design issues in the React theme layer affect more merchants than Liquid issues; (3) the checkout UX is embedded in storefront-runtime rather than a dedicated checkout runtime, which constrains the ability to apply checkout-specific design governance independently.

**Intelligence Notes**
storefront-runtime is architecturally the most complex app in the ecosystem: it handles multi-tenant routing via middleware, two rendering modes (React default, Liquid canary), customer authentication with a separate HS256 issuer, embedded theme preview mode for the merchant theme editor, PayPal return handling, and a seed API for development. The `/demo/urban-kicks` route represents the completed vision for the Liquid theme experience and should be treated as the visual and UX reference for storefront design quality. The Framer Motion dependency at this layer introduces animation capability for theme transitions and page animations — legitimate in a customer-facing context where visual delight supports conversion.

---

## 5. platform-console

**Status:** Active — internal super-admin operator tool, production deploy target
**Runtime path:** `apps/platform-console` (port 9007, `console.letbuyy.com`)
**Primary users:** LetBuyy founders, engineering leads, platform administrators — MFA-required, highest-authority system access
**Business domain:** Platform governance / Revenue oversight / Trust and Safety / Compliance / Audit
**Visual personality:** Accidental — defers to `@letbuyy/ui` component defaults; forced-dark; unintentionally identical to platform-operations-portal; tool-like but without deliberate visual differentiation
**Design maturity score:** 6.0/10 (no bespoke design system, which is correct; but lacks intentional identity for its authority level)
**Information density:** High — cross-platform data tables, KPI aggregates, audit logs, risk queues

**Routes and Workflows**
34 routes: 22 UI pages + 6 API routes. Auth routes: `/(auth)/login`, `/(auth)/mfa` (MFA-required for all sessions). Dashboard routes: `/dashboard` (leadership KPI home), `/stores` (paginated table of all merchant stores), `/merchants/[id]` (Merchant 360 deep-dive), `/revenue` (platform revenue dashboard), `/money-reconciliation` (ledger reconciliation), `/subscriptions`, `/founding` (founding-merchant program), `/marketplace-governance` (app/theme review queue), `/risk` (risk detection), `/trust-safety` (trust and safety queue), `/analytics`, `/operations`, `/compliance`, `/users`, `/employees`, `/audit-logs`, `/settings`. API routes: `/api/console-auth/login`, `/api/console-auth/logout`, `/api/console-auth/callback`, `/api/console-auth/mfa`, `/api/founding/action`, `/api/founding/export`.

The 5 primary workflows are: (1) Monitor merchant health and platform KPIs — revenue, subscription counts, active stores, churn signals — via the leadership home dashboard; (2) Risk and Trust and Safety — review risk-detection alerts, act on trust/safety escalations (account suspensions, fraud investigations); (3) Ledger reconciliation — verify payment ledger balance and investigate money discrepancies (`/money-reconciliation`); (4) Marketplace governance — approve or reject app and theme submissions from `app-marketplace` and `theme-marketplace`; (5) Compliance and audit — browse immutable audit logs for compliance investigations and regulatory requirements.

**Layout Model**
Operator dashboard: `AppNavigation` sidebar (17-item flat list), always-dark theme via `ThemeScript defaultTheme="dark"`, `surface="operations"`, content area right. The sidebar provides flat navigation to all 17 dashboard sections. `ConsoleDataTable.tsx` is the primary UI primitive — a data table abstraction built on `@letbuyy/ui`'s data display primitives, with console-specific column configurations. The `_local-ui/` directory handles console-specific UI overrides. The `founding/` component directory contains founding program management components. No page-level sub-navigation beyond the sidebar.

**Design System Integration**
Token adoption: heavy use of `@letbuyy/ui` (AppNavigation, ThemeToggleButton, Button, data display primitives). `globals.css` imports `letbuyy-tokens.css` and adds `rgb(10 10 10)` as the dark background — diverging from canonical ink-950 (`rgb(10 9 18)`) by a small but non-zero amount. No bespoke design system, which is the correct approach for an internal tool. Known violation: the wrong dark background value (30-minute fix).

**Risk Assessment**
The primary design risk is identity confusion with platform-operations-portal — the two apps are visually indistinguishable, which creates a cognitive risk for operators who work in both. If an operations staff member opens the wrong app, the lack of visual differentiation means they may not notice immediately. In the context of console.letbuyy.com's MFA-gated super-admin authority, this is a real UX risk even if not a security risk. Secondary risk: the forced-dark theme with no option for system-default theming may cause visual fatigue for operators who work long sessions; a deliberate architectural reason for forced-dark (security context visual cue) should be documented in the design constitution if it is intentional.

**Intelligence Notes**
The `/money-reconciliation` route is architecturally significant — it is the visual surface for the platform's most security-sensitive operation (verifying ledger integrity). Its design should communicate authority and precision, not just data density. The `/marketplace-governance` route gives console operators direct control over what appears in the frozen app-marketplace and theme-marketplace — making this route the de facto governance interface for those frozen surfaces until they are unfrozen and their governance flows are integrated into a production path. The `founding/` component directory and `/api/founding/export` API suggest a structured founding-merchant program with data export capability — a commercial program with its own UX considerations that deserve documentation in the design constitution.

---

## 6. platform-operations-portal

**Status:** Active — internal team operations tool, production deploy target
**Runtime path:** `apps/platform-operations-portal` (port 9008, `ops.letbuyy.com`)
**Primary users:** LetBuyy operations staff, customer success team, support agents — invite-only, workflow-oriented
**Business domain:** Merchant success / Customer support / CRM / Retention / Marketing operations
**Visual personality:** Accidental copy of platform-console — visually indistinguishable; same forced-dark, same sidebar approach, no deliberate differentiation for its distinct operational context
**Design maturity score:** 6.0/10 (same as platform-console; both suffer from accidental rather than intentional identity)
**Information density:** High — queue management, data tables, merchant health scorecards, CRM pipeline views

**Routes and Workflows**
27 routes: 20 UI pages, no dedicated API routes (all data proxied through api-gateway). Auth routes: `/(auth)/login`, `/(auth)/invite`. Dashboard routes: `/` (team home), `/crm` (CRM contact list), `/tickets` (support tickets), `/support` (support queue), `/merchant-health` (health scoreboard), `/risk`, `/trust-safety`, `/developers` (developer 360 view), `/retention`, `/campaigns`, `/communications`, `/onboarding` (merchant onboarding queue), `/operations` (review queue hub), `/operations/onboarding`, `/operations/communications`, `/stores` (store browser), `/users`, `/marketing`.

The 5 primary workflows are: (1) Support ticket handling — `/tickets` and `/support` queue, triage and resolve merchant support issues; (2) CRM pipeline management — `/crm`, track merchant contacts, outreach history, relationship status; (3) Merchant health monitoring — `/merchant-health` scoreboard, identify at-risk merchants and initiate intervention actions; (4) Merchant onboarding management — `/onboarding` queue, guide new merchants through setup and activation; (5) Communication and campaign operations — `/communications` and `/campaigns`, configure and send merchant communications, run retention campaigns.

**Layout Model**
Operator dashboard — `AppNavigation` sidebar (12-item list via `AppNavigation`), always-dark theme (`ThemeScript defaultTheme="dark"`), `surface="operations"`, content area right. Structurally identical to platform-console. The `_local-ui/` directory contains ops-portal-specific UI overrides. Unlike platform-console, this app has no dedicated API routes — all data access is proxied through `services/api-gateway`, making it a pure UI layer over the API gateway.

**Design System Integration**
Token adoption: same profile as platform-console — heavy `@letbuyy/ui` usage, `letbuyy-tokens.css` import, wrong dark background `rgb(10 10 10)`. `@letbuyy/ui` provides AppNavigation, ThemeToggleButton, MaterialIcon, and all UI primitives. The `MaterialIcon` usage (distinct from Lucide) is the only notable UI library divergence from merchant-control-plane's Lucide-heavy approach — an acceptable difference given the operational context. No bespoke design system. CSS is byte-for-byte identical to platform-console's globals.css beyond import statements.

**Risk Assessment**
The primary risk is the same as platform-console: identity confusion between the two operator tools. An ops staff member at ops.letbuyy.com and a founder at console.letbuyy.com see the same visual environment despite operating in fundamentally different authority contexts. Additionally, the ops-portal's `/risk` and `/trust-safety` routes duplicate routes that also exist in platform-console — the operational and governance concerns across these two apps overlap at the route level, which may indicate a consolidation decision is needed. The invite-based auth (`/(auth)/invite`) requires UX treatment for first-time login with an invite token — a specialised auth flow that should be documented alongside identity-platform's flows in the design constitution.

**Intelligence Notes**
The presence of a `/developers` route (Developer 360 view) is notable in a merchant success tool — it suggests the ops team has visibility into external developer activity (API key usage, app submissions, OAuth authorisations) as part of their merchant success workflow. This is an interesting cross-domain surface that connects merchant success, developer relations, and the frozen developer-portal's data. The `/retention` and `/campaigns` routes represent a marketing operations capability that, combined with the `/crm` and `/merchant-health` routes, makes this app the closest thing LetBuyy has to an internal Intercom or HubSpot for merchant relationship management.

---

## 7. app-marketplace (Frozen)

**Status:** Frozen — not a production deploy target; pending consolidation per CLAUDE.md
**Runtime path:** `apps/app-marketplace` (port 9003)
**Primary users:** Merchants (browsing/installing apps), third-party app developers (submitting apps), platform moderators
**Business domain:** App ecosystem / Partner platform / Developer integrations
**Visual personality:** Slate-neutral marketplace aesthetic — no purple tinting, clean catalogue layout, no ink-lavender; diverges intentionally from the merchant-facing identity
**Design maturity score:** 7.0/10 (comprehensive token redeclaration; structurally complete; wrong dark background; frozen)
**Information density:** Medium — catalogue grid browsing, app detail pages with screenshots, developer dashboard

**Routes and Workflows**
40 routes: 27 UI pages + 10 API routes. Public: `/` (home), `/apps/[slug]` (app detail), `/categories`, `/categories/[slug]`, `/collections/[slug]`, `/partners`, `/search`, `/stories/[slug]`. Authenticated merchant: `/my-apps` (installed apps dashboard), `/developers/dashboard`, `/developers/apps/new`, `/developers/register`. Developer tools: `/developers/docs/[topic]`, `/developers/review-requirements`. Moderation: `/moderation/reviews`. API: `/api/apps`, `/api/apps/[id]` (CRUD), `/api/apps/[id]/install`, `/api/apps/[id]/reviews`, `/api/apps/search`, `/api/developers`, `/api/developers/apps`, `/api/developers/register`.

The 5 primary workflows are: (1) Merchant browses/searches catalogue → reads app detail → installs app into store; (2) Merchant manages installed apps (`/my-apps` dashboard, spending controls, demo sessions); (3) Third-party developer registers, creates app listing, submits for review; (4) Platform moderator (via platform-console `/marketplace-governance`) reviews and approves/rejects submissions; (5) Editorial collection and partner story browsing.

**Layout Model**
Marketplace / catalogue layout: top navigation (`Header.tsx`) + footer, category/collection nav for browsing. Grid-based catalogue layout with search and filter. 36+ components: `AppCard.tsx`, `AppDetailParity.tsx`, `InstalledAppsGrid.tsx`, `ScreenshotGallery.tsx`, `StarRating.tsx`, `QualityBadge.tsx`, `PricingTag.tsx`, install/consent/billing panels (`AppInstallConsentPanel.tsx`, `AppBillingChargePanel.tsx`, `AppSpendControlPanel.tsx`), developer tooling (`ApiKeyPanel.tsx`, `DeveloperWebhookManager.tsx`, `DeveloperAnalyticsChart.tsx`, etc.), moderation tools (`ReviewModerationActions.tsx`, `ReportActionButton.tsx`), and marketplace chrome (`MarketplaceCollectionSections.tsx`, `MarketplaceEditorial.tsx`, `CategoryGrid.tsx`).

**Design System Integration**
Token adoption: comprehensive inline token redeclaration — the most thorough token coverage of the frozen apps, though implemented as inline redeclarations rather than consuming `--lb-*` directly. Uses `surface="marketplace"`. Background flash prevention via `dangerouslySetInnerHTML` style (bespoke solution, not using `ThemeScript`). Known violation: dark background `rgb(10 15 26)` — blue-shifted, not the canonical ink-950. Structured data: Organization, WebSite, and CollectionPage JSON-LD. The `appstore-shell` root class is a custom shell identifier not present in other apps.

**Risk Assessment**
Frozen status means these risks are not active production concerns, but they are consolidation blockers. The `AppBillingChargePanel.tsx` and `AppSpendControlPanel.tsx` components handle billing interactions that must align with the canonical ledger-only payment model if they are ever promoted to production. The install flow (`/api/apps/[id]/install`) requires verified integration with `services/api-gateway` and the tenant ownership model. The developer registration flow has its own auth path that must integrate with identity-platform's OAuth2 server on unfreezing. The 36+ component library is the largest component count of any frozen app and represents significant consolidation work.

**Intelligence Notes**
The app-marketplace has the richest component set of any frozen app — 36+ components covering catalogue browsing, app installation, developer tooling, and moderation, all at a level of completeness suggesting significant engineering investment before the freeze decision. The `SandboxStorePanel.tsx` and `CollaboratorCodePanel.tsx` components suggest a developer program with sandbox environments and team collaboration features — capabilities not yet available in the active merchant-control-plane apps section. If the consolidation decision is to merge these capabilities into merchant-control-plane's `/[store]/apps` section, the component library is a strong starting point, but the visual redesign to ink-lavender/admin surface styling will require deliberate migration work.

---

## 8. developer-portal (Frozen)

**Status:** Frozen — not a production deploy target; pending consolidation per CLAUDE.md
**Runtime path:** `apps/developer-portal` (port 9004)
**Primary users:** Third-party developers building integrations, app developers, theme developers
**Business domain:** Developer platform / API documentation / Partner ecosystem
**Visual personality:** Teal accent system, docs aesthetic — code-heavy, information-dense; designed for technical readers not consumers
**Design maturity score:** 7.0/10 (minimal dependency footprint; `surface="marketplace"` is semantically wrong for developer docs)
**Information density:** Medium — documentation-style content, code samples, developer dashboards

**Routes and Workflows**
10 routes (minimal for a developer portal): 8 UI pages. Routes: `/` (home), `/dashboard` (developer dashboard), `/docs` (documentation index), `/api-reference` (API reference), `/api` (API overview), `/webhooks` (webhook guide), `/sdk` (SDK overview, singular), `/sdks` (SDK listing, plural — both exist), `/oauth` (OAuth integration guide).

The 5 primary workflows are: (1) Developer reads API reference and authentication guide; (2) Developer sets up OAuth2 integration using the OAuth guide and identity-platform's OIDC endpoints; (3) Developer configures webhooks and manages endpoint registrations; (4) Developer downloads or browses available SDKs; (5) Developer views personal dashboard — API key management, usage metrics (all data from api-gateway).

**Layout Model**
Developer documentation portal — `PortalChrome.tsx` wrapper with sidebar/topbar navigation. Compact density (`density="compact"`) is the correct choice for code-documentation readability. The `developer-shell` class identifies the root container. The `_local-ui/` directory handles portal-specific overrides. An `anonymous-preview-shell.tsx` wrapper handles unauthenticated preview states. The `auth-provider.tsx` manages client-side auth state for the dashboard section. Carried-over components from theme-marketplace adjacency (thematic/action components) represent technical debt from a shared codebase phase.

**Design System Integration**
Token adoption: thin — minimal dependency footprint is the correct approach for a documentation portal that should prioritise readability. `@letbuyy/ui` is the only external UI dependency (`LetbuyyThemeProvider`, `ThemeScript`). Surface is incorrectly set to `surface="marketplace"` — developer documentation is categorically different from marketplace browsing. A `developer` surface type would allow code-documentation-specific token overrides (monospace font weighting, code block colours, terminal-style backgrounds) without affecting the marketplace surface.

**Risk Assessment**
Frozen status reduces immediate risk. The most significant architectural issue is the duplicate routes (`/sdk` and `/sdks`) suggesting an unresolved naming decision made before the freeze. The lack of live API integration (documentation-only, per topology) means the developer dashboard (`/dashboard`) serves static or cached data rather than real-time API key usage — a developer experience gap that would need to be addressed on unfreeze. The `policy-draft-page.tsx` component suggests legal content (terms, privacy for developers) that was in draft state at freeze time.

**Intelligence Notes**
The developer-portal is the most architecturally minimal of the frozen apps — 10 routes, 8 pages, a single external dependency (`@letbuyy/ui`). This minimalism is a consolidation advantage: the content-based documentation flows could be migrated to a static site generator (Docusaurus, Nextra) or incorporated as a `/developers/*` section within an active app with minimal UI adaptation work. The teal accent system was a deliberate aesthetic departure from the ink-lavender merchant surface — a reasonable choice for a developer tool. If the consolidation decision targets the developer portal, the teal accent would need to either be formalised as a `developer` surface token or abandoned in favour of the platform ink-lavender aesthetic.

---

## 9. theme-marketplace (Frozen)

**Status:** Frozen — not a production deploy target; pending consolidation per CLAUDE.md
**Runtime path:** `apps/theme-marketplace` (port 9005)
**Primary users:** Merchants (browsing/purchasing/installing themes), theme developers (submitting theme listings)
**Business domain:** Theme ecosystem / Design marketplace
**Visual personality:** Strongly intentional — own indigo primary, 3-accent system, rose dark text, visual-first grid gallery; the most differentiated visual identity of the frozen apps
**Design maturity score:** 8.0/10 (visual coherence is high; but fully disconnected from `--lb-*` token system — highest remediation effort)
**Information density:** Medium — visual theme gallery, theme detail pages, buyer dashboard

**Routes and Workflows**
37 routes: 30 UI pages + 4 API routes. Public: `/` (home), `/themes` (catalogue), `/themes/[slug]` (theme detail), `/themes/category/[category]`, `/themes/compare` (side-by-side comparison), `/collections/[slug]`, `/authors/[handle]`, `/about`, `/contact`, `/support`, `/install`, `/pricing`. Preview: `/preview/[token]` — store-scoped theme preview (architecturally significant: preview must accurately render within a merchant's store context). Legal: `/legal/terms`, `/legal/privacy`, `/legal/license`, `/legal/refund`. Auth: `/auth/callback`. Buyer dashboard: `/dashboard` (hub), `/dashboard/downloads`, `/dashboard/favorites`, `/dashboard/installations`, `/dashboard/purchases`, `/dashboard/settings`. Developer: `/developer`, `/developer/listings/new`. Documentation: `/docs`, `/docs/api`. Checkout: `/checkout`, `/checkout/success`. API: `/api/themes`, `/api/themes/[slug]`.

The 5 primary workflows are: (1) Merchant browses theme catalogue → previews theme in their own store context via `/preview/[token]` → purchases and installs; (2) Merchant manages purchased themes (dashboard: downloads, favorites, installations, purchases); (3) Theme developer submits new theme listing via `/developer/listings/new`; (4) Side-by-side theme comparison (`/themes/compare`); (5) Category-based theme browsing by industry vertical.

**Layout Model**
Marketplace with buyer dashboard: top navigation (`Navbar` component with server-side auth session check in root layout) + footer. `min-h-screen flex flex-col` body. Content padded `pt-[72px]` for fixed navbar. `ToastProvider` in root. 19+ components: `theme-card.tsx`, `theme-detail-experience.tsx`, `theme-category-landing.tsx`, `theme-compare-selection.tsx`, `theme-favorites-list.tsx`, `theme-preference-actions.tsx`, `theme-action-feedback.tsx`, `theme-share-button.tsx`, `theme-upload-panel.tsx`. Auth state is checked server-side in root layout via session cookie + `ThemeService.getSessionUser()` — a pattern distinct from the client-side auth-provider pattern used in developer-portal.

**Design System Integration**
Token adoption: none — theme-marketplace built its own complete token system, fully disconnected from `--lb-*`. Uses `surface="marketplace"` but overrides it entirely. The own token system includes: indigo primary, 3-accent visual system, rose dark text, its own dark background (`rgb(15 15 26)` — a slightly lighter blue-shifted dark than app-marketplace's `rgb(10 15 26)`). This is the most extreme case of token divergence in the frozen tier. The visual output is high-quality and internally coherent; it simply shares no token lineage with the active platform design system.

**Risk Assessment**
Frozen status contains the risk. On unfreeze, this app requires the most extensive token migration of the frozen trio: every visual value must be mapped to a `--lb-*` equivalent or a new token must be added to the design system. The indigo primary is compatible with the ink-lavender aesthetic and could map to `--lb-color-primary`; the rose dark text is a more significant departure that would need either a dedicated semantic token or reconsideration. The `/preview/[token]` route is the most architecturally complex in the frozen apps — it must render a merchant's storefront with a specific theme applied, requiring integration with `storefront-runtime`'s theme engine and the token override API. This preview capability is the closest functional equivalent to merchant-control-plane's theme editor preview mode.

**Intelligence Notes**
The theme-marketplace is the frozen app with the most complete, intentional visual identity — it was clearly developed as a consumer-facing marketplace with significant design investment. The buyer dashboard (downloads, favorites, installations, purchases) represents a feature set that the active merchant-control-plane themes section does not yet have: a purchase history and license management UI. The server-side auth session check in root layout (using session cookie + `ThemeService.getSessionUser()`) is an architecture pattern distinct from the other frozen apps and suggests a session management approach that integrates more tightly with the identity-platform's identity-platform session cookie than the pure OAuth2 flow. The checkout route (`/checkout`, `/checkout/success`) is a separate checkout flow for paid theme purchases — a canonical money-handling path that must use the ledger RPC pattern on unfreeze.

---

## 10. mobile/merchant-app

**Status:** Active — deployed to iOS App Store and Google Play
**Runtime path:** `apps/mobile/merchant-app` (Flutter, Dart SDK ^3.10.0)
**Primary users:** Merchants on mobile devices — same user population as merchant-control-plane, different device context
**Business domain:** Merchant operations — mobile-native counterpart to merchant-control-plane
**Visual personality:** Material Design with LetBuyy theming — native mobile patterns (bottom tab bar, stack navigation, native form inputs), mirroring merchant-control-plane's ink-lavender identity through Flutter token generation
**Design maturity score:** N/A (Flutter native; token mirror with 3+ dark palette parity gaps vs. web)
**Information density:** Medium — mobile-optimised tables, metric cards, native forms; lower density than web dashboard by necessity

**Routes and Workflows**
50+ screens across 27 screen directories. Auth: login, OTP, Turnstile, error. Dashboard: home screen with metrics overview. Orders: list, detail, returns. Products: list, form, collections, import. Inventory: locations, purchase orders, suppliers, transfers. Customers: list, detail. Discounts: coupons list/form, gift cards. Marketing: email campaigns, leads, reviews. Content: blog posts, pages, media library, navigation. Customize: theme management, theme versions. Editor: section editor for theme sections. Analytics: analytics dashboard. Settings: billing, custom data, notifications, security, shipping, taxes, team. Security: 2FA enrollment. KYC: identity verification. Money: payouts and billing. Apps: installed apps list, app WebView bridge runtime. Preview: live storefront preview. Wizard: store setup wizard. Subscription: plan upgrade flow. AI: AI assistant screen.

The 5 primary workflows are: (1) Real-time order notifications → view, process, and manage orders on mobile (the highest-frequency use case for the mobile app vs. web); (2) Product management — add/edit products with camera image upload, manage inventory on-device; (3) Dashboard monitoring — revenue, orders, and visitor metrics in a glanceable home screen format; (4) Discount and gift card management on-the-go; (5) Live store preview from mobile — see storefront changes rendered in real-time.

**Layout Model**
Native mobile — bottom tab bar for primary navigation (Dashboard, Orders, Products, Marketing, Settings). Stack navigation within sections. Role gate at app entry level (before any content loads). `webview_flutter` provides the embedded WebView for the app bridge runtime — apps installed from app-marketplace that provide a web-based configuration UI are surfaced in a native WebView wrapper. `hive_flutter` handles local storage. The home-screen widget (Android) provides metrics without opening the app. Bottom tab bar + stack pattern mirrors standard Material Design mobile navigation conventions rather than adapting merchant-control-plane's sidebar model.

**Design System Integration**
The mobile app connects to `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart` via the token generation pipeline (`scripts/generators/generate-mobile-tokens.mjs`). Known parity gaps: dark background uses `gray900 = #111827` instead of `ink.950 = #0a0912`; dark border uses `slate700 = #334155` instead of `rgba(139,92,246,0.18)`; `surfaceDark`/`cardDark` values diverge similarly. The generation script passes CI validation but the source mapping for ink-palette values is incorrect. FontAwesome (`font_awesome_flutter`) is the icon system — distinct from the web apps' Lucide React icons — which is architecturally appropriate for native mobile but means icon visual language is not shared across web and mobile.

**Risk Assessment**
The dark palette parity gap is a brand consistency risk: a merchant who switches between the iOS merchant app and the web dashboard in dark mode sees two different dark backgrounds. For a platform whose ink-lavender dark identity is a carefully designed distinguishing characteristic, this cross-platform inconsistency undermines the quality signal that the dark palette is designed to convey. The gap also affects dark border rendering and card surface colours. The generation script fix is 2 hours plus device visual review — the effort is low, the impact is meaningful, and it is a quick win that should be included in Phase 1 of the migration roadmap alongside the web quick wins.

**Intelligence Notes**
The WebView app bridge runtime (`apps/` screens) is architecturally significant: it means third-party apps from the app-marketplace can surface native-looking UIs inside the Flutter app by loading web content in a native WebView wrapper. This is the mobile-native equivalent of the web app's embedded app bridge (`EmbeddedAppBridgeClient.tsx`). The KYC screen directory (identity verification flow) surfaces a compliance requirement directly in the mobile app — an interesting design challenge where a security/compliance flow must meet native mobile UX expectations while collecting sensitive information. The AI screen (`ai/`) mirrors the web dashboard's `/[store]/ai` route — confirming that the AI assistant is a cross-platform feature, not web-only.
