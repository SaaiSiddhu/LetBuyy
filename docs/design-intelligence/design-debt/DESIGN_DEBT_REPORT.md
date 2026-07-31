# Design Debt Report
**Generated:** 2026-06-19  
**Scope:** apps/merchant-control-plane, apps/identity-platform, apps/marketing-site  
**Token Authority:** packages/typescript/ui/src/tokens.ts + config/tailwind/letbuyy-tokens.css

---

## Token System Reference

The canonical `--lb-*` token system is defined in `packages/typescript/ui/src/tokens.ts` and emitted as Tailwind v4 `@theme` utilities in `config/tailwind/letbuyy-tokens.css`. The mapping guide inside that file is authoritative:

| Raw value | Correct token |
|---|---|
| `bg-white` | `bg-surface` |
| `bg-gray-50` | `bg-surface-subdued` |
| `text-gray-900` | `text-default` |
| `text-gray-500` | `text-subdued` |
| `border-gray-200` | `border-line` |

The design ratchet rule (CLAUDE.md) forbids new `rounded-[...]` and raw `px` values. All spacing must use `--lb-space-*` tokens (xs=4px, sm=8px, md=12px, lg=16px, xl=20px, 2xl=24px, 3xl=32px). No `--lb-font-size-*` token exists at 10px; the smallest defined is `caption = 12px`.

---

## App 1: merchant-control-plane

### Summary
The merchant-control-plane is the most complex app in scope. Nine of ten pages follow a consistent pattern: `Page` + `PageHeader` + `@letbuyy/ui` table/card/badge components + inline `var(--lb-*)` tokens. Two surfaces — the billing settings page and the theme editor — operate outside this pattern entirely with their own CSS class namespaces.

### 1.1 DashboardClient.tsx
**File:** `apps/merchant-control-plane/src/app/[store]/dashboard/DashboardClient.tsx`  
**Overall:** High `@letbuyy/ui` adoption; specific hardcoded values in data-vis and step indicator area.

| Violation | Severity | Detail |
|---|---|---|
| `shadow-[0_4px_14px_rgba(139,92,246,0.4)]` hardcoded RGBA shadow | HIGH | No `--lb-shadow-*` token mapped; should use a component-level shadow token once defined |
| `text-white` (×2) on primary CTA button text | MEDIUM | Should be `text-[color:var(--lb-color-primary-cta-text)]` for theme-aware inversion |
| `text-[10px]` on metric labels (lines ~179, 224, 227, 287, 292) | HIGH | No `--lb-font-size-*` token at 10px. Closest canonical token is `caption = 12px` (`--lb-font-size-caption`). Violates ratchet. |
| `p-[2px]` hardcoded padding (lines ~179, 287, 292) | MEDIUM | Below the spacing scale; use `--lb-space-1 = 4px` or a 0 value instead |
| `h-8 w-8` (32px) step indicator circle | LOW | Should be a size token; no `--lb-size-*` token at this value — add or use explicit `--lb-space-3xl = 32px` as `size` |
| `size={10}`, `size={13}`, `size={15}`, `size={16}` on `MaterialIcon` | LOW | Inconsistent icon sizing; no canonical icon size token. Should standardise to a defined set (12, 16, 20, 24). |

### 1.2 products/page.tsx
**File:** `apps/merchant-control-plane/src/app/[store]/products/page.tsx`  
**Overall:** Very consistent. `Table`, `EmptyState`, `Badge`, `Input` from `@letbuyy/ui`. Minor layout constraint hardcode.

| Violation | Severity | Detail |
|---|---|---|
| `min-w-[112px]` on quantity Input | LOW | Hardcoded minimum width in arbitrary Tailwind bracket. No `--lb-size-*` token equivalent. |

### 1.3 customers/page.tsx
**File:** `apps/merchant-control-plane/src/app/[store]/customers/page.tsx`  
**Overall:** Excellent consistency. Full `@letbuyy/ui` component usage throughout. No significant violations found.

