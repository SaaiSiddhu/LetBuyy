# LetBuyy Theme Governance

**Generated:** 2026-06-19
**Sources:** `scripts/validators/validate-design-system.mjs`, `scripts/validators/design-system-baseline.json`, `docs/design-system/foundations.md`, `docs/design-system/colors.md`, `docs/design-system/dark-mode.md`, `docs/ui-standards/design-system.md`, `packages/theme-engine/src/theme-governance.ts`, `docs/theme-research/09-target-theme-architecture.md`.

---

## Current State

### What Governance Exists Today

LetBuyy has a **deterministic validator gate** of 107 validators, of which the design system contributes at least 4 hard gates and 1 ratchet gate:

#### Hard Gates (fail CI, cannot merge)

| Validator | What It Catches | Where Enforced |
|---|---|---|
| `validate-design-system.mjs` | `<DesignSystemRoot>` in layout files (apps must use `<LetbuyyThemeProvider>`); `theme="auto"` prop (forbidden — must pass resolved theme); legacy storage keys (`letbuyy_theme`, `theme`, `theme-marketplace-theme`); bespoke `ThemeContext.createContext` implementations | CI + pre-commit hook |
| `validate-design-tokens.mjs` | `tokens.json` DTCG file drifting from `tokens.ts` (auto-generated parity check) | CI + `scripts/generators/generate-design-tokens.mjs --check` |
| `validate-mobile-tokens.mjs` | Flutter token drift from `tokens.ts` | CI |
| ESLint `@letbuyy/ui` plugin | Raw `<button>`, `<input>`, `<table>` elements (error); raw hex/rgb color in TSX (error); Tailwind palette classes like `bg-gray-500` (warning) | Per-app `eslint.config.mjs` |

#### Ratchet Gate (drift may only decrease)

`scripts/validators/design-system-baseline.json` records current violation counts. Any PR that **increases** a count fails CI. Counts can only be **decreased** (by fixing violations) or held.

Current baseline (as of 2026-06-12):

| Metric | Current Count | What It Measures |
|---|---|---|
| `appCssRawHex` | 0 | Raw hex values in `.css` files |
| `appCssNakedRgbHsl` | 572 | Raw `rgb()`/`hsl()` in `.css` files |
| `tailwindPaletteClasses` | 588 | Tailwind default palette classes (`bg-gray-*`, `text-white`, etc.) |
| `appLocalLbTokenRedefs` | 112 | App CSS files re-declaring `--lb-*` variables (bypassing the token system) |
| `rawPxFontSize` | 533 | Raw `px` font sizes (should use `--lb-font-size-*`) |
| `rawPxSpacing` | 1,365 | Raw `px` spacing (should use `--lb-space-*`) |
| `tsxInlineStyles` | 635 (cap) | Inline `style={{}}` in TSX |
| `tsxRawHex` | 0 | Raw hex colors in TSX |
| `tsxArbitraryRadius` | 327 | `rounded-[...]` Tailwind arbitrary radius |
| `tsxArbitraryShadow` | 8 | `shadow-[...]` Tailwind arbitrary shadow |
| `localWorkspaceImplementations` | 0 | Duplicate workspace implementations |

**Note:** `apps/marketing-site` is exiled from the ratchet scope (intentionally excluded because it is a marketing site with bespoke design requirements).

#### Storefront / Liquid Renderer Governance

`packages/theme-engine/src/theme-governance.ts` provides:

- `THEME_RENDERER_GOVERNANCE_DEFAULT_MODE = 'warn'` — section schema mismatches warn in dev, can be escalated to `'enforce'`
- `auditThemeRendererRegistry()` — validates that every section type in a template config is registered in `SECTION_SCHEMAS` or `BUILT_IN_SECTION_SCHEMAS`, and that block types are valid
- `assertThemeRendererRegistry()` — enforcing variant that throws on any schema mismatch
- `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION = { status: 'deferred', authority: 'ARB' }` — explicit ARB gate on Liquid becoming the default renderer
- `ART-17` (referenced in CLAUDE.md) — freezes new React-per-section on frozen surfaces; new sections must be Liquid

### Who Owns the Token System

**Token system authority:** `packages/typescript/ui/src/tokens.ts` is the single source of truth. The DTCG JSON interchange (`packages/typescript/ui/tokens.json`) is auto-generated from `tokens.ts` and must stay in parity (validated by `generate-design-tokens.mjs --check`).

