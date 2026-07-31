# LetBuyy Visual Identity Report

**Produced by:** Visual Identity Agent
**Date:** 2026-06-19
**Source:** globals.css, layout.tsx, and key component files for each application

---

## Foundation: The LetBuyy Design System

Before analyzing individual apps, the shared foundation must be understood. Every app inherits from two sources:

1. `config/tailwind/letbuyy-tokens.css` — a Tailwind v4 `@theme` layer that maps `--lb-color-*` CSS variables to Tailwind utility classes.
2. `packages/typescript/ui/src/tokens.ts` — the authoritative primitive + semantic + component token tree.

**Brand color system:**
- Primary: `#8B5CF6` (purple-500) in light / same in dark
- CTA (primary button): `#6D28D9` (purple-700) in both modes
- Dark backgrounds use the "ink" palette: `#0a0912` (ink-950) through `#1b1827` (ink-700) — described in code as "deep violet-tinted darks"
- Dark borders: `rgba(139, 92, 246, 0.18)` — purple-tinted, not gray
- Five named surfaces: `admin`, `marketplace`, `storefront`, `identity`, `operations`

**Typography system:**
- Single font family loaded across all apps: Geist Sans (variable `--font-letbuyy-sans`), Geist Sans Latin Ext (display), Geist Mono
- Type scale: 12px caption to 32px display, with fluid clamp variants for marketing headings

**Radius tokens:** sm=4px, md=8px, lg=12px, xl=16px, full=999px

**Density tokens:** compact / comfortable / spacious — all apps default to compact

---

## Application Analyses

---

### identity-platform

**Visual Mood:** Premium / Focused / Intimate

**Brand Personality:** Trustworthy, minimal, slightly editorial. Deliberately narrower than the marketing site — it needs to disappear and let the form take center stage.

**Primary Colors:**
Purple (`var(--primary)` → `--lb-color-primary`) dominates as an action color. Backgrounds are custom lavender-tinted whites that are NOT from `--lb-*` tokens but are intentionally harmonized:
```css
--bg: rgb(250 249 255);           /* "Premium Ink Lavender" — hardcoded */
--bg-secondary: rgb(244 242 254); /* hardcoded */
--text-primary: rgb(10 8 22);     /* hardcoded ink */
--border: rgb(224 216 248);       /* hardcoded purple-tinted border */
```
The comment in code reads "Premium Ink Lavender" — these are deliberate hardcoded values that shadow the `--lb-color-*` system. The design intent is clear but execution diverges from the token ratchet.

**Typography:**
Geist Sans via `--font-letbuyy-sans`. Auth card titles: 22px mobile / 24px desktop, weight 700. Subtitles: 14px. Labels: 13px weight 500. Inputs: 16px (prevents iOS zoom). Consistent typographic rhythm throughout.

**Border Radius:**
Mixed: inputs use 8px then overridden to 10px in the "COMPACT AUTH FLOW POLISH" section; buttons use 8px → 10px override; cards use 16px desktop / 18px after latest override; OTP inputs use 12px; onboarding bento cards use 14px. The layering of overrides reveals iterative refinement — the base was 8px, polished up to 10px for "premium" feel.

**Shadow Usage:**
Minimal and intentional. Card shadow on desktop: `0 18px 48px rgba(15, 23, 42, 0.08)`. Hardcoded shadow on OTP focus: `0 0 0 3px rgba(139, 92, 246, 0.15)`. Dark card: `0 4px 32px rgba(0, 0, 0, 0.5)`. Shadows serve to separate auth card from lavender background.

**Spacing:**
Comfortable. Auth card padding: 32px desktop. Form gaps: 13px. Field gaps: 7px. The overall rhythm is compact but not cramped — designed for a single form on screen.

**Background Treatment:**
Two-layer: page is lavender (`rgb(250 249 255)`) and card is white (`var(--input-bg) = #fff`) on desktop, creating a lifted card effect. Mobile is full-bleed lavender, no card lift. Dark mode: page is `rgb(10 9 18)` (near-black), card is `rgb(13 11 22)` — barely differentiated, relying on border `rgba(139,92,246,0.18)` to separate.

**Illustration Style:**
None. Icon-only. Uses `MaterialIcon` from `@letbuyy/ui` — specifically the `AuthIcon` wrapper that constrains to a typed subset of Material icon names. OTP icon has a purple-tinted circular container (`rgba(139, 92, 246, 0.1)`). The auth flow uses inline emoji for status states (check mark, etc).

**Icon Style:**
Material Design Icons via `MaterialIcon` from `@letbuyy/ui`. The `AuthIcon` component wraps with `auth-icon-svg` class and enforces an `AuthIconName` type — only ~40 icons are in the allowed set.