| Violation | Severity | Detail |
|---|---|---|
| None identified | — | Benchmark file for other pages |

### 1.4 coupons/page.tsx
**File:** `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx`

| Violation | Severity | Detail |
|---|---|---|
| `Rs. ${coupon.value}` currency prefix (line ~82) | HIGH | Must be `₹` per India-first locale standard. `Rs.` is incorrect and non-canonical. |
| Raw `<table><thead><tbody><tr><th><td>` elements inside `<Table tableClassName="...">` wrapper | HIGH | All other pages use `<Table rows={} columns={}>` declarative API. This page injects raw HTML into the children slot, bypassing the Table component's accessibility and column management. |
| Raw `<select>` HTML element for status edit inside table cell | MEDIUM | No `@letbuyy/ui` Select component used. Raw `<select>` lacks design token styling and consistent focus ring. |

### 1.5 reviews/page.tsx
**File:** `apps/merchant-control-plane/src/app/[store]/reviews/page.tsx`  
**Overall:** Good token usage. Full `@letbuyy/ui` component set.

| Violation | Severity | Detail |
|---|---|---|
| `--lb-color-border-strong` on empty star color | INFO | This is a valid semantic token reference. Acceptable. |
| `size={10}` on star `MaterialIcon` | LOW | Below canonical icon size floor. Prefer `12` as minimum. |

### 1.6 settings/billing/page.tsx
**File:** `apps/merchant-control-plane/src/app/[store]/settings/billing/page.tsx`  
**Overall:** Major structural violation. All layout classes are custom CSS namespace (`billing-*`, `settings-*`) defined in an external stylesheet not using `--lb-*` tokens in JSX. The JSX itself does use `@letbuyy/ui` for interactive controls (Button, Badge, Table, Banner, EmptyState, Skeleton).

| Violation | Severity | Detail |
|---|---|---|
| `billing-stat-grid`, `billing-stat-card`, `billing-stat-icon`, `billing-stat-body`, `billing-stat-label`, `billing-stat-value` custom class namespace | HIGH | These layout/spacing classes are defined in an external CSS file and do not use `--lb-*` tokens directly in JSX. Creates a shadow design system. |
| `billing-upcoming-*` class namespace (main, amount, meta, actions, warn, foot) | HIGH | Same issue — private CSS namespace for a major content area. |
| `settings-home-card`, `settings-home-section-label`, `settings-form-body`, `settings-general-stack`, `settings-general-hint`, `settings-business-link` | HIGH | Parallel `settings-*` namespace alongside `billing-*`. Both should be replaced with `Card` + `Section` from `@letbuyy/ui` and `--lb-*` inline tokens. |
| `<span className="billing-stat-icon billing-stat-icon--rupee">₹</span>` | MEDIUM | Typography character used as icon. Should use a proper `MaterialIcon` or lucide icon. |
| `billing-stat-icon--rupee`, `billing-stat-icon--info`, `billing-stat-icon--ok` BEM modifier pattern | MEDIUM | Three icon variants styled via CSS BEM modifiers rather than token-driven inline color. |

**Note:** The `SettingsPane` component wrapping this page is a shared component (`@/components/settings/SettingsPane`) — its internals should also be audited, but it is outside the 24 files scoped to this report.

### 1.7 products/collections/page.tsx
**File:** `apps/merchant-control-plane/src/app/[store]/products/collections/page.tsx`  
**Overall:** Good token usage overall. Two minor violations.

| Violation | Severity | Detail |
|---|---|---|
| `divide-[var(--lb-color-border-subdued)]` | MEDIUM | `--lb-color-border-subdued` does not appear in the canonical token list in `tokens.ts`. The canonical border tokens are `--lb-color-border` and `--lb-color-border-strong`. This may be a phantom token that resolves to unset/transparent. |
| `min-h-11` | LOW | Tailwind v4 numeric spacing `11` = 44px. No `--lb-space-*` token at 44px. If intent is touch target height, should use a defined density token or explicit `--lb-density-control-height`. |

