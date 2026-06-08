# LetBuyy — Design Token Governance Audit

**Auditor:** Principal Design Systems Architect / UI Governance
**Date:** 2026-06-09
**Scope:** Token source-of-truth, token tiers, propagation, and enforcement across all web apps, the Flutter app, and shared packages.
**Method:** Direct source tracing (no code modified). Token engine read in full; enforcement tooling and CI traced; per-app consumption quantified with `rg`/`grep`. Every claim cites a file path and, where useful, line numbers.

> **One-line verdict:** The token *architecture* is genuinely strong — a Polaris-grade primitive → semantic → component tier system with light/dark/auto, three densities, five surfaces, per-tenant brand overrides, and built-in WCAG contrast checks. The token *governance* is the weak half: enforcement is half-wired (TSX hex is an error, but CSS is completely ungoverned and the Tailwind-palette rule is warn-only), so each app has grown a multi-thousand-line parallel CSS universe that bypasses the tokens it imports.

---

## 1. Canonical token source-of-truth

The real design-token system lives in **`packages/typescript/ui/src/tokens.ts`** (1,389 lines), exported by `@letbuyy/ui`.

> ⚠️ **Naming trap (Low severity, documentation):** `packages/token-core` (`@letbuyy/token-core`) is **not** design tokens — it is the auth/JWT token envelope package (`packages/token-core/src/index.ts:4` `TokenKind = 'id_token' | 'access_token' | …`). Anyone searching "token-core" for design tokens is misdirected. Recommend renaming to `@letbuyy/auth-token-core` or documenting the distinction in `AGENTS.md`.

### Token tiers (this is the strong part)

| Tier | Symbol | Location | Notes |
|---|---|---|---|
| **Primitive** | `letbuyyPrimitiveTokens` | `tokens.ts:47-121` | Raw palette: purple 100–900, gray 50–900 (+125/150/175), slate, green/amber/red/blue, opacity. Brand = purple `#8B5CF6`/`#7C3AED`. |
| **Semantic** | `letbuyySemanticTokens` | `tokens.ts:186-315` | `light` + `dark` roles: background/button/text/border/accent/status/statusText/statusSoft/focusRing/overlay. |
| **Component** | `letbuyyComponentTokens` | `tokens.ts:317-488` | `light`/`dark` per-component: button, card, sidebar, emptyState, input, table, pageHeader, badge, banner. |
| **Density** | `letbuyyDensityTokens` | `tokens.ts:500-585` | `compact`/`comfortable`/`spacious` — row heights, paddings, gaps, icon sizes. |
| **Type / space / radius / shadow / z / motion / size** | `letbuyyTokens.*` | `tokens.ts:672-800` | Typography scale, 12-step space scale, radius, shadows, z-index, motion, semantic sizes. |
| **CSS-variable emitter** | `letbuyyTokenCss` | `tokens.ts:1274-1388` | Serializes all tiers into `--lb-*` custom properties under theme/density/surface selectors. |

This is a textbook three-tier model and matches Shopify Polaris's palette-vs-alias split conceptually (see `SHOPIFY_BENCHMARK_REPORT.md`). Notable extras most teams never build: **per-tenant brand injection** (`createLetbuyyBrandVariables`, `tokens.ts:1187-1234`) and **runtime WCAG contrast validation** (`validateLetbuyyBrandContrast`, `tokens.ts:1154-1185`, AA 4.5 / focus 3.0).

### How tokens reach the DOM

`DesignSystemRoot` (`design-system-root.tsx:19`) renders a `<div data-letbuyy-design-system data-letbuyy-theme data-letbuyy-density data-letbuyy-surface>` and injects `letbuyyTokenCss` as a single inline `<style>` via `TokenStyleBoundary` (`token-style-boundary.tsx:13`, de-duplicated through React context). A second, additive layer — `config/tailwind/letbuyy-tokens.css` — maps Tailwind v4 `@theme` color utilities (`bg-surface`, `text-default`, `border-line`…) onto the `--lb-color-*` variables so utility classes also theme correctly.

---

## 2. Findings

### TOK-1 — CSS token governance is written but DORMANT
**Severity: Critical** · **Affected: all apps with hand-authored CSS (merchant-control-plane, app-marketplace, marketing-site, identity-platform, storefront-runtime, theme-marketplace)**

**Root cause.** `.stylelintrc.cjs` exists at the repo root and is well-designed — it bans raw hex (`color-no-hex`), named colors (`color-named: never`), and raw `rgb()/hsl()` outside the generated token files (`declaration-property-value-disallowed-list`). But its own header comment says: *"To activate: `npm i -D stylelint` … and add `lint:css` …"*. It was never activated.

