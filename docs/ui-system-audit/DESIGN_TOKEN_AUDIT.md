# DESIGN_TOKEN_AUDIT.md

**Scope:** token system in `packages/typescript/ui/src/tokens.ts` (997 LOC) + `fonts.ts`.
**Audit date:** 2026-06-06

---

## Executive summary (for leadership)

**The token architecture is the strongest part of `@letbuyy/ui`, and it is genuinely good.** It implements the same three-tier model that Shopify Polaris, Stripe, and Material 3 use:

> **primitive** (raw values) → **semantic** (intent: `text.primary`, `background.card`) → **component** (per-component: `button.primary.bg`, `card.shadow`)

…plus an orthogonal **density** axis (compact / comfortable / spacious) and **theme** axis (light / dark), all compiled deterministically from TypeScript into CSS custom properties (`--lb-*`). There is **one source of truth** (`tokens.ts`) and **no app imports raw token objects** — consumption is entirely via CSS variables. That is exactly the architecture you want.

**The problems are not architectural, they are hygiene:**

1. **Alias sprawl** — the flattened `color.light`/`color.dark` maps expose the *same value under many names* (`text` = `textPrimary`, `border` = `borderDefault`, `space-1` = `space-xs`). This balloons the variable count and invites drift.
2. **A brand contradiction** — the brand is purple, but the **light-mode primary button is near-black** (`slate-900`), while dark-mode primary is purple. The "primary" color is not stable across themes.
3. **No breakpoint tokens** — responsive design relies on raw Tailwind `sm/md/lg/xl` literals scattered through component class strings; breakpoints are the one token family that was never tokenized.
4. **Dual vocabularies** — `danger` vs `critical`, `heading` vs `h4`/`sectionTitle`, duplicate spacing names.

None of these break rendering today, but they are exactly the kind of debt that makes a token system unsafe to evolve. Fixes are in `TOP_100_UI_FOUNDATION_ISSUES.md` and `LETBUYY_UI_SYSTEM_V2.md`.

---

## Source-of-truth verdict by token family

| Token family | Single source? | Where | Notes |
|---|---|---|---|
| **Color** | ✅ then ⚠️ | `letbuyyPrimitiveTokens.color` → semantic → component → flattened `color.{light,dark}` | Single source, but flattened layer re-exposes values under 3–4 alias names each |
| **Typography** | ✅ | `letbuyyTokens.typography` | Single source. But two naming schemes coexist (semantic `pageTitle/cardTitle` **and** `h1–h4`) |
| **Spacing** | ⚠️ | `letbuyyTokens.space` | Single object, but emitted **twice** as `--lb-space-1..8` *and* `--lb-space-xs..xl` |
| **Radius** | ✅ | `letbuyyTokens.radius` | Clean: `sm/md/lg/xl/full` |
| **Shadow** | ⚠️ | `letbuyyTokens.shadow` **and** `component.card.shadow` | Two shadow systems: global `shadow.{sm,md,lg}` and a separate per-theme `card.shadow` literal that doesn't reference the scale |
| **Breakpoints** | ❌ | *(none)* | **No breakpoint tokens exist.** Raw Tailwind `sm:/md:/xl:` literals in components |
| **Motion** | ✅ | `letbuyyTokens.motion` | `duration.{fast,normal,slow}`, `easing.{standard,out,emphasized}`, `transform` |
| **Z-index** | ❌ | *(none — hardcoded)* | No z-index scale; components hardcode `z-10/z-40/z-50` Tailwind utilities |
| **Density** | ✅ | `letbuyyDensityTokens` | Excellent — 3 tiers × ~28 measures, emitted as `--lb-density-*` |
| **Sizing** | ✅ | `letbuyyTokens.size` | Rich named sizes (page max, content measure, command-palette width, chart heights…) |

---

## 1. Color

### Structure (good)
```
primitive.color.{purple,gray,slate,green,amber,red,blue,white,black}  // raw hex
  → semantic.{light,dark}.{background,button,text,border,accent,status,statusSoft,focusRing,overlay}
    → component.{light,dark}.{button,card,sidebar,emptyState,input,table,pageHeader,badge,banner}
      → flattened color.{light,dark}.*  (consumed as --lb-color-*)
```
This is the correct layering. `appendTokenVariables()` recursively walks primitive/semantic/component into kebab-cased `--lb-primitive-*`, `--lb-semantic-*`, `--lb-component-*` variables, and `colorVariables()` adds the flattened `--lb-color-*` aliases.

