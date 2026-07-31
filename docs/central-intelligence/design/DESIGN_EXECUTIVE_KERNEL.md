---
title: LetBuyy Design Executive Kernel
version: 1.0
created: 2026-06-19
stability: PERMANENT
superseded_by: nothing
consumed_by: AI agents, Claude Code, Codex, new contributors
source: docs/design-intelligence/LETBUYY_DESIGN_INTELLIGENCE_MASTER.md
---

# LetBuyy Design Executive Kernel

*Read this before touching any LetBuyy UI code. This document is stable — it does not change when audits run or debt counts shift. It encodes permanent platform design law.*

---

## 1. DESIGN PHILOSOPHY

### 1.1 LetBuyy Is a Platform Ecosystem, Not a Single Product

Five distinct user populations. Five distinct cognitive modes. Five distinct design requirements.

| Surface | Users | Mode | Design Language |
|---------|-------|------|-----------------|
| `letbuyy.com` (marketing-site) | Prospective merchants | Evaluation | Bold, aspirational, low friction, gradient-heavy |
| `accounts.letbuyy.com` (identity-platform) | New merchants onboarding | High-anxiety transition | Single-focus card, 380–420px, mobile-first, trust-communicating |
| `admin.letbuyy.com` (merchant-control-plane) | Operating merchants | Daily work | Data-dense, keyboard-navigable, sidebar-anchored, efficiency-first |
| `{store}.letbuyy.com` (storefront-runtime) | Shoppers at merchant stores | Shopping | **Intentionally identity-less** — the merchant's brand, not LetBuyy's |
| `console / ops.letbuyy.com` (internal tools) | LetBuyy operators | Oversight and intervention | Forced-dark, information-maximising, unconsumer |

**The governing principle: consistency WITHIN products, governance ACROSS the ecosystem.**

A merchant dashboard that looks identical to a marketing site is a design failure. The auth card and the merchant dashboard share a typeface and a colour palette — they do not share a layout, an information density, or a navigation model. That distinction is a design success.

### 1.2 Intentional vs Accidental Identity

**Intentional — codify and protect:**
- identity-platform + merchant-control-plane + marketing-site: the "ink lavender" palette (`rgb(250 249 255)` light, `rgb(10 9 18)` dark). Three teams independently chose the same premium palette. Formal token: `--lb-color-bg` already maps to `#0a0912` in dark mode. The light pole will be promoted to `--lb-color-bg-premium`.
- storefront-runtime: intentionally identity-less (score of 5/10 is correct, not a failure).
- platform-console + platform-operations-portal: forced-dark, tool-like (correct). Visual differentiation between the two is needed but absent — accidental sameness, not intentional.

**Accidental — migrate, do not preserve:**
- parallel CSS custom property systems that shadow `--lb-*` tokens
- divergent dark backgrounds (`rgb(10 10 10)` in internal tools instead of canonical `rgb(10 9 18)`)
- frozen apps (app-marketplace, theme-marketplace, developer-portal) that developed their own visual systems before being frozen

### 1.3 The Four-Layer Architecture

```
Layer 0: Global Foundation
  packages/typescript/ui/src/tokens.ts
  config/tailwind/letbuyy-tokens.css
  The --lb-* namespace. ~330 CSS custom properties.
  Owner: Design System team. Change requires ARB review.
  A change to ink.950 propagates to every surface simultaneously.

Layer 1: Shared Interaction Library
  packages/typescript/ui  (@letbuyy/ui)
  50+ React components, ThemeProvider, 5 surface types, ratchet validator.
  Owner: Design System team. Breaking changes require ARB.

Layer 2: Product Design Systems
  Per-app CSS, per-app compositions, per-app component extensions.
  Owner: Product teams. Must reference --lb-* tokens. Standard code review.

Layer 3: Tenant Customisation
  createLetbuyyBrandVariables API. Scoped to storefront-runtime only.
  WCAG contrast-validated. No Layer 3 values propagate to any other surface.
```

---

## 2. TOKEN RULES

### 2.1 The Token Hierarchy

```
Tier 0: Primitive  →  --lb-primitive-color-ink-950: #0a0912
Tier 1: Semantic   →  --lb-color-bg: ink-950 in dark, lavender-50 in light
Tier 2: Component  →  --lb-button-bg: var(--lb-color-primary)
Tier 3: Density    →  --lb-density-button-height: 36px / 40px / 44px
```

