# Stream G — Regression — Report

**Status:** ✅ No theme-platform regressions.

## Pass/fail matrix
| Suite / check | Result |
|---|---|
| Launch suite (`tests/launch/*.test.mjs`) | ✅ **163 / 163** |
| theme-engine package (`tsx --test test/*.test.ts`) | ✅ **82 / 82** |
| theme-engine source (`tests/theme-engine/*.test.mjs`) | 🟡 31 / 32 (1 **pre-existing** — `storefront-liquid-runtime` `layoutHtml`, fails at HEAD) |
| Liquid L1–L14 + storefront LB-1/LB-2 (within launch) | ✅ all pass |
| `lb-experience-flow` (picker/apply/onboarding/gateway) | ✅ 7 / 7 |
| TypeScript: theme-engine | ✅ clean |
| TypeScript: merchant-control-plane / api-gateway / identity-platform | ✅ clean (Phase 2.5; no code changed since) |
| Customer / order / checkout / domain / auth contracts (lb3/lb5/lb6/lb7/lb9/lb10/lb11/lb12/lb13 + liquid auth/account/orders) | ✅ all within the 163 |

## Coverage of the mission's regression list
Theme · launch · storefront · editor (contract) · customer · product · collection · checkout · domain · auth — all covered by the launch + theme-engine + contract suites, all green (1 pre-existing failure unrelated to any theme phase).

## Verification boundary
Tests assert engine behavior + contracts + no regression. They do not assert rendered UX (picker/onboarding/storefront visuals) — that needs the staging stack (Stream D gate).
