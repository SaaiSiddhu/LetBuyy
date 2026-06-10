# DESIGN SYSTEM COMPLIANCE REPORT
### Phase 9 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY
### Compliance target: `@letbuyy/ui`

## DESIGN-SYSTEM COMPLIANCE SCORE: **50 / 100**
**(Infrastructure ≈ 80 · Actual adoption ≈ 45)**

## 0. Verdict

`@letbuyy/ui` **exists** (`packages/typescript/ui/`, v1.0.0, with Storybook, `tokens.json`, codemods, and an ESLint plugin) and **is a workspace dependency** of the identity app (`apps/identity-platform/package.json:17` → `"@letbuyy/ui": "workspace:*"`). The provider, tokens, and lint governance are all real and wired. The failure is **incomplete migration**: an `unstyled` escape hatch on DS components (used **76×**) lets a **1,984-line shadow stylesheet** with a **parallel token namespace** do the actual styling — and the lint rules can't see it.

---

## 1. What is compliant (the foundation, ≈80)

- **Theme provider:** `LetbuyyThemeProvider surface="identity"` + `ThemeScript` from `@letbuyy/ui` (`src/app/layout.tsx:3,98,106`).
- **Tokens:** canonical token layer imported via `globals.css:2` → `config/tailwind/letbuyy-tokens.css` (maps `--lb-color-*` to utilities).
- **Lint governance is enforced** (`apps/identity-platform/eslint.config.mjs:11-22`):
  - `@letbuyy/ui/no-raw-elements: "error"`
  - `@letbuyy/ui/no-hardcoded-hex: "error"`
  - `@letbuyy/ui/no-raw-form-controls: "warn"`  ← only warn
  - `@letbuyy/ui/no-raw-color-functions: "warn"`  ← only warn
  - `@letbuyy/ui/no-tailwind-default-color: "warn"`  ← only warn

Result: **0 hex colors and 0 raw Tailwind color classes in `.tsx`** — the `error`-level rules genuinely work.

---

## 2. What is non-compliant (the adoption, ≈45)

### The `unstyled` bypass loophole (the core finding)
DS components are imported, then neutered with `unstyled`, so the shadow CSS skins them:
- `<Button>` total/unstyled = **79 / 67 (85%)**; `<Input>` = **15 / 9 (60%)**. Examples: `login:245,332`, `signup:515,587,570`, `lookup:484,498`, `select:194,209`, `onboarding:676,806,893`.
- Because `unstyled` keeps it a "DS component," it **passes `no-raw-form-controls`** while `.auth-*` CSS provides 100% of the visuals. The linter reports green over a second design system.

### Hardcoded-value census (grep + wc)
| Category | Count | Where |
|---|---:|---|
| Hex in `.tsx` | 0 | enforced |
| Raw Tailwind colors in `.tsx` | 0 | enforced |
| `rgb()/hsl()` literals in `.tsx` | 1 | `layout.tsx:102` |
| Inline `style={{…}}` in `.tsx` | 40 (4 files) | onboarding 33, login 2, lookup 2, select 1 |
| `rgb()/rgba()` in `globals.css` | 58 | `:21-39,476,1108…` |
| Hardcoded `px` in `globals.css` | **424** | pervasive |
| `font-size:` (all hardcoded px) in `globals.css` | **77** | `:91,110,298…` |
| `--lb-*` token refs in `globals.css` | 6 | minimal |
| Local-token refs (`--text-*`,`--bg-*`,`--primary`) | 160 | the parallel namespace |

### Two parallel token namespaces
The app defines **its own** tokens — `--text-primary`, `--bg-secondary`, `--text-hint`, `--input-bg` — with raw `rgb()` values in `globals.css:5-40`, **separate from** the canonical `--lb-color-*`. Confirmed: `--text-primary`/`--bg-secondary`/`--text-hint` are **not** defined in `config/tailwind/letbuyy-tokens.css`. Only a handful bridge to `--lb-*` (`globals.css:11-18`).

### Orphan / undefined tokens & classes
- `.auth-label` (used `onboarding:885,908,948`) and `.auth-input` (used on a `<textarea>` `onboarding:950`) are **never defined** → unstyled render.
- `var(--purple)` consumed (`globals.css:212,527`) but **never defined** → broken color in both themes (`.auth-info` renders live at `lookup:543`).

---

## 3. Compliance by token category

| Category | Through `@letbuyy/ui`? | Notes |
|---|:--:|---|
| Color | ~100% in `.tsx`, ~73% in CSS | shadow sheet uses local rgb namespace |
| Spacing | **~0% in shadow CSS** | 424 raw px; `--lb-space-*` bypassed |
| Typography | **~0% in shadow CSS** | 77 hardcoded font-sizes |
| Radius / shadow | partial | DS pages use `--lb-radius-*`; shadow pages hardcode |
| Motion | minimal | not tokenized in shadow sheet |
| Dark/Light | real provider, but leakage | Phase 11 |

---

## 4. Recommendation (analysis-only)
The fix is not "adopt a design system" — it's **finish the migration and close the loophole**: promote the three `warn` rules to `error`, add a lint rule that flags `unstyled` on DS components in the auth surface, delete the shadow `.auth-*` classes as pages convert (the 4 DS-native pages prove the target pattern), collapse the parallel token namespace into `--lb-*`, and define-or-remove the `--purple`/`.auth-label`/`.auth-input` orphans. This is governance that is *real but unfinished*, not absent.