Never use primitive tokens in product code. Consume only semantic or component tokens.

### 2.2 How to Use Tokens in TSX

```typescript
// WRONG — raw Tailwind palette
<div className="bg-gray-100 text-gray-900 border-gray-200 rounded-[8px] p-[14px]">

// CORRECT — semantic utilities from letbuyy-tokens.css
<div className="bg-surface text-default border-line rounded-md p-3">

// ALSO CORRECT — CSS variable reference (use when no Tailwind alias exists)
<div style={{ background: 'var(--lb-color-surface-raised)' }}>
```

### 2.3 Canonical Token Reference (Key Semantic Tokens)

| Intent | Token | Tailwind Alias |
|--------|-------|----------------|
| Page background | `--lb-color-bg` | `bg-page` |
| Surface / card | `--lb-color-surface` | `bg-surface` |
| Raised surface | `--lb-color-surface-raised` | `bg-surface-raised` |
| Sidebar | `--lb-color-sidebar` | `bg-sidebar` |
| Primary text | `--lb-color-text` | `text-default` |
| Secondary text | `--lb-color-text-subdued` | `text-subdued` |
| Muted text | `--lb-color-text-muted` | `text-muted` |
| Body border | `--lb-color-border` | `border-line` |
| Primary action | `--lb-color-primary` | `bg-primary` |
| Destructive | `--lb-color-critical` | `text-critical` |
| Focus ring | `--lb-color-focus-ring` | `ring-focus` |

**Density tokens control layout rhythm.** Platform default is `compact`. Never override density defaults in product code — the ThemeProvider controls this.

| Control | compact | comfortable | spacious |
|---------|---------|-------------|----------|
| Button height | 36px | 40px | 44px |
| Input height | 36px | 40px | 44px |
| Table row | 44px | 48px | 52px |
| Sidebar row | 40px | 44px | 48px |

### 2.4 Token Governance

**Adding a token:** Verify it doesn't exist → determine tier → name `--lb-{category}-{subcategory}-{role}` → add to `tokens.ts` + `tokens.json` → run `node scripts/validate-governance.mjs` → ARB label if Layer 0.

**Deprecating a token:** Add to `deprecatedTokenAliasVariables` in `tokens.ts` → write codemod → run codemod across all apps → remove from CSS output → wait one release cycle → remove from the list.

**Token ownership matrix:**

| Prefix | Owner | Change process |
|--------|-------|----------------|
| `--lb-primitive-color-*` | Design System | ARB required |
| `--lb-color-*` | Design System | ARB required |
| `--lb-density-*` | Design System | ARB required |
| `--lb-font-*` | Design System | ARB required |
| `--lb-space-*` | Design System | ARB required |
| `--lb-radius-*` | Design System | ARB required |
| `--lb-shadow-*`, `--lb-z-*`, `--lb-motion-*` | Design System | ARB required |
| `--mcp-*` | Merchant UX team | Standard PR, product-scoped |
| `--ops-*` | Platform Operations | Standard PR, product-scoped |

---

## 3. COMPONENT RULES

### 3.1 The Component Decision Tree

```
1. Does an @letbuyy/ui component cover this need?
   → YES: Use it. No app-level alternative.
   → NO: Continue.

2. Is this pattern used in 2+ runtimes?
   → YES: Propose for @letbuyy/ui graduation (see 3.3).
   → NO: Build at Layer 2 (app-level), using --lb-* tokens.
```

### 3.2 Forbidden Raw HTML Elements

Never use these directly in product JSX when a component alternative exists:

| Raw element | Correct replacement |
|-------------|---------------------|
| `<button>` | `<Button>` from `@letbuyy/ui` |
| `<input>` | `<Input>` from `@letbuyy/ui` |
| `<select>` | `<Select>` from `@letbuyy/ui` |
| `<textarea>` | `<Textarea>` from `@letbuyy/ui` |
| `<table>` | `<Table>` from `@letbuyy/ui` |
| `<dialog>` | `<Dialog>` from `@letbuyy/ui` |

Enforcement: ESLint `no-raw-elements` (error, CI blocking).

### 3.3 Component Graduation Checklist (App → @letbuyy/ui)

