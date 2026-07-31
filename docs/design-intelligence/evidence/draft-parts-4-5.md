# LetBuyy Design Intelligence Master Document
## Parts 4 and 5: Visual Identity Intelligence and Layout Topology

**Produced by:** Design Intelligence Agent
**Date:** 2026-06-19
**Source documents:** VISUAL_IDENTITY_REPORT.md, APP_BRAND_GUIDES.md, LAYOUT_TOPOLOGY.md, PAGE_ARCHITECTURE.md

---

---

# PART 4: VISUAL IDENTITY INTELLIGENCE

---

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

The phrase "ink lavender" appears independently in at least two of these three files. The third (marketing-site) uses "Premium Ink Lavender" and traces the origin further — the comment `Matching light_theme_colors.dart` reveals these color values were originally defined in a Flutter mobile application and ported to the web platform. Three engineering teams, working on three very different surfaces, each independently arrived at (or preserved) the same palette. This is convergent identity — the platform's visual character expressed itself without a top-down decree.

### What the Ink Lavender Palette Is

The palette has two poles:

**Light pole — "Premium Ink Lavender"**

| Role | Value | Where Used |
|---|---|---|
| Page background | `rgb(250 249 255)` | identity, merchant, marketing |
| Secondary surface / sidebar | `rgb(244 242 254)` | identity (bg-secondary), merchant (sidebar-bg) |
| Text primary | `rgb(10 8 22)` | identity, marketing |
| Border | `rgb(224 216 248)` | identity, merchant |

The light values are a white with a slight violet-blue temperature shift — almost imperceptible at a glance, unmistakable as a system when seen as a set. The page background `rgb(250 249 255)` is 5 blue-channel units away from pure white. The sidebar `rgb(244 242 254)` pushes further into the lavender. The border `rgb(224 216 248)` is visibly purple-tinted.

**Dark pole — "Ink 950"**

| Role | Value | Where Used |
|---|---|---|
| Dark page background | `rgb(10 9 18)` | identity, merchant, marketing |
| Dark card | `rgb(13 11 22)` | identity (barely differentiated from page) |
| Dark sidebar | `rgb(13 11 21)` | merchant |
| Dark border | `rgba(139, 92, 246, 0.18)` | identity, merchant |

The dark value `rgb(10 9 18)` is described in the token file as "deep violet-tinted dark" — it is the `ink.950` step in the ink palette. It is not black. The slight upward pressure on the blue and green channels gives the dark mode a violet warmth that distinguishes LetBuyy from apps using pure black (`#000000`) or flat dark gray (`rgb(18 18 18)`).

### What It Means

The ink lavender identity is the most coherent cross-application visual signal in the entire platform. A user who opens the marketing site, logs in through the identity platform, and then navigates the merchant dashboard experiences the same color temperature across all three transitions. The lavender page background and the ink dark mode create a recognizable container — one that feels "premium" without being ostentatious, and "technical" without being cold.

This identity is also, at the moment, an accident of engineering rather than a formalized standard. The three apps that share it do so because developers preserved the original Flutter palette. The six apps that do not share it (`platform-console`, `platform-operations-portal`, `storefront-runtime`, `app-marketplace`, `developer-portal`, `theme-marketplace`) have diverged into their own backgrounds, some intentionally and some accidentally.

### What Needs to Happen to Formalize It

The ink lavender identity exists in practice. It needs to exist in policy. Four actions are required:

1. **Name the canonical values in `tokens.ts`.** The token file already defines `ink.950 = '#0a0912'`. The light pole (`rgb(250 249 255)`) should be named `lavender.50` or equivalent and documented as the platform's canonical page background for internal surfaces. These names should appear in the token tree, not only in individual `globals.css` comments.

2. **Map the canonical values to `--lb-color-bg` and `--lb-color-surface`.** Currently, `identity-platform` and `merchant-control-plane` set these values via local CSS variables (`--bg`, `--sidebar-bg`) that parallel the `--lb-color-*` token names without aliasing them. The canonical approach is to write `--lb-color-bg: rgb(250 249 255)` at the `:root` level for the relevant surfaces, rather than introducing shadow variables.

3. **Correct the three apps that have diverged accidentally.** `platform-console` and `platform-operations-portal` use `rgb(10 10 10)` as the dark background — a pure-black approximation that loses the violet warmth. `app-marketplace` uses `rgb(10 15 26)` — a bluer variant. These should be migrated to `rgb(10 9 18)` via a single `--lb-color-bg` token assignment.

4. **Document the ink lavender palette as a brand standard.** A line in the design system documentation stating "The canonical LetBuyy light background is `rgb(250 249 255)` (lavender.50) and the canonical dark background is `rgb(10 9 18)` (ink.950). Active applications must consume these values via `var(--lb-color-bg)`" closes the gap between current practice and enforceable standard.

---

## 4.2 Per-Application Visual Intelligence

### identity-platform

**Visual Mood and Brand Personality**

Premium, focused, and intimate. The identity platform is designed to disappear — to become a transparent vessel for the task of authentication. The lavender background is warm enough to feel human; the constrained palette is narrow enough to keep attention on the form. The brand personality is "trustworthy minimal": no illustrations, no gradients in the primary surface, no decorative motion. The auth flow earns trust through precision.

**Identity Type: Intentional**

The code is explicitly self-annotating. Comments include `AUTH DESIGN SYSTEM — Mobile-First`, `Premium Ink Lavender`, and `ONBOARDING DESIGN SYSTEM — Purple theme`. The iterative refinement visible in the globals.css (base values overridden in a `COMPACT AUTH FLOW POLISH` block) demonstrates active design curation, not accidental inheritance. `LetbuyyThemeProvider surface="identity"` assigns the correct surface slot.

**Color System**

The primary action color is `--lb-color-primary` (`#8B5CF6`, purple-500), consumed correctly via the token alias. The backgrounds and borders are hardcoded rather than token-aliased:

| Variable | Value | Status |
|---|---|---|
| `--bg` | `rgb(250 249 255)` | Hardcoded — should be `var(--lb-color-bg)` |
| `--bg-secondary` | `rgb(244 242 254)` | Hardcoded — no `--lb-*` equivalent |
| `--text-primary` | `rgb(10 8 22)` | Hardcoded — should be `var(--lb-color-text)` |
| `--border` | `rgb(224 216 248)` | Hardcoded — no `--lb-*` equivalent |

Violation: Local variable names shadow or parallel the `--lb-color-*` system without aliasing into it. Any future change to the design system's background value will not propagate to this app.

**Typography**

Geist Sans via `--font-letbuyy-sans`. Typographic scale is internally consistent: auth card titles at 22px mobile / 24px desktop, weight 700; subtitles at 14px; labels at 13px weight 500; inputs at 16px (intentionally sized to prevent iOS automatic zoom). The rhythm is compact but not cramped. Token compliance is not applicable at this granularity — the text component from `@letbuyy/ui` is not used in the auth flow; instead bespoke CSS classes (`auth-title`, `auth-subtitle`) are applied directly.

**Border Radius Treatment**

Mixed and layered. The base auth styles establish 8px for inputs and buttons, 16px for cards. A subsequent `COMPACT AUTH FLOW POLISH` block overrides inputs and buttons to 10px and cards to 18px. The OTP input uses 12px; onboarding bento cards use 14px. The result is five distinct radius values across the flow. Token compliance: low — the canonical radius tokens (`--lb-radius-sm = 4px`, `--lb-radius-md = 8px`, `--lb-radius-lg = 12px`, `--lb-radius-xl = 16px`) are not referenced. File of concern: `apps/identity-platform/src/app/globals.css`, lines approximately 1679 through 2000+.

**Shadow and Depth**

Minimal and intentional. Desktop auth card: `0 18px 48px rgba(15, 23, 42, 0.08)`. OTP focus ring: `0 0 0 3px rgba(139, 92, 246, 0.15)`. Dark card: `0 4px 32px rgba(0, 0, 0, 0.5)`. Shadows serve one purpose here — separating the auth card from the lavender page background. All values are hardcoded; no shadow tokens consumed.

**Spacing Rhythm**

Comfortable and deliberate. Auth card padding: 32px desktop. Form gap: 13px. Field-to-label gap: 7px. The rhythm serves a single-form-per-screen layout. Systematic, not random, but not drawn from `--lb-space-*` tokens.

**Icon System**

`MaterialIcon` from `@letbuyy/ui` via the `AuthIcon` wrapper. The wrapper enforces an `AuthIconName` type constraining the usable set to approximately 40 icons. The OTP step uses a purple-tinted circular container (`rgba(139, 92, 246, 0.1)`). Inline emoji are used for status states (success checkmark, error). Compliant with `@letbuyy/ui` re-exports; non-compliant on emoji usage for status.

**Motion**

Custom keyframe animations declared in `globals.css`: `fadeSlideIn`, `errorShakeIn`, `successPop`. These are local definitions — not from the design system token set. The token system provides `--lb-ease-*` variables; this app defines its own without cross-referencing them.

**Visual Debt**

- Button border-radius declared 8px, overridden to 10px in polish block (file: `globals.css`)
- Input border-radius: same dual-declaration
- Card border-radius: 16px then 18px — three-layer override stack
- `--purple` variable undefined until patched: `--purple: var(--primary)` (file: `globals.css`)
- Dark mode `.dark body` background re-declared in two separate media query blocks
- All background/border values hardcoded instead of referencing `--lb-color-*`

---

### marketing-site

**Visual Mood and Brand Personality**

Bold, aspirational, and dynamic. The marketing site is the platform's public-facing pitch — it projects ambition, scale, and modern commerce. The design references "Commerce Operating System," an editorial framing that establishes LetBuyy as infrastructure, not software. The visual language is data-visualization-forward in the hero section and icon-forward in the mega-menu.

**Identity Type: Strongly Intentional**

