# LetBuyy App Brand Guides — Comparative Matrix

**Produced by:** Visual Identity Agent
**Date:** 2026-06-19

---

## Comparative Matrix

| Attribute | identity-platform | marketing-site | merchant-control-plane | storefront-runtime | platform-console |
|-----------|-------------------|----------------|----------------------|-------------------|-----------------|
| **Primary Color** | `--lb-color-primary` (#8B5CF6) | `--lb-color-primary` (#8B5CF6) | `--lb-color-primary` (#8B5CF6) | rgb(99 102 241) — indigo | rgb(139 92 246) — hardcoded |
| **Background (light)** | rgb(250 249 255) — ink lavender | rgb(250 249 255) — ink lavender | rgb(250 249 255) — ink lavender | rgb(255 255 255) — white | rgb(255 255 255) — white |
| **Background (dark)** | rgb(10 9 18) — ink | rgb(10 9 18) — ink | rgb(10 9 18) — ink | rgb(255 255 255) — no dark | rgb(10 10 10) — near-black |
| **Font** | Geist Sans (--font-letbuyy-sans) | Geist Sans (--font-letbuyy-sans) | Geist Sans (--font-letbuyy-sans) | Geist Sans (--font-letbuyy-sans) | Geist Sans (--font-letbuyy-sans) |
| **Border Radius** | 8px → 10px (polished override) | Not declared (component-level) | 8px sidebar / 16px cards | 12px base (0.75rem) | Not declared (deferred) |
| **Visual Mood** | Premium / Focused | Bold / Aspirational | Professional / Dense | Neutral / Blank-Slate | Austere / Internal |
| **Token Usage** | Partial — hardcodes parallel to `--lb-*` | Partial — own `--bg-*` / `--shadow-*` vars | High — delegates to `@letbuyy/ui` | Low — minimal, non-brand colors | Minimal — 38-line globals.css |
| **Consistency Score** | 8/10 | 9/10 | 9/10 | 5/10 | 6/10 |
| **Dark Default** | No (system) | No (system) | No (system) | No (system) | YES (`defaultTheme="dark"`) |
| **LetbuyyThemeProvider** | surface="identity" | surface="storefront" (WRONG) | surface="admin" | surface="storefront" | surface="operations" |
| **Icon System** | MaterialIcon (restricted set) | Lucide (full set) | MaterialIcon (full set) | Theme-dependent | Deferred to component |
| **Animations** | fadeSlideIn, errorShakeIn, successPop | Framer Motion throughout | Token-based transitions | Fade-in / slide-up keyframes | None visible |
| **Gradient Use** | Progress bar only | Heavy — hero, glow, radial bg | None | None | None |
| **Shadow Tone** | Drop shadows (structural) | Glow shadows (atmospheric) | Structural (header glow) | None | None |

| Attribute | platform-operations-portal | app-marketplace | developer-portal | theme-marketplace |
|-----------|---------------------------|-----------------|-----------------|------------------|
| **Primary Color** | rgb(139 92 246) — hardcoded | `--lb-color-primary` (#8B5CF6) | `--lb-color-primary` (#8B5CF6) + teal accent | rgb(108 92 231) — own indigo |
| **Background (light)** | rgb(255 255 255) — white | rgb(255 255 255) — white | `--lb-color-bg` (inherited) | rgb(248 249 252) — cool gray |
| **Background (dark)** | rgb(10 10 10) — near-black | rgb(10 15 26) — different | `--lb-color-bg` (inherited) | rgb(15 15 26) — navy dark |
| **Font** | Geist Sans (Arial fallback) | Geist Sans (--font-letbuyy-sans) | Geist Sans (--font-letbuyy-sans) | Geist Sans (--font-letbuyy-sans) |
| **Border Radius** | Not declared (deferred) | Not declared (deferred) | Not declared (deferred) | Own scale: sm=6 md=10 lg=16 xl=24 |
| **Visual Mood** | Austere / Internal | Clean / Discovery | Technical / Docs | Creative / Gallery |
| **Token Usage** | Minimal — copy of console | Comprehensive inline `--lb-*` | Thin — delegates, own accents | None — fully own system |
| **Consistency Score** | 6/10 | 7/10 | 7/10 | 8/10 |
| **Dark Default** | YES (`defaultTheme="dark"`) | No (system) | No (system) | No (system) |
| **LetbuyyThemeProvider** | surface="operations" | surface="marketplace" | surface="marketplace" (debatable) | surface="marketplace" |
| **Icon System** | Deferred to component | Deferred to component | Deferred to component | Deferred to component |
| **Animations** | None visible | None declared | Blur topbar transition | Transition vars declared |
| **Gradient Use** | None | None | Subtle teal top gradient | Glass effects planned |
| **Shadow Tone** | None | Slate-tinted card shadow | None declared | Three-level + glow |

---

## Identity Classification

### Apps with INTENTIONAL Distinct Identities

These apps demonstrate purposeful, named, documented visual systems:

**1. marketing-site**
- Has its own gradient system (`--gradient-primary`, `--gradient-dark`, `--gradient-radial`)
- Has its own glow system (`--shadow-glow`, `--primary-glow`, `--accent-glow`)
- Has its own glass variables (`--glass-bg`, `--glass-border`)
- Has its own easing curves (`--ease-smooth`, `--ease-bounce`)
- Uses Framer Motion throughout
- Named in code as "PREMIUM DESIGN TOKENS - LIGHT MODE (Matching light_theme_colors.dart)"
- **Verdict:** Fully intentional. This is the brand's marketing face and was designed to spec.

**2. identity-platform**
- Has its own named palette ("Premium Ink Lavender")
- Has its own OTP input system
- Has its own step-indicator animation
- Has its own onboarding bento grid system
- Iteratively polished in layers (base → wave fixes → compact polish override)
- Named in code as "AUTH DESIGN SYSTEM — Mobile-First" and "ONBOARDING DESIGN SYSTEM — Purple theme"
- **Verdict:** Fully intentional. The auth flow was designed as a standalone product with careful attention to micro-interactions.

**3. merchant-control-plane**
- Defines explicit sidebar tokens: `--sidebar-width: 226px`, `--sidebar-item-height: 32px`, `--sidebar-item-px: 10px`
- Makes a unique structural decision: **always-dark header in light mode**
- Bridges `@letbuyy/ui` AppNavigation tokens explicitly
- Named in code as "LETBUYY ADMIN — DESIGN SYSTEM / Synced with accounts app theme"
- **Verdict:** Fully intentional. The inverted header is a considered wayfinding decision.

**4. theme-marketplace (frozen)**
- Completely independent color system with its own indigo primary
- Three-accent system (indigo + cyan + pink)
- Own radius scale disconnected from platform
- Rose-tinted text primary in dark mode
- Named in code as "THEME MARKETPLACE — Design Tokens (Shared)"
- **Verdict:** Fully intentional and most distinct. Someone designed this as a standalone creative product.

**5. developer-portal (frozen)**
- Has unique teal accent system with 4 named semantic colors
- Body background uses custom teal gradient (no other app does this)
- Glassmorphism topbar with `color-mix()`
- Narrower container (1180px) optimized for reading
- **Verdict:** Intentional. Teal is a strong signal of "developer documentation" context.

---

### Apps that ACCIDENTALLY Diverged

These apps inherited or copied configurations without making intentional visual choices:

**1. platform-console**
- globals.css is 38 lines with no named sections, no color palette rationale
- Copies the component system defaults
- The only intentional choice is `defaultTheme="dark"` in layout.tsx
- Uses Arial fallbacks unusual for an app meant for internal platform operators on modern hardware
- **Verdict:** Accidental. Identity is "whatever the component library does."

**2. platform-operations-portal**
- globals.css is byte-for-byte identical to platform-console
- No differentiation from platform-console despite being a different product (team portal vs. super-admin console)
- **Verdict:** Accidental divergence from distinctiveness — these two apps are visually indistinguishable.

**3. storefront-runtime**
- The non-brand indigo primary is intentional, but the rest (font aliases, radius, white background) are default scaffolding
- The wide font variable list (`--font-lora`, `--font-playfair`, etc.) are hooks that don't actually load different fonts
- **Verdict:** Intentionally identity-less at the platform level, accidentally underbaked as a result — merchants see an "empty" experience until a theme is applied.

**4. app-marketplace (frozen)**
- Uses slate-neutral borders instead of purple-tinted borders — this could be intentional (marketplace = neutral territory) but is not documented
- Redundantly redeclares all `--lb-color-*` values that ThemeProvider already sets
- Surface token coverage is the most thorough of the frozen apps
- **Verdict:** Partially intentional — the neutral palette was a choice, but the extensive inline token declarations suggest someone was overriding defaults reactively rather than designing proactively.

---

## Visual Coherence Across the Platform

### What Is Coherent

**Typography:** All apps load identical font files (Geist Sans, Geist Display, Geist Mono) from the same WOFF2 files in `packages/typescript/ui/assets/fonts/`. Variable naming differs but the actual typeface is universal. LetBuyy has a single voice typographically.

**Brand purple:** Every app uses `#8B5CF6` (purple-500) as the interaction color, either via `--lb-color-primary` or by hardcoding the same hex. Purple is unambiguously the LetBuyy brand color.

**ThemeProvider:** All 9 apps use `LetbuyyThemeProvider` and `ThemeScript`. Theme switching (light/dark/system) works consistently via the single `letbuyy-theme` localStorage key.

**The "ink lavender" core:** identity-platform, merchant-control-plane, and marketing-site share the `rgb(250 249 255)` page background and `rgb(10 9 18)` dark background — the platform's three most visible surfaces are visually unified.

### What Is Incoherent

**Surface assignment:** The `surface` prop on `LetbuyyThemeProvider` is semantically wrong for two major apps. `marketing-site` uses `surface="storefront"` and `developer-portal` uses `surface="marketplace"`. Since all surfaces currently resolve to identical token values, this is a latent risk — if the design system ever differentiates surfaces visually, these apps will get the wrong treatment.

**Border treatment split:** The platform's internal tools (identity-platform, merchant-control-plane) use purple-tinted borders (`rgb(224 216 248)`). The external tools (app-marketplace) use slate-neutral borders (`rgb(226 232 240)`). This is actually appropriate contextually but is undocumented and inconsistent.

**Radius fragmentation:** 
- Platform tokens: sm=4px, md=8px, lg=12px, xl=16px
- identity-platform buttons (polished): 10px
- storefront-runtime: 12px base
- theme-marketplace: sm=6px, md=10px, lg=16px, xl=24px
- No single canonical corner radius for interactive elements across the platform.

**Dark mode divergence (backgrounds):**
- ink-dark apps: `rgb(10 9 18)` (identity, merchant, marketing)
- platform-console/operations: `rgb(10 10 10)` — slightly different
- app-marketplace: `rgb(10 15 26)` — noticeably different (bluer)
- theme-marketplace: `rgb(15 15 26)` — navy-dark

Four different dark backgrounds across the platform — imperceptible individually, but creates an inconsistent experience for users who cross surfaces.

**Primary color divergence:**
- LetBuyy canonical: `#8B5CF6` = `rgb(139 92 246)` (purple-500)
- theme-marketplace: `rgb(108 92 231)` — perceptibly different indigo-purple
- storefront-runtime: `rgb(99 102 241)` — clearly different indigo

A user browsing the theme marketplace sees a different shade of purple than they see in the marketing site or merchant dashboard.

---

## Recommendations Summary

| Issue | Apps Affected | Severity |
|-------|--------------|----------|
| Wrong `surface` prop in marketing-site | marketing-site | Medium — latent risk |
| Wrong `surface` prop in developer-portal | developer-portal | Low — frozen app |
| Radius fragmentation (4 different systems) | All | Medium — impacts component feel |
| 4 different dark backgrounds | All | Low — visual but subtle |
| theme-marketplace primary not LetBuyy purple | theme-marketplace | Medium — brand identity |
| platform-console/operations not differentiated | Both portals | Low — internal only |
| Storefront font aliases don't load different fonts | storefront-runtime | High — misleads merchants |
| marketing-site uses own `--bg-*` vars vs. `--lb-*` | marketing-site | Low — tech debt |
| app-marketplace redundant inline token declarations | app-marketplace | Low — maintenance debt |

---

## Surface-to-App Mapping (Current vs. Recommended)

| Surface | Current Apps | Status |
|---------|-------------|--------|
| `identity` | identity-platform | Correct |
| `admin` | merchant-control-plane | Correct |
| `storefront` | storefront-runtime, **marketing-site** | marketing-site is wrong |
| `marketplace` | app-marketplace, developer-portal, theme-marketplace | developer-portal could be own surface |
| `operations` | platform-console, platform-operations-portal | Correct |

Recommended: Add a `marketing` surface to the token system to distinguish the public marketing site from the consumer storefront. Assign `developer-portal` to its own `developer` surface or to `operations`.

---
