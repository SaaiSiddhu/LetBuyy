# Design System Adoption Scorecard — Phase 1.5

**Date:** 2026-06-09 · read-only · scores calculated from the measurement pass + ownership traces.
**Scoring basis (0–100):** Theme = provider wired (verified 9/9). Navigation = canonical shell adoption. Typography/Spacing = measured token÷(token+raw) adoption %. Components = DS file-adoption adjusted for fork density. Dark Mode = color tokenization % (won't-theme inventory). Overall = mean of populated dimensions.

## Per-app scorecard (current)

| App | Theme | Navigation | Typography | Spacing | Components | Dark Mode | **Overall** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| platform-operations-portal | 100 | 85 | 100 | 100 | 50 | 84 | **87** |
| platform-console | 100 | 85 | 100 | 100 | 50 | 61 | **83** |
| theme-marketplace | 100 | 20 | 84 | 97 | 50 | 63 | **69** |
| merchant-control-plane | 100 | 35 | 72 | 57 | 55 | 72 | **65** |
| developer-portal | 100 | 20 | 58 | 90 | 45 | 56 | **62** |
| app-marketplace | 100 | 15 | 12 | 1 | 40 | 56 | **37** |
| identity-platform | 100 | — | 3 | 12 | 30 | 11 | **31** |
| storefront-runtime | 100 | 20 | 4 | 17 | 30 | 3 | **29** |
| marketing-site | 100 | 15 | 0 | 0 | 25 | 1 | **24** |
| **mobile/merchant-app** | 60 | — | 0 | 6 | 30 | 70 | **33** |
| **PLATFORM (web mean)** | **100** | **37** | **55** | **50** | **42** | **46** | **54** |

## Current vs Target vs Gap

| App | Current | Target (Phase 2/3) | Gap |
|---|:---:|:---:|:---:|
| platform-operations-portal | 87 | 95 | 8 |
| platform-console | 83 | 95 | 12 |
| theme-marketplace | 69 | 92 | 23 |
| merchant-control-plane | 65 | 95 | 30 |
| developer-portal | 62 | 92 | 30 |
| app-marketplace | 37 | 90 | **53** |
| identity-platform | 31 | 90 | **59** |
| storefront-runtime | 29 | 90 | **61** |
| marketing-site | 24 | 90 | **66** |
| mobile/merchant-app | 33 | 90 | **57** |
| **PLATFORM** | **~52** | **92** | **~40** |

## Reading the scorecard
- **Theme is solved (100 across the board)** — the recovery's keystone holds. Every other dimension is an *adoption* gap, which is exactly why the platform still feels inconsistent.
- **Bimodal distribution.** Internal-ops apps (console 83, ops 87, merchant 65, theme 69, developer 62) cluster high; customer-facing apps (app-marketplace 37, identity 31, storefront 29, marketing 24) cluster low. The gap between the best (87) and worst (24) web app is **63 points** — the platform is two design cultures sharing one token file.
- **Components is the universal weak dimension** (platform 42) — even the high scorers (console/ops 50) run forked `_local-ui` kits inside the canonical shell.
- **Biggest gaps to close:** marketing-site (66), storefront-runtime (61), identity-platform (59), mobile (57), app-marketplace (53). These five own ~80% of the remaining debt.

See `DESIGN_SYSTEM_PHASE2_MASTER_PLAN.md` for the ranked debt list and the roadmap that moves the platform mean from ~52 to ~92.