The comment `PREMIUM DESIGN TOKENS - LIGHT MODE (Matching light_theme_colors.dart)` reveals design-to-spec execution. A full gradient system, glow system, glass system, and custom easing curves were defined purposefully. Framer Motion is used throughout for entrance animation. This is the most thoroughly designed application in the platform. The sole misalignment: `layout.tsx` uses `surface="storefront"` — the wrong surface assignment.

**Color System**

Brand purple `#8B5CF6` via `--lb-color-primary`. Additionally:

| Variable | Value | Status |
|---|---|---|
| `--gradient-primary` | `linear-gradient(135deg, rgb(139 92 246) 0%, rgb(124 58 237) 50%, rgb(109 40 217) 100%)` | Local — not from tokens |
| `--accent` | `rgb(6 182 212)` — cyan | Local — the only app with cyan as explicit brand element |
| `--shadow-glow` | `0 0 60px rgba(139, 92, 246, 0.12)` | Local — not from tokens |
| `--bg-deep` | `rgb(250 249 255)` light / `rgb(10 9 18)` dark | Local name — should be `--lb-color-bg` |
| `--glass-bg` | `rgba(250, 249, 255, 0.95)` | Local — not from tokens |

Violation: All custom variables (`--bg-deep`, `--bg-dark`, `--bg-elevated`, `--shadow-glow`, `--gradient-*`) use local names instead of canonical `--lb-color-*` and `--lb-shadow-*` names. Technical debt but no visual breakage.

**Typography**

Geist Sans via `--font-letbuyy-sans`. Hero title uses fluid `clamp()` sizing. Header navigation inherits body size. Custom easing curves `--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1)` and `--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)` are duplicates of token-provided `--lb-ease-emphasized` and `--lb-ease-out`, declared locally without aliasing.

**Border Radius Treatment**

Not declared in `globals.css`. Radius is handled at the component class level (`btn-primary`, `btn-ghost`, `glass-border`). The hero section relies on glassmorphism effects and radial gradients as the primary visual treatment rather than rounded corners. Token compliance: neither compliant nor non-compliant — radius is simply absent from app-level CSS.

**Shadow and Depth**

Atmospheric, not structural. `--shadow-glow: 0 0 60px rgba(139, 92, 246, 0.12)` and `--shadow-card: 0 4px 8px rgba(139, 92, 246, 0.06)`. Shadows here communicate brand presence, not component elevation. All hardcoded.

**Spacing Rhythm**

Spacious. Container max-width 1400px. Section padding scales progressively across breakpoints: 20px → 24px → 40px → 60px. The header is scroll-aware (`scrolled` state after 50px). The mega-menu is a full DOM overlay with glassmorphism treatment. Spacing is systematic within the marketing context but not drawn from `--lb-space-*` tokens.

**Icon System**

Lucide via `@letbuyy/ui` re-exports (`ArrowRight`, `Zap`, `ChevronDown`, and others from the full Lucide set). This is correct — marketing surfaces need expressive icons. Compliant with `@letbuyy/ui` re-exports.

**Motion**

Framer Motion throughout — `initial={{ y: -100, opacity: 0 }}` on the header, `AnimatePresence` on the mobile drawer, component-level entrance animations. Lenis smooth scroll at `duration: 1.2` on the homepage. The most motion-forward application in the platform. Motion is programmatic (Framer Motion) rather than CSS-token-driven.

**Visual Debt**

- `surface="storefront"` in `layout.tsx` — wrong surface assignment; should be `surface="marketing"` once that surface is created (`apps/marketing-site/src/app/layout.tsx`)
- `--ease-smooth`, `--ease-bounce` duplicate token-provided easing curves under different names
- `--bg-deep`, `--bg-dark`, `--bg-elevated` use local names instead of `--lb-color-bg`, `--lb-color-surface`, `--lb-color-card`
- Cyan accent `rgb(6 182 212)` is not piped through `--lb-color-*` and is invisible to the design system

---

### merchant-control-plane

**Visual Mood and Brand Personality**

Professional, dense, and confident. This is a productivity tool — merchants process orders, manage inventory, and check dashboards without visual friction. The brand personality is "utilitarian with premium touches": precision earns trust here, not decoration. The app's most distinctive visual decision — an always-dark header in light mode — is a wayfinding statement rather than a decorative one.

**Identity Type: Intentional**

Code comments are explicit: `LETBUYY ADMIN — DESIGN SYSTEM / Synced with accounts app theme / Purple-first, light/dark mode support` and `— Sidebar — Ink Lavender —`. The inverted header (dark on light, light on dark) is a deliberate structural choice. `LetbuyyThemeProvider surface="admin"` is correct.

**Color System**

| Variable | Value | Status |
|---|---|---|
| `--header-bg` (light) | `rgb(10 9 18)` — near-black | Intentional inversion; hardcoded |
| `--header-fg` (light) | `rgb(255 255 255)` | Hardcoded |
| `--header-border` | `rgba(139, 92, 246, 0.14)` | Purple-tinted; hardcoded |
| `--sidebar-bg` | `rgb(244 242 254)` | Ink lavender sidebar; hardcoded |
| Content area bg | `rgb(250 249 255)` | Ink lavender page; via `--lb-color-bg` override |

The "PREMIUM PALETTE OVERRIDE" block writes `--lb-color-bg` at high specificity (`html [data-letbuyy-theme="light"]`) to inject the lavender values — a documented specificity hack with the comment "High-specificity selectors beat letbuyyTokenCss". This approach is functional but creates maintenance risk if the ThemeProvider changes its injection mechanism.

**Typography**

Geist Sans. The merchant app is the most complete consumer of `@letbuyy/ui` components. Typography is handled by the design system — `PageHeader`, `Page`, `Section`, `Card`, `MetricCard`, `Badge`, `Banner` all carry their own text styles via token-driven component CSS. The app itself does not define a type scale; it inherits one. Token compliance: high.

**Border Radius Treatment**

Sidebar items: 8px via `--sidebar-item-radius: 8px` (matches `--lb-radius-md`). Cards: 16px from `--lb-component-card-radius`. The merchant app is the most precisely token-aligned on radius. Compliant.

**Shadow and Depth**

Structured. Header search shadow: `0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 6px 20px rgba(139, 92, 246, 0.10)` — a subtle glow under the dark header's search field. Cards use component token shadows. Shadows serve structural and navigational purposes, not atmospheric ones.

**Spacing Rhythm**

Compact by explicit choice. Sidebar row height: `--sidebar-item-height: 32px` — this is below the compact density token `sidebarRowHeight: '40px'`, constituting a documented opt-out. Item padding: 10px horizontal, 6px vertical. Sidebar width: 226px (`--sidebar-width: 226px`). These values are precisely operator-set, not random.

**Icon System**

`MaterialIcon` from `@letbuyy/ui`. Icon names (`"settings"`, `"storefront"`) passed as `name` props. The `DashboardClient` passes icon names as JSX into `PageHeader` action slots. Full compliance with `@letbuyy/ui` re-exports.

**Motion**

Token-based transitions. No Framer Motion. The `AISidebar` slides in via CSS transitions using `--lb-*` easing variables. Appropriate for a productivity application — motion is functional (sidebar open/close, tab transitions), not ornamental.

**Visual Debt**

- `--admin-header-height: 64px` mirrors `--lb-density-header-height` but is a local variable — risk of drift if density system changes (file: `apps/merchant-control-plane/src/app/globals.css`)
- `--sidebar-item-height: 32px` is an explicit under-ride of the compact density token `sidebarRowHeight: '40px'` — this is intentional but undocumented as a deviation (file: `globals.css`)
- "PREMIUM PALETTE OVERRIDE" specificity hack — functional but fragile (file: `globals.css`)
- Settings pages use custom CSS classes (`settings-home-card`, `settings-general-stack`) instead of `Card + Section` from `@letbuyy/ui` — layout inconsistency within the app

---

### storefront-runtime

**Visual Mood and Brand Personality**

Neutral, theme-ready, and blank-slate. The storefront-runtime is fundamentally not a LetBuyy product — it is a LetBuyy-powered merchant product. Its visual identity is deliberately empty. The runtime provides hooks; the theme provides the face.

**Identity Type: Intentional (intentionally identity-less)**

The non-brand indigo primary (`rgb(99 102 241)`) is the clearest signal: this surface belongs to merchants, not to LetBuyy. `LetbuyyThemeProvider surface="storefront"` is correct. The wide font variable list and the `product-grid-dynamic` utility are scaffolding, not design.

**Color System**

| Variable | Value | Status |
|---|---|---|
| `--primary` | `rgb(99 102 241)` — indigo, NOT brand purple | Intentional divergence |
| `--secondary` | `rgb(139 92 246)` — brand purple as secondary | Intentional positioning |
| `--accent` | `rgb(244 114 182)` — pink | Theme hook |
| `--background` | `rgb(255 255 255)` — pure white | Theme-neutral default |

**Typography**

Ten font variables declared (`--font-outfit`, `--font-poppins`, `--font-lora`, `--font-space-grotesk`, `--font-playfair`, `--font-nunito`, `--font-open-sans`, `--font-dm-sans`, `--font-montserrat`, `--font-inter`). All resolve to Geist variants. This is a theme customization hook system — merchants select a "font" but receive Geist under a different variable name. This is a high-severity deception: a merchant selecting "Playfair Display" does not receive a serif font.

**Border Radius Treatment**

```css
--radius: 0.75rem; /* 12px */
--radius-lg: var(--radius);
--radius-md: calc(var(--radius) - 2px); /* 10px */
--radius-sm: calc(var(--radius) - 4px); /* 8px */
```

Skews rounder than the platform token system (which uses `sm=4px`). Disconnected from `--lb-radius-*` — expressed in `rem` with no connection to token values. Non-compliant.

**Shadow and Depth**

Minimal. Custom scrollbar styling only. No ambient or structural shadows at the runtime level. Theme-provided.

**Spacing Rhythm**