Before a Layer 2 component can be promoted to Layer 1:
- [ ] Used in 2+ runtimes or fills a documented DS gap
- [ ] Uses only `--lb-*` tokens (zero raw Tailwind, zero inline px)
- [ ] Imports nothing from its current app
- [ ] Props API is generalized and documented
- [ ] `governance.stories.tsx` entry with Do/Don't examples
- [ ] `validate:design-system` gate is green
- [ ] ARB comment in PR

### 3.4 Icon Imports

```typescript
// PROHIBITED — every surface
import { ArrowRight } from 'lucide-react'

// REQUIRED — every surface
import { ArrowRight } from '@letbuyy/ui'
```

`@letbuyy/ui` re-exports all icons from a version-pinned lucide-react. Direct imports create dual-dependency and icon version drift. Enforcement: `validate-governance.mjs`.

### 3.5 Overlay Architecture

All overlays portal to `<body>` via `OverlayPortal`, which mirrors `data-letbuyy-theme`, `data-letbuyy-surface`, and `data-letbuyy-density` attributes. Never build a custom overlay mechanism. Never portal manually.

| Overlay type | Use when |
|-------------|----------|
| `<Dialog>` | Blocking action, requires user decision before proceeding |
| `<Sheet>` | Supplementary info, mobile-primary, non-blocking |
| `<Drawer>` | Secondary workspace, form entry, can remain open while working |
| `<Popover>` | Ephemeral contextual info, dismisses automatically |
| `<Tooltip>` | Label or hint only — no interactive elements inside |

---

## 4. DESIGN GOVERNANCE

### 4.1 The Design Constitution (Binding Articles)

**Article I — The --lb-* Namespace Is Law**
No product, surface, or individual introduces parallel token systems, shadow token names, or raw primitive values in product code without ARB approval. The `--lb-*` CSS custom property namespace is the sole authoritative source for all design values in all LetBuyy surfaces.

**Article II — The Four-Layer Architecture Is Fixed**
Layer 0 changes require ARB. Layer 1 breaking changes require ARB. Layer 2 changes use standard code review. Layer 3 is constrained by WCAG validation and scoped to storefront-runtime only.

**Article III — The Ratchet Is Constitutional**
Ratchet baselines may only decrease. A PR that increases any ratchet count fails CI. There is no exception process for increasing ratchet counts. The 7 ratchet categories: `tsxArbitraryRadius`, `tailwindPaletteClasses`, `rawPxSpacing`, `rawPxFontSize`, `appCssNakedRgbHsl`, `tsxInlineStyles`, `lucideDirectImports`.

**Article IV — Formatting Is Standardised**
`formatInrCurrency` from `@letbuyy/ui` is the sole INR formatter. `en-IN` locale for all date formatting. No exceptions. No surface-specific formatters.

### 4.2 When ARB Review Is Required

Required:
- Any change to `packages/typescript/ui/src/tokens.ts`
- Any new export added to `packages/typescript/ui/src/index.ts`
- Any change to `LetbuyyThemeProvider` props
- Any change to `config/tailwind/letbuyy-tokens.css` variable names
- Any change to `tokens.json` structure
- Any change to ratchet baseline `scripts/validators/design-system-baseline.json`
- Any new surface type

Not required (standard code review only):
- Reducing a ratchet count (migration work)
- Running any existing codemod
- Updating design documentation
- Adding Storybook entries for existing components
- App-level Layer 2 CSS changes that correctly reference `--lb-*` tokens

### 4.3 The ThemeProvider System

Each app must declare exactly one `LetbuyyThemeProvider` with the correct surface:

| App | Surface | defaultTheme |
|-----|---------|--------------|
| merchant-control-plane | `"admin"` | `"system"` |
| identity-platform | `"identity"` | `"system"` |
| marketing-site | `"marketing"` *(pending — currently wrong)* | `"system"` |
| storefront-runtime | `"storefront"` | `"system"` |
| platform-console | `"operations"` | `"dark"` |
| platform-operations-portal | `"operations"` | `"dark"` |

Flash prevention: every app includes `<ThemeScript />` in `<head>`. Never hand-roll a flash prevention script.

### 4.4 The Surface System

Surfaces scope token overrides. Each surface can define `[data-letbuyy-surface="X"]` CSS overrides that extend — never replace — the Layer 0 foundation.

- `admin`: merchant-control-plane. Compact density default. Sidebar-anchored layout.
- `identity`: identity-platform. Minimal chrome. Mobile-first card.
- `marketing`: marketing-site. No density system. Marketing-appropriate visual extensions permitted.
- `storefront`: storefront-runtime. Blank-slate by design. `createLetbuyyBrandVariables` controls visual identity.
- `operations`: internal operator tools. Forced dark. High information density.