**Package owner:** `@letbuyy/ui` (`packages/typescript/ui`). All apps consume, none re-declare.

**Theme engine owner:** `packages/theme-engine/src/` — separate authority for storefront rendering. Theme engine tokens (merchant `primaryColor`, etc.) are entirely independent of `--lb-*`.

**Governance authority:** The 107-validator gate is authoritative for hard violations. The Architecture Review Board (ARB) gates platform-wide renderer decisions (`THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION`).

### How Tokens Are Changed

1. Edit `packages/typescript/ui/src/tokens.ts` — the single source
2. Run `pnpm run scripts/generators/generate-design-tokens.mjs` to regenerate `tokens.json`
3. Run `pnpm run validate:design-tokens` to verify parity
4. Run `pnpm run validate:mobile-tokens` if Flutter token parity is affected
5. If lowering ratchet drift, run `node scripts/validators/validate-design-system.mjs --update` to regenerate `design-system-baseline.json`
6. Commit both `tokens.ts` and `tokens.json`

**Deprecated tokens** are tracked in `deprecatedTokenAliasVariables` Set in `tokens.ts`. When a token is deprecated, it is added to this Set, which causes `colorVariables()` to explicitly delete it from the emitted CSS. This prevents accidental use.

Currently deprecated:
- `--lb-color-text-primary` (use `--lb-color-text`)
- `--lb-color-text-secondary` (use `--lb-color-text-subdued`)
- `--lb-color-border-default` / `--lb-color-border-subtle` (use `--lb-color-border`)
- `--lb-color-danger` (use `--lb-color-critical`)
- `--lb-semantic-focus-ring` / `--lb-semantic-accent-brand` / `--lb-semantic-accent-text`
- `--lb-semantic-text-primary` / `--lb-semantic-text-secondary` / `--lb-semantic-text-muted`

### How Token Violations Are Caught

**At development time:**
- ESLint `@letbuyy/ui` plugin catches raw elements and colors in TSX
- `pnpm lint:css` (Stylelint) catches raw color values in `.css` files (once Stylelint is installed)

**At commit time:**
- `pnpm run hooks:install` sets up pre-commit hooks
- Hooks run `validate-design-system.mjs` and `validate-design-tokens.mjs`

**At CI time:**
- All 107 validators run in the gate
- Ratchet counts are compared against `design-system-baseline.json`
- Any increase in violation counts fails the build

---

## Gaps

### Missing Theming Capabilities

**1. Canonical Provider Not Universally Adopted**

`identity-platform` and `platform-console` do not use `LetbuyyThemeProvider`. They have their own CSS dark mode implementations:
- `identity-platform`: custom `.dark` class toggle on auth pages; no `ThemeScript` in `<head>` → flash risk
- `platform-console`: uses `@media (prefers-color-scheme: dark)` only — no persistent manual override

**2. Storefront Dark Mode Not Implemented**

The React storefront rendering path has no dark mode. Liquid themes could theoretically support it via `settings_data` color tokens but no dark palette is defined in `THEME_SETTINGS_SCHEMA`. The storefront customer experience is always light-mode.

**3. No Per-Surface Color Differentiation**

All 5 surfaces (`admin | marketplace | storefront | identity | operations`) use identical `surfaceVariables()` outputs. The `surface` prop on `DesignSystemRoot` scopes component variable names but not brand colors. A `marketplace` surface looks identical to an `admin` surface.

**4. Preset Application Not Wired**

`packages/theme-engine/src/theme-presets.ts` defines 10 Experience presets with full validation, but there is no API action in `merchant-control-plane` to apply a preset to `settings_data.current`. The preset engine is built but not connected to the merchant UI.

**5. Font Loading for Non-System Fonts**

Experience presets reference fonts like `Playfair Display`, `Cormorant Garamond`, `Space Grotesk`. These only render correctly once a font-loading mechanism is wired into the Liquid head assets. Until then, these experiences render with system-font fallbacks. This is documented in `docs/v1-execution/phase-2/03-experience-registry-report.md` (deferred).

**6. Large globals.css Files With Extensive Raw Values**

The ratchet baseline shows significant outstanding drift:
- 572 raw `rgb()` calls in CSS files
- 588 Tailwind palette classes in TSX
- 1,365 raw `px` spacing values
- 327 arbitrary radius values

