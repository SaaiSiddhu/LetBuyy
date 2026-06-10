# THEME COMPLIANCE REPORT
### Wave 4 — Theme Recovery · 2026-06-09 · IMPLEMENTATION (partial applied) · architecture FROZEN

> Verification: edits are inspection-verified, not compiled here (see `SECURITY_EXECUTION_REPORT` preamble). Frozen target: `IDENTITY_RECOVERY_ENHANCEMENT/THEME_FORENSICS`-aligned, 100% token-driven.

## APPLIED this wave
| Fix | Evidence | LOC | Risk |
|---|---|--:|:--:|
| **TH-1 — undefined `--purple` defined (broken color in BOTH themes → fixed)** | `apps/identity-platform/src/app/globals.css:11-17` now defines `--purple: var(--primary)` (theme-aware via `--lb-color-primary`, no hardcoded color); consumed at `:216,531` (`.auth-info`, onboarding icon hover) — verified both now resolve | +4 / −0 | **Low** (defines a previously-broken token; no behavior change elsewhere) |

Result: the live broken-token rendering bug (`.auth-info` text on the lookup page) is resolved without introducing a hardcoded color, and it now responds to light/dark via the brand primary token.

## SPEC / deferred (build-risky — staged, not applied blind)
These require deleting/rewriting the 1,986-line shadow stylesheet, which cannot be compile-verified in this sandbox; doing them blind would risk breaking the build (violating "leave buildable"). They are sequenced in `IDENTITY_IMPLEMENTATION_WAVES.md` Wave 2/4 and detailed in `IDENTITY_DESIGN_SYSTEM_ENFORCEMENT.md §3`:
- Remove the parallel hand-written `.dark` block + 14 `.dark` selectors (`globals.css:31-40,267,…`); source dark values from `--lb-*`.
- Replace hardcoded `rgb(5 8 16)` body bg (`:1108`) and `rgb(10 15 26)` in `layout.tsx:102` with tokens.
- Tokenize the 60 `rgb()`/426 `px`/77 `font-size` literals as pages convert off the shadow sheet.

## Theme compliance status
- **Blockers cleared this wave:** 1 of 6 (the only one that was a *live rendering bug* and safely fixable in isolation).
- **Remaining blockers:** 5 (parallel `.dark`, two hardcoded bg literals, rgba overlays, mixed namespaces) — all mechanical, all ride along with the Wave 2 page conversion.
- **Can the app be 100% token-driven? YES** — no architectural blocker (provider/tokens/lint exist); remaining work is removing the hand-maintained escapes during conversion.

## Human-required blockers
None for theme. (The conversion itself needs a human build/visual-diff loop, not a human decision.)
