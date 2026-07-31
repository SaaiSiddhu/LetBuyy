# Phase 2 — Testing Report (Stream H)

**Status:** ✅ No Phase-2 regressions. New foundation fully covered by behavioral tests.

## New tests (behavioral — import the real engine)
- `packages/theme-engine/test/theme-presets.test.ts` — 14 tests (preset engine + 10 experiences + industry map): registry integrity, schema accept/reject, dual-font overlay, merge/replace, template-config dual-path + no-mutation, export/import round-trip, industry resolution incl. the Harvest→Refresh fix, fallback + override.
- `packages/theme-engine/test/theme-bundle-core.test.ts` — 6 tests (Core fixture valid + de-branded + structure-preserving; Urban Kicks fixture unchanged; alias resolver).

## Results
| Suite | Result |
|---|---|
| theme-engine package suite (`tsx --test test/*.test.ts`) | **76 / 76 pass** (20 new + 56 existing) |
| theme-engine typecheck (`tsc --noEmit`) | **clean (exit 0)** |
| Full launch suite (`node --test tests/launch/*.test.mjs`) | **156 / 156 pass** (no regression) |
| theme-engine source tests (`tests/theme-engine/*.test.mjs`) | 31 / 32 — the **1 failure is pre-existing** (composition-engine `result.liquid.layoutHtml`, fails at HEAD, file untouched by Phase 2) |
| `lb-liquid-l1..l14` + `lb1/lb2` (via the launch suite) | all pass |

## Coverage of the mission's regression list
Theme runtime, storefront runtime, theme editor (contract), publishing/drafts/preview (contract), policies, customers, orders, collections, products, search, cart — all covered by the existing launch + theme-engine suites, which remain green. Phase-2 changes touched only the theme-engine package (new files + one barrel line), so these surfaces are unaffected (verified by the full launch suite).

## Verification boundary (honest)
Tests assert engine behavior + contracts + no regression. They do **not** assert the merchant-facing UI flow (editor picker, onboarding industry step) — that wiring is documented (Streams E/F) but not built, and would require the full local stack (gateway + storefront + Supabase + a store) to verify visually.