The largest offender is `apps/merchant-control-plane/src/app/globals.css` at 13,630 lines, which re-implements much of the design system in bespoke CSS classes (e.g. `.lb-table-*`, `.lb-input-*`, `.lb-modal-*`) rather than composing from `@letbuyy/ui` components.

**7. Marketing Site Exclusion**

`apps/marketing-site` is exiled from the ratchet scope. It has its own premium token vocabulary (`--gradient-primary`, `--glass-bg`, `--shadow-glow`, `--ease-smooth`) that is never synchronized with the design system and drifts independently.

**8. No Token Contract Between Admin and Storefront Systems**

`--lb-*` tokens (admin design system) and storefront `--primary`/`--background`/etc. tokens are completely separate namespaces. There is no cross-system token contract. A merchant's `primaryColor` in the storefront has no relation to `--lb-color-primary` in the admin. This is correct by design but creates a maintenance surface: changes to either system do not propagate to the other.

**9. No Brand Color Contrast Enforcement in CI**

`validateLetbuyyBrandContrast()` exists but is only called when a `brand` prop is passed to the provider. There is no CI gate that validates that specific per-tenant brand colors meet WCAG AA contrast requirements before being persisted to the database.

### Current Risks

**Risk 1: Identity Platform Flash (High)**

`identity-platform` does not render `<ThemeScript>` in `<head>`. Dark mode is toggled via JavaScript after paint. On dark OS settings, users see a white flash before the theme is applied.

**Risk 2: Token Redefinition in App CSS (Medium)**

112 `--lb-*` token redefinitions exist in app CSS files (measured by `appLocalLbTokenRedefs`). The merchant-control-plane `globals.css` directly overrides `--lb-component-sidebar-*` and `--lb-color-primary` family tokens. If the canonical token definitions change, these local overrides may silently produce incorrect results if they reference stale values.

**Risk 3: Liquid Renderer Without ARB Gate Could Drift (Medium)**

`THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'`. The flip is guarded by ARB approval, but individual stores can activate Liquid rendering by having `rendererEngine: 'liquid'` in their `templateConfig`. There is no CI gate that audits whether live stores with Liquid rendering meet the parity requirements (`THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT = 20`).

**Risk 4: Section Schema Drift (Low-Medium)**

`auditThemeRendererRegistry()` runs in `'warn'` mode by default. Unknown section types produce warnings, not errors. A misconfigured theme template (e.g. a section type removed from `SECTION_SCHEMAS` but still referenced in stored `template_config` records) would silently degrade without CI enforcement.

**Risk 5: Marketing Site Token Drift (Low)**

The marketing site's premium tokens (`--gradient-*`, `--glass-*`, `--shadow-glow`) are defined in isolation. If the brand purple changes in `tokens.ts`, the marketing site gradients (`linear-gradient(135deg, rgb(139 92 246) 0%, ...)`) must be manually updated — there is no automated link.

---

## Recommendations

### Token Architecture Improvements

**1. Extend LetbuyyBrandOverrides for White-label**

Add `secondary`, `surface`, and `typography` override keys to `LetbuyyBrandOverrides`:

```typescript
interface LetbuyyBrandOverrides {
  primary: string;           // existing
  secondary?: string;        // new: secondary action color
  background?: string;       // new: override page background for white-label
  headingFont?: string;      // new: custom font family
  bodyFont?: string;         // new: custom font family
  // ... existing fields
}
```

This enables true white-label instances without touching the token system.

**2. Add Per-Surface Color Scoping**

The `letbuyySurfaceTokens` map today produces identical variables for all surfaces. Add surface-specific brand accent overrides so `marketplace` and `operations` surfaces can have distinct visual identities:

```typescript
const letbuyySurfaceAccents: Record<LetbuyySurface, { light: string; dark: string }> = {
  admin:       { light: '#8B5CF6', dark: '#8B5CF6' },  // purple
  marketplace: { light: '#3B82F6', dark: '#60A5FA' },  // blue
  operations:  { light: '#10B981', dark: '#34D399' },  // emerald
  identity:    { light: '#8B5CF6', dark: '#8B5CF6' },  // same as admin
  storefront:  { light: '#8B5CF6', dark: '#8B5CF6' },  // merchant-overridden
};
```

**3. Unify Marketing Site Gradient Tokens**

Move `--gradient-primary` and `--shadow-glow` into a `letbuyyMarketingTokens` export in `tokens.ts`. This makes the marketing site's purple gradient automatically update when the brand primary changes.

