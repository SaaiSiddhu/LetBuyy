# LetBuyy Design Governance Report
**Audit date:** 2026-06-09
**Scope:** CI enforcement, ESLint plugin activation, stylelint coverage, ratchet baseline state, drift policy

---

## 1. Governance Infrastructure Inventory

| Tool | File | Scope | Status |
|---|---|---|---|
| ESLint plugin (`@letbuyy/ui`) | `packages/typescript/ui/eslint/index.cjs` | .ts/.tsx in apps | Activated in all 9 apps |
| Stylelint config | `.stylelintrc.cjs` | .css in apps | Configured but **not CI-enforced** |
| Design system validator | `scripts/validators/validate-design-system.mjs` | apps dir, HARD + RATCHET | Ratchet baseline **MISSING** |
| Mobile token generator | `scripts/generators/generate-mobile-tokens.mjs` | TS → Dart | Drift-check mode exists (`--check`) |
| Design token CSS generator | `scripts/generators/generate-design-tokens.mjs` | TS → CSS | Drift-check mode exists (`--check`) |
| Token API snapshot validator | `packages/typescript/ui/tests/validators/ui-public-api-snapshot-validator.mjs` | Package public API | Exists |
| Token variable snapshot validator | `packages/typescript/ui/tests/validators/ui-token-variable-snapshot-validator.mjs` | CSS var names | Exists |
| CI workflows | `.github/workflows/` | All | **NO CI WORKFLOWS EXIST** |

---

## 2. ESLint Plugin (`@letbuyy/ui`) — Real Enforcement

### Rules Defined
`packages/typescript/ui/eslint/index.cjs`

| Rule | Severity in recommended | What it catches |
|---|---|---|
| `no-raw-elements` | **error** | Raw `<button>`, `<input>`, `<table>` elements (requires @letbuyy/ui replacements) |
| `no-hardcoded-hex` | **error** | String/template literals containing `#[hex]` color values |
| `no-raw-form-controls` | warn | Raw `<select>`, `<textarea>`, `<dialog>` |
| `no-raw-color-functions` | warn | `rgba?()` or `hsla?()` in string literals |
| `no-tailwind-default-color` | warn | Tailwind built-in palette classes (e.g. `bg-slate-500`, `text-purple-600`) |

### Activation Status

All 9 app ESLint configs (`apps/*/eslint.config.mjs`) activate the plugin identically:

```js
// apps/merchant-control-plane/eslint.config.mjs (representative)
plugins: { "@letbuyy/ui": uiPlugin },
rules: {
  "@letbuyy/ui/no-raw-elements": "error",
  "@letbuyy/ui/no-hardcoded-hex": "error",
  "@letbuyy/ui/no-raw-form-controls": "warn",
  "@letbuyy/ui/no-raw-color-functions": "warn",
  "@letbuyy/ui/no-tailwind-default-color": "warn",
}
```

Evidence of effectiveness: 0 hardcoded hex values in any *.tsx file across all 9 apps. The `error` severity is working.

**Warning:** ESLint is configured but there are no GitHub Actions CI workflows in `.github/workflows/`. This means ESLint runs only if developers run it locally. There is no automated CI gate blocking PRs with violations.

---

## 3. Stylelint — Configured But Dormant in CI

### What It Would Catch

`.stylelintrc.cjs` declares three rules:

| Rule | Intent |
|---|---|
| `color-no-hex` | Block `#hex` values in CSS outside the token layer |
| `color-named` | Block named colors (`white`, `black`, `red`) |
| `declaration-property-value-disallowed-list` | Block raw `rgba?()` / `hsla?()` in any CSS property |

Exempted: `*token*.css`, `letbuyy-tokens*.css`, `packages/typescript/ui/**`, `config/tailwind/**`.

### Activation Status

`package.json:19` declares the script:
```json
"lint:css": "stylelint \"apps/**/src/**/*.css\" \"packages/**/src/**/*.css\""
```

However:
1. `stylelint` is **not in the root `devDependencies`** (the `.stylelintrc.cjs` comments explicitly say "To activate: `npm i -D stylelint`").
2. There are no CI workflows to execute this script.
3. The `validate-design-system.mjs` validator itself acknowledges this: *"the dormant stylelint config (which governs .css once a human installs the stylelint binary)"* (line 7).

**Verdict: Stylelint is fully dormant.** The 25 hardcoded hex values in `marketing-site/src/app/globals.css` would be caught if stylelint ran, but they are currently ungated.

---

## 4. `validate-design-system.mjs` — Ratchet Without a Baseline

### What It Does

The validator runs two categories of checks:

**HARD invariants (must be zero):**
- App layout using `<DesignSystemRoot>` directly instead of `<LetbuyyThemeProvider>`
- `theme="auto"` in layout files
- Legacy theme storage keys (`letbuyy_theme`, `theme-marketplace-theme`)
- Bespoke theme-provider `createContext` files in apps