**Visual Consistency:** 8/10

Internally consistent in intent, but the "COMPACT AUTH FLOW POLISH" override block (lines 1679–2000+ in globals.css) re-declares many values that contradict the base section. The result is visually coherent because the final layer wins, but the code has "stacking" technical debt.

**Identity Intent:** INTENTIONAL

The `/* AUTH DESIGN SYSTEM — Mobile-First */` comment, the named lavender color palette, and the explicit "Purple theme" annotation for onboarding all indicate deliberate identity decisions. The `LetbuyyThemeProvider surface="identity"` assignment gives it its own surface slot.

**Evidence:**
```css
/* Light Theme — Premium Ink Lavender */
--bg: rgb(250 249 255);
--border: rgb(224 216 248);
/* ONBOARDING DESIGN SYSTEM — Extends auth system — Purple theme */
.onboard-progress-fill {
  background: linear-gradient(90deg, var(--primary), var(--accent-cyan));
}
```

**Conflicts:**
- Button border-radius declared as 8px in base, then overridden to 10px in the polish block
- Input border-radius same: 8px → 10px
- Card border-radius: 16px → 18px. Three layers of overrides for the same values
- `--purple` var was undefined until a THEME FIX comment patched it: `--purple: var(--primary)`
- Dark mode `.dark body` background re-declared in two media queries

---

### marketing-site

**Visual Mood:** Bold / Aspirational / Dynamic

**Brand Personality:** Premium commerce platform — projects ambition, scale, and modernity. References "Commerce Operating System." More editorial than the auth flow.

**Primary Colors:**
Full purple system with explicit gradient and glow variables:
```css
--gradient-primary: linear-gradient(135deg, rgb(139 92 246) 0%, rgb(124 58 237) 50%, rgb(109 40 217) 100%);
--shadow-glow: 0 0 60px rgba(139, 92, 246, 0.12);
--accent: rgb(6 182 212); /* cyan accent as secondary brand color */
```
Also maintains `--accent-blue` via `--lb-color-info`. The marketing site is the only app that explicitly names and uses a cyan accent as a visual brand element (not just a functional color).

**Typography:**
Geist Sans. Hero title uses fluid clamp sizing. Header navigation links have no declared size override — inherit body. Footer column titles in uppercase with letter-spacing in the component CSS (not visible in globals.css, lives in component CSS via className). The Header.tsx uses Framer Motion for entrance animation: `initial={{ y: -100, opacity: 0 }}`.

**Border Radius:**
Not declared in globals.css for most elements — this app delegates radius to component-level class names. Button classes `btn-primary`, `btn-ghost`, `btn-outline` are referenced but defined in the component CSS (large globals.css file truncated at 200 lines). The hero section uses glass effects and radial gradients more than rounded corners as the primary visual treatment.

**Shadow Usage:**
Ambient glow shadows — unlike the auth app which uses drop shadows for card lift, the marketing site uses glow:
```css
--shadow-glow: 0 0 60px rgba(139, 92, 246, 0.12);
--shadow-card: 0 4px 8px rgba(139, 92, 246, 0.06);
```
Shadows here are atmospheric, not structural.

**Spacing:**
Spacious. Container max-width 1400px. Section padding progressive: 20px → 24px → 40px → 60px across breakpoints. The Header is animated with Framer Motion on scroll (`scrolled` state). The mega-menu is a full DOM overlay with `glass-border` treatment.

**Background Treatment:**
Gradient-based. `--bg-deep: rgb(250 249 255)` in light (same lavender base as auth), but dark mode: `--bg-deep: rgb(10 9 18)`. The comment in the CSS says "Matching light_theme_colors.dart" and "Matching dark_theme_colors.dart" — indicating these colors were originally from a Flutter app and were ported. The marketing site additionally uses `--gradient-dark: linear-gradient(180deg, ...)` and `--gradient-radial: radial-gradient(...)` that are NOT used in any other app.

**Illustration Style:**
The `CommerceNetwork` component (referenced in Hero.tsx) is a custom visualization component — likely a network graph or node diagram. `TrustPills` and `CommerceMetrics` are trust indicators. No third-party illustration library. The site's visual language is data-visualization-forward for the hero, transitioning to icon + text for the mega-menu.

**Icon Style:**
Lucide icons via `@letbuyy/ui` re-exports (`ArrowRight`, `Zap`, `ChevronDown`, etc.). Marketing site uses the full Lucide set, unlike the auth flow which uses only the constrained `AuthIcon` subset. This is appropriate — marketing needs more expressive icons.