**4. Token Migration Plan for globals.css Drift**

The 13,630-line merchant-control-plane `globals.css` is the primary source of drift. Recommended phased approach:
- Phase A: Migrate `.lb-table-*` → `@letbuyy/ui Table` component (largest single category)
- Phase B: Migrate `.lb-input-*`, `.lb-modal-*`, `.lb-drawer-*` → `@letbuyy/ui` equivalents
- Phase C: Remove app-local `--primary`, `--bg`, `--text-*` aliases and use `--lb-color-*` directly
- Target: reduce `globals.css` from 13,630 to < 2,000 lines

### Governance Process Improvements

**1. Add ThemeScript Enforcement to Validator**

The `validate-design-system.mjs` gate should flag any `layout.tsx` that uses `<LetbuyyThemeProvider>` without a sibling `<ThemeScript>` in `<head>`. Currently flash prevention is advisory.

**2. Add identity-platform to Canonical Provider**

Migrate `identity-platform` to `LetbuyyThemeProvider`. The auth UI's custom dark mode toggle should call `useTheme().setTheme()` instead of toggling `.dark` class manually. This resolves the flash risk.

**3. Add Brand Contrast Gate to DB Writes**

When a merchant saves `primaryColor` via the theme editor API (`services/api-gateway/src/routes/themes.ts`), call `validateLetbuyyBrandContrast(primaryColor)` server-side and return a 422 if the primary-to-white contrast ratio is below 4.5:1. This prevents inaccessible storefronts from being published.

**4. Escalate Renderer Audit to Enforce Mode**

Change `THEME_RENDERER_GOVERNANCE_DEFAULT_MODE` from `'warn'` to `'enforce'` in the API gateway's template rendering path (not in the package default, which may be used in dev tooling where warn is appropriate). Unknown section types should prevent template rendering in production, not just warn.

**5. Ratchet Wave Planning**

The ratchet baseline (`design-system-baseline.json`) has a `ratchetPerWavePercent: 10` setting. Formalize a quarterly "token wave" where the team commits to reducing each ratchet count by 10%. At the current pace:
- `rawPxSpacing` (1,365) would reach 0 in ~7 quarters (1.75 years)
- `tailwindPaletteClasses` (588) would reach 0 in ~4 quarters (1 year)
- `tsxArbitraryRadius` (327) would reach 0 in ~3 quarters (9 months)

**6. Enforce ART-17 in CI**

ART-17 (no new React-per-section after freeze) is currently documented but not machine-checked. Add a validator that counts React-rendered sections in `apps/storefront-runtime/src/lib/theme-engine/sections/` and ensures the count does not increase without an explicit governance override flag.

### Tooling Recommendations

**1. Token Usage Analytics**

Add a build-time step that produces a `token-usage-report.json` showing:
- Which `--lb-*` tokens are referenced in TSX/CSS
- Which tokens are defined but unreferenced (dead tokens)
- Which components use the most tokens (complexity indicator)

This data feeds the LCIS `/api/discovery-v2` endpoint for autonomous drift detection.

**2. Visual Token Diff in PRs**

Add a GitHub Action that runs `generate-design-tokens.mjs` on PRs touching `tokens.ts` and posts a comment showing which CSS variables changed, were added, or were removed. Reviewers can see the full token diff without reading the TypeScript.

**3. Storefront Token Preview in Editor**

Wire the Experience preset selector in the merchant theme editor to call `validateExperiencePreset()` before saving. Show a live color swatch preview using the preset's `swatches` field from `ExperiencePreviewSchema`. This is architecturally ready (the preview schema is implemented) but not connected to the editor UI.

**4. Cross-System Token Bridge Document**

Produce a living document (or LCIS endpoint) that maps:
- Admin `--lb-color-primary` ↔ Storefront `--primary` (both resolve to `#8B5CF6` by default, but are independent)
- Admin `--lb-color-critical` ↔ Storefront `--error` (same value, independent definition)

This prevents silent divergence when a designer assumes the two systems are linked.

**5. Stylelint Activation**

The `.stylelintrc.cjs` is referenced in `docs/ui-standards/design-system.md` but `pnpm lint:css` requires Stylelint to be installed. Add `stylelint` and `stylelint-config-standard` to the dev workspace and activate it in CI to enforce the `appCssNakedRgbHsl` and `appCssRawHex` counts programmatically rather than via the custom validator script.
