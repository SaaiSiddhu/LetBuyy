# THEME FORENSICS REPORT
### Phase 11 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY

## THEME GOVERNANCE SCORE: **62 / 100**

## 0. Verdict

Theming is **real and correctly wired** — a pre-paint `ThemeScript`, the canonical `LetbuyyThemeProvider surface="identity"`, and a well-reasoned `useAuthTheme` hook that routes the toggle through the provider (not a raw `.dark` class). Light and dark are genuinely reachable end-to-end. The problems are **leakage**, not breakage: a parallel hand-written `.dark` block, hardcoded magic background colors outside the token system, and an **undefined theme token (`--purple`) that renders broken in both modes**. These live outside `@letbuyy/ui` and must be maintained by hand, defeating single-source-of-truth theming.

---

## 1. Real theming infrastructure (the part that's right)

- `ThemeScript` (pre-paint) + `LetbuyyThemeProvider surface="identity"` (`src/app/layout.tsx:98,106`).
- **`useAuthTheme.ts` is exemplary:** routes the toggle through `useTheme().setTheme` rather than toggling `.dark` directly, with a documented rationale (the old direct-toggle left `@letbuyy/ui` components on a stale theme — `useAuthTheme.ts:9-13`) and a hydration-mismatch guard via a `mounted` flag (`:27-31`).
- Inline pre-paint background via `--lb-color-bg` (`layout.tsx:99-103`).
- Turnstile widget uses `theme:'auto'` (`TurnstileWidget.tsx:71`); `OAuthBrandIcon` glyph fills use `--lb-color-*` (`OAuthBrandIcon.tsx:33-45`). Theme-aware. ✅

---

## 2. Leakage & duplication (file:line)

| # | Issue | Evidence | Effect |
|---|---|---|---|
| T1 | **Parallel `.dark` namespace** — hand-redefines `--bg`,`--text-primary`,`--border`,`--input-bg` with raw `rgb()` | `globals.css:31-40` (+14 hand-written `.dark` selectors at `:31,267,271,978,1107,1123,1214,1291,1303,1312,1447,1653-1655`) | duplicates the DS `.dark`/`--lb-*` layer; must be hand-maintained |
| T2 | **Hardcoded dark-only body bg, no token, no light pair** | `globals.css:1108` `.dark body { background: rgb(5 8 16) }` | invisible to the DS theme; magic value |
| T3 | **`rgb(10 15 26)` literal in TSX** as `--lb-color-bg` fallback | `layout.tsx:102` | hardcoded dark value in markup |
| T4 | **Undefined `--purple` → broken color in BOTH themes** | consumed `globals.css:212,527`; defined **nowhere** (grep) | `.auth-info` (live at `lookup:543`) and onboarding icon hover fall back to invalid/inherited color |
| T5 | **Hardcoded translucent overlays that don't theme** | `.auth-error` `rgba(239,68,68,0.08)` (`:476`), `.auth-info` `rgba(99,102,241,0.08)` (`:526`), `.auth-success-badge` (`:287`), focus ring (`:1714`) | fixed regardless of theme; `.dark` variants separately hand-patched |
| T6 | **Mixed token namespaces in one string** — local `--text-hint` in Suspense fallbacks vs `--lb-*` elsewhere | `reset-password:270`, `check-email:216`, `login:369`, `lookup:630` | the two token systems coexist uneasily |

---

## 3. Is dark mode real / reachable?

**Yes.** Unlike a dead-theme scenario, light/dark is fully wired and the toggle works through the provider; colors come from the `data-theme`/class the `ThemeScript` sets pre-paint. The defects are **maintainability leaks** (hand-coded `.dark` blocks, the `rgb(5 8 16)` body bg, the undefined `--purple`) sitting outside the token system — not an unreachable or broken theme.

---

## 4. Recommendation (analysis-only)
Delete the parallel `.dark` block and the `rgb(5 8 16)`/`rgb(10 15 26)` magic values, sourcing all of it from `--lb-color-*`; define or remove `--purple` (T4 is a live rendering bug); move the translucent state-surface colors into themed tokens. Net: the theme *engine* is a strength to build on — the work is removing the ~16 hand-maintained color escapes that the shadow stylesheet introduced (cross-ref Phase 9).