---

## 5. PLATFORM STANDARDS

### 5.1 Globally Standardised (No Exceptions, Any Surface)

| Standard | Rule |
|----------|------|
| Token prefix | `--lb-*` for all Layer 0 properties |
| Token consumption | Semantic tokens only in product code (never `--lb-primitive-*`) |
| INR money formatting | `formatInrCurrency(amount)` from `@letbuyy/ui` |
| Date locale | `en-IN` everywhere |
| Token/Dart parity | `tokens.json` ≡ `tokens.ts` ≡ `letbuyy_tokens.dart` (CI enforced) |
| Flutter tokens | Generated from `generate-mobile-tokens.mjs` — never hand-edited |
| Ratchet direction | Baseline may only decrease — constitutional |
| WCAG minimum | 4.5:1 for text, 3:1 for focus ring — enforced by `validateLetbuyyBrandContrast()` |
| Tap target minimum | 44px height for interactive elements (compact mode 36px permitted for trained daily-use admin UI) |
| Z-index stack | `--lb-z-*` tokens only — dropdown 30, sticky 40, overlay 50, modal 60, toast 70, tooltip 80 |
| Flash prevention | `<ThemeScript />` in `<head>` — never custom script |
| Overlay portalling | `OverlayPortal` with attribute mirroring — never manual portalling |
| ESLint config | `@letbuyy/ui/recommended` in all active apps (`no-raw-elements` + `no-hardcoded-hex` both at `error`) |

### 5.2 App-Specific (Correct — Do Not Standardise)

| Pattern | App | Why correct |
|---------|-----|-------------|
| `defaultTheme="dark"` | platform-console, platform-operations-portal | Operator tools are always dark |
| `compact` density default | admin, operations surfaces | Daily-use merchant/operator tool; trained users |
| Marketing site gradients and raw colour palette | marketing-site | Intentional brand expression; excluded from ratchet scope by design |
| Liquid/React hybrid rendering | storefront-runtime | Liquid canary OFF by default; React is current primary renderer |
| `createLetbuyyBrandVariables` brand override | storefront-runtime only | Tenant customisation; must not appear in any other surface |
| `InternalWorkspace` / `InternalPanel` / `InternalMetric` | platform-console | Internal tool components; must not be generalised |

### 5.3 The Ink Lavender Palette Standard

The canonical LetBuyy visual identity for internal-facing merchant surfaces. Origin: Flutter `light_theme_colors.dart`, independently adopted by three engineering teams in parallel.

| Role | Light value | Dark value | Token |
|------|-------------|------------|-------|
| Page background | `rgb(250 249 255)` | `rgb(10 9 18)` | `--lb-color-bg` (dark: ink-950) |
| Sidebar | `rgb(244 242 254)` | `rgb(13 11 21)` | `--lb-color-sidebar` |
| Text primary | `rgb(10 8 22)` | `rgb(248 247 255)` | `--lb-color-text` |
| Border | `rgb(224 216 248)` | `rgba(139,92,246,0.18)` | `--lb-color-border` |

Any active app using a dark background other than `var(--lb-color-bg)` is wrong. The value `rgb(10 10 10)` (used in platform-console and platform-operations-portal) is a known violation.

### 5.4 Breakpoints

```
xs:     360px  — canonical smallest Android; India-first default
mobile: 480px  — compact phone landscape
sm:     640px
md:     768px
lg:     1024px
xl:     1280px
2xl:    1536px
```

Mobile-first by default. The primary test viewport for identity-platform is 360px. The primary test viewport for merchant-control-plane is 1280px.

---

## 6. MIGRATION PRINCIPLES

### 6.1 Three Inviolable Rules

1. **Ship working code.** A PR that fixes a token violation but breaks a page layout is not a step forward.
2. **Never break user flows.** Payment, checkout, and auth flows migrate last — always. Prove the pattern on lower-risk surfaces first.
3. **Always have a rollback plan.** Every migration PR is independently revertable with no cascading breakage.

### 6.2 Migration Sequencing

```
Quick wins first (codemods, isolated violations, no visual risk)
  ↓
Token bridging (wire app-local CSS vars to --lb-* equivalents)
  ↓
Component replacement (raw elements → @letbuyy/ui components)
  ↓
Layout and shell migration (last — highest blast radius)
  ↓
Payment / auth flows (final — never first)
```