**Visual Consistency:** 9/10

The marketing site is the most intentionally designed app. Every element — the gradient system, the glow shadows, the glassmorphism header, the Framer Motion animations — points to a coherent premium SaaS aesthetic. The mega-menu design with `desktop-mega-layout`, `desktop-mega-feature-grid`, and `desktop-mega-side` suggests a thoughtfully planned navigation architecture.

**Identity Intent:** STRONGLY INTENTIONAL

The comment `/* PREMIUM DESIGN TOKENS - LIGHT MODE (Matching light_theme_colors.dart) */` reveals this was designed to a spec. The layout.tsx uses `surface="storefront"` — an odd choice for the marketing site (it shares surface with the consumer storefront), but it defaults the token set correctly.

**Evidence:**
```css
/* Gradients */
--gradient-primary: linear-gradient(135deg, rgb(139 92 246) 0%, rgb(124 58 237) 50%, rgb(109 40 217) 100%);
/* Glass */
--glass-bg: rgba(250, 249, 255, 0.95);
--glass-border: rgba(139, 92, 246, 0.08);
/* Animation */
--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
```

**Conflicts:**
- `layout.tsx` uses `surface="storefront"` — the marketing site is not a storefront and this is the wrong surface assignment
- Custom `--ease-smooth` and `--ease-bounce` variables duplicate what `tokens.ts` provides as `--lb-ease-emphasized` and `--lb-ease-out`
- Dark mode tokens use `--bg-deep`, `--bg-dark`, `--bg-elevated` (local names) instead of `--lb-color-bg`, `--lb-color-surface`, `--lb-color-card` (canonical names)

---

### merchant-control-plane

**Visual Mood:** Professional / Dense / Confident

**Brand Personality:** Utilitarian with premium touches. This is a productivity tool — merchants need to process orders, manage inventory, and check dashboards without visual friction. The app earns trust through precision, not beauty.

**Primary Colors:**
Purple primary (`--lb-color-primary`) but with a distinctive structural decision: the **header is always dark** in light mode:
```css
/* — Header — dark on light theme — */
--header-bg: rgb(10 9 18);       /* near-black header in light mode */
--header-fg: rgb(255 255 255);   /* white header text */
--header-border: rgba(139, 92, 246, 0.14);
```
This creates a striking visual inversion — the sidebar is lavender (`rgb(244 242 254)`) and the content area is off-white (`rgb(250 249 255)`), but the top bar is dark with purple-tinted chrome. This is the app's most distinctive visual decision.

In dark mode the header flips to white:
```css
--header-bg: rgb(255 255 255);
--header-fg: rgb(10 8 22);
```
This means the merchant header always contrasts against the page — always dark-on-light at the header regardless of page theme. This is an intentional "wayfinding" decision.

**Typography:**
Geist Sans. The dashboard uses `@letbuyy/ui` component library: `PageHeader`, `Page`, `Section`, `Card`, `MetricCard`, `Badge`, `Banner` — all token-driven components. Typography is handled by the design system, not the app itself. The merchant app is the most complete consumer of `@letbuyy/ui` components.

**Border Radius:**
Sidebar items: 8px (`--sidebar-item-radius: 8px`). Cards: 16px (from `--lb-component-card-radius: '16px'` in tokens). The merchant app precisely follows the component token system.

**Shadow Usage:**
Structured. The header has `--header-search-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 6px 20px rgba(139, 92, 246, 0.10)` — a subtle glow under the search in the dark header. Cards use token shadows.

**Spacing:**
Compact by default. Sidebar row height: 32px (`--sidebar-item-height: 32px`). Item padding: 10px horizontal / 6px vertical. Sidebar width: 226px. These are precise, operator-set values.

**Background Treatment:**
Three-layer: dark header → lavender sidebar (`rgb(244 242 254)`) → off-white content area (`rgb(250 249 255)`). In dark mode: dark header (now white) → near-black sidebar (`rgb(13 11 21)`) → ink-dark content (`rgb(10 9 18)`). The layering communicates hierarchy.

**Illustration Style:**
None. Uses `EmptyState` from `@letbuyy/ui` which has an animated float illustration. Uses `MaterialIcon` throughout the dashboard. The `FoundingMerchantCard` component is the only bespoke visual element referenced.

**Icon Style:**
`MaterialIcon` from `@letbuyy/ui`. Dashboard uses icon strings like `"settings"`, `"storefront"` passed as `name` props. The DashboardClient passes icon names as JSX into PageHeader action props.

**Visual Consistency:** 9/10