### Finding C-1 — Brand/primary contradiction across themes ⚠️ HIGH
- `letbuyyColorTokens.primary` = `purple[500]` (`#8B5CF6`) — the brand.
- But `semantic.light.button.primary.bg` = `slate[900]` (`#111…` near-black); `semantic.dark.button.primary.bg` = purple.

So a primary `Button` is **black in light mode and purple in dark mode**. Meanwhile `accent.brand`, `Avatar`, `MetricCard` sparkline, `ProgressBar`, active tabs, and focus rings are **purple in both**. The result: in light mode the most prominent CTA does not use the brand color, and "primary" is theme-unstable. This is a deliberate-looking choice (Linear/Vercel use near-black CTAs) but it is undocumented and collides with the purple brand signal everywhere else. **Decide and document: is the brand purple or is it ink?**

### Finding C-2 — Alias sprawl in flattened color maps ⚠️ MEDIUM
`color.light`/`color.dark` expose the same value under multiple keys, each of which becomes a CSS variable:
- `text` = `textPrimary` (both → `semantic.text.primary`)
- `border` = `borderDefault` (both → `semantic.border.default`)
- `bg` = `background` (both → `semantic.background.page`)
- `textSubdued` = `textSecondary`
- plus `--lb-sidebar-bg`/`--lb-color-sidebar`, `--lb-card-bg`/`--lb-color-card`, `--lb-content-bg`/`--lb-color-bg` all duplicating.

Net effect: **~30+ redundant CSS variables**. Drift risk: a future edit to `--lb-color-text` that misses `--lb-color-text-primary` desynchronizes two names that consumers assume are identical.

### Finding C-3 — `danger`/`critical` dual vocabulary ⚠️ MEDIUM
`status.danger` and flattened `critical`/`criticalSoft`/`criticalHover` coexist. `Badge` accepts both `'danger'` and `'critical'`. There is no single canonical word for the error intent. Pick one (Polaris uses `critical`).

### Finding C-4 — `statusSoft` light values are hardcoded hex, not primitives ⚠️ LOW
`semantic.light.statusSoft` uses literal `#DCFCE7/#FEF3C7/#FEE2E2/#E0F2FE` rather than primitives, while `dark.statusSoft` correctly references `primitive.color.*[950]`. Light soft-status colors are off-ramp from the primitive scale.

### Contrast spot-checks (see `ACCESSIBILITY_AUDIT.md` for full)
- `textSecondaryLight` `#6B7280` on `surfaceLight` `#FFF` ≈ 4.8:1 — passes AA for normal text (barely).
- `textMuted` `#94A3B8` on white ≈ 2.6:1 — **fails** AA for text; only safe for decorative/large.
- Brand purple `#8B5CF6` text on white ≈ 3.5:1 — **fails** AA for normal text; the active-tab and primary-accent text uses it.

---

## 2. Typography

### Finding T-1 — Two parallel type scales ⚠️ MEDIUM
`typography.fontSize` defines **both** a semantic scale (`pageTitle`, `sectionTitle`, `cardTitle`, `bodyLarge`, `body`, `secondary`, `table`, `sidebar`, `emptyState`, `caption`, `badge`) **and** a generic scale (`display`, `h1`, `h2`, `h3`, `h4`, `heading`). Several collide on value (`h2`=`pageTitle`=24px; `h4`=`heading`=`sectionTitle`=18px; `secondary`=`table`=`small`=13px). 21 font-size variables for what is functionally ~7 distinct steps. Consolidate to one named scale.

### Strengths
- Each size has a paired line-height (good — most teams forget this).
- Font stacks (`fonts.ts`) are layered correctly with system fallbacks; families wired as `--lb-font-family-{body,display,mono}`.
- Weights are a clean 4-step scale (`400/500/600/700`).

---

## 3. Spacing, radius, shadow

### Finding S-1 — Spacing emitted under two names ⚠️ LOW
`space` (`none/xs/sm/md/lg/xl/2xl/3xl/4xl`) is emitted as **both** numeric (`--lb-space-0..8`) and t-shirt (`--lb-space-xs..xl`). The numeric set goes to 8, the t-shirt set stops at `xl` — so they are not even symmetric. `layout.tsx`'s `SpaceScale` type only allows `'0'..'7'`, ignoring `4xl`/`--lb-space-8` partially. Pick one naming convention.