### 1.8 products/inventory/page.tsx
**File:** `apps/merchant-control-plane/src/app/[store]/products/inventory/page.tsx`

| Violation | Severity | Detail |
|---|---|---|
| `min-w-[112px]` on Input component | LOW | Same as products/page.tsx. Hardcoded 112px bracket. |

### 1.9 products/purchase-orders/page.tsx
**File:** `apps/merchant-control-plane/src/app/[store]/products/purchase-orders/page.tsx`  
**Overall:** Clean, minimal page. Uses `@letbuyy/ui` components. No violations found.

### 1.10 online-store/themes/[themeId]/editor/page.tsx
**File:** `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`  
**Overall:** CRITICAL — this full-screen editor runs an entirely separate design system. It is structurally isolated by design (full-viewport overlay tool), but the implementation establishes a parallel class namespace and icon system that drifts from platform standards.

| Violation | Severity | Detail |
|---|---|---|
| 27 icons imported directly from `lucide-react` (not `@letbuyy/ui`) | CRITICAL | Imports: `ArrowLeft, Blocks, Bot, CheckCircle2, ChevronDown, ChevronRight, Eye, FileJson, GripVertical, Laptop, Layers3, Loader2, Monitor, Palette, PanelLeft, Plus, Redo2, Rocket, Save, Settings, Smartphone, Sparkles, Tablet, Trash2, Undo2, WandSparkles, X`. The `@letbuyy/ui` package re-exports lucide icons as the canonical surface. Direct `lucide-react` imports bypass governance and version pinning. |
| ~50+ `theme-os-*` custom CSS class namespace with BEM modifiers | HIGH | Full layout, spacing, and color are managed via private CSS classes in an external stylesheet. No `var(--lb-*)` token usage in JSX. |
| Zero use of `Page`, `PageHeader`, `Card`, `Section` from `@letbuyy/ui` | HIGH | Structurally isolated from the merchant app's component system. Justified for a full-screen tool, but should still reference `--lb-*` tokens. |
| Hardcoded icon sizes: `size={17}`, `size={15}`, `size={14}`, `size={13}`, `size={32}`, `size={16}`, `size={15}` | MEDIUM | Seven different size values on lucide-react icons. No canonical icon size set defined for this surface. |
| `Button unstyled` used on ~30+ interactive elements | INFO | Valid pattern — `unstyled` prop strips `@letbuyy/ui` styling so `theme-os-*` custom CSS can apply. Intentional. |

**Design context:** The theme editor is a purpose-built full-screen tool analogous to a visual IDE. Its isolation from the standard merchant layout is intentional. The primary remediation target is the icon import source (should be `@letbuyy/ui`) and the CSS should reference `--lb-*` tokens for any semantic values (color, radius, z-index) even inside its private namespace.

---

## App 2: identity-platform

### Summary
The identity-platform operates a completely separate design system from `@letbuyy/ui`. This is intentional and architecturally justified: the auth/onboarding surface is a public-facing consumer flow that predates the merchant component library and requires its own brand expression. However, several specific patterns create design debt even within its own system.

### 2.1 globals.css (identity-platform)
**File:** `apps/identity-platform/src/app/globals.css`