The most component-system-compliant app. It delegates almost all visual decisions to `@letbuyy/ui`. The globals.css is unusually detailed with named CSS variable sections and explicit comments linking tokens to the design system. The "PREMIUM PALETTE OVERRIDE" block (not shown, continues after line 200) sets `--lb-color-bg` to the exact lavender values, ensuring merchant and auth apps share the same ink-lavender palette.

**Identity Intent:** INTENTIONAL

The comment `/* LETBUYY ADMIN — DESIGN SYSTEM / Synced with accounts app theme / Purple-first, light/dark mode support */` and `/* — Sidebar — Ink Lavender — */` demonstrate the merchant app has a defined design language. The inverted header is a deliberate wayfinding choice.

**Evidence:**
```css
/* — Header — dark on light theme — */
--header-bg: rgb(10 9 18);
--header-border: rgba(139, 92, 246, 0.14);
--header-logo-glow: rgba(139, 92, 246, 0.32);
/* — Sidebar — Ink Lavender — */
--sidebar-bg: rgb(244 242 254);
```

**Conflicts:**
- The "PREMIUM PALETTE OVERRIDE" section re-declares `--lb-color-*` at `html [data-letbuyy-theme="light"]` specificity — this is a deliberate specificity hack to override the token system's own variables, documented with the comment "High-specificity selectors beat letbuyyTokenCss"
- `--admin-header-height: 64px` is a local variable that mirrors `--lb-density-header-height` from compact density tokens — potential drift if density changes
- `--sidebar-item-height: 32px` is below the compact density token `sidebarRowHeight: '40px'` — explicit opt-out of the density system for sidebar

---

### storefront-runtime

**Visual Mood:** Neutral / Theme-Ready / Blank-Slate

**Brand Personality:** The storefront-runtime is fundamentally NOT a LetBuyy product — it is a LetBuyy-powered merchant product. Its identity is therefore deliberately empty, designed to be overridden by merchant themes.

**Primary Colors:**
Hardcoded non-LetBuyy purple: `--primary: rgb(99 102 241)` (indigo-500, NOT the brand `#8B5CF6`). This is the default/demo primary color. The secondary is `rgb(139 92 246)` — brand purple used as secondary. The accent is `rgb(244 114 182)` — pink.

This is a significant divergence: the storefront-runtime uses an **indigo default primary** rather than LetBuyy's purple. This is intentional — merchants who haven't customized their theme should see a "neutral" color that doesn't look like they copied LetBuyy's brand.

**Typography:**
The storefront-runtime declares the widest font palette in the platform — 10 font variables:
```css
--font-outfit, --font-poppins, --font-lora, --font-space-grotesk,
--font-playfair, --font-nunito, --font-open-sans, --font-dm-sans, --font-montserrat
```
All resolve to Geist variants (the actual font files are the same — only the CSS variable names change). These are theme customization hooks. When a merchant picks "Playfair Display" in the theme editor, `--font-body: var(--font-playfair)` takes effect, giving them the perception of Playfair while actually serving Geist.

**Border Radius:**
```css
--radius: 0.75rem; /* 12px */
--radius-lg: var(--radius);
--radius-md: calc(var(--radius) - 2px); /* 10px */
--radius-sm: calc(var(--radius) - 4px); /* 8px */
```
More opinionated than the token system (which uses sm=4px/md=8px). The storefront skews rounder as a default merchant experience.

**Shadow Usage:**
Functional only. Scrollbar custom styling is the only shadow-adjacent code visible. No ambient glow. Shadows will be provided by themes.

**Spacing:**
Not declared at the app level. The `product-grid-dynamic` utility is the only layout class in globals.css for the actual storefront content: `grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem`. This is a scaffold, not a design decision.

**Background Treatment:**
`--background: rgb(255 255 255)` — pure white default. No lavender. No ink dark. The storefront is white-first because merchants may use any color scheme.

**Illustration Style:**
Not applicable at the runtime level — themes provide illustrations.

**Icon Style:**
Not declared at this level — theme-dependent.

**Visual Consistency:** 5/10

Internally consistent as a blank slate but externally inconsistent with the LetBuyy platform aesthetic. This is by design. The `--font-lora`, `--font-playfair` declarations alongside `--font-inter` create a font naming system for theme selection. The `glass` and `glass-dark` utilities (backdrop-blur + bg opacity) provide theme authors with composable effects.

**Identity Intent:** INTENTIONAL (intentionally identity-less)

The storefront is designed to not have a visual identity at the runtime level. `layout.tsx` uses `surface="storefront"` which correctly maps to the storefront surface token set. The non-brand indigo primary is the clearest signal: this surface belongs to merchants, not to LetBuyy.

