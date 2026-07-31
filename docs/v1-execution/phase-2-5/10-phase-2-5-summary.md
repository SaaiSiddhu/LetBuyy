# Phase 2.5 — Theme Experience Completion — Summary

**Date:** 2026-06-19 · **Branch:** `stepup/main`
**Verdict: the merchant-facing theme flow now EXISTS in code and is contract-tested + typecheck-clean. It is NOT yet visually certified (no stack) and fonts aren't head-wired → CONDITIONAL GO for Phase 3.**

## The success-criterion flow — wired end to end
`Create Store → Select Industry (onboarding step 3) → See Recommended Experience → [store created with experience auto-applied, server-authoritative] → Theme Editor → Experiences tab → Preview (swatch cards + live iframe) → Apply (no refresh) → Customize (existing settings) → Publish.`

## Stream status
| Stream | Status |
|---|---|
| A Experience Picker | ✅ Wired (editor Experiences tab; 10 experiences; never "Urban Kicks"/"Theme Preset") |
| B Experience Application | ✅ Wired (apply → draft → live preview, both render paths, no refresh) |
| C Industry Onboarding | ✅ Wired (industry select → server auto-apply in gateway; override + Summit fallback) |
| D Font System | 🟡 Tested registry core; `<link>` head-wiring documented (deferred) |
| E Experience Preview | ✅ Card preview + live iframe; live per-experience screenshots need stack |
| F LetBuyy Core | 🟡 Alias + Core fixture done; editor default renamed; runtime activation deferred (safe) |
| G Visual Certification | ✅ Deterministic spec cert (all 10) + gallery; ❗ live pixel cert needs stack |
| H Governance | ✅ All validators pass; zero new drift; frozen files untouched |
| I Regression | ✅ 163/163 launch · 82/82 theme-engine · 31/32 source (1 pre-existing) |
| J Documentation | ✅ this doc set |

## Files changed (Phase 2.5)
**NEW:** `ExperiencePicker.tsx` (merchant-control-plane); `experience-fonts.ts` + `test/experience-fonts.test.ts` (theme-engine); `tests/launch/lb-experience-flow.test.mjs`; `docs/v1-execution/phase-2-5/*`.
**EDIT:** editor `page.tsx` (Experiences tab + apply + theme-name fix); onboarding `page.tsx` (industry step); gateway `stores.ts` (experience auto-apply); theme-engine `index.ts` (font barrel export).

## Evidence
```
launch suite        : 163/163 pass   (new lb-experience-flow = 7)
theme-engine suite  : 82/82 pass     (new font tests = 6)
typechecks          : theme-engine ✅ merchant-control-plane ✅ api-gateway ✅ identity-platform ✅
governance          : theme-governance ✅ no-new-react ✅ package-export ✅ undeclared-import ✅
                      dependency-graph ✅ circular-import ✅ anti-fabrication ✅ migration-safety ✅
design-system       : zero new drift (tsxRawHex 0)
frozen theme-registry.ts : untouched
```

## Scores (honest)
| Metric | Before | After | Why not higher |
|---|---|---|---|
| **Theme readiness** | ~85% | **~90%** | Flow wired + font core; but font `<link>` not head-wired, no live visual verification, 5/10 experiences need a designer pass, section auto-order is an optional enhancement. |
| **Platform readiness** | 90–91% | **~92%** | Merchant theme flow exists at the code level; visual certification + font fidelity remain. |

## Remaining to reach a true 95% / "visually certified"
1. **Font head-wiring** (2 documented edits: React `layout.tsx` + Liquid `theme-renderer.ts` head) + cross-device check.
2. **Live visual verification** on the full stack (gateway + storefront + Supabase + per-experience stores): desktop/tablet/mobile × draft/published/preview.
3. **Designer review** of the 5 `designed` experiences (Aura, Ride, Dawn, Bloom, Nova).
4. **(Optional) Core runtime activation** — switch compile/fallback paths to the Core fixture + the additive `letbuyy-core` DB alias row (sequence with the WIP migration cleanup).

## Recommendation: CONDITIONAL GO for Phase 3
The flow is wired and verified at the code level (typecheck + contract tests + no regression + governance-clean). Phase 3 may proceed in parallel. The "no-developer theme flow, visually certified at 95%" claim should not be made until items 1–3 land on the running stack — those are small, well-specified follow-ups, not new design work.