`product-grid-dynamic` declares `grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem`. This is a scaffold. All other spacing is theme-provided.

**Icon System**

Theme-dependent. Not defined at the runtime level.

**Motion**

`fade-in` and `slide-up` keyframe animations declared in globals.css. Theme-accessible transition hooks. Not from design system tokens.

**Visual Debt**

- Font aliases (`--font-lora`, `--font-playfair`, `--font-outfit`) do not load their named fonts — all resolve to Geist. Merchants believe they are selecting a typeface but are not. This is a critical merchant-facing deception (file: `apps/storefront-runtime/src/app/globals.css`)
- `--radius: 0.75rem` disagrees in unit with `--lb-radius-lg: 12px` — same numeric value, different unit system, no connection
- `--font-inter` as body stack also declared as `--font-body: var(--font-inter)` via `@theme` — two paths to the same variable

---

### platform-console

**Visual Mood and Brand Personality**

Austere, functional, and internal-tool. The platform-console is the super-admin surface — used by LetBuyy operators, not merchants. Minimal visual identity signals authority and reduces cognitive load for power users processing operational data.

**Identity Type: Accidental**

The globals.css is 38 lines with no named sections, no color palette rationale, and no design commentary. The only explicit identity decision is `defaultTheme="dark"` in `layout.tsx`. Everything else is "whatever the component library does."

**Color System**

```css
:root {
  --font-system: var(--font-letbuyy-sans), Arial, Helvetica, sans-serif;
  --background: rgb(255 255 255);
  --foreground: rgb(23 23 23);
  --lb-color-primary: rgb(139 92 246);
}
```

Hardcodes `--lb-color-primary` directly — redundant since `LetbuyyThemeProvider` already sets this value. Dark background: `rgb(10 10 10)` — differs from the canonical ink dark `rgb(10 9 18)` by 9 units on the green and blue channels. The difference is barely perceptible individually but creates measurable inconsistency when compared side-by-side with ink-correct surfaces.

**Typography**

`--font-system: var(--font-letbuyy-sans), Arial, Helvetica, sans-serif`. The Arial/Helvetica fallback (rather than `ui-sans-serif`) suggests the CSS was written for a Windows-first internal audience. No display font declared.

**Border Radius Treatment**

Not declared. Entirely deferred to `@letbuyy/ui` component defaults. Token compliance by delegation.

**Shadow and Depth**

Not declared. Deferred to component system.

**Spacing Rhythm**

Not declared. Deferred to component system.

**Icon System**

Not declared. Inherits from `@letbuyy/ui`.

**Motion**

None visible.

**Visual Debt**

- `--lb-color-primary: rgb(139 92 246)` hardcoded in globals.css — redundant and a drift risk (file: `apps/platform-console/src/app/globals.css`)
- `rgb(10 10 10)` dark background deviates from canonical `rgb(10 9 18)` — subtle but real inconsistency
- No visual differentiation from `platform-operations-portal` despite being a different product

---

### platform-operations-portal

**Visual Mood and Brand Personality**

Austere, functional, internal-tool — identical to platform-console.

**Identity Type: Accidental**

The `globals.css` is byte-for-byte identical to `platform-console/globals.css`. This is copy-paste or shared configuration with no differentiation. Two internal tools — one a super-admin console, one an employee operations portal — are visually indistinguishable from their CSS alone.

**Color System**

Identical to platform-console: `rgb(255 255 255)` light, `rgb(10 10 10)` dark, `rgb(139 92 246)` primary. Same deviation from canonical ink dark. Same redundant primary declaration.

**Typography, Border Radius, Shadow, Spacing, Icons, Motion**

All identical to platform-console. See platform-console entry above.

**Visual Debt**

- All platform-console visual debt applies identically
- Additionally: no visual signal differentiating this tool from platform-console — operators using both tools receive no context about which surface they are on (files: `apps/platform-operations-portal/src/app/globals.css`, `layout.tsx`)

---

### app-marketplace

**Visual Mood and Brand Personality**

Clean, browsable, and discovery-oriented. A focused experience for finding and evaluating apps. The closest analogy is a standard SaaS marketplace — high-contrast, neutral palette, emphasis on scannable card grids.

**Identity Type: Partially Intentional**

The explicit inline token declarations with slate-neutral borders (instead of purple-tinted lavenders) suggest someone made a considered choice to keep this surface neutral rather than warm. However, the rationale is undocumented in the code. The `layout.tsx` uses `surface="marketplace"` correctly.

**Color System**

| Variable | Value | Notes |
|---|---|---|
| `--lb-color-bg` | `rgb(255 255 255)` | Inline declaration — ThemeProvider already sets this |
| `--lb-color-border` | `rgb(226 232 240)` — slate-200 | NOT purple-tinted — deliberate cool neutrality |
| `--lb-shadow-card` | `0 1px 2px rgb(15 23 42 / 5%), 0 8px 24px rgb(15 23 42 / 4%)` | Slate-tinted shadow — neutral, not purple |
| `html.dark` bg | `rgb(10 15 26)` | Different from canonical `rgb(10 9 18)` — bluer |

The border and shadow colors are the defining visual difference. Where identity-platform and merchant-control-plane use purple-tinted borders (`rgb(224 216 248)`), the app-marketplace uses slate-neutral borders (`rgb(226 232 240)`). The result is a cooler, more neutral surface — appropriate for a marketplace that should feel like "neutral territory" rather than branded LetBuyy space.

**Typography**

Geist Sans via `--font-letbuyy-sans`. `--font-display-premium` for headings. Standard usage.

**Border Radius Treatment**

Not declared locally. Deferred to `--lb-*` component tokens. Token compliant by delegation.

**Shadow and Depth**

Slate-tinted card shadow (not purple-tinted). All values inline-declared rather than consumed from tokens.

**Spacing Rhythm**

Explicit section spacing: `--lb-section-y-desktop: 64px`, `--lb-section-y-large: 96px`, `--lb-section-y-mobile: 48px`. Container: `--lb-size-marketplace-container: 1200px`. Systematic and explicit.

**Icon System**

Deferred to `@letbuyy/ui`.

**Motion**

None declared.

**Visual Debt**

- Full `--lb-color-*` set declared inline in globals.css — duplicates what ThemeProvider already provides (file: `apps/app-marketplace/src/app/globals.css`)
- Dark background `rgb(10 15 26)` deviates from canonical `rgb(10 9 18)` — bluer dark mode
- "Legacy marketplace aliases" section (`--primary: var(--lb-color-primary)`) duplicates ThemeProvider mappings
- Slate border choice is correct contextually but undocumented — a future maintainer may "fix" it to purple-tinted unaware of the intent

---

### developer-portal

**Visual Mood and Brand Personality**

Technical, documentation-focused, and trustworthy. Developer documentation must feel familiar to engineers. The teal accent and subtle gradient background echo documentation portals (Stripe Docs, Vercel Docs). The narrow container optimizes for reading dense technical content.

**Identity Type: Intentional**

The teal accent system with four named semantic colors and the custom body gradient are explicit design decisions. This is the only app with a clearly different primary accent hue from the platform-wide purple. The narrower container (1180px vs. 1400px for marketing) is an intentional reading-width optimization.

**Color System**

| Variable | Value | Notes |
|---|---|---|
| `--developer-accent-teal` | `rgb(15 118 110)` — teal-700 | App-local; not in `--lb-color-*` |
| `--developer-accent-blue` | `rgb(37 99 235)` — blue-700 | App-local |
| `--developer-accent-amber` | `rgb(180 83 9)` — amber-700 | App-local |
| `--developer-accent-rose` | `rgb(190 18 60)` — rose-700 | App-local |
| Body background gradient | `linear-gradient(180deg, rgba(15, 118, 110, 0.08), transparent 360px)` over `var(--lb-color-bg)` | Teal fade; unique to this app |

The developer portal uses `--lb-color-primary` from ThemeProvider for interactive elements but overlays teal as the editorial accent. This creates a dual-hue identity: purple for actions, teal for context.

**Typography**

`--developer-font-sans`, `--developer-font-display`, `--developer-font-mono` — all mapped to Geist variants under developer-namespaced aliases. The mono stack is substantive: developer portals are heavy with code samples, and explicit mono font declaration signals that code blocks are a first-class element.

**Border Radius Treatment**

Not declared locally. Deferred to `--lb-*` component tokens.

**Shadow and Depth**

Glassmorphism topbar: `backdrop-filter: blur(18px)` with `color-mix(in srgb, var(--lb-color-bg) 90%, transparent)`. Correctly uses `var(--lb-color-bg)` in the color-mix formula — partial token compliance.

**Spacing Rhythm**

Container: `width: min(1180px, calc(100% - 32px))`. The narrower container compared to marketing (1400px) or marketplace (1200px) is appropriate for documentation readability.

**Icon System**

Uses `surface="marketplace"` in `layout.tsx` — same as app-marketplace, which is semantically incorrect for a developer portal. Should arguably use `surface="operations"` or a new `surface="developer"`.

**Motion**

Blur topbar transition on scroll. No Framer Motion.

**Visual Debt**

- `surface="marketplace"` in `layout.tsx` — wrong surface for a developer portal; shares surface with app-marketplace despite different visual intent (file: `apps/developer-portal/src/app/layout.tsx`)
- Developer accent colors (`--developer-accent-*`) are app-local and invisible to the design system — cannot be audited, changed, or themed centrally
- `density="compact"` set explicitly in `layout.tsx` when compact is already the default — redundant declaration

---

### theme-marketplace

**Visual Mood and Brand Personality**

Creative, gallery-like, and indigo-forward. The theme marketplace must "wow" — merchants evaluating themes are here to judge visual quality, and the marketplace itself must be visually credible. Of all platform apps, this one most aggressively differentiates its identity.

**Identity Type: Strongly Intentional**