**Evidence:**
```css
/* Brand Colors */
--primary: rgb(99 102 241);    /* indigo — NOT LetBuyy purple */
--secondary: rgb(139 92 246);  /* LetBuyy purple as secondary */
--accent: rgb(244 114 182);    /* pink */
```

**Conflicts:**
- Uses `--font-inter` as the body stack but also declares `--font-body: var(--font-inter)` via `@theme` — both reference the same variable through different paths
- `--font-lora` and `--font-playfair` resolve to Geist Display (a sans-serif), which is semantically wrong for a "serif" font selection. The merchant thinks they're getting Lora/Playfair but gets Geist.
- `--radius: 0.75rem` disagrees with `--lb-radius-lg: 12px` (they are the same value, but expressed in different units with no connection)

---

### platform-console

**Visual Mood:** Austere / Functional / Internal-Tool

**Brand Personality:** This is the super-admin console — used by LetBuyy operators, not merchants. Visual identity is deliberately minimal to signal authority and reduce cognitive load for power users.

**Primary Colors:**
Hardcoded purple directly (not via `--lb-color-primary` alias):
```css
--lb-color-brand-purple: rgb(139 92 246);
--lb-color-primary: rgb(139 92 246);
```
Plain `rgb(255 255 255)` in light mode. Black in dark mode: `rgb(10 10 10)`. The color system is minimal — no lavender backgrounds, no ink palette, no purple-tinted borders.

**Typography:**
`--font-system: var(--font-letbuyy-sans), Arial, Helvetica, sans-serif`. The fallback to Arial/Helvetica (instead of `ui-sans-serif`) is unusual — it suggests this was written for a Windows-first internal audience. No display font declared.

**Border Radius:**
Not declared. Defers entirely to the `@letbuyy/ui` component defaults.

**Shadow Usage:**
Not declared. Defers to component system.

**Spacing:**
Not declared. Defers to component system.

**Background Treatment:**
Pure white (`rgb(255 255 255)`) light / near-black (`rgb(10 10 10)`) dark. No lavender, no purple tinting. The starkest backgrounds in the platform.

**Illustration Style:**
Not applicable.

**Icon Style:**
Not declared. Inherits from `@letbuyy/ui`.

**Visual Consistency:** 6/10

Internally consistent by virtue of doing almost nothing. The globals.css is 38 lines — the simplest in the platform. The layout.tsx sets `defaultTheme="dark"` with `surface="operations"` — the only app that explicitly prefers dark as default. This is the right choice for a power-user internal console.

**Identity Intent:** ACCIDENTAL (minimal by default, not by explicit intent)

The brevity of the globals.css suggests the console was built quickly for internal use with "whatever the component library does" as the identity. No named color palette, no named sections, no design commentary. The `defaultTheme="dark"` is the only explicit identity decision.

**Evidence:**
```css
/* platform-console globals.css — 38 lines total */
:root {
  --font-system: var(--font-letbuyy-sans), Arial, Helvetica, sans-serif;
  --background: rgb(255 255 255);
  --foreground: rgb(23 23 23);
  --lb-color-primary: rgb(139 92 246);
}
```

**Conflicts:**
- Hardcodes `--lb-color-primary` directly in globals.css instead of inheriting from `LetbuyyThemeProvider` — the ThemeProvider already sets this value, making the declaration redundant (and potentially inconsistent if tokens change)
- `rgb(10 10 10)` dark background differs from the platform's canonical dark `#0a0912` (rgb(10 9 18)) — a very subtle but real divergence

---

### platform-operations-portal

**Visual Mood:** Austere / Functional / Internal-Tool (identical to platform-console)

**Brand Personality:** Employee portal for LetBuyy team. Structurally identical to platform-console.

**Primary Colors:** Identical to platform-console — hardcoded `rgb(139 92 246)` primary.

**Typography:** Identical to platform-console — `--font-system` with Arial fallbacks.

**Border Radius:** Not declared.

**Shadow Usage:** Not declared.

**Spacing:** Not declared.

**Background Treatment:** Identical to platform-console — pure white / `rgb(10 10 10)`.

**Illustration Style:** Not applicable.

**Icon Style:** Inherits from `@letbuyy/ui`.

**Visual Consistency:** 6/10

Consistent with itself but is a carbon copy of platform-console. The two internal apps are visually indistinguishable from their CSS alone — the only difference is the title metadata.

**Identity Intent:** ACCIDENTAL

The globals.css is byte-for-byte identical to platform-console's globals.css. This is either copy-paste or shared configuration. Neither is intentional brand differentiation — these apps simply have no distinct identity.