**Architecture:** The identity-platform defines its own CSS custom property namespace (`--primary`, `--bg`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-hint`, `--border`, `--input-bg`, `--error`, `--success`, `--warning`) that bridge to `--lb-color-*` tokens where possible. Several are hardcoded to raw RGB values.

| Violation | Severity | Detail |
|---|---|---|
| `--primary: var(--lb-color-primary)` — CORRECT | PASS | Proper token bridging for the primary color. |
| `--primary-light: rgb(167 139 250)` | MEDIUM | Hardcoded raw RGB. This is the light-mode violet-400 value. Should reference `--lb-color-primary-hover` or a defined tint token. |
| `--bg: rgb(250 249 255)` / `--bg-secondary: rgb(244 242 254)` (light) | MEDIUM | Hardcoded surface values. Should reference `var(--lb-color-bg)` / `var(--lb-color-bg-subdued)`. |
| `--text-primary: rgb(10 8 22)` through `--text-hint: rgb(158 147 190)` | MEDIUM | Four text color levels hardcoded. Should map to `--lb-color-text-*` semantic tokens. |
| `--border: rgb(224 216 248)` (light) | MEDIUM | Hardcoded border color. Should map to `var(--lb-color-border)`. |
| Dark `.dark` block: `--border: rgba(139, 92, 246, 0.18)` | MEDIUM | Hardcoded dark-mode border. Should map to `var(--lb-color-border)` (which already has dark-mode values). |
| `box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08)` on `.auth-card` | LOW | Hardcoded shadow. No `--lb-shadow-*` token defined at this level yet. |
| `box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.12)` on input focus | LOW | Hardcoded focus ring. Should reference `--lb-color-primary` with alpha. |
| `background: rgba(139, 92, 246, 0.1)` and similar alpha variants (×8 occurrences) | HIGH | Hardcoded RGB with alpha for hover/bg states throughout — `onboard-bento-card.primary`, `onboard-type-card.selected`, `onboard-guided-pill`, etc. These should use `color-mix()` against `var(--primary)` or a defined `--lb-color-primary-surface` token. |
| `font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace` on `.auth-otp-input` | LOW | Hardcoded monospace family stack. Should use `var(--font-mono-premium)` which is already defined in the same file. |
| `color: rgb(34 197 94)` on `.onboard-type-status.available` | MEDIUM | Hardcoded green. Should reference `var(--success)` which is defined as `var(--lb-color-success)`. |
| `color: rgb(0 0 0)` on `.auth-unavailable-badge` | LOW | Hardcoded black for badge text on warning background. |
| Raw `px` values in layout (padding: `20px`, `28px`, spacing: `12px`, `14px`, etc.) | MEDIUM | The identity app predates the spacing token system. Values exist in the authoritatively-CSS zone where `--lb-space-*` tokens are not applied. Systematic in the CSS but a migration target. |

### 2.2 onboarding/page.tsx
**File:** `apps/identity-platform/src/app/onboarding/page.tsx`

**Architecture:** The onboarding page uses a purpose-built `auth-*` / `onboard-*` CSS class system, `Button unstyled` + `Input unstyled` from `@letbuyy/ui` for interactive components, and `AuthIcon` (Material Symbols wrapper). This is architecturally consistent with the identity-platform's own design system.

| Violation | Severity | Detail |
|---|---|---|
| `style={{ color: 'rgb(34 197 94)' }}` on success check icon (line ~367) | MEDIUM | Hardcoded RGB green inline style. Should be `color: var(--success)` which resolves to `var(--lb-color-success)`. |
| `className="text-[color:var(--primary)]"` (line ~378) | MEDIUM | Uses Tailwind arbitrary `text-[color:...]` bracket syntax against identity app's `--primary` variable, not `--lb-color-primary` directly. Works but inconsistent with `var(--lb-*)` convention. |
| `style={{ color: 'var(--primary)' }}` (line ~531) | LOW | Direct `--primary` CSS var reference as inline style instead of using a Tailwind token class. Inconsistent style application method across the same template. |
| `style={{ marginTop: 16 }}` (line ~385) | MEDIUM | Hardcoded 16px margin as inline style object. No spacing token applied. Should be `style={{ marginTop: 'var(--lb-space-lg)' }}` or a class-based approach. |
| Raw `<select className="onboard-industry-select">` for industry picker | MEDIUM | No `@letbuyy/ui` Select component used. Consistent with rest of identity platform's pattern (which uses `<Input unstyled>`) but raw `<select>` has no design token focus ring. |
| `AuthIcon` `size` props: 28, 22, 18, 16, 14, 20 — six different values in one file | LOW | Inconsistent icon sizing. Prefer a constrained set (16, 20, 24, 28) for the identity surface. |

### 2.3 lib/config/urls.ts
**File:** `apps/identity-platform/src/lib/config/urls.ts`  
**Assessment:** Configuration/utility file only. No design tokens or styling. No design debt. Correctly hardcodes production URL fallbacks (`https://admin.letbuyy.com`, `https://accounts.letbuyy.com`) with env-var overrides.