### 6.3 What Must Never Be Rewritten in a Big-Bang Approach

- `@letbuyy/ui` `index.ts` public API surface — reorganisation breaks all consumers simultaneously
- Checkout and payment flows — real merchant money; visual regression is a trust failure
- `letbuyy-tokens.css` `@theme` variable names — frozen API surface; renaming breaks all apps simultaneously
- `letbuyy_tokens.dart` by hand — must always be generated, never hand-edited
- Ratchet baseline values — resetting upward is constitutionally prohibited
- Marketing-site visual identity palette — deliberate brand expression requiring design sign-off

### 6.4 Codemod Reference

| Codemod | What it does | When to use |
|---------|-------------|-------------|
| `tailwind-default-color-to-token` | Replaces raw Tailwind palette classes with semantic aliases | Before promoting `no-tailwind-default-color` to error |
| `rounded-arbitrary-to-token` | Replaces `rounded-[Xpx]` with canonical `rounded-{size}` | Any file with arbitrary radius violations |
| `badge-danger-to-critical` | Renames `variant="danger"` to `variant="critical"` | After deprecating the danger variant |
| `page-aliases-to-canonical` | Updates deprecated Page component prop aliases | When deprecated Page aliases warn in console |
| `token-alias-rename` | Renames deprecated token aliases to their replacements | Whenever a token is deprecated |

Run all codemods with `--dry` first. Review the diff before applying. Never run a codemod on more than 20 files per PR without reviewing a 10% sample.

---

## 7. AI AGENT GOVERNANCE

### 7.1 Eight Binding Rules for AI Coding Agents

**Rule 1 — Check the component catalog first.**
`curl "http://localhost:3333/api/search-v2?q=<description>"` then check `packages/typescript/ui/src/component-catalog.stories.tsx`. If an equivalent exists, use it.

**Rule 2 — Use `--lb-*` tokens for all values.**
Every color, spacing, radius, and shadow value must resolve to a `--lb-*` custom property. No raw hex. No arbitrary Tailwind. No `px` values in className.

**Rule 3 — Never import from `lucide-react`.**
Always `import { Icon } from '@letbuyy/ui'`. Always.

**Rule 4 — No arbitrary Tailwind values.**
`rounded-[8px]` → `rounded-md`. `p-[14px]` → `p-3`. `text-[13px]` → `text-secondary`. No exceptions.

**Rule 5 — No raw Tailwind palette utilities.**
`bg-gray-100` → `bg-surface`. `text-gray-900` → `text-default`. `border-gray-200` → `border-line`. `bg-white` → `bg-surface`.

**Rule 6 — Use `formatInrCurrency` for all money.**
```typescript
import { formatInrCurrency } from '@letbuyy/ui'
formatInrCurrency(amount)  // CORRECT
`₹${amount}`              // WRONG
`Rs. ${amount}`           // WRONG — also a locale violation
```

**Rule 7 — Run `node scripts/validate-governance.mjs` after any design system change.**
After touching `tokens.ts`, `letbuyy-tokens.css`, any `globals.css`, or any TSX in an active app.

**Rule 8 — Query LCIS before scanning the repository.**
```
curl "http://localhost:3333/api/search-v2?q=<question>"    # semantic search
curl "http://localhost:3333/api/blast?q=<symbol>"           # blast radius
curl "http://localhost:3333/api/domain?key=<domain>"        # domain context
```
Repository grep is the final fallback when LCIS cannot answer.

### 7.2 Reference Implementations (Gold Standard Files)

These files represent the highest design-system compliance in the codebase. Use them as the canonical pattern for new work.

| Pattern | Gold standard file |
|---------|-------------------|
| List page | `apps/merchant-control-plane/src/app/[store]/customers/page.tsx` |
| Data with purchase orders | `apps/merchant-control-plane/src/app/[store]/products/purchase-orders/page.tsx` |
| Checkout / plan selection | `apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/SelectPlanClient.tsx` |
| Settings page | `apps/merchant-control-plane/src/app/[store]/settings/billing/page.tsx` |

---

*Source document: `docs/design-intelligence/LETBUYY_DESIGN_INTELLIGENCE_MASTER.md`*
*This kernel is the AI agent consumption layer. When audits produce new findings, update the Master. Update this Kernel only when platform design law changes.*