**Evidence:**
Both files contain:
```css
--font-system: var(--font-letbuyy-sans), Arial, Helvetica, sans-serif;
--background: rgb(255 255 255);
--foreground: rgb(23 23 23);
--lb-color-primary: rgb(139 92 246);
```

**Conflicts:**
Same conflicts as platform-console. Additionally: two separate internal tools with identical CSS creates an identity gap. If operators use both tools, there is no visual signal for which tool they are in.

---

### app-marketplace

**Visual Mood:** Clean / Browsable / Discovery-Oriented

**Brand Personality:** A focused shopping experience for apps. Closest to a standard SaaS marketplace (think Shopify App Store aesthetic).

**Primary Colors:**
The app-marketplace has the most comprehensive CSS variable setup of any non-auth app, explicitly declaring the full `--lb-color-*` token set inline rather than inheriting from the ThemeProvider injection:
```css
--lb-color-bg: rgb(255 255 255);
--lb-color-surface: rgb(255 255 255);
--lb-color-surface-subdued: rgb(248 250 252);
--lb-color-text: rgb(15 23 42);
--lb-color-text-subdued: rgb(71 85 105);
--lb-color-border: rgb(226 232 240);  /* slate-200 — NOT purple-tinted */
```
The border is `rgb(226 232 240)` (slate-200, neutral gray) — NOT the purple-tinted `rgb(224 216 248)` used by identity and merchant apps. This makes the app marketplace feel cooler/neutral vs. the warmer lavender aesthetic of the internal tools.

**Typography:**
Geist Sans. Uses `--font-inter` alias as body. `--font-display-premium` for headings.

**Border Radius:**
Not individually declared — defers to `--lb-*` component tokens. The app itself uses `surface="marketplace"` which uses the same token values as other surfaces.

**Shadow Usage:**
`--lb-shadow-card: 0 1px 2px rgb(15 23 42 / 5%), 0 8px 24px rgb(15 23 42 / 4%)` — a softer, slate-tinted shadow (not purple-tinted like the auth/merchant apps). Card shadows here are neutral.

**Spacing:**
Section spacing declared explicitly: `--lb-section-y-desktop: 64px`, `--lb-section-y-large: 96px`, `--lb-section-y-mobile: 48px`. Container: `--lb-size-marketplace-container: 1200px`. The marketplace has its own grid/section rhythm separate from the marketing site.

**Background Treatment:**
Pure white (`rgb(255 255 255)`) with slate-subdued (`rgb(248 250 252)`) for secondary surfaces. Notably no lavender tinting. The marketplace is visually the "brightest" app on the platform — high contrast, clean white, slate neutrals.

**Illustration Style:**
Not visible at this level — app listings would provide imagery.

**Icon Style:**
Inherits from `@letbuyy/ui`. Uses `surface="marketplace"`.

**Visual Consistency:** 7/10

Consistent in its brightness and neutral palette, but diverges significantly from the rest of the platform's lavender-ink aesthetic. This could be intentional (marketplace should feel "neutral territory") or could be accidental divergence from the canonical palette.

**Identity Intent:** PARTIALLY INTENTIONAL

The explicit token redeclaration with slate neutrals (not purple-tinted lavenders) suggests someone made a considered choice to not purple-tint this surface. However, there's no comment in the CSS explaining the rationale. The `layout.tsx` uses `surface="marketplace"` correctly.

**Evidence:**
```css
--lb-color-border: rgb(226 232 240);  /* slate, not purple-tinted */
--lb-shadow-card: 0 1px 2px rgb(15 23 42 / 5%), 0 8px 24px rgb(15 23 42 / 4%);
/* vs. identity-platform's purple-tinted card shadow */
```

**Conflicts:**
- Declares the full `--lb-color-*` set inline which duplicates what `LetbuyyThemeProvider` already sets — the `html {...}` inline style in layout.tsx (`html.dark { background: var(--lb-color-bg, rgb(10 15 26)); }`) uses `rgb(10 15 26)` which is different from the platform's canonical dark `#0a0912` = `rgb(10 9 18)`
- "Legacy marketplace aliases" section in globals.css (the `--primary: var(--lb-color-primary)` block) duplicates variable mappings that the ThemeProvider already handles

---

### developer-portal

**Visual Mood:** Technical / Documentation-Focused / Trustworthy

**Brand Personality:** Developer documentation. Should feel like home for engineers. Somewhat distinct from the rest of the platform.