---

## App 3: marketing-site

### Summary
The marketing-site is a purpose-built marketing surface with its own premium design system. It imports `config/tailwind/letbuyy-tokens.css` (inheriting `--lb-color-*` token definitions) and bridges them into local aliases (`--primary`, `--bg-deep`, `--text-primary`, etc.). Components import from `@letbuyy/ui` for interactive elements (Button, icons) while using a bespoke CSS class system (`hero-*`, `header-*`, `pricing-*`, `footer-*`, `cop-*`) for layout and visual design — a legitimately different surface. The design debt is concentrated in the globals.css bridging layer.

### 3.1 globals.css (marketing-site)
**File:** `apps/marketing-site/src/app/globals.css` (read lines 1–300)

| Violation | Severity | Detail |
|---|---|---|
| `--primary-glow: rgba(139, 92, 246, 0.18)` | MEDIUM | Hardcoded RGBA glow alias. Should use `color-mix(in srgb, var(--lb-color-primary) 18%, transparent)` |
| `--accent: rgb(6 182 212)` (cyan) | MEDIUM | Hardcoded raw RGB for accent color. No `--lb-color-accent` or `--lb-color-info-*` token that maps to cyan-500. |
| `--success: rgb(22 163 74)` (light mode), `--success: var(--lb-color-success)` (dark mode) | HIGH | Inconsistency: light mode uses hardcoded green-700, dark mode maps to the semantic token. Both should use `var(--lb-color-success)`. |
| `--warning: rgb(180 83 9)` (light), `--warning: rgb(251 191 36)` (dark) | HIGH | Both hardcoded, different values. Should both reference `var(--lb-color-warning)`. |
| `--bg-deep`, `--bg-dark`, `--bg-elevated`, `--bg-card`, `--bg-card-hover` | MEDIUM | Five surface aliases hardcoded to raw RGB in both themes. These broadly match `--lb-color-bg` and `--lb-color-surface-*` tokens but do not reference them. |
| `--text-primary`, `--text-secondary`, `--text-muted`, `--text-subtle` | MEDIUM | Four text color levels hardcoded. Should bridge to `--lb-color-text-*` tokens. |
| `--border-subtle`, `--border-light`, `--border-glow` (×2 themes) | MEDIUM | Border aliases hardcoded. `--border-glow` uses hardcoded purple RGBA. |
| `--gradient-primary: linear-gradient(135deg, rgb(139 92 246) 0%, rgb(124 58 237) 50%, rgb(109 40 217) 100%)` | MEDIUM | Hardcoded purple gradient using raw RGB values. Should use `var(--lb-color-primary)` with `color-mix` or `oklch` variants. |
| `--shadow-glow: 0 0 60px rgba(139, 92, 246, 0.12)` (light), `0 0 80px rgba(139, 92, 246, 0.22)` (dark) | LOW | Hardcoded shadow values. No `--lb-shadow-*` token defined at this level. |
| `.header` uses `rgba(255, 255, 255, 0.96)` and `rgba(226, 232, 240, 0.72)` | MEDIUM | Hardcoded backdrop and border colors for header. Not using any `--lb-*` or even local `--bg-*` / `--border-*` aliases. |
| `.header.menu-open` uses `rgb(10 9 18)` hardcoded | LOW | Hardcoded dark background for open mobile menu. |