**Code evidence.**
- `.stylelintrc.cjs:1-30` — full rule set + the "To activate" instruction.
- `grep -rn "stylelint\|lint:css" package.json apps/*/package.json` → **"NO stylelint dep / lint:css script ANYWHERE."**
- Result: the entire `.css` channel is ungoverned. `apps/merchant-control-plane/src/app/globals.css` = **10,335 lines**; `apps/app-marketplace/.../globals.css` = **7,475**; `apps/marketing-site/.../globals.css` = **5,143** — versus `platform-console` = **38** and `platform-operations-portal` = **37**.
- Platform totals of ungoverned raw values in CSS: **560** naked `color:/background: rgb(...)` declarations, **1,331** raw `px` padding/margin/gap declarations, **720** raw `px` font-sizes, **25** raw hex (all in `marketing-site/globals.css`).

**Recommended canonical direction.** Install `stylelint`, add `"lint:css": "stylelint \"apps/**/src/**/*.css\""`, wire it into `turbo lint` and CI as an **error gate**. Then run a one-time migration pass converting raw values in each `globals.css` to `var(--lb-*)`. The biggest globals.css files should be treated as the migration backlog.

---

### TOK-2 — Color ESLint rules are warn-only for the channels that actually leak
**Severity: High** · **Affected: all 9 web apps**

**Root cause.** The ESLint plugin `@letbuyy/ui` (`packages/typescript/ui/eslint/index.cjs`) ships five rules but only two block:

| Rule | Severity (`configs.recommended`) | Sees `.css`? |
|---|---|---|
| `no-raw-elements` (`<button>/<input>/<table>`) | **error** (`index.cjs:156`) | no |
| `no-hardcoded-hex` | **error** (`index.cjs:157`) | no |
| `no-raw-form-controls` (`<select>/<textarea>/<dialog>`) | warn (`:158`) | no |
| `no-raw-color-functions` (`rgb()/hsl()`) | warn (`:159`) | no |
| `no-tailwind-default-color` (`bg-gray-500`…) | warn (`:160`) | no |

The color rules inspect only JS `Literal`/`TemplateElement`/`JSXText` nodes (`index.cjs:108-118`) — they are structurally blind to `.css` files. So the two enforced rules (hex + raw elements) work (TSX hex ≈ 0), but the drift that survives is exactly what's left at `warn`: **254** raw Tailwind-palette classes (`bg-gray-*`, `bg-white`, `bg-slate-*`) platform-wide, led by **platform-console (115)** and **platform-operations-portal (42)** — the two apps with the cleanest CSS pushed their drift into `className` strings instead.

**Code evidence.** `eslint/index.cjs:137-142` (rule definition), `:160` (`warn`); `apps/platform-console/eslint.config.mjs:20` `"@letbuyy/ui/no-tailwind-default-color": "warn"` (identical in all 9 apps).

**Recommended canonical direction.** Promote `no-tailwind-default-color`, `no-raw-color-functions`, and `no-raw-form-controls` to `error` after a burn-down. Pair with TOK-1's stylelint so both channels (TSX + CSS) are governed. Consider a Tailwind `blocklist` for default-palette color classes as defense-in-depth.

---

### TOK-3 — CI lints changed files only and does not fail on warnings
**Severity: High** · **Affected: platform-wide governance**

**Root cause.** `.github/workflows/ci.yml:84` runs `pnpm turbo lint --filter="...[HEAD^1]"` — only packages changed since the previous commit, and ESLint warnings never fail a build. There is **no design/token/CSS/UI validator** among the 167 governance validators (`scripts/validators/` has none named `design|token|tailwind|ui|theme|css|style`), and `validate:governance` (`ci.yml:188`) checks architecture/topology, not design tokens. Net: token discipline relies on author goodwill, not a gate.

**Code evidence.** `ci.yml:83-84` (changed-only lint), `ci.yml:188` (`validate:governance` = architecture), `turbo.json:35-37` (`"lint": { "dependsOn": [] }`), `ls scripts/validators/ | grep -iE 'design|token|tailwind|ui|theme|css|style'` → none.

**Recommended canonical direction.** Add a `validate:design-tokens` step that runs ESLint (error severities) + stylelint repo-wide (not changed-only) in CI, and a small bespoke validator that fails when an app's `globals.css` exceeds a budget of raw color/spacing literals (a "drift budget" that only ratchets down).

---

### TOK-4 — Mobile token bridge exists, is in-sync, and is bypassed
**Severity: High** · **Affected: apps/mobile/merchant-app**