**Primary Colors:**
Teal-accented, not purple-first:
```css
--developer-accent-teal: rgb(15 118 110);    /* teal-700 */
--developer-accent-blue: rgb(37 99 235);      /* blue-700 */
--developer-accent-amber: rgb(180 83 9);      /* amber-700 */
--developer-accent-rose: rgb(190 18 60);      /* rose-700 */
```
The developer portal is the ONLY app with a distinctly different accent system. Teal is used as the primary link color / gradient start. Purple is still present via `--lb-color-primary` from the ThemeProvider, but the visual foreground uses teal.

**Background Treatment:**
The body has a custom gradient:
```css
body {
  background:
    linear-gradient(180deg, rgba(15, 118, 110, 0.08), transparent 360px),
    var(--lb-color-bg);
}
```
A subtle teal gradient fades into the lb-color-bg beneath. This is the developer portal's most distinctive visual marker — a green-tinted top-of-page treatment that echoes documentation portals like Stripe Docs or Vercel Docs.

**Typography:**
`--developer-font-sans`, `--developer-font-display`, `--developer-font-mono` — all mapped to the same Geist variables but under developer-namespaced aliases. The mono stack (`--developer-font-mono`) is important here — developer portals are heavy with code samples.

**Border Radius:**
Not declared locally. Defers to `--lb-*` component tokens.

**Shadow Usage:**
Not declared locally. The topbar uses `backdrop-filter: blur(18px)` and `color-mix(in srgb, var(--lb-color-bg) 90%, transparent)` for a glassmorphism effect — similar to the marketing site's header treatment.

**Spacing:**
Container: `width: min(1180px, calc(100% - 32px))` — slightly narrower than the marketing site (1400px) or marketplace (1200px). Good for documentation readability.

**Illustration Style:**
Not applicable at this level. Docs apps use code snippets as visual elements.

**Icon Style:**
`surface="marketplace"` with `density="compact"`. The developer portal shares the marketplace surface but has its own accent system.

**Visual Consistency:** 7/10

Internally consistent — the teal gradient + lb-color tokens create a clear "docs" aesthetic. The blur topbar is a nice touch. However, the `surface="marketplace"` assignment means the developer portal and app marketplace share the same surface token set, despite having different visual intentions (marketplace = neutral, developer portal = technical/teal).

**Identity Intent:** INTENTIONAL

The teal accent system with four named semantic colors (`--developer-accent-teal/blue/amber/rose`) and the custom body gradient are explicit design decisions. This is the only app with a color system clearly different from the platform-wide purple.

**Evidence:**
```css
:root {
  --developer-accent-teal: rgb(15 118 110);
  --developer-accent-blue: rgb(37 99 235);
  --developer-accent-amber: rgb(180 83 9);
  --developer-accent-rose: rgb(190 18 60);
}
body {
  background:
    linear-gradient(180deg, rgba(15, 118, 110, 0.08), transparent 360px),
    var(--lb-color-bg);
}
```

**Conflicts:**
- Uses `surface="marketplace"` (same as app-marketplace) despite being a completely different product context. Should arguably be its own surface or at minimum `surface="operations"`
- Developer accent colors are NOT piped through `--lb-color-*` tokens — they're app-local variables invisible to the design system
- `density="compact"` is set explicitly in layout.tsx but compact is already the default, making the declaration redundant

---

### theme-marketplace

**Visual Mood:** Creative / Gallery-Like / Indigo-Forward

**Brand Personality:** A visual showcase for themes. Of all the platform apps, this one most needs to "wow" — merchants are here to judge visual quality, so the marketplace itself must be visually credible.

**Primary Colors:**
The most divergent primary color on the platform: `rgb(108 92 231)` (a mix between indigo and purple — not quite either). This is explicitly different from LetBuyy brand purple `#8B5CF6 = rgb(139 92 246)`:
```css
@theme {
    --color-primary: rgb(108 92 231);
    --color-primary-light: rgb(162 155 254);
    --color-primary-dark: rgb(72 52 212);
    --color-secondary: rgb(0 210 211);   /* cyan — creative accent */
    --color-accent: rgb(253 121 168);    /* pink — feminine/playful */
}
```
Three-color accent system: indigo primary + cyan secondary + pink accent. This is the richest color system in the platform and the most visually differentiated.

**Typography:**
Geist via `--font-letbuyy-*` variables. Uses the same Geist files but maps them under `--font-inter`, `--font-display-premium`, `--font-mono-premium` local aliases.

**Border Radius:**
Explicitly declared with its own named scale:
```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;
```
This matches neither the LetBuyy token scale (sm=4px, md=8px, lg=12px, xl=16px) nor the storefront scale (0.75rem=12px base). The theme marketplace uses rounder defaults.