### 3.2 page.tsx (marketing home)
**File:** `apps/marketing-site/src/app/page.tsx`  
**Assessment:** Clean orchestration file. Imports components, sets up Lenis scroll. No design violations.

### 3.3 Hero.tsx
**File:** `apps/marketing-site/src/components/Hero.tsx`  
**Overall:** Clean. Uses `Zap`, `ArrowRight` from `@letbuyy/ui`. All styling via CSS class names.

| Violation | Severity | Detail |
|---|---|---|
| None in JSX | — | All styling deferred to globals.css class system |
| Motion `transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}` hardcoded | LOW | Hardcoded easing in JS. A motion token (`--lb-ease-smooth`) would centralise this. |

### 3.4 Header.tsx
**File:** `apps/marketing-site/src/components/Header.tsx`  
**Overall:** Well-structured. Icon imports from `@letbuyy/ui` are correct. `Button unstyled` used correctly for trigger patterns.

| Violation | Severity | Detail |
|---|---|---|
| `ChevronRight width={34} height={34}` | LOW | 34px is non-standard. Canonical sizes are 16, 20, 24. |
| Motion easing `[0.16, 1, 0.3, 1]` repeated in three places | LOW | Same hardcoded easing curve repeated. Should be a shared constant or motion token. |
| Links to `apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace` external URLs | INFO | These reference frozen/pending apps per CLAUDE.md. The footer and header navigate to them. Not a style violation but worth noting. |

### 3.5 Features.tsx
**File:** `apps/marketing-site/src/components/Features.tsx`  
**Overall:** Data-visualization-heavy component with an interactive Commerce OS graph and workspace previews. The JSX is entirely CSS-class-driven. Icons from `@letbuyy/ui` are correct. However, the component data layer hardcodes many raw color values.

| Violation | Severity | Detail |
|---|---|---|
| `GNODES` array: `color: 'rgb(20 184 166)'`, `'rgb(59 130 246)'`, `'rgb(139 92 246)'`, `'rgb(16 185 129)'`, `'rgb(245 158 11)'`, `'rgb(236 72 153)'`, `'rgb(167 139 250)'`, `'rgb(6 182 212)'` | HIGH | Eight hardcoded raw RGB values for graph node colors in JS data. These should reference semantic tokens (`--lb-color-teal`, `--lb-color-blue`, `--lb-color-primary`, etc.) via `getComputedStyle` or a defined palette constant. |
| `EVTS` feed: `c: 'rgb(59 130 246)'` etc. (×32 entries, same palette) | HIGH | Same raw RGB palette repeated in 32 event feed items. |
| `fill: 'rgba(20,184,166,0.14)'` etc. on node fills | MEDIUM | Alpha variants of hardcoded colors. Should use `color-mix()` against tokens. |
| `color-mix(in srgb, ${f.color} 40%, transparent)` inline styles | MEDIUM | `color-mix` uses hardcoded JS color strings. Would be correct if the strings were token values instead. |
| `rgba(139,92,246,0.28)`, `rgba(139,92,246,0.15)` etc. in SVG | MEDIUM | Multiple hardcoded purple RGBA values in SVG `<stop>` and `<circle>` elements. |
| `fontFamily: "ui-sans-serif, system-ui, sans-serif"` hardcoded in SVG `<text>` | LOW | Should use a variable referencing `var(--font-inter)` or similar. SVG text doesn't support CSS vars directly, so a JS constant pulling from `getComputedStyle` would be the correct approach. |
| `style={{maxWidth:680, margin:'16px auto 0'}}` | MEDIUM | Hardcoded pixel values as inline styles. Should use `--lb-space-lg` for margin and a width token. |

### 3.6 Pricing.tsx
**File:** `apps/marketing-site/src/components/Pricing.tsx`  
**Overall:** Very clean. Data-driven from `/api/founding-pricing`. Uses `Check`, `AlertCircle`, `ChevronUp` from `@letbuyy/ui`. All layout via CSS classes. Currency correctly displayed as `₹`.