**RATCHET invariants (tracked in baseline.json, counts may only decrease):**
- `appCssRawHex` — raw hex in app CSS files
- `appCssNakedRgbHsl` — raw `rgb()/hsl()` in color properties
- `tailwindPaletteClasses` — Tailwind built-in palette class usage
- `appLocalLbTokenRedefs` — `--lb-*:` redefinitions in app CSS
- `rawPxFontSize` — raw px in font-size rules
- `rawPxSpacing` — raw px in padding/margin/gap rules

### Critical Finding: Baseline File is MISSING

Expected path: `scripts/validators/design-system-baseline.json`
File exists: **NO**

The validator's own code path (line 129):
```js
if (!baseline) {
    failures.push('No design-system-baseline.json found. Run with --update to create it.');
}
```

**This means the ratchet has never been seeded.** Running `validate-design-system.mjs` in CI mode currently fails immediately with "No design-system-baseline.json found" — which means either:
(a) It has never been run in CI (consistent with finding no CI workflows), or
(b) It has been run with `--update` locally to suppress the error but that output was never committed.

**Impact:** The governance ratchet cannot enforce any CSS drift reduction until the baseline JSON is committed.

---

## 5. `validate:design-tokens` and Mobile Token Drift Check

`package.json:18`:
```json
"validate:design-tokens": "node scripts/generators/generate-design-tokens.mjs --check"
```

`generate-mobile-tokens.mjs` similarly supports `--check` mode (lines 9-10 of that file). Both are available but not hooked into CI.

---

## 6. Token Redefinition in App CSS

`marketing-site/src/app/globals.css` (5,320 lines) defines a parallel local token set:

```css
:root, [data-theme="light"] {
  --primary: var(--lb-color-primary);       /* OK — aliasing lb tokens */
  --primary-glow: rgba(139, 92, 246, 0.25); /* VIOLATION — raw rgba */
  --accent: rgb(6 182 212);                  /* VIOLATION — raw rgb */
  --bg-deep: rgb(255 255 255);              /* VIOLATION — raw rgb */
  --text-primary: rgb(15 23 42);            /* VIOLATION — raw rgb */
  /* ... ~40 more parallel token definitions */
}
```

This is the only CSS file using raw colors in apps; it does import `letbuyy-tokens.css`:
```css
@import "../../../../config/tailwind/letbuyy-tokens.css";
```

But then defines 40+ local aliases that duplicate a subset of the token system with raw rgb values. This is not caught by any active gate.

---

## 7. Governance Summary Matrix

| Gate | Defined | Activated | CI-enforced | Baseline Committed |
|---|---|---|---|---|
| ESLint `no-hardcoded-hex` (error) | YES | YES (9/9 apps) | NO (no CI workflows) | N/A |
| ESLint `no-raw-elements` (error) | YES | YES (9/9 apps) | NO | N/A |
| ESLint `no-raw-color-functions` (warn) | YES | YES (9/9 apps) | NO | N/A |
| ESLint `no-tailwind-default-color` (warn) | YES | YES (9/9 apps) | NO | N/A |
| Stylelint `color-no-hex` | YES | NO (no binary installed) | NO | N/A |
| Design system ratchet validator | YES | Manual only | NO | **NO — baseline missing** |
| Mobile token drift check | YES | Manual only | NO | N/A |
| Design token CSS drift check | YES | Manual only | NO | N/A |
| GitHub Actions CI pipeline | NO | — | — | — |

**Governance Score: 2/10.**
The governance _infrastructure_ is well-designed: ESLint plugin with 5 rules, stylelint config, a ratchet validator, a drift-check generator. But **nothing runs in CI** (no `.github/workflows/` exist), **the ratchet has no baseline**, and **stylelint is not installed**. The governance is entirely voluntary, enforced only if individual developers remember to run it locally.

---

## 8. Recommended Remediation (observation only — READ-ONLY audit)

Priority order for a human to action:

1. Create `.github/workflows/ci.yml` executing at minimum: `npm run lint` (ESLint), `npm run validate:design-system`, and `npm run validate:design-tokens` on every PR.
2. Run `node scripts/validators/validate-design-system.mjs --update` and commit the resulting `design-system-baseline.json`.
3. Install `stylelint` as a devDependency and add `npm run lint:css` to the CI workflow.
4. Resolve the 25 hardcoded hex violations in `apps/marketing-site/src/app/globals.css` (convert to `var(--lb-*)` references).
5. Commit the generated `letbuyy_color_tokens.dart` to source control with a CI step that fails if `--check` reports drift.
6. Promote the two `[CONSOLIDATE -> @letbuyy/ui]` local workspace components into the shared library.
