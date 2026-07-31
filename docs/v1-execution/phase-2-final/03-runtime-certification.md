# Stream C — Runtime Certification — Report

**Status:** ✅ Contract-level certified (each runtime behavior has a passing test/contract); ❗ LIVE runtime behavior requires the staging stack.

## Certification matrix (code/contract level)
| Runtime behavior | Verified by | Status |
|---|---|---|
| Store creation | gateway `POST /stores` + create-store route; `lb-experience-flow` C-tests | ✅ contract |
| Theme assignment (industry → experience) | `resolveExperienceForIndustry` + gateway auto-apply; `theme-presets` + `lb-experience-flow` tests | ✅ contract |
| Theme draft | `theme-template-editor.test.mjs` (draft upsert by template_key); editor `applyExperience` → `syncPreviewDraft` | ✅ contract |
| Preview | editor preview-session token path (existing); `lb-experience-flow` B-tests | ✅ contract |
| Publish | `publish_theme_release` RPC; `theme-template-editor` publish contract | ✅ contract |
| Theme update / customize | editor settings + `applyChange` → draft; `theme-template-editor` | ✅ contract |
| Theme rollback | `VersionTree` + `rollbackRelease` adapter (`RollbackThemeReleaseSchema`) | ✅ contract |
| Theme versioning | `theme_releases` versioning + draft version checks | ✅ contract |
| Theme rendering (React) | `tests/theme-engine/storefront-liquid-runtime` + `theme-section-registry` + composition-engine | ✅ contract |
| Liquid rendering (canary) | `lb-liquid-l1..l14` (46 tests) + `theme-engine` package suite | ✅ contract |
| Experience apply → both render paths | `applyExperienceToTemplateConfig` writes `themeSettings` + `settings_data.current`; theme-presets tests | ✅ contract |

## Evidence
launch 163/163 · theme-engine package 82/82 · theme-engine source 31/32 (1 pre-existing) · all theme governance validators pass.

## ISSUES REGISTER
1. **Live runtime not exercised** — the matrix certifies the code paths + contracts, not a running store going create→publish→render on staging. That requires the stack (gateway + storefront + Supabase + a store) — not available here. **Gate for production cert.**
2. **1 pre-existing theme-engine source test fails** (`storefront-liquid-runtime` `result.liquid.layoutHtml`) — fails at HEAD, in `composition-engine.tsx` (untouched by any theme phase). Pre-existing, not a Phase-2 regression.