The most independently designed app in the platform. A three-accent color system (indigo primary + cyan secondary + pink accent), a rose-tinted dark mode text color, a custom radius scale, and a distinct `@theme` block signal that someone designed this as a standalone creative product. The comment `THEME MARKETPLACE — Design Tokens (Shared)` and the `@theme { }` block indicate specification-driven design.

**Color System**

| Variable | Value | Notes |
|---|---|---|
| `--color-primary` | `rgb(108 92 231)` — indigo-purple | NOT `--lb-color-primary` (`rgb(139 92 246)`) — perceptibly different |
| `--color-primary-light` | `rgb(162 155 254)` | Own scale |
| `--color-primary-dark` | `rgb(72 52 212)` | Own scale |
| `--color-secondary` | `rgb(0 210 211)` — cyan | Creative accent |
| `--color-accent` | `rgb(253 121 168)` — pink | Playful/fashion accent |
| Background (light) | `rgb(248 249 252)` — cool gray, not lavender | Diverges from ink lavender |
| Background (dark) | `rgb(15 15 26)` — navy-dark, not ink | Bluer than canonical `rgb(10 9 18)` |
| Dark text primary | `rgb(238 187 195)` — rose-tinted white | Most distinctive dark-mode text in platform |

The `layout.tsx` uses `surface="marketplace"` which injects `--lb-color-primary: #8B5CF6` via ThemeProvider. The app's `@theme` block overrides this with `rgb(108 92 231)`. The cascade creates a subtle color conflict — ThemeProvider sets LetBuyy purple, the `@theme` block replaces it with a different purple-indigo.

**Typography**

Geist via `--font-letbuyy-*` variables mapped to local aliases `--font-inter`, `--font-display-premium`, `--font-mono-premium`.

**Border Radius Treatment**

Own named scale:

| Token | Value | Platform token |
|---|---|---|
| `--radius-sm` | `6px` | `--lb-radius-sm = 4px` — disagrees |
| `--radius-md` | `10px` | `--lb-radius-md = 8px` — disagrees |
| `--radius-lg` | `16px` | `--lb-radius-lg = 12px` — disagrees |
| `--radius-xl` | `24px` | `--lb-radius-xl = 16px` — disagrees |

All four radius values are larger than their platform counterparts. The theme marketplace skews rounder — appropriate for a creative/gallery product but entirely disconnected from the canonical system.

**Shadow and Depth**

Three-level shadow scale plus glow: `--shadow-glow: 0 0 30px rgba(108, 92, 231, 0.15)` — using the local indigo primary rather than `--lb-color-primary`. Glassmorphism planned via `--glass-bg`, `--glass-card-bg`, `backdrop-blur` declarations.

**Spacing Rhythm**

`--spacing-section: 80px`, `--spacing-container: 1280px`. Explicit and consistent.

**Icon System**

Uses `surface="marketplace"` in `layout.tsx`. All icon handling deferred to `@letbuyy/ui`.

**Motion**

Transition tokens declared in `@theme` block. Glass effects planned via backdrop-blur. No Framer Motion evident.

**Visual Debt**

- `--color-primary: rgb(108 92 231)` is not the LetBuyy brand purple — brand identity divergence in a frozen app (file: `apps/theme-marketplace/src/app/globals.css`)
- Radius scale (`sm=6, md=10, lg=16, xl=24`) has no connection to platform tokens — entirely parallel system
- `surface="marketplace"` in `layout.tsx` while the `@theme` block overrides the ThemeProvider's primary color — creates a color cascade conflict (file: `apps/theme-marketplace/src/app/layout.tsx`)
- Rose-tinted dark text (`rgb(238 187 195)`) is unique in the platform and would require special handling for any cross-surface theming

---

## 4.3 Cross-App Visual Coherence Analysis

### Visual Families

Three distinct visual families emerge from the nine applications:

**Family 1: The Ink Lavender Core (identity-platform, merchant-control-plane, marketing-site)**

These three apps share the `rgb(250 249 255)` page background, `rgb(10 9 18)` dark background, purple-tinted borders, and Geist Sans. They form the user's primary experience: discover the product on the marketing site, create an account through the identity platform, manage the store in the merchant control plane. A user navigating this path experiences visual continuity — same color temperature, same type system, same purple interaction language. This is LetBuyy's face to the world.

**Family 2: The Neutral Slate Tier (app-marketplace, developer-portal, platform-console, platform-operations-portal)**

These four apps use white or near-white light backgrounds and slate/cool-neutral borders. They feel deliberately de-branded — either to communicate "neutral territory" (marketplace, developer portal) or functional austerity (internal consoles). The family shares an absence of the lavender warmth. The internal tools belong here by accident; the marketplace apps belong here by (partially documented) intent.

**Family 3: The Independent Identities (storefront-runtime, theme-marketplace)**

These two apps have distinct, self-contained color systems that diverge intentionally from the platform. The storefront-runtime is blank-slate by design; the theme-marketplace has its own creative brand (indigo + cyan + pink). Both are either frozen or theme-driven, reducing the immediate cross-surface consistency impact.

### Dangerous Divergences

**Divergence 1: Surface misassignment in marketing-site**

`marketing-site` uses `surface="storefront"`. This is latent. Currently, all surfaces resolve to identical token values, so there is no visible symptom. If the design system ever differentiates the `storefront` surface visually — adding a different radius, a different shadow, a different primary shade for commerce contexts — the marketing site will inherit merchant-storefront styling. The fix is cheap now and expensive later. Assign `surface="marketing"` once that surface is created.

**Divergence 2: Dark background fragmentation**

Four different dark backgrounds across nine apps:

| Value | Apps | Deviation from canonical |
|---|---|---|
| `rgb(10 9 18)` — canonical ink.950 | identity, merchant, marketing | None — canonical |
| `rgb(10 10 10)` | platform-console, platform-operations-portal | +1G, +8B — barely perceptible |
| `rgb(10 15 26)` | app-marketplace | +6G, +8B — perceptible in side-by-side |
| `rgb(15 15 26)` | theme-marketplace | +5R, +6G, +8B — navy cast, clearly different |

A user who browses the app marketplace in dark mode and then switches to the merchant dashboard will see a perceptibly different dark background. The experience is not broken but is inconsistent in a way that accumulates over time.

**Divergence 3: Border temperature split**

Internal/branded apps use purple-tinted borders (`rgb(224 216 248)`). Discovery apps use slate-neutral borders (`rgb(226 232 240)`). This split may be contextually correct — internal tools should feel branded, discovery surfaces should feel neutral — but it is undocumented. A maintainer who "corrects" the marketplace border to purple-tinted would inadvertently change the app's personality.

**Divergence 4: Primary color in theme-marketplace**

The theme-marketplace primary `rgb(108 92 231)` is perceptibly different from the LetBuyy brand purple `rgb(139 92 246)`. The R channel is 31 units lower (less red = more blue-shifted). A merchant who opens the theme marketplace sees a different shade of the brand's primary color. Because the app is frozen, this is not an active regression, but it would matter if the app were reactivated.

### What a User Experiences Moving Between Surfaces

**Merchant-focused journey (discovery → auth → dashboard):**
A user who discovers LetBuyy through the marketing site, creates a store via the identity platform, and then opens the merchant dashboard will experience near-seamless visual continuity. The page backgrounds match, the dark mode matches, the type system is identical, and the purple primary color is consistent. This is the platform's strongest cross-surface story.

**Developer journey (marketing → developer portal):**
Moving from the marketing site to the developer portal introduces a color temperature shift — the teal body gradient replaces the pure lavender background, and the topbar style changes from Framer Motion entrance animation to glassmorphism blur. The transition is not jarring but is noticeable. The portal feels like a separate product.