| Violation | Severity | Detail |
|---|---|---|
| `Check size={16}` and `AlertCircle size={32}` | LOW | Acceptable sizes but inconsistent (16 vs 32). |
| `🏆` emoji in pricing approval title | INFO | Not a token violation, but emojis are flagged by CLAUDE.md's "Only use emojis if the user explicitly requests it" rule for new code. |

### 3.7 Footer.tsx
**File:** `apps/marketing-site/src/components/Footer.tsx`  
**Overall:** Excellent. Clean import surface. All icons from `@letbuyy/ui` (Facebook, Twitter, Instagram, Youtube, Linkedin, Globe, ChevronDown, X, Check, Button, Checkbox). No style violations in JSX.

| Violation | Severity | Detail |
|---|---|---|
| None in JSX | — | |
| Social `<a>` tags instead of `<Button unstyled>` or `<Link>` | INFO | External social links correctly use `<a target="_blank" rel="noopener noreferrer">`. Not a violation. |

---

## Cross-App Patterns

### Hardcoded Color Pattern
All three apps hardcode the LetBuyy brand purple (`rgb(139, 92, 246)` / `rgba(139, 92, 246, ...)`) directly rather than referencing `var(--lb-color-primary)`. The marketing-site's globals.css defines `--primary: var(--lb-color-primary)` but then hardcodes the same value in gradients and shadows instead of using `--primary`.

### Icon Size Inconsistency
- `merchant-control-plane`: `MaterialIcon` at sizes 10, 13, 15, 16, 17, 32
- `identity-platform`: `AuthIcon` at sizes 14, 16, 18, 20, 22, 28
- `marketing-site`: `LucideIcon` at sizes 14, 15, 16, 17, 19, 24, 32, 34

No canonical icon size set is enforced across apps. The governance.stories.tsx does not address icon sizing. The only standard implied by `@letbuyy/ui` components themselves is the `size` prop accepting arbitrary numbers.

### CSS Class Namespace Proliferation
Three separate CSS class naming conventions exist:
1. `merchant-control-plane` pages: mix of inline `--lb-*` Tailwind utilities + `@letbuyy/ui` structural components (the canonical pattern)
2. `billing-*` / `settings-*` namespace (billing page only)
3. `theme-os-*` namespace (theme editor only)
4. `auth-*` / `onboard-*` namespace (identity-platform, justified)
5. `hero-*`, `header-*`, `footer-*`, `pricing-*`, `cop-*` namespaces (marketing-site, justified for marketing surface)

Namespaces 2 and 3 inside `merchant-control-plane` are the design debt items — they should migrate toward the canonical pattern.

### Currency Locale
- `coupons/page.tsx`: uses `Rs.` prefix — **violation**
- All other files: use `₹` symbol or `formatInrCurrency()` — correct
- `marketing-site/Features.tsx`: uses `₹` inline in data constants — correct
- `pricing.tsx`: uses `₹${price.toLocaleString('en-IN')}` — correct

---

## Severity Summary

| Severity | Count | Examples |
|---|---|---|
| CRITICAL | 1 | Theme editor direct `lucide-react` imports |
| HIGH | 12 | `Rs.` prefix, `text-[10px]`, raw HTML table in coupons, billing CSS namespace, `--lb-color-border-subdued` phantom token, marketing-site color inconsistencies, Features.tsx 8 hardcoded node colors |
| MEDIUM | 22 | Identity app hardcoded RGB surface/text/border aliases, onboarding inline styles, marketing globals gradients/shadows, billing icon pattern |
| LOW | 14 | `min-w-[112px]` inputs, icon sizing, motion easing, `p-[2px]` |
| INFO | 4 | Social link pattern, frozen app references, emoji, icon at floor size |