**Root cause.** `packages/typescript/ui/src/mobile-tokens.ts` (68 lines) is the intended web→Flutter token bridge; `scripts/generators/generate-mobile-tokens.mjs` transpiles it to `apps/mobile/merchant-app/lib/theme/letbuyy_color_tokens.dart`, and `--check` reports *in sync*. But the live `ThemeData` is driven by a separate hand-maintained Dart palette (`packages/dart/ui_kit/lib/src/themes/app_colors.dart`), where `success = #A4E500` (lime) and `error = #B02525` (brick) diverge from web `#22C55E`/`#EF4444` (`tokens.ts:90,103`). The generated, correct values are reduced to a screen-local `mobile_tokens` alias. The drift gate is not in CI (`ci.yml` runs `flutter analyze/test` only; no `generate-mobile-tokens --check`).

**Code evidence.** `mobile-tokens.ts:3-4` ("can never drift") vs `app_colors.dart:92,96`; `store_theme.dart:17` binds `LetbuyyColorTokens.primary` to the ui_kit class, not the generated file (name collision — two classes named `LetbuyyColorTokens`). Full detail in `LIGHT_DARK_MODE_AUDIT.md` §Mobile and `COMPONENT_DUPLICATION_REPORT.md` §Mobile.

**Recommended canonical direction.** Make the generated `letbuyy_color_tokens.dart` the single Dart source; delete/rename the duplicate `LetbuyyColorTokens`; reconcile `AppColors` semantic colors to the generated values; wire `generate-mobile-tokens.mjs --check` into CI as a gate.

---

### TOK-5 — Apps re-declare `--lb-*` tokens locally, defeating the single source
**Severity: High** · **Affected: app-marketplace, identity-platform, merchant-control-plane**

**Root cause.** Because of the dark-mode cascade issue (see `THEME_ARCHITECTURE_AUDIT.md` THEME-1), apps hand-author their own `.dark` overrides instead of relying on the emitted token CSS. `app-marketplace/src/app/globals.css:115-144` re-defines `--lb-color-*` under its own `.dark`; `merchant-control-plane/globals.css` maps app-local aliases *from* DS tokens (e.g. `--header-bg: var(--lb-color-text)`), creating a second, fragile token layer. Repo-wide there are **80–124 app-local custom properties** per large app shadowing the canonical set.

**Code evidence.** `app-marketplace/.../globals.css:115-144`; `merchant-control-plane/.../globals.css` `--sidebar-*`/`--header-*` aliases; intelligence scan lists per-app non-`--lb-` custom-prop counts (merchant 124, app-marketplace 80, marketing 71).

**Recommended canonical direction.** Eliminate the root cause (THEME-1) so apps can delete their `.dark` token re-declarations and consume the emitted variables directly. Forbid redefinition of any `--lb-*` variable outside `@letbuyy/ui` via a stylelint rule.

---

### TOK-6 — A deprecated-alias purge exists but no codified token contract / changelog discipline for additions
**Severity: Medium** · **Affected: @letbuyy/ui consumers**

**Root cause.** The token file actively prunes deprecated aliases (`deprecatedTokenAliasVariables`, `tokens.ts:9-21`, deleted at `:1057-1059`) and the package ships a `DEPRECATIONS.md` + codemods for component renames — good hygiene. But there is no machine-readable token manifest (e.g., a JSON token dictionary) and no enforced changelog for token *additions*; tokens are TS objects only. Polaris ships `@shopify/polaris-tokens` as a standalone, versioned, machine-readable package consumed by both code and Figma.

**Code evidence.** `tokens.ts:9-21,1057-1059`; `packages/typescript/ui/DEPRECATIONS.md`; no `tokens.json`/W3C-DTCG export found.

**Recommended canonical direction.** Emit a versioned `tokens.json` (W3C Design Tokens format) from `tokens.ts` as the interchange artifact for Figma + mobile generation, and treat it as the single source the TS/CSS/Dart layers all derive from.

---

## 3. Token-governance scorecard (component of the master scorecard)

| Dimension | Rating | Basis |
|---|---|---|
| Token architecture / tiering | **4.5 / 5** | Primitive→semantic→component, density, surfaces, brand, contrast checks. |
| Token completeness (color/type/space/radius/shadow/z/motion) | **4.5 / 5** | All families present and themed. |
| Cross-platform token parity (web↔mobile) | **2.0 / 5** | Bridge exists but bypassed; semantic-color divergence. |
| Token enforcement (lint/CI) | **1.5 / 5** | TSX hex blocked; CSS ungoverned; key rules warn-only; changed-only CI. |
| Token documentation / interchange | **2.0 / 5** | Auto-generated scan only; no machine-readable manifest. |
| **Design-token governance (overall)** | **3.0 / 5** | World-class core, half-wired governance. |

See `DESIGN_SYSTEM_MASTER_AUDIT.md` for the consolidated platform scorecard and remediation sequencing.