**Admin journey (merchant dashboard → platform-console):**
If a LetBuyy operator uses both the merchant dashboard (to understand a merchant's perspective) and the platform-console (to take operator actions), they move between two apps with similar but not identical dark modes (`rgb(10 9 18)` vs. `rgb(10 10 10)`). The more significant difference is the sidebar: the merchant dashboard has a 220px sidebar with lavender background and grouped navigation; the platform-console has a 260px sidebar with a flat 17-item list. The jump is perceptible as a context switch, which is appropriate for crossing the merchant/operator boundary.

---

## 4.4 Dark Mode Intelligence

### All Four Dark Background Values Found

| Value | App(s) | Description | Canonical? |
|---|---|---|---|
| `rgb(10 9 18)` | identity-platform, merchant-control-plane, marketing-site | ink.950 — deep violet-tinted dark | YES — canonical |
| `rgb(10 10 10)` | platform-console, platform-operations-portal | Near-black — no violet tint | No — accidental deviation |
| `rgb(10 15 26)` | app-marketplace | Bluer dark — slate-midnight cast | No — divergence |
| `rgb(15 15 26)` | theme-marketplace | Navy-dark — distinctly blue | No — intentional but non-canonical |

`storefront-runtime` has no dark mode at the runtime level — the app does not declare a dark background (`rgb(255 255 255)` only). Dark mode for the storefront is theme-provided.

### Which Is Canonical

The canonical dark background is `rgb(10 9 18)`, which is:
- `ink.950` in the token palette (`#0a0912`)
- The value described in code as "deep violet-tinted dark" in `tokens.ts`
- Used by the three highest-traffic, highest-visibility applications in the platform (marketing, auth, merchant)
- The value that ThemeProvider resolves `var(--lb-color-bg)` to in dark mode

The ink.950 dark has a specific visual character: compared to pure black, it has slightly elevated green (+9) and blue (+18) channels. This creates the violet warmth described in the token documentation. The difference is subtle when viewed in isolation but unmistakable when switched into after a surface using `rgb(10 10 10)`.

### Migration Path

**Step 1: No-op assessment**
`platform-console` and `platform-operations-portal` use `rgb(10 10 10)`. Migrating them to `rgb(10 9 18)` requires changing one CSS value in two `globals.css` files. Risk: zero. These are internal tools; no merchant sees them. Action: straightforward one-line fix.

**Step 2: App marketplace alignment**
`app-marketplace` uses `rgb(10 15 26)`. This is 6 units bluer than canonical. The fix is to change the dark background declaration to use `var(--lb-color-bg)` from ThemeProvider rather than hardcoding a value. The app already declares the full `--lb-color-*` set inline; removing the inline dark background declaration will allow ThemeProvider to set the canonical value. Action: remove the inline dark background declaration in `apps/app-marketplace/src/app/globals.css`.

**Step 3: Theme marketplace (deferred)**
`theme-marketplace` uses `rgb(15 15 26)` intentionally — the navy-dark is part of its creative identity. Because the app is frozen, migration should be deferred until the app is reactivated. When reactivated, the team should decide whether to adopt the canonical ink dark or to create an official "creative" surface token that permits the navy variant.

**Step 4: Token enforcement**
Add a validator to the 107-validator gate that flags any `globals.css` declaring a dark background value other than `var(--lb-color-bg)` or `rgb(10 9 18)`. This prevents future apps from accidentally diverging.

---

## 4.5 Visual Identity Decisions (Binding)

The following statements are binding decisions for all active applications. Frozen applications (`app-marketplace`, `developer-portal`, `theme-marketplace`) are exempt until reactivated.

**Decision 1: Canonical ink-lavender dark background**
The canonical LetBuyy dark page background is `rgb(10 9 18)` (`ink.950`, `#0a0912`). All active apps MUST use `var(--lb-color-bg)` for their dark page background. Direct hex values are prohibited in `globals.css` for this property. Current violations: `platform-console` (`rgb(10 10 10)`), `platform-operations-portal` (`rgb(10 10 10)`).

**Decision 2: Canonical ink-lavender light background**
The canonical LetBuyy light page background for internal surfaces (identity, merchant, marketing) is `rgb(250 249 255)`. All active apps targeting these surfaces MUST use `var(--lb-color-bg)` which resolves to this value. Current implementation: achieved via high-specificity override in merchant-control-plane. Recommended implementation: set at the ThemeProvider surface level so no override is needed.

**Decision 3: Brand purple is #8B5CF6**
The canonical LetBuyy primary color is `#8B5CF6` = `rgb(139 92 246)`. All active apps MUST reference this value through `var(--lb-color-primary)`. Direct hex declarations in `globals.css` are prohibited. Current violations: `platform-console` and `platform-operations-portal` hardcode `rgb(139 92 246)` directly (redundant, not wrong, but a drift risk).

**Decision 4: surface="marketing" for the marketing site**
The marketing site MUST NOT use `surface="storefront"`. A `marketing` surface MUST be added to the token system and assigned to the marketing site. Until the surface is created, the marketing site should use `surface="identity"` as a temporary proxy (both have identical token values; the distinction is semantic). Current violation: `apps/marketing-site/src/app/layout.tsx` uses `surface="storefront"`.

**Decision 5: Font aliases must load the fonts they name**
The storefront-runtime MUST NOT declare font CSS variables (`--font-lora`, `--font-playfair`, etc.) that resolve to Geist variants. If merchant font selection is a planned feature, the aliases must load the actual font files or the feature must be disabled. Merchants who select "Playfair Display" and receive Geist are being misled. Current violation: `apps/storefront-runtime/src/app/globals.css`.

**Decision 6: No more than one CSS override stack per property**
The identity-platform's three-layer border-radius override (8px base → 10px polish → varied per-component) MUST be resolved to a single declaration per element. Stacked overrides for the same property across multiple CSS blocks are prohibited. The final intent (10px inputs/buttons, 16px cards) should be declared once in the appropriate section. Current violation: `apps/identity-platform/src/app/globals.css`.

**Decision 7: Purple-tinted borders for internal branded surfaces**
The canonical border for identity, auth, and merchant surfaces is `rgb(224 216 248)` (purple-tinted). The canonical border for discovery/marketplace surfaces is `rgb(226 232 240)` (slate-neutral). This distinction MUST be documented in the design system as an explicit rule, not inferred from practice.

---

---

# PART 5: LAYOUT TOPOLOGY

---

## 5.1 Global Layout Primitives

Every layout primitive in the `@letbuyy/ui` package is sourced from three files:
- `packages/typescript/ui/src/app-shell.tsx` — shell primitives (`AppFrame`, `Sidebar`, `Navigation`, `AppNavigation`)
- `packages/typescript/ui/src/layout.tsx` — page-level layout (`Page`, `PageHeader`, `Card`, `Section`, `Container`, `Box`, `BlockStack`, `InlineStack`, `Grid`, `Columns`)
- `packages/typescript/ui/src/navigation/app-navigation.tsx` — the canonical data-driven shell

### AppFrame

The root frame for any app that has a sidebar. A `div.flex.min-h-screen` with two children: an optional left sidebar slot and a right `flex-col` containing an optional `header` element and a `main.min-w-0.flex-1.overflow-auto` content area. `AppFrame` imposes no visual opinion; it is a pure structural composition primitive.

Token-controlled layout variables: `--lb-component-sidebar-bg` (sidebar background), `--lb-component-sidebar-border` (sidebar right border).

**Apps using AppFrame:** merchant-control-plane (via AppNavigation), platform-console (via AppNavigation).

### Sidebar

Fixed-width `aside` with three zones: optional `header` (brand area), scrollable `content`, and optional `footer` (secondary navigation). Width is controlled by a `width` prop:

| Variant | Width |
|---|---|
| `sm` | 220px |
| `md` (default) | 260px |
| `lg` | 320px |

Background: `--lb-component-sidebar-bg`. Border-right: `--lb-component-sidebar-border`. The sidebar is not collapsible at the primitive level — collapsibility is handled by the consuming application shell.

**Apps using Sidebar:** merchant-control-plane (width="sm", 220px), platform-console (width="md", 260px default).

### Navigation

Renders a `<ul>` of `NavItem` components supporting two-level hierarchy (parent items with collapsible children). Active state is managed via `bg-[--lb-component-sidebar-active-bg]` and `text-[--lb-component-sidebar-active-text]` tokens. Children indent under the icon column using `pl-[calc(space-3+icon-size+space-2)]`. Badges are supported on parent items. The expand/collapse chevron rotates 90 degrees when open.

### AppNavigation

The canonical shell. Composes `AppFrame + Sidebar + Navigation` from a `sections: AppNavigationSection[]` prop. Active state is computed automatically from `usePathname()`, eliminating the need for manual active-prop management. Sections may carry an optional `title` string rendered as an uppercase caption label. This is the single entry point that consuming apps should use rather than composing `AppFrame`, `Sidebar`, and `Navigation` independently.

**Apps using AppNavigation:** merchant-control-plane, platform-console.

### Page

The canonical page content container. A `<main>` element with:
- `mx-auto` horizontal centering
- `max-w-[--lb-size-page-max]` width constraint
- `px-[--lb-space-3] py-[--lb-space-3]` on mobile, scaling to `sm:px-[--lb-density-card-padding] sm:py-[--lb-density-page-gap]` on larger viewports
- `flex flex-col gap-[--lb-density-page-gap]` vertical layout with density-token-controlled gap

All spacing and width decisions are driven by density tokens (`--lb-density-*`), allowing the entire page's rhythm to be changed by switching density mode (compact / comfortable / spacious). All active apps default to `compact`.

**Apps using Page:** merchant-control-plane (all standard routes), platform-console.

### PageHeader

The canonical page introduction block. Contains a structured composition:
- Optional `Breadcrumbs` (hidden by default, enabled via `showBreadcrumbs` prop)
- Optional `eyebrow` label (uppercase caption, primary color, communicates section context)
- `<h1>` with auto-resolved `MaterialIcon` from the `resolvePageIdentity` map
- Optional `description` (one-liner, subdued color)
- Optional `primaryAction` (filled button) and `secondaryActions[]` (outline buttons), right-aligned on `md+`, stacked on mobile with `[&>*]:max-sm:flex-1`
- Minimum height: `--lb-density-header-height`
- Responsive: stacks vertically on mobile, switches to row layout at `md:`

`PageHeader` is the most used primitive across active pages. Every merchant-control-plane standard page renders a `PageHeader`. The `resolvePageIdentity` function maps 15 page identity keys (`dashboard`, `products`, `orders`, `collections`, `inventory`, `customers`, `analytics`, `marketing`, `discounts`, `content`, `settings`, `apps`, `themes`, `payments`, `domains`) to automatically assigned `MaterialIcon` names, removing the need for each page to manually select an icon.

**Apps using PageHeader:** merchant-control-plane (all standard + settings routes), platform-console.

### Card

A `<section>` element with border (`--lb-color-border`), background (`--lb-color-surface`), rounded corners (`--lb-component-card-radius = 16px`), and optional shadow. Three layout variants: `default` (vertical stack), `stack` (explicit vertical), and `split` (two-column grid on `md+`, collapses to single column on mobile).

### Section

Content area inside a `Card`. Carries an optional `title` (rendered as `<h2>`), optional `description`, optional `action` slot (right-aligned header action), and a `columns` prop (1, 2, or 3) that sets a CSS grid for children. Padding: `--lb-density-card-padding`.

### Container

Centering wrapper with width options: `sm`, `md`, `lg`, `xl`, `page` (max `--lb-size-page-max`), `measure` (optimal reading width), or `full`. Default: `max-w-[--lb-size-page-max]` with `mx-auto`. Used within marketing pages and in the developer portal for narrower reading-column layouts.

### Box, BlockStack, InlineStack, Grid, Columns

Primitive layout atoms. All use `--lb-space-*` gap tokens. All include `min-w-0` for safe truncation. These are used internally by higher-level components (`Card`, `Section`, `PageHeader`) and are available for bespoke layouts within page content.

### Text

Component with variants: `display`, `heading`, `body`, `caption`, `subdued`, `strong`, `positive`, `negative`, `code`. All consume `--lb-font-size-*` and `--lb-color-text-*` tokens. When using `Text`, apps consume the type system without declaring font sizes locally.

---

## 5.2 The Five Layout Archetypes

### Archetype 1: The Merchant Dashboard Layout

**Description**

A three-zone application shell — fixed top header, persistent left sidebar, scrollable main content — surrounding pages structured as `Page > PageHeader > Card/Section > content`. This is the dominant layout pattern in the merchant-facing surface and represents the largest engineering investment in the platform's layout system.

**Token variables that control it**

| Variable | What it controls |
|---|---|
| `--lb-density-header-height` | Fixed top bar height (mirrors `--admin-header-height: 64px`) |
| `--lb-component-sidebar-bg` | Sidebar background color |
| `--lb-component-sidebar-border` | Sidebar right-edge border |
| `--lb-component-sidebar-active-bg` | Active nav item background |
| `--lb-component-sidebar-active-text` | Active nav item text color |
| `--lb-size-page-max` | Max-width of the content column inside `Page` |
| `--lb-density-card-padding` | Horizontal/vertical padding of cards and page edges |
| `--lb-density-page-gap` | Vertical gap between `Page` children (between cards) |
| `--lb-radius-xl` | Card corner radius (16px) |

**Sidebar behavior**

220px fixed on desktop (`lg+`). Hidden on mobile — replaced by a hamburger-triggered full-height slide-in overlay with backdrop. The sidebar is `sticky`, with `height: calc(100vh - admin-header-height)` and `self-start` so it tracks scroll without leaving the viewport.

**Header behavior**

Fixed position, `z-50`, full viewport width. The dark-on-light header inversion (dark bg in light mode, light bg in dark mode) is implemented via `--header-bg` switching — the header always contrasts against the page regardless of theme mode.

**Mode switching**

The `AdminShell` component switches between three modes based on the current pathname:
- Standard (sidebar + header): all non-settings, non-full-screen routes
- Settings (header only, no sidebar): all `/settings/*` routes
- Full-screen (no header, no sidebar): `/editor`, `/access_account/checkout`, `/subscribe/checkout`

**Used by:** merchant-control-plane (primary), platform-console (simplified variant)

---

### Archetype 2: The Auth/Onboarding Flow

**Description**

Centered card on a colored page, no persistent navigation. Every page is a self-contained modal-like experience. The shell is minimal by design — the card is the product. No `AppFrame`, no `Sidebar`, no `PageHeader` from `@letbuyy/ui`. All layout is bespoke CSS.

**Structure**

```
div.auth-container (full-viewport flex center, both axes)
└── div.auth-card [optionally + .onboard-card for wider variant]
    ├── div.auth-logo (BrandLogo component)
    ├── div.auth-top-bar (language + theme + user — onboarding only)
    ├── div.auth-error (conditional error banner)
    ├── h1.auth-title
    ├── p.auth-subtitle
    ├── [form / step content]
    └── [action buttons]
```

**Key characteristics**

- Card width: ~400–500px centered. On mobile, the card goes full-bleed with the lavender background.
- Background: two-layer in light mode (lavender page + white card, creating lift). Single-layer in dark mode (ink page + barely-differentiated ink card, differentiated by `rgba(139,92,246,0.18)` border).
- No persistent navigation. Multi-step flows (onboarding wizard, 3 steps) are controlled by a client-side `step` state variable — not URL-based.
- Chrome is additive only when needed: the language switcher and theme toggle appear on the onboarding page but not on login/signup/forgot-password.

**Used by:** identity-platform (all auth pages, store selection, onboarding, OAuth flows)

---

### Archetype 3: The Marketing Surface

**Description**

Full-width, long-scroll marketing pages. No app shell. Sticky top navigation with mega-menus. Hero section followed by discrete content sections each spanning the full viewport width with `max-w-[1400px]` internal centering.

**Structure**

```
html
└── body
    ├── Header (sticky, scroll-aware, glassmorphism)
    │   ├── [desktop] Logo + horizontal nav + mega-menus + CTA
    │   └── [mobile] Logo + hamburger → full-height right drawer
    ├── main
    │   ├── Hero (full-width, gradient background, animated)
    │   ├── [Content sections] (CapabilityMap, MerchantJourney, Features, Pricing, FAQ, EcosystemMap, FinalCTA)
    │   └── [each section: full-width wrapper → max-w-[1400px] inner container]
    └── Footer
```

**Gradient usage**

The marketing site is the only active app with explicit gradient surface treatments:
- `--gradient-primary: linear-gradient(135deg, rgb(139 92 246) 0%, rgb(124 58 237) 50%, rgb(109 40 217) 100%)` — used for CTA buttons and hero accent elements
- `--gradient-dark: linear-gradient(180deg, ...)` — dark-mode section backgrounds
- `--gradient-radial: radial-gradient(...)` — hero background halo effects
- `--glass-bg: rgba(250, 249, 255, 0.95)` with `backdrop-filter: blur(12px)` — header glassmorphism

**Responsive behavior**

Breakpoint at `1024px` (`lg`). Below `lg`: hamburger replaces the horizontal navigation. The mobile drawer (AnimatePresence + slide from right) has panel drill-down for nested navigation. Smooth scroll via Lenis (`duration: 1.2`) on the homepage.

**Section rhythm**

Section padding: 20px mobile → 40px tablet → 60px desktop. Container: 1400px max-width. Sections are visually separated by background color or gradient shifts rather than borders.

**Used by:** marketing-site

---

### Archetype 4: The Internal Operations Console

**Description**

Forced dark, information-dense, no decorative elements. An internal operations tool layout — sidebar navigation + header utilities + content area. Minimal visual chrome. The application shell is identical in structure to the Merchant Dashboard Layout but stripped of the lavender warmth, Framer Motion, the command palette search, and the AI sidebar.

**Structure**

```
html (LetbuyyThemeProvider defaultTheme="dark")
└── body
    ├── (auth) routes — plain (no shell)
    │   ├── /login
    │   └── /mfa
    └── (dashboard) routes — AppNavigation (MFA required)
        ├── Sidebar 260px
        │   ├── Brand: "LetBuyy" + red "Console" badge
        │   └── Navigation (17 items, single flat list)
        ├── Header area (ThemeToggle + user email + Logout)
        └── main content → Page + PageHeader + Card/Section
```

**Forced dark default**

`defaultTheme="dark"` in `layout.tsx` — the only active app to set a non-system default. Internal operators work in dark mode by design. This is a deliberate ergonomic decision for a tool used for extended data-processing sessions.

**Information density**

No ambient glow. No gradient surfaces. No Framer Motion. No store-switcher. No command palette search. No AI sidebar. Sidebar navigation is a flat 17-item list with no grouping titles. The interface removes every decorative element to maximize space for operational data.

**No mobile optimization**

The sidebar is hidden below `lg` with no hamburger substitute. The console is an internal tool used on desktop. Mobile fallback is not implemented and not required.

**Used by:** platform-console, platform-operations-portal (structurally identical)

---

### Archetype 5: The Storefront Presentation Layer

**Description**

Intentionally identity-less. The runtime shell is a near-empty React tree. A single `RootLayout` with fonts and ThemeScript, receiving `{children}` that resolve to either the Liquid rendering path or the React theme rendering path. The presentation layer's layout is entirely determined by the active merchant theme, not by the runtime.

**Structure**

```
html (LetbuyyThemeProvider surface="storefront")
└── body.antialiased
    └── RootLayout (fonts + ThemeScript + SpeedInsights)
        └── {children}
            ├── [Liquid rendering path] — when THEME_LIQUID_RENDERING_DEFAULT_ENABLED=true
            └── [React theme rendering path] — default (Liquid canary off)
```

**What the runtime provides**

- Font variable declarations (10 named slots, all resolving to Geist — see Decision 5 in section 4.5)
- Default indigo primary color (`rgb(99 102 241)`) as the "unthemed" state
- `product-grid-dynamic` grid utility for product listing pages
- `glass` and `glass-dark` Tailwind utilities for theme authors to use
- `fade-in` and `slide-up` keyframe animations as theme-accessible hooks
- Custom scrollbar styling

**What the runtime does not provide**

- Header, footer, navigation, hero, product detail, cart, checkout layout — all theme-provided
- Sidebar, page structure, section spacing — all theme-provided
- Dark mode — the runtime declares no dark background; themes provide it

**Blank-slate principle**

The non-brand indigo primary (`rgb(99 102 241)`) is the clearest signal of this principle. If a merchant has not applied a theme, their store shows an indigo color that does not look like LetBuyy. This prevents storefronts from accidentally inheriting LetBuyy's brand identity.

**Used by:** storefront-runtime

---

## 5.3 Per-Application Layout Analysis

### merchant-control-plane

**Archetype:** Merchant Dashboard Layout

**ASCII Layout Tree**

```
┌─────────────────────────────────────────────────────────────┐
│  HeaderBar [fixed, dark on light]  64px                     │
│  [logo] [search] [ai] [notifications] [store switcher]      │
└─────────────────────────────────────────────────────────────┘
┌──────────────┬──────────────────────────────────────────────┐
│  Sidebar     │  Main content area                           │
│  220px       │  max-w-[--lb-size-page-max], centered        │
│  sticky      │                                              │
│  [brand]     │  Page                                        │
│  [nav]       │  ├── PageHeader (breadcrumb + title + CTAs)  │
│  ├─ Home     │  ├── [Banner, conditional]                   │
│  ├─ Orders   │  ├── Card                                    │
│  ├─ Money    │  │   └── Section                             │
│  ├─ Products │  │       └── [Table / form / metrics]        │
│  ├─ Mktg    │  └── [Additional Cards]                      │
│  └─ Content  │                                              │
│              │  [AISidebar] (inline, pushes content)        │
│  [settings]  │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

**Sidebar Details**
- Width: 220px (`sm` variant)
- Background: `rgb(244 242 254)` — ink lavender
- Collapsible: yes — hidden at `<lg`, slide-in overlay on mobile via hamburger
- Mobile trigger: hamburger in HeaderBar left
- Mobile close: backdrop overlay tap
- Navigation sections: Primary, Sales channels, Apps, (footer) Settings
- Active state: `--lb-component-sidebar-active-bg` / `--lb-component-sidebar-active-text`
- Keyboard shortcuts: `g h/o/p/i/c/m/d/r/t/y/a/x/s`

**Header Details**
- Fixed position, full-width, `z-50`
- Dark background in light mode: `rgb(10 9 18)`
- Always inverted: dark on light / light on dark
- Left: hamburger (mobile only) + LetBuyy logo
- Center: command palette trigger (`⌘K`)
- Right: mobile search icon, AI assistant toggle, notifications bell, store-switcher pill
- Bottom sheets on mobile for store-switcher and notifications

**Page Header Pattern**
Every standard page: `eyebrow` (section category) + `title` (with auto-icon) + `description` + `breadcrumbs` + `primaryAction` + optional `secondaryActions`. Responsive: stacks vertically on mobile, row on `md+`.

**Navigation Pattern:** Left sidebar, permanent desktop / drawer mobile

**Responsive Behavior**
- Mobile breakpoint: 768px for header logic; 1024px for sidebar visibility
- Sidebar: `hidden lg:flex`, overlay mode on mobile
- PageHeader: `flex-col md:flex-row`
- Actions: `[&>*]:max-sm:flex-1`
- Bottom sheets replace dropdowns on mobile

**Layout Consistency Score: 8/10**

Known violations:
- Settings pages use custom CSS classes (`settings-home-card`, `settings-general-stack`) instead of `Card + Section` from `@letbuyy/ui` — creates a two-pattern system within the same app
- Theme editor bypasses all layout primitives — full-screen canvas, acceptable exception
- Full-screen checkout flows bypass shell entirely — acceptable exception

---

### platform-console

**Archetype:** Internal Operations Console

**ASCII Layout Tree**

```
┌─────────────────────────────────────────────────────────────┐
│  Header area (right-aligned)                                │
│  [ThemeToggle] [user email] [Logout]                        │
└─────────────────────────────────────────────────────────────┘
┌──────────────────┬──────────────────────────────────────────┐
│  Sidebar 260px   │  Main content area                       │
│  [brand]         │                                          │
│  LetBuyy         │  Page                                    │
│  [Console] badge │  └── PageHeader + Card/Section           │
│                  │                                          │
│  [flat 17-item   │                                          │
│   nav list]      │                                          │
│                  │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

**Sidebar Details**
- Width: 260px (`md` default)
- No mobile support — hidden below `lg`, no hamburger
- Single flat section, 17 items, no grouping titles
- Brand: "LetBuyy" wordmark + red "Console" badge (high-criticality signal)
- No footer navigation

**Header Details**
- Right-aligned utilities only: theme toggle, user email, logout
- No search, no store-switcher, no notifications
- Minimal by intent

**Page Header Pattern**
Uses `Page + PageHeader + Card/Section` from `@letbuyy/ui` — consistent with merchant patterns but with different data domains (merchant directory, revenue, subscriptions, etc.)

**Navigation Pattern:** Left sidebar, permanent desktop only (no mobile)

**Responsive Behavior**
- No mobile optimization — internal tool used on desktop only
- Sidebar hidden below `lg` but no fallback

**Layout Consistency Score: 7/10**

Known violations:
- No mobile navigation fallback — acceptable for internal tool but worth noting
- Visual identity identical to platform-operations-portal — no context signal for which tool the operator is using

---

### identity-platform

**Archetype:** Auth/Onboarding Flow

**ASCII Layout Tree**

```
┌──────────────────────────────────────────────────────────────┐
│  page background: rgb(250 249 255)                           │
│                                                              │
│             ┌──────────────────────────┐                    │
│             │  auth-card               │                    │
│             │  400–500px centered      │                    │
│             │  [auth-top-bar optional] │                    │
│             │  [BrandLogo]             │                    │
│             │  [auth-error optional]   │                    │
│             │  h1.auth-title           │                    │
│             │  p.auth-subtitle         │                    │
│             │  [form content]          │                    │
│             │  [action buttons]        │                    │
│             └──────────────────────────┘                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Sidebar Details:** None

**Header Details**
- Present only on the onboarding page (`/onboarding`) as `auth-top-bar`
- Contains: language switcher (EN/HI/TA), theme toggle, user avatar + dropdown
- Not present on login, signup, forgot-password, set-password, reset-password, or check-email pages

**Page Header Pattern**
No `PageHeader` from `@letbuyy/ui`. Each auth step uses `h1.auth-title` + `p.auth-subtitle` — bespoke CSS classes. These are intentionally minimal to avoid visual noise on a focused form.

**Navigation Pattern:** Step wizard (3 steps for onboarding), no persistent nav. Steps controlled by client-side `step` state.

**Responsive Behavior**
- Mobile-first: auth cards are full-bleed on mobile (no card lift), centered with lift on desktop
- Language support: EN/HI/TA (stored in `localStorage`)
- Inputs sized at 16px to prevent iOS automatic zoom

**Layout Consistency Score: 9/10**

Known violations:
- Three-layer border-radius override stack (base → polish → per-component) — inconsistent values across the flow despite visual coherence in the final rendered state
- No violations in structural layout — the auth/onboarding archetype is uniformly applied

---

### marketing-site

**Archetype:** Marketing Surface

**ASCII Layout Tree**

```
┌──────────────────────────────────────────────────────────────┐
│  Header [sticky, glassmorphism, scroll-aware]                │
│  [Logo] [Nav: Why LetBuyy ▾  Products ▾  Pricing  Docs]    │
│  [Log in] [Start for free →]                                 │
└──────────────────────────────────────────────────────────────┘
│  Hero (full-width, gradient bg, Framer Motion entrance)      │
│  CapabilityMap section                                       │
│  MerchantJourney section                                     │
│  Features section                                            │
│  Pricing section                                             │
│  FAQ section                                                 │
│  EcosystemMap section                                        │
│  FinalCTA section                                            │
┌──────────────────────────────────────────────────────────────┐
│  Footer (multi-column, full-width)                           │
└──────────────────────────────────────────────────────────────┘
```

**Sidebar Details:** None

**Header Details**
- Sticky positioned; adds `scrolled` class after 50px scroll
- Desktop: logo left, horizontal nav center with mega-menu dropdowns, CTA right
- Mobile: logo + hamburger; drawer slides in from right (full-height, AnimatePresence)
- Mega-menus: feature card grid + aside highlight panel, glassmorphism treatment
- Mega-menu breakpoint: 1024px

**Page Header Pattern**
No `PageHeader` from `@letbuyy/ui`. Marketing sections use bespoke section heading patterns — hero headline with fluid `clamp()` sizing, section headings with eyebrow labels styled via component CSS.

**Navigation Pattern:** Top horizontal nav with mega-menus (desktop) / right drawer with panel drill-down (mobile)

**Responsive Behavior**
- Nav mode switch: `lg` (1024px)
- Mobile: hamburger replaces nav; full-height right drawer with panel sub-navigation
- Sections: full-width wrapper, `max-w-[1400px]` inner container, padding scales from 20px to 60px
- Smooth scroll via Lenis on homepage

**Layout Consistency Score: 9/10**

Known violations:
- `surface="storefront"` wrong surface assignment (layout.tsx)
- `--ease-smooth`, `--ease-bounce` duplicate token-provided values under different names
- Custom `--bg-*` variable names instead of `--lb-color-*`

---

### storefront-runtime

**Archetype:** Storefront Presentation Layer

**ASCII Layout Tree**

```
html (surface="storefront")
└── body
    └── RootLayout
        └── {children}
            [theme-provided layout]
```

**Sidebar Details:** Theme-provided

**Header Details:** Theme-provided

**Page Header Pattern:** Theme-provided

**Navigation Pattern:** Theme-provided

**Responsive Behavior:** Theme-provided; runtime provides no structural layout

**Layout Consistency Score: N/A (theme-driven)**

Known violations:
- Font aliases (`--font-lora`, `--font-playfair`, etc.) do not load named fonts — high severity merchant-facing issue

---

## 5.4 Page Pattern Library

### List Page

**When to use:** Any resource that has multiple instances that need to be enumerated, filtered, searched, and acted upon. Orders, Products, Customers, Coupons, Reviews, Collections, Inventory, Purchase Orders, Gift Cards, and similar.

**Layout structure:**

```
Page (max-w constraint, flex-col, density gap)
└── PageHeader
    ├── breadcrumbs (Home → Resource)
    ├── eyebrow (section category)
    ├── title (h1 with auto-icon)
    ├── description
    └── primaryAction ("Add [Resource]") + secondaryActions
Card
└── Section (title="[Resource] list", description="N items")
    ├── div.grid — search Input + refresh Button
    ├── [Banner if error]
    └── Table
        ├── savedViews tabs (All / Active / Draft / Archived / etc.)
        ├── filterChips (removable active filters)
        ├── bulkActions bar
        ├── sortable column headers
        ├── rows (click navigates to detail)
        └── EmptyState (illustration variant for true empty, icon variant for filter empty)
```

**Required elements:** PageHeader (with primaryAction), Card, Section, Table, EmptyState.

**Current implementations:**
- `apps/merchant-control-plane/src/app/[store]/products/page.tsx`
- `apps/merchant-control-plane/src/app/[store]/customers/page.tsx`
- `apps/merchant-control-plane/src/app/[store]/orders/page.tsx` (and all other list routes enumerated in PAGE_ARCHITECTURE.md)

---

### Detail/Entity Page

**When to use:** Single-resource editing or viewing — a specific product, a specific order, a specific customer.

**Layout structure:**

```
Page
└── PageHeader
    ├── breadcrumbs (Home → Resource → Item Name)
    ├── title (h1 — item name or ID)
    └── primaryAction (Save) + secondaryActions (Delete, Duplicate, Archive)
Grid (2-col on md+, 1-col mobile)
├── [col 1: primary] Card/Section forms (title, description, main attributes)
└── [col 2: secondary] Card/Section sidebar data (status, dates, metadata, relationships)
```

**Required elements:** PageHeader with save action, at least two Card/Section areas, breadcrumbs required.

**Current implementations:**
- `apps/merchant-control-plane/src/app/[store]/products/[productId]/page.tsx`
- Order and customer detail pages

---

### Settings Page

**When to use:** Configuration for a specific domain — payments, shipping, taxes, notifications, etc. Not for lists of resources.

**Layout structure:**

```
SettingsPane
└── Page
    └── PageHeader (breadcrumb: Settings → [Page Title])
        ├── [optional guidance Banner]
        ├── [optional stat grid for billing-type pages]
        └── div.settings-home-card sections
            ├── div.settings-home-section-label (section title)
            └── div.settings-form-body (form fields + submit)
```

**Current state:** Settings pages use custom CSS classes (`settings-home-card`, `settings-home-section-label`, `settings-form-body`) instead of `Card + Section` from `@letbuyy/ui`. This is the primary layout inconsistency within merchant-control-plane. The recommended path is to migrate settings pages to `Card + Section`, which would eliminate the bespoke CSS and align with the rest of the application.

**Required elements:** `SettingsPane`, PageHeader with breadcrumb, form structure within the settings-specific CSS (or `Card + Section` after migration).

**Current implementations:** All 18 settings routes in `apps/merchant-control-plane/src/app/[store]/settings/`

---

### Creation Wizard

**When to use:** Multi-step flows where the merchant completes a task in discrete stages with progress tracking. New store onboarding, plan checkout, theme installation.

**Two implementation patterns exist:**

**Pattern A: In-shell wizard (standard routes)**
Uses the full merchant shell. Steps implemented as sub-routes or client-side state within a standard-mode page.

**Pattern B: Full-screen wizard (full-screen bypass)**
Bypasses `AdminShell` entirely. The route is detected via pathname inspection (`/editor`, `/access_account/checkout`, `/subscribe/checkout`) and the shell is not rendered. The page is responsible for its own navigation chrome (back/forward, progress indicator, cancel).

The onboarding wizard in identity-platform (`/onboarding`) is Pattern B — full-screen, 3 client-side steps:
- Step 1: Bento grid of site type cards
- Step 2: Text inputs (store name, subdomain with live validation)
- Step 3: Review summary with industry picker + confirm

**Required elements (Pattern B):** Self-contained progress indicator, clear step titles, back/cancel affordance, no shell chrome.

**Current implementations:**
- `apps/identity-platform/src/app/onboarding/page.tsx` (Pattern B — pre-auth)
- `apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/page.tsx` (Pattern B — in-app)
- `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` (Pattern B — canvas editor)

---

### Dashboard Overview

**When to use:** The primary landing page for a scoped context (a merchant's store, or the platform operator's home). A high-level summary rather than a data entry or list browsing surface.

**Layout structure:**

```
Page
└── PageHeader (showIcon=false, eyebrow=site_type, primaryAction, secondaryAction=Settings)
PlanBanner (conditional, dismissible)
FoundingMerchantCard (founding program, conditional)
MetricCards grid (2-col md, 4-col xl — Revenue / Orders / Visitors / Conversion)
SetupGuide Card (circular progress + checklist steps — shown until complete)
RecentActivity Card (activity feed)
PlanUpsell Card (shown when on free or trial plan)
```

**Required elements:** PageHeader, at least one MetricCard grid, a recent activity or summary feed. `EmptyState` is not appropriate here — a dashboard always has something to show (even if it is zeros).

**Current implementations:**
- `apps/merchant-control-plane/src/app/[store]/dashboard/DashboardClient.tsx`
- Platform-console Leadership Home (simplified variant)

---

### Empty State

**When to use:** A list page (or any data surface) has no items — either because the resource has never been created, or because the current filter/search matches nothing.

**Two variants:**

**Primary empty state** (no items exist at all):
Uses `EmptyState` component with illustration variant. Illustration images are stored in `/Emptystate Illustration/`. Includes: title (what the resource is), body (why to create it or what it enables), `primaryAction` ("Add [Resource]"), optional `secondaryAction`.

Resources with custom illustrations: Products, Customers, Past Bills.

**Filter/search empty state** (items exist but filter shows none):
Uses `EmptyState` with icon variant (no illustration). Shorter message. Action is "Clear filters" rather than "Add resource."

**Required elements:** `EmptyState` component, always `primaryAction`, body copy that explains the value of the resource (not just "No items found").

**Current implementations:** All list pages in merchant-control-plane, via the `EmptyState` component in `@letbuyy/ui`.

---

## 5.5 Layout Debt and Inconsistencies

### Violation 1: Settings pages use custom CSS instead of Card + Section

**File:** `apps/merchant-control-plane/src/app/[store]/settings/billing/page.tsx` and all other settings routes
**What it is:** Settings pages render into a `SettingsPane` component that uses bespoke CSS classes (`settings-home-card`, `settings-home-section-label`, `settings-general-stack`, `settings-form-body`, `billing-stat-card`) instead of the `Card + Section` primitives from `@letbuyy/ui`. The visual output is similar but the implementation diverges from the rest of the application.
**Severity:** Medium. No visual breakage for merchants, but creates two codepaths for "a container with a title and form content." Any design system update to `Card + Section` (spacing, radius, border) will not automatically apply to settings pages.
**Fix:** Migrate `SettingsPane` page content to `Card + Section`. The `SettingsPane` wrapper itself can remain as a convenience layer that injects the breadcrumb and settings-specific PageHeader behavior, but the inner content should use standard layout primitives.

---

### Violation 2: marketing-site uses surface="storefront"

**File:** `apps/marketing-site/src/app/layout.tsx`
**What it is:** `LetbuyyThemeProvider surface="storefront"` is set on the marketing site. The marketing site is not a storefront — it is a public marketing surface. The `storefront` surface is intended for consumer-facing merchant storefronts.
**Severity:** Medium (latent). Currently all surfaces resolve to identical token values, so there is no visible symptom. The risk materializes if the design system ever differentiates the `storefront` surface to apply different visual treatments for commerce contexts.
**Fix:** Create a `marketing` surface in the token system. Assign the marketing site to `surface="marketing"`. Interim: use `surface="identity"` as a semantically closer proxy.

---

### Violation 3: developer-portal uses surface="marketplace"

**File:** `apps/developer-portal/src/app/layout.tsx`
**What it is:** The developer portal shares the `marketplace` surface with the app-marketplace and theme-marketplace. The developer portal is a developer documentation surface, not a marketplace.
**Severity:** Low (frozen app). The developer portal is frozen and not a deploy target.
**Fix:** When reactivated, assign `surface="operations"` or create a `developer` surface.

---

### Violation 4: platform-console and platform-operations-portal have no mobile navigation fallback

**File:** `apps/platform-console/src/app/(dashboard)/layout.tsx`, `apps/platform-operations-portal/src/app/(dashboard)/layout.tsx`
**What it is:** The sidebar is hidden below `lg` (`hidden lg:flex`) but there is no hamburger, drawer, or mobile menu substitute. On a screen narrower than 1024px, navigation is inaccessible.
**Severity:** Low (internal tools, desktop-only use). Not a merchant-facing issue.
**Fix:** Add a hamburger + drawer pattern consistent with the merchant-control-plane approach, or document explicitly that these tools require a desktop browser and add a viewport-size warning for narrow screens.

---

### Violation 5: Full-screen wizard routes lack a consistent chrome standard

**File:** `apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/page.tsx`, `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`
**What it is:** Full-screen bypass routes (`/editor`, `/access_account/checkout`, `/subscribe/checkout`) receive no shell. Each full-screen page is responsible for its own header, navigation chrome, cancel affordance, and progress indication. There is no shared pattern for this.
**Severity:** Low (few pages). Currently manageable.
**Fix:** Define a `FullScreenShell` pattern in `@letbuyy/ui` — a thin wrapper that provides a consistent close/back button position, progress indicator slot, and branding area without the full merchant sidebar/header. Use this wrapper on all full-screen bypass pages.

---

### Violation 6: storefront-runtime font aliases do not load named fonts

**File:** `apps/storefront-runtime/src/app/globals.css`
**What it is:** Variables `--font-lora`, `--font-playfair`, `--font-outfit`, `--font-poppins`, `--font-nunito`, `--font-open-sans`, `--font-dm-sans`, `--font-montserrat`, `--font-space-grotesk` are declared as theme customization hooks but all resolve to Geist variants. A merchant who selects "Playfair Display" in the theme editor receives Geist Sans under a `--font-playfair` alias.
**Severity:** High (merchant-facing deception). Merchants are making typographic decisions they believe have visual effect. The feature is a Potemkin village.
**Fix:** Either (a) load the actual named font files and assign them to the corresponding variables, with appropriate performance impact assessment, or (b) remove the font alias declarations and replace the theme editor's font picker with a curated set of Geist variants (Regular, Display, Mono weight variations) — honest about what is actually available. Option (b) is faster to implement; option (a) delivers the merchant's actual expectation.

---

### Violation 7: AISidebar has no layout token

**File:** `apps/merchant-control-plane/src/components/AISidebar.tsx`
**What it is:** The AI sidebar is an inline right-hand panel that pushes the main content when toggled. Its width is not controlled by a density token — it is hardcoded within the component. If the density system is extended or the sidebar width is adjusted, the AISidebar does not participate in the adjustment.
**Severity:** Low.
**Fix:** Add `--lb-density-ai-sidebar-width` as a density token and apply it in the AISidebar component.

---

*End of Parts 4 and 5.*
