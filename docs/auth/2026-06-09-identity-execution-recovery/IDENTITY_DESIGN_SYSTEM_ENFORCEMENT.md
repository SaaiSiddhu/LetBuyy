# IDENTITY DESIGN SYSTEM ENFORCEMENT
### Phase 3 — Execution Recovery · 2026-06-09 · ANALYSIS-ONLY
### Parts 4 & 5: `@letbuyy/ui` compliance + light/dark token forensics

## 1. Compliance scorecard (measured this pass)

| Metric | Current | Target | Evidence |
|---|--:|--:|---|
| Hex colors in `.tsx` | 0 | 0 | lint `no-hardcoded-hex: error` works |
| Raw Tailwind color classes in `.tsx` | 0 | 0 | lint `no-tailwind-default-color` |
| **DS components rendered `unstyled`** | **76** (~81% of Buttons+Inputs) | 0 | `grep unstyled src/app` = 76 |
| **Inline `style={{}}`** | **42** | 0 | `src/app/**` |
| **Shadow stylesheet** `globals.css` | **1,986 LOC** | ≤ ~300 (identity-specific only) | `wc -l` |
| Raw `px` in CSS | 426 | 0 (tokens) | `globals.css` |
| `rgb()/rgba()` in CSS | 60 | 0 (tokens) | `globals.css` |
| `var(--lb-*)` refs in `.tsx` | 33 | (all styling) | grep |
| Undefined token `--purple` | 2 | 0 | `globals.css:212,527` |
| DS-native pages | 4 / 10 | 10 / 10 | forgot/reset/set/check-email |

### Overall design-system compliance: **~45% → target ≥ 95%**
**Method (transparent):** the infrastructure layer scores high (~80) — real `@letbuyy/ui` v1.0.0 dependency (`package.json:17`), `LetbuyyThemeProvider`+`ThemeScript` (`layout.tsx:98,106`), canonical tokens, and **enforced ESLint** (`eslint.config.mjs:11-22`). The **adoption** layer scores low (~25–30): 81% of DS components are `unstyled`, a 1,986-line shadow sheet provides the actual visuals, spacing/typography are ~0% tokenized, and 6 of 10 pages are non-compliant. Weighted ≈ **45%**. The number rises automatically as the UI-recovery conversion (`IDENTITY_UI_RECOVERY_PLAN`) proceeds.

---

## 2. Violations by category (file:line)
- **Raw controls via the `unstyled` loophole** — `<Button unstyled className="auth-btn-primary">` (`login:245,332`; `signup:515,587`), `<Input unstyled className="auth-otp-input">` (`signup:570`), 76 total. This is the central violation: it keeps lint green while a second design system does the styling.
- **Custom/inline CSS** — 42 `style={{}}` (onboarding 33: `:884-1023`); the 1,986-LOC `globals.css` shadow system.
- **Hardcoded spacing/typography** — 426 `px`, 77 `font-size:` in `globals.css` (DS `--lb-space-*`/type scale bypassed).
- **Parallel token namespace** — `--text-primary`/`--bg-secondary`/`--text-hint`/`--input-bg` defined with raw `rgb()` in `globals.css:5-40`, separate from canonical `--lb-color-*` (confirmed absent from `config/tailwind/letbuyy-tokens.css`).
- **Orphan/undefined** — `.auth-label`/`.auth-input` used (`onboarding:885,950`) but never defined; `--purple` consumed (`:212,527`) but never defined.

---

## 3. Light/Dark mode forensics (Part 5)

**Infrastructure is real and correct:** `ThemeScript` (pre-paint) + `LetbuyyThemeProvider surface="identity"` (`layout.tsx:98,106`); `useAuthTheme.ts` routes the toggle through `useTheme().setTheme` with a documented hydration guard (`:27-31`) — not a raw `.dark` hack. Light/dark/system are genuinely reachable.

**Blockers to "fully token-driven" (every one must clear):**
| Blocker | Evidence | Fix |
|---|---|---|
| Parallel hand-written `.dark` block (+14 `.dark` selectors) duplicating the DS theme | `globals.css:31-40,267,…,1655` | delete; source from `--lb-*` |
| Hardcoded dark-only body bg `rgb(5 8 16)` (no token, no light pair) | `globals.css:1108` | tokenize |
| Hardcoded `rgb(10 15 26)` in TSX (layout bg fallback) | `layout.tsx:102` | `--lb-color-bg` |
| **Undefined `--purple` → broken color in both themes** | `globals.css:212,527` (live at `lookup:543`) | define or remove |
| Hardcoded translucent `rgba()` state overlays (error/info/success/focus) | `globals.css:476,526,287,1714` | themed tokens |
| Mixed namespaces in one string (local `--text-hint` vs `--lb-*`) | `reset:270`, `check-email:216`, `login:369`, `lookup:630` | collapse to `--lb-*` |

**Can the identity app become fully token-driven? — YES**, and it is a bounded job: there are no architectural blockers (the provider/tokens/lint already exist), only the ~16 hand-maintained color escapes above + the 426 px / 77 font-sizes in the shadow sheet. Clearing them is mechanical and rides along with the UI-recovery conversion.

---

## 4. Enforcement plan (make compliance non-regressing)
| Control | Action | Wave |
|---|---|---|
| Promote 3 `warn` rules → **`error`** | `no-raw-form-controls`, `no-raw-color-functions`, `no-tailwind-default-color` (`eslint.config.mjs:14-22`) | 2 (after conversion clears existing warns) |
| New lint rule | **ban `unstyled` on DS components** in the identity surface | 2 |
| Stylelint | ban raw `hex`/`rgb()`/`px` in app CSS; require `--lb-*` | 2 |
| CI budget gate | `globals.css` line count **may not increase** (forces monotonic shrink) | 2 |
| a11y CI | axe on every identity surface → WCAG 2.1 AA | 2 |
| Token-coverage check | fail if a non-`--lb-` color custom property is introduced | 2 |

> Per `IDENTITY_GOVERNANCE_MODEL §5`, these gates are what prevent the shadow design system from regrowing after Wave 2 cleans it up. Compliance % is a **release gate**, not a report: clients do not federate against an identity surface below the target.