**Shadow Usage:**
Three-level shadow scale plus glow: `--shadow-glow: 0 0 30px rgba(108, 92, 231, 0.15)` using the local indigo primary, not `--lb-color-primary`. The most shadow-aware globals.css after the marketing site.

**Spacing:**
`--spacing-section: 80px` and `--spacing-container: 1280px`. Standard but explicit.

**Background Treatment:**
Light: `rgb(248 249 252)` (near-white with slight blue/gray cast, not lavender). Dark: `rgb(15 15 26)` (deep navy-dark, not the ink purple of the brand — it's slightly bluer). Dark text includes `--color-text-primary: rgb(238 187 195)` — a rose-tinted white, clearly intentional for the creative brand.

**Illustration Style:**
Not visible at this level. The app (frozen) would show theme screenshots.

**Icon Style:**
Uses `surface="marketplace"` — same as app-marketplace and developer portal.

**Visual Consistency:** 8/10

The theme marketplace has the clearest distinct visual identity in the platform. The three-color system, the rounder radii, the custom light/dark palette with rose-tinted text in dark mode, and the named transition tokens all indicate a thoughtfully designed app. The use of glassmorphism (`--glass-bg`, `--glass-card-bg`) with backdrop-blur suggests visual effects were planned.

**Identity Intent:** STRONGLY INTENTIONAL

This is the most independently designed app. The comment `THEME MARKETPLACE — Design Tokens (Shared)` and the `@theme { }` block with color constants indicate someone deliberately specified a distinct brand for this surface. The pink text primary in dark mode (`rgb(238 187 195)`) is particularly deliberate — it communicates "creativity" and "fashion" which fits a theme gallery.

**Evidence:**
```css
@theme {
    --color-primary: rgb(108 92 231);
    --color-secondary: rgb(0 210 211);
    --color-accent: rgb(253 121 168);
}
/* Dark mode */
--color-text-primary: rgb(238 187 195);  /* rose-tinted white */
--color-bg: rgb(15 15 26);              /* deep navy-dark */
```

**Conflicts:**
- Does NOT use `--lb-color-primary` — uses its own `--color-primary` which is a different purple. This means the theme marketplace primary color is visually close to but not identical to the LetBuyy brand
- Radius scale (`sm=6px, md=10px, lg=16px, xl=24px`) doesn't match `--lb-radius-*` tokens — there's no connection between the two systems
- `layout.tsx` uses `surface="marketplace"` which injects `--lb-color-primary: #8B5CF6` via ThemeProvider, but the app's `@theme` block overrides this with `rgb(108 92 231)`. The cascade creates a subtle color disagreement

---

## Cross-Platform Observations

### The Ink-Lavender System

Three apps share an explicitly named "ink lavender" or "Premium Ink Lavender" palette: **identity-platform**, **merchant-control-plane**, and **marketing-site**. All three use:
- Light page: `rgb(250 249 255)`
- Light secondary: `rgb(244 242 254)`
- Light text: `rgb(10 8 22)`
- Light border: `rgb(224 216 248)` or similar

This is the most coherent cross-app visual pattern. These three apps form a visual "core" of the platform.

### The Surface System (Theoretical vs. Actual)

The token system defines 5 surfaces: `admin`, `marketplace`, `storefront`, `identity`, `operations`. Actual usage:
- `identity` → identity-platform (correct)
- `admin` → merchant-control-plane (correct)
- `storefront` → storefront-runtime AND marketing-site (marketing-site is wrong)
- `marketplace` → app-marketplace, developer-portal, theme-marketplace (developer-portal is debatable)
- `operations` → platform-console, platform-operations-portal (correct)

The surfaces share identical CSS variable values in the token system (all five surfaces resolve to the same light/dark colors). The surface distinction currently only matters for naming/intent, not for actual color differentiation.

### Token Compliance Gradient

From most to least token-compliant:
1. **merchant-control-plane** — Uses `@letbuyy/ui` components extensively; CSS variables mostly bridge to `--lb-*`
2. **developer-portal** — Thin globals.css, delegates to ThemeProvider
3. **platform-console / platform-operations-portal** — Minimal, delegates to ThemeProvider
4. **app-marketplace** — Declares `--lb-color-*` explicitly (redundant but correct values)
5. **identity-platform** — Heavy custom CSS with hardcoded values that parallel `--lb-*` without using them
6. **marketing-site** — Has its own `--bg-deep`, `--shadow-glow`, etc. that parallel tokens
7. **storefront-runtime** — Uses non-brand colors by design; minimal token usage
8. **theme-marketplace** — Has its own complete token system separate from `--lb-*`

---