### Finding S-2 — Two shadow systems ⚠️ LOW
Global `shadow.{sm,md,lg}` exists, but `component.{light,dark}.card.shadow` is a **separate literal** (`0 1px 2px …, 0 8px 24px …`) that doesn't reference the scale. Cards therefore don't use `--lb-shadow-*`; they use `--lb-component-card-shadow`. Two ways to get a shadow.

### Strengths
- Radius scale is clean and consistently consumed (`--lb-radius-*`).
- Motion tokens exist and are consistently used (`duration`, `easing`, `transform` for hover lift/scale).

---

## 4. The two missing token families

### Finding B-1 — No breakpoint tokens ❌ HIGH (for a "responsive foundation")
There is **no breakpoint scale anywhere**. Responsive behavior is implemented with raw Tailwind literals (`sm:`, `md:`, `xl:`) embedded directly in component class strings (e.g. `Page`, `Section`, `IndexTable`, `Modal`, `SaveBar`). Consequences:
- Breakpoint values are Tailwind defaults (640/768/1024/1280), invisible to the token system and to consumers.
- No way to theme/override breakpoints; no documented responsive contract.
- See `RESPONSIVE_FOUNDATION_REPORT.md`.

### Finding Z-1 — No z-index scale ❌ MEDIUM
Overlay stacking is hardcoded: Tooltip `z-50`, Modal `z-50`, CommandPalette `z-50`, Combobox menu `z-40`, ToastProvider `z-50`, SaveBar `z-40`, sticky elements `z-10`. With multiple `z-50` layers, **stacking order between Modal, Toast, and CommandPalette is undefined** (DOM-order dependent). A `--lb-z-*` scale (dropdown/sticky/overlay/modal/toast/tooltip) is needed.

---

## 5. Token compilation & delivery

`letbuyyTokenCss` serializes everything into a single CSS string with selectors:
- `:root, [data-theme="light"], [data-letbuyy-theme="light"]` (light)
- `[data-theme="dark"], [data-letbuyy-theme="dark"], .dark` (dark)
- `[data-density="compact|comfortable|spacious"]` (+ `data-letbuyy-density`)
- base resets under `[data-letbuyy-design-system="true"]` + empty-state keyframes.

### Finding D-1 — No `prefers-color-scheme` ⚠️ HIGH (theming)
There is **no `@media (prefers-color-scheme: dark)`** block. `DesignSystemRoot theme="auto"` sets the theme data-attr to `undefined`, so "auto" silently means **light**. See `THEMING_AUDIT.md`.

### Finding D-2 — Token CSS injected per-provider-instance ⚠️ MEDIUM
`DesignSystemRoot` injects the **entire** `letbuyyTokenCss` via `<style dangerouslySetInnerHTML>` whenever `includeTokenStyles` (default `true`). Nested roots or multiple roots → **duplicated multi-KB `<style>` blocks**. There is no dedupe guard and no static CSS-file delivery path.

### Finding D-3 — `surface` token dimension declared but unused ⚠️ MEDIUM
`DesignSystemRoot` writes `data-letbuyy-surface="admin|marketplace|storefront|identity|operations"`, but **no token CSS keys off it**. The surface axis is declared and inert — a hook for multi-surface theming that was never wired (relevant to white-label; see `THEMING_AUDIT.md`).

---

## Scorecard

| Dimension | Grade | One-line |
|---|---|---|
| Layering (primitive/semantic/component) | **A** | Textbook three-tier model |
| Density system | **A** | Rare and well-executed |
| Single source of truth | **A−** | One file; CSS-var consumption; no raw imports |
| Naming consistency | **C** | Alias sprawl, dual vocabularies, two type scales |
| Theme coverage | **C+** | Light/dark only; auto broken; surface inert |
| Breakpoints | **F** | Not tokenized at all |
| Z-index | **D** | No scale; colliding `z-50` |
| Delivery | **B−** | Deterministic, but per-instance `<style>` injection |

**Bottom line:** keep the architecture verbatim; spend one focused sprint on **token hygiene** (collapse aliases, unify vocabularies, add breakpoint + z-index scales, wire `prefers-color-scheme`). That converts a B token system into an A.
